import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE report
      ADD COLUMN minority_views jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN follow_up_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD CONSTRAINT report_minority_views_array CHECK (jsonb_typeof(minority_views) = 'array'),
      ADD CONSTRAINT report_follow_up_questions_array CHECK (jsonb_typeof(follow_up_questions) = 'array');
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE report
      DROP CONSTRAINT IF EXISTS report_follow_up_questions_array,
      DROP CONSTRAINT IF EXISTS report_minority_views_array,
      DROP COLUMN IF EXISTS follow_up_questions,
      DROP COLUMN IF EXISTS minority_views;
  `);
}
