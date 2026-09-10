import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE question DROP CONSTRAINT question_position_check;
    ALTER TABLE question ALTER COLUMN position TYPE integer;
    ALTER TABLE question ADD CONSTRAINT question_position_check CHECK (position > 0);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Refuse rollback if longer surveys exist; never discard their questions.
  pgm.sql(`
    ALTER TABLE question DROP CONSTRAINT question_position_check;
    ALTER TABLE question ADD CONSTRAINT question_position_check CHECK (position BETWEEN 1 AND 5);
    ALTER TABLE question ALTER COLUMN position TYPE smallint;
  `);
}
