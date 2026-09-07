import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE organizer (
      id uuid PRIMARY KEY,
      kind text NOT NULL DEFAULT 'guest' CHECK (kind IN ('guest', 'registered')),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'merged')),
      merged_into_organizer_id uuid REFERENCES organizer(id) ON DELETE RESTRICT,
      email text,
      password_hash text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (
        (status = 'merged' AND merged_into_organizer_id IS NOT NULL AND email IS NULL AND password_hash IS NULL)
        OR
        (status = 'active' AND merged_into_organizer_id IS NULL AND (
          (kind = 'guest' AND email IS NULL AND password_hash IS NULL)
          OR (kind = 'registered' AND email IS NOT NULL AND password_hash IS NOT NULL)
        ))
      )
    );
    CREATE UNIQUE INDEX organizer_email_unique ON organizer (lower(email)) WHERE email IS NOT NULL;

    CREATE TABLE organizer_credential (
      id uuid PRIMARY KEY,
      organizer_id uuid NOT NULL REFERENCES organizer(id) ON DELETE CASCADE,
      token_hash bytea NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      last_used_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE account_session (
      id uuid PRIMARY KEY,
      organizer_id uuid NOT NULL REFERENCES organizer(id) ON DELETE CASCADE,
      token_hash bytea NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      last_used_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE survey (
      id uuid PRIMARY KEY,
      organizer_id uuid NOT NULL REFERENCES organizer(id) ON DELETE CASCADE,
      public_token text NOT NULL UNIQUE,
      title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
      intro text NOT NULL DEFAULT '' CHECK (length(intro) <= 2000),
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'archived')),
      access_code_hash text,
      min_report_responses smallint NOT NULL DEFAULT 2 CHECK (min_report_responses BETWEEN 1 AND 50),
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX survey_organizer_status_updated_idx ON survey (organizer_id, status, updated_at DESC);

    CREATE TABLE question (
      id uuid PRIMARY KEY,
      survey_id uuid NOT NULL REFERENCES survey(id) ON DELETE CASCADE,
      position smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
      prompt text NOT NULL CHECK (length(btrim(prompt)) BETWEEN 1 AND 1000),
      required boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (survey_id, position)
    );
    CREATE INDEX question_survey_position_idx ON question (survey_id, position);

    CREATE TABLE response_session (
      id uuid PRIMARY KEY,
      client_session_id uuid NOT NULL UNIQUE,
      survey_id uuid NOT NULL REFERENCES survey(id) ON DELETE CASCADE,
      session_token_hash bytea NOT NULL UNIQUE,
      public_label text NOT NULL,
      status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'transcribing', 'ready', 'submitted', 'failed')),
      consent_version text NOT NULL CHECK (length(btrim(consent_version)) BETWEEN 1 AND 64),
      expires_at timestamptz NOT NULL,
      submitted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (survey_id, public_label),
      CHECK ((status = 'submitted' AND submitted_at IS NOT NULL) OR (status <> 'submitted' AND submitted_at IS NULL))
    );
    CREATE INDEX response_session_survey_status_submitted_idx ON response_session (survey_id, status, submitted_at);

    CREATE TABLE answer (
      id uuid PRIMARY KEY,
      response_session_id uuid NOT NULL REFERENCES response_session(id) ON DELETE CASCADE,
      question_id uuid NOT NULL REFERENCES question(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
      final_text text NOT NULL CHECK (length(final_text) <= 10000),
      input_mode text NOT NULL CHECK (input_mode IN ('text', 'voice')),
      audio_status text NOT NULL DEFAULT 'not_used' CHECK (audio_status IN ('not_used', 'streamed_and_discarded', 'failed_and_discarded')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (response_session_id, question_id)
    );
    CREATE INDEX answer_response_question_idx ON answer (response_session_id, question_id);

    CREATE TABLE report_request (
      id uuid PRIMARY KEY,
      survey_id uuid NOT NULL REFERENCES survey(id) ON DELETE CASCADE,
      instruction text NOT NULL CHECK (length(btrim(instruction)) > 0),
      snapshot_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'preparing', 'analyzing', 'validating', 'completed', 'failed')),
      completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR (status <> 'completed' AND completed_at IS NULL))
    );
    CREATE INDEX report_request_survey_created_idx ON report_request (survey_id, created_at DESC);

    CREATE TABLE agent_run (
      id uuid PRIMARY KEY,
      survey_id uuid NOT NULL REFERENCES survey(id) ON DELETE CASCADE,
      report_request_id uuid REFERENCES report_request(id) ON DELETE CASCADE,
      run_type text NOT NULL CHECK (run_type IN ('survey_creation', 'report')),
      status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
      model_provider text NOT NULL,
      model_id text NOT NULL,
      started_at timestamptz,
      completed_at timestamptz,
      error_code text,
      usage jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((run_type = 'report' AND report_request_id IS NOT NULL) OR (run_type = 'survey_creation' AND report_request_id IS NULL))
    );
    CREATE INDEX agent_run_report_request_created_idx ON agent_run (report_request_id, created_at DESC);

    CREATE TABLE agent_event (
      id uuid PRIMARY KEY,
      agent_run_id uuid NOT NULL REFERENCES agent_run(id) ON DELETE CASCADE,
      sequence integer NOT NULL CHECK (sequence > 0),
      event_type text NOT NULL,
      tool_name text,
      duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
      safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (agent_run_id, sequence)
    );
    CREATE INDEX agent_event_run_sequence_idx ON agent_event (agent_run_id, sequence);

    CREATE TABLE report (
      id uuid PRIMARY KEY,
      report_request_id uuid NOT NULL UNIQUE REFERENCES report_request(id) ON DELETE CASCADE,
      schema_version text NOT NULL,
      markdown text NOT NULL,
      eligible_response_count integer NOT NULL CHECK (eligible_response_count >= 0),
      limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE finding (
      id uuid PRIMARY KEY,
      report_id uuid NOT NULL REFERENCES report(id) ON DELETE CASCADE,
      position smallint NOT NULL CHECK (position > 0),
      title text NOT NULL,
      category text NOT NULL,
      summary text NOT NULL,
      support_count integer NOT NULL CHECK (support_count >= 0),
      support_percent numeric(5,2) NOT NULL CHECK (support_percent BETWEEN 0 AND 100),
      confidence text NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
      suggested_action text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (report_id, position)
    );

    CREATE TABLE theme_assignment (
      finding_id uuid NOT NULL REFERENCES finding(id) ON DELETE CASCADE,
      response_session_id uuid NOT NULL REFERENCES response_session(id) ON DELETE CASCADE,
      question_id uuid NOT NULL REFERENCES question(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
      reason text NOT NULL,
      validated boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (finding_id, response_session_id)
    );

    CREATE TABLE evidence (
      id uuid PRIMARY KEY,
      finding_id uuid NOT NULL REFERENCES finding(id) ON DELETE CASCADE,
      answer_id uuid NOT NULL REFERENCES answer(id) ON DELETE CASCADE,
      safe_excerpt text NOT NULL,
      public_response_label text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX evidence_finding_created_idx ON evidence (finding_id, created_at);

    CREATE TABLE idempotency_operation (
      id uuid PRIMARY KEY,
      scope_kind text NOT NULL CHECK (scope_kind IN ('organizer', 'public_survey')),
      scope_id uuid NOT NULL,
      operation text NOT NULL,
      key_hash bytea NOT NULL,
      request_hash bytea NOT NULL,
      resource_id uuid NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (scope_kind, scope_id, operation, key_hash)
    );
    CREATE INDEX idempotency_operation_expiry_idx ON idempotency_operation (expires_at);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS idempotency_operation;
    DROP TABLE IF EXISTS evidence;
    DROP TABLE IF EXISTS theme_assignment;
    DROP TABLE IF EXISTS finding;
    DROP TABLE IF EXISTS report;
    DROP TABLE IF EXISTS agent_event;
    DROP TABLE IF EXISTS agent_run;
    DROP TABLE IF EXISTS report_request;
    DROP TABLE IF EXISTS answer;
    DROP TABLE IF EXISTS response_session;
    DROP TABLE IF EXISTS question;
    DROP TABLE IF EXISTS survey;
    DROP TABLE IF EXISTS account_session;
    DROP TABLE IF EXISTS organizer_credential;
    DROP TABLE IF EXISTS organizer;
  `);
}
