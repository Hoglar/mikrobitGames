-- Run once on an empty database with the separate migration administrator.
-- backend_app and ai_reader LOGIN roles are provisioned outside migrations.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ai_view_owner') THEN
    CREATE ROLE ai_view_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO backend_app, ai_reader', current_database());
END $$;
ALTER ROLE backend_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE ai_reader NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA app;
CREATE SCHEMA ai_read;
REVOKE ALL ON SCHEMA app, ai_read FROM PUBLIC;

CREATE TABLE app.players (
  id uuid PRIMARY KEY,
  username varchar(32) NOT NULL CHECK (username ~ '^[A-Za-z0-9_-]{3,32}$'),
  username_key varchar(32) GENERATED ALWAYS AS (lower(username)) STORED NOT NULL UNIQUE,
  password_hash text NOT NULL CHECK (length(password_hash) > 0),
  created_at timestamptz NOT NULL
);
CREATE TABLE app.sessions (
  id uuid PRIMARY KEY,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  player_id uuid NOT NULL REFERENCES app.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  renewed_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (created_at <= renewed_at AND renewed_at < absolute_expires_at),
  CHECK (absolute_expires_at = created_at + interval '2592000 seconds'),
  CHECK (expires_at = least(renewed_at + interval '259200 seconds', absolute_expires_at))
);
CREATE INDEX sessions_player ON app.sessions(player_id);
CREATE INDEX sessions_expiry ON app.sessions(expires_at);
CREATE TABLE app.games (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL CHECK (length(btrim(name)) > 0),
  score_unit varchar(32) NOT NULL CHECK (length(btrim(score_unit)) > 0),
  ranking_direction varchar(16) NOT NULL CHECK (ranking_direction IN ('higher_is_better','lower_is_better')),
  min_value bigint NOT NULL CHECK (min_value >= 0),
  max_value bigint NOT NULL CHECK (max_value >= min_value AND max_value <= 9007199254740991),
  is_active boolean NOT NULL
);
CREATE TABLE app.records (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES app.players(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES app.games(id) ON DELETE RESTRICT,
  value bigint NOT NULL CHECK (value BETWEEN 0 AND 9007199254740991),
  created_at timestamptz NOT NULL,
  UNIQUE(player_id, game_id, value)
);
CREATE INDEX records_game_player_value ON app.records(game_id, player_id, value);
CREATE INDEX records_history ON app.records(player_id, game_id, created_at, id);
CREATE TABLE app.attempts (
  player_id uuid NOT NULL REFERENCES app.players(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  game_id uuid NOT NULL REFERENCES app.games(id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL CHECK (status IN ('completed','incomplete')),
  value bigint CHECK (value BETWEEN 0 AND 9007199254740991),
  created_at timestamptz NOT NULL,
  record_outcome varchar(16) NOT NULL CHECK (record_outcome IN ('created','already_recorded','not_improved','not_eligible')),
  record_id uuid REFERENCES app.records(id) ON DELETE CASCADE,
  PRIMARY KEY(player_id, id),
  CHECK ((status = 'completed' AND value IS NOT NULL AND
           ((record_outcome IN ('created','already_recorded') AND record_id IS NOT NULL) OR
            (record_outcome = 'not_improved' AND record_id IS NULL))) OR
         (status = 'incomplete' AND record_outcome = 'not_eligible' AND record_id IS NULL))
);
CREATE INDEX attempts_recent ON app.attempts(player_id, created_at DESC, id DESC);
CREATE INDEX attempts_game_recent ON app.attempts(player_id, game_id, created_at DESC, id DESC);
CREATE INDEX attempts_game ON app.attempts(game_id);
CREATE INDEX attempts_record ON app.attempts(record_id);

GRANT USAGE ON SCHEMA app TO backend_app;
GRANT SELECT, INSERT, DELETE ON app.players, app.sessions TO backend_app;
GRANT UPDATE(password_hash) ON app.players TO backend_app;
GRANT UPDATE(renewed_at, expires_at) ON app.sessions TO backend_app;
GRANT SELECT ON app.games TO backend_app;
GRANT UPDATE(is_active) ON app.games TO backend_app;
GRANT SELECT, INSERT ON app.records, app.attempts TO backend_app;

GRANT USAGE ON SCHEMA app, ai_read TO ai_view_owner;
GRANT SELECT(id, username, username_key, created_at) ON app.players TO ai_view_owner;
GRANT SELECT(id, name, score_unit, ranking_direction, min_value, max_value, is_active) ON app.games TO ai_view_owner;
GRANT SELECT(id, player_id, game_id, value, created_at) ON app.records TO ai_view_owner;
CREATE VIEW ai_read.players AS SELECT id, username, username_key, created_at FROM app.players;
CREATE VIEW ai_read.games AS SELECT id, name, score_unit, ranking_direction, min_value, max_value, is_active FROM app.games;
CREATE VIEW ai_read.records AS SELECT id, player_id, game_id, value, created_at FROM app.records;
ALTER VIEW ai_read.players OWNER TO ai_view_owner;
ALTER VIEW ai_read.games OWNER TO ai_view_owner;
ALTER VIEW ai_read.records OWNER TO ai_view_owner;
GRANT USAGE ON SCHEMA ai_read TO ai_reader;
GRANT SELECT ON ai_read.players, ai_read.games, ai_read.records TO ai_reader;
ALTER ROLE backend_app SET search_path = pg_catalog, app;
ALTER ROLE ai_reader SET search_path = pg_catalog, ai_read;
ALTER ROLE ai_reader SET statement_timeout = '2s';
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app, ai_read FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app, ai_read REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
