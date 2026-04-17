ALTER TABLE api_usage_daily ADD COLUMN request_source text NOT NULL DEFAULT 'production';
DROP INDEX IF EXISTS api_usage_daily_key_date_endpoint;
CREATE UNIQUE INDEX api_usage_daily_key_date_endpoint
  ON api_usage_daily (api_key_id, usage_date, endpoint, request_source);
CREATE INDEX IF NOT EXISTS idx_api_usage_daily_user_date_source
  ON api_usage_daily (user_id, usage_date, request_source);
