CREATE TABLE app_settings (
  id int PRIMARY KEY DEFAULT 1,
  ai_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
INSERT INTO app_settings (id, ai_enabled) VALUES (1, false);

-- Writes go only through /api/admin/ai-toggle (service-role key, bypasses RLS).
-- Any authenticated client can read (frontend gates the AI-chat entry point on this).
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_authenticated_read" ON app_settings FOR SELECT TO authenticated USING (true);
