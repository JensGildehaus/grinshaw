-- Grinshaw Phase 4: Coach-Wissen-Tabelle
--
-- Globale Wissens-Sammlung (Lauf-Training, Physiologie, Methodik) die
-- Grinshaw on-demand per Tool-Use konsultiert. Bewusst keine RLS:
-- Jens ist einziger User, das Wissen ist global (kein user_id-Bezug),
-- Wartung erfolgt manuell ueber Supabase-Dashboard oder Service-Role.
--
-- Brand-Geste im Charakter: "Man konsultiert die einschlaegige
-- Fachliteratur." -- statt das Wissen in jedem System-Prompt
-- mitzuschicken, holt Grinshaw es nur wenn das Gespraech es verlangt.

create table if not exists coach_knowledge (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null unique,        -- Lookup-Key, z.B. 'stryd_zones', 'cardiac_drift'
  title       text not null,                -- Menschenlesbar, z.B. "Stryd-Power-Zonen (Z1-Z5)"
  content_md  text not null,                -- Eigentlicher Wissens-Inhalt in Markdown
  tags        text[] default '{}',          -- z.B. ['power', 'physiology'] fuer Filter
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Bewusst KEINE RLS -- Jens einziger User, kein Datenschutz-Risiko bei
-- globalen Wissens-Eintraegen. Tabelle ist mit anon-Key voll lesbar.
-- Schreibzugriff bleibt der Service-Role bzw. Supabase-Dashboard
-- vorbehalten (Wartungs-Workflow, nicht App-Endpoint).
alter table coach_knowledge disable row level security;

-- Falls je weitere User hinzukommen sollten und das Coach-Wissen
-- public bleiben soll, dann stattdessen:
--   alter table coach_knowledge enable row level security;
--   create policy "coach_knowledge: alle lesen" on coach_knowledge
--     for select using (true);

-- updated_at-Trigger-Funktion. CREATE OR REPLACE -- idempotent, falls
-- sie aus einer frueheren Migration noch nicht in der Live-DB landete,
-- wird sie hier definiert. Falls schon vorhanden: kein Schaden.
create or replace function set_updated_at()
returns trigger as $func$
begin
  new.updated_at = now();
  return new;
end;
$func$ language plpgsql;

-- Trigger idempotent neu anlegen
drop trigger if exists coach_knowledge_updated_at on coach_knowledge;
create trigger coach_knowledge_updated_at
  before update on coach_knowledge
  for each row execute function set_updated_at();

-- Index auf topic fuer schnellen Lookup (unique, also automatisch indexed
-- -- expliziter Index hier nur redundant; kein zusaetzlicher Index noetig).

-- Lookup-Beispiel fuer Grinshaw-Tool 'get_coach_knowledge(topic)':
--   select title, content_md, tags
--   from coach_knowledge
--   where topic = $1;

-- Alle Themen auflisten (fuer Tool, das Grinshaw zeigt was verfuegbar ist):
--   select topic, title from coach_knowledge order by title;
