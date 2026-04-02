-- Grinshaw: Aufgaben-Tabelle
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  status      text not null default 'open' check (status in ('open', 'done')),
  priority    int not null default 2 check (priority in (1, 2, 3)),
  source      text default 'manual' check (source in ('manual', 'github', 'calendar')),
  grinshaw_note text,
  created_at  timestamptz not null default now(),
  due_date    timestamptz,
  updated_at  timestamptz not null default now()
);

-- RLS aktivieren
alter table tasks enable row level security;

-- Nutzer sieht nur seine eigenen Aufgaben
create policy "tasks: eigene lesen" on tasks
  for select using (auth.uid() = user_id);

create policy "tasks: eigene anlegen" on tasks
  for insert with check (auth.uid() = user_id);

create policy "tasks: eigene bearbeiten" on tasks
  for update using (auth.uid() = user_id);

create policy "tasks: eigene löschen" on tasks
  for delete using (auth.uid() = user_id);

-- updated_at automatisch setzen
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on tasks
  for each row execute function set_updated_at();
