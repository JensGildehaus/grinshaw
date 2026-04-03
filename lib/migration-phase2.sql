-- Phase 2 Migration — in Supabase SQL Editor ausführen

-- 1. Tasks Tabelle erweitern
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_quote text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

-- 2. Priority von int (1/2/3) auf text (high/medium/low) migrieren
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority_new text;
UPDATE tasks SET priority_new = CASE priority::text
  WHEN '1' THEN 'high'
  WHEN '2' THEN 'medium'
  WHEN '3' THEN 'low'
  ELSE 'medium'
END;
ALTER TABLE tasks DROP COLUMN priority;
ALTER TABLE tasks RENAME COLUMN priority_new TO priority;

-- 3. Status: 'snoozed' ist jetzt ebenfalls erlaubt (kein Constraint nötig)

-- 4. user_preferences Tabelle anlegen
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  key text not null,
  value text,
  confidence float default 0.5,
  updated_at timestamptz default now(),
  unique(user_id, key)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL USING (auth.uid() = user_id);
