-- v2 removes the v1 pipeline/review/ACP state from existing project DBs (project DB only, D-022).

DROP TABLE IF EXISTS pipeline_state;
DROP TABLE IF EXISTS task_runs;
DROP TABLE IF EXISTS agent_sessions;
DROP TABLE IF EXISTS reviews;
