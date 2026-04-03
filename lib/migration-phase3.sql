-- Phase 3 Migration — in Supabase SQL Editor ausführen

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  subscription jsonb not null,
  created_at timestamptz default now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions FOR ALL USING (auth.uid() = user_id);
