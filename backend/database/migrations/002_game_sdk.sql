BEGIN;
ALTER TABLE app.games ADD COLUMN sdk_metadata jsonb
  CHECK (sdk_metadata IS NULL OR jsonb_typeof(sdk_metadata) = 'object');
CREATE UNIQUE INDEX games_sdk_identity ON app.games
  ((sdk_metadata->>'packageId'), (sdk_metadata->>'modeId'), (sdk_metadata->>'rulesVersion'))
  WHERE sdk_metadata IS NOT NULL;
GRANT SELECT(sdk_metadata) ON app.games TO ai_view_owner;
CREATE OR REPLACE VIEW ai_read.games AS
  SELECT id, name, score_unit, ranking_direction, min_value, max_value, is_active, sdk_metadata FROM app.games;
COMMIT;
