-- ============================================================================
-- Grinshaw Phase 4 Coach: All-in-One Migration
--
-- Diese Datei vereint:
--   1. CREATE TABLE coach_knowledge + Trigger (aus migration-phase4-coach.sql)
--   2. Initial-Befuellung mit 6 Wissens-Eintraegen (Markdown-Quellen unter
--      lib/coach-knowledge/)
--
-- Im Supabase-Dashboard ausfuehren: SQL Editor -> Inhalt einfuegen -> Run.
-- Idempotent: re-runs aktualisieren bestehende Eintraege (on conflict).
--
-- Generiert von tools/build-coach-knowledge-sql.mjs -- nicht manuell editieren.
-- Aenderungen erfolgen in den .md-Dateien, dann Script neu laufen lassen.
-- ============================================================================

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

-- updated_at automatisch setzen (Funktion existiert seit schema.sql)
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


-- ============================================================================
-- Initial-Befuellung: 6 Wissens-Eintraege
-- ============================================================================

insert into coach_knowledge (topic, title, content_md, tags) values
  ('cardiac_drift', $ck_cardiac_drift$Cardiac Drift (Pulsdrift)$ck_cardiac_drift$, $ck_cardiac_drift$# Cardiac Drift (Pulsdrift)

Cardiac Drift bezeichnet das Phänomen, dass bei konstanter Pace oder Power der **Pulsschlag im Verlauf des Laufs steigt**. Es ist ein wertvoller Indikator für aerobe Effizienz und Hitze/Hydrations-Belastung.

## Berechnung

Klassisch: Vergleich der durchschnittlichen Herzfrequenz der zweiten Hälfte mit der ersten Hälfte.

```
Drift % = ((avgHR_2.Hälfte - avgHR_1.Hälfte) / avgHR_1.Hälfte) × 100
```

## Interpretation

| Drift | Bewertung |
|---|---|
| < 5% | Sehr gute aerobe Effizienz, stabile Fitness |
| 5-7% | Akzeptabel, leichte Müdigkeit oder Hitze möglich |
| 7-10% | Auffällig — zu schnell gestartet, Hydration nachjustieren, oder Hitze |
| > 10% | Aerob nicht stabil — Trainings-Reize zu hart, Recovery-Bedarf |

## Wann Cardiac Drift aussagekräftig ist

- Bei **gleichmäßigem Tempo** (kein Intervall-Charakter)
- Bei Distanzen **über 45 Minuten** (kürzer ist Drift nicht voll ausgebildet)
- Bei konstantem Untergrund (keine starken Höhen-Wechsel)

## Was Drift NICHT zeigt

- Bei Intervallen oder progressivem Tempo ist die Berechnung wertlos
- Bei extremer Hitze ist Drift kein Fitness-Indikator, sondern Wärme-Indikator
- Bei einzelner Messung schwer beurteilbar — Trend über mehrere ähnliche Läufe ist aussagekräftiger

## Limitation in der aktuellen Datenlage

Bei Lauf-Posts aus Sanity sind nur `avgHR` und `maxHR` als Gesamt-Werte vorhanden — **keine Hälften-Splits**. Daher kann Grinshaw klassischen Cardiac Drift nicht direkt berechnen. Ersatz-Indikatoren:

- **HR/Power-Verhältnis-Trend** über mehrere Läufe: Wenn bei gleicher Power die HR über Wochen steigt, deutet das auf nachlassende aerobe Effizienz hin (Überlastung, Krankheit, schlechte Erholung).
- **Diff maxHR - avgHR**: Sehr nahe Werte deuten auf konsistente Belastung, große Differenz auf Endspurt oder Intervall-Charakter.$ck_cardiac_drift$, ARRAY['hr', 'physiology'])
on conflict (topic) do update set
  title = excluded.title,
  content_md = excluded.content_md,
  tags = excluded.tags;

insert into coach_knowledge (topic, title, content_md, tags) values
  ('hr_power_decoupling', $ck_hr_power_decoupling$HR/Power-Decoupling (Aerobic Decoupling)$ck_hr_power_decoupling$, $ck_hr_power_decoupling$# HR/Power-Decoupling (Aerobic Decoupling)

Das **HR-zu-Power-Verhältnis** ist einer der präzisesten Marker für aerobe Effizienz und Fitness-Entwicklung. Es zeigt, wie viel Pulsschlag der Athlet aufbringen muss, um eine bestimmte Leistung zu erzeugen.

## Berechnung

Für einen einzelnen Lauf:
```
HR/Power-Ratio = avgHR / avgPower
```

Beispiel: 152 bpm / 250 W = 0,608

Niedriger Wert = effizient (wenig Puls für viel Leistung)
Hoher Wert = ineffizient (viel Puls für wenig Leistung)

## Trend über mehrere Läufe

**Das wichtigste Signal ist die Veränderung über Zeit.** Vergleich des HR/Power-Ratios bei ähnlichen Läufen (gleiche Distanz-Kategorie, gleicher Lauf-Typ) über Wochen:

| Trend | Bedeutung |
|---|---|
| Sinkt | Aerobe Effizienz steigt — Fitness verbessert sich |
| Stabil | Fitness gehalten, kein klarer Fortschritt |
| Steigt | Aerobe Effizienz sinkt — Müdigkeit, Krankheit, Übertraining, Hitze |

## Decoupling als Übertrainings-Indikator

Wenn das Ratio über 1-2 Wochen kontinuierlich steigt **trotz** unveränderter Trainings-Belastung:
- Erholung unzureichend
- Beginnende Überlastung (HRV würde das zeigen, aber dazu fehlen uns Daten)
- Krankheits-Vorbote (Erkältung sich anbahnend)

→ Coach-Empfehlung: 3-5 Tage reduzieren, viel Z1, ggf. Pausentage

## Decoupling als Fitness-Indikator

Wenn das Ratio über mehrere Wochen sinkt:
- Aerobe Basis wächst
- Mitochondrien-Dichte und Kapillarisierung verbessern sich
- Athlet kann bei gleicher Leistung tiefer in Z2 bleiben

→ Coach-Empfehlung: bisherige Trainings-Disziplin halten, Volumen vorsichtig erhöhen

## Aussagekraft

Aussagekräftig ist das Ratio bei:
- **Vergleichbaren Läufen** (ähnliche Distanz, ähnliche Wetter-Bedingungen, ähnlicher Lauf-Typ)
- **Längeren Distanzen** (> 30 Min, sonst zu wenig stabile Daten)
- **Mehreren Läufen im Trend** (Einzel-Messung ist verrauscht)$ck_hr_power_decoupling$, ARRAY['hr', 'power', 'efficiency'])
on conflict (topic) do update set
  title = excluded.title,
  content_md = excluded.content_md,
  tags = excluded.tags;

insert into coach_knowledge (topic, title, content_md, tags) values
  ('pacing_discipline', $ck_pacing_discipline$Pace-Disziplin und „Zu schnell"-Erkennung$ck_pacing_discipline$, $ck_pacing_discipline$# Pace-Disziplin und „Zu schnell"-Erkennung

Eine der häufigsten Trainings-Fehler ist mangelnde Pace-Disziplin: der Athlet plant einen ruhigen Lauf, läuft aber doch schneller als geplant. Die Konsequenz ist nicht nur fehlende Erholung, sondern auch ein verschobener Trainings-Reiz — aus einem Z1/Z2-Lauf wird ungewollt ein Z3-Lauf, ohne adäquaten Effekt.

## Erkennungs-Heuristik

Vergleich der aktuellen Pace mit dem **Wochen-Durchschnitt für ähnliche Distanz/Lauf-Typ**:

```
Tempo-Abweichung % = ((Wochen-Schnitt - aktuelle Pace) / Wochen-Schnitt) × 100
```

(Negative Werte = aktueller Lauf war schneller als Schnitt)

| Abweichung | Bewertung bei `runType: ruhig` |
|---|---|
| -3% bis +3% | Disziplin gewahrt |
| -5% bis -3% | Leichte Mahnung — etwas schneller als geplant, akzeptabel |
| -10% bis -5% | Klare Anmerkung — Disziplin hat gelitten |
| < -10% | Coach-Warnung — der Lauf war im falschen Trainings-Bereich |

Bei `runType: tempo` oder `wettkampf` greifen andere Regeln — schneller ist dort erwartet.

## Power-Auslastung als Kreuz-Check

Pace allein ist nicht der einzige Indikator. Power-Auslastung in % CP ist präziser:
- Lauf-Typ `ruhig` mit Power-Auslastung > 85% CP: definitiv zu hart, unabhängig davon was die Pace sagt
- Lauf-Typ `ruhig` mit Power-Auslastung < 80% CP: brave Z1-Z2-Disziplin

## Brand-konsequente Coach-Sprache

**Bei eingehaltener Disziplin:**
- „Man stellt Kohärenz zwischen Ankündigung und Ausführung fest."
- „Die Disziplin hat sich behauptet — ein selteneres Phänomen, als man wahrhaben möchte."
- „Schrittmaß und Lauf-Typ in stimmiger Übereinstimmung. Das ist die diskreteste Form von Lob."

**Bei leichter Mahnung:**
- „Man bemerkt, dass das Schrittmaß um zwei Sekunden pro Kilometer unter dem Wochen-Schnitt lag. Bei nominell ruhiger Absicht wirft das die Frage auf, ob die Disziplin in der zweiten Hälfte gelitten hat."
- „Man rät zu sanfterer Hand bei der kommenden Einheit."

**Bei klarer Warnung:**
- „Man konstatiert: dies war kein ruhiger Lauf, gleichviel was die Markierung behauptet. Die Power lag bei [%] der Critical Power — eindeutig im Bereich Schwelle."
- „Die Constitution wird die kommenden Tage zur Rechenschaft ziehen. Man rät zu Zurückhaltung."

## Warum Pace-Disziplin wichtig ist

- **Erholungs-Verlust** — ein zu hartes „leichtes" Tagewerk verlängert die Erholungszeit
- **Trainings-Reiz-Verschiebung** — ungewollte Z3-Belastung statt Z1-Adaptation
- **Tempotrap-Risiko** — wenn das ständig passiert, dominiert Z3 die Woche (siehe `polarized_80_20`)
- **Wettkampf-Nachhall** — fehlende Disziplin im Training führt im Wettkampf zu Overpacing in den ersten Kilometern$ck_pacing_discipline$, ARRAY['pace', 'discipline'])
on conflict (topic) do update set
  title = excluded.title,
  content_md = excluded.content_md,
  tags = excluded.tags;

insert into coach_knowledge (topic, title, content_md, tags) values
  ('polarized_80_20', $ck_polarized_80_20$80/20 polarisiertes Training (Seiler-Modell)$ck_polarized_80_20$, $ck_polarized_80_20$# 80/20 polarisiertes Training (Seiler-Modell)

Das **polarisierte Trainings-Modell** nach Stephen Seiler (Norwegisches Modell) gilt als Gold-Standard für Ausdauer-Athleten im Bereich Laufen, Radsport und Triathlon.

## Das Prinzip

Die Gesamt-Trainings-Zeit verteilt sich auf zwei Bereiche:

- **~80% in Zone 1-2** (Leicht bis Moderat) — sehr easy, deutlich unter der Schwelle
- **~20% in Zone 4-5** (Intervall bis Wiederholung) — hart, deutlich über der Schwelle
- **Zone 3 (Schwelle) wird bewusst gemieden** — sie ist „zu hart für easy, zu easy für hart"

## Warum nicht mehr Schwelle?

Zone 3 erzeugt **Stress ohne adäquaten Trainings-Reiz**:
- Das aerobe System wird nicht voll stimuliert (das macht Z1/Z2)
- Die VO₂max wird nicht voll gefordert (das macht Z4/Z5)
- Aber: die Erholungszeit ist verhältnismäßig lang

Polarisiertes Training maximiert die Trainings-Reize und minimiert die Erholungs-Kosten.

## Wochen-Verteilungs-Check

Pro Trainings-Woche wird die Zeit in den Zonen aggregiert:

```
Z1+Z2-Anteil = Zeit_in_Z1_Z2 / Gesamt-Zeit
Z4+Z5-Anteil = Zeit_in_Z4_Z5 / Gesamt-Zeit
```

**Ideal:**
- Z1+Z2: 75-85%
- Z3: 5-10% (so wenig wie möglich)
- Z4+Z5: 10-20%

**Anti-Pattern: „Tempotrap"** — wenn Z3 dominiert (> 25%), wird viel Stress erzeugt mit wenig Effekt. Klassisches Symptom: Athlet trainiert hart, fühlt sich permanent müde, macht keine Fortschritte.

## Anwendung im Coach-Kommentar

Wenn der aktuelle Lauf in Z3 lag und das die zweite Z3-Einheit der Woche war: vorsichtig auf die Tempotrap hinweisen. Wenn die Woche viele Z1/Z2-Einheiten hatte und der heutige Lauf war ein Z4-Intervall: das ist polarisiert-richtig, das Tagewerk verdient Anerkennung.

## Alternative Modelle (zur Kontext-Einordnung)

- **Pyramidal** (klassisch deutsch): viel Z1, etwas Z3 (Schwelle), wenig Z4/Z5 — solider, aber weniger explosiv
- **Threshold-fokussiert** (sub-Threshold-Stil norwegischer Spitze): viel Z3 mit kürzeren Intervallen — funktioniert nur bei sehr hoher Trainings-Ökonomie und perfekter Recovery$ck_polarized_80_20$, ARRAY['methodology', 'volume'])
on conflict (topic) do update set
  title = excluded.title,
  content_md = excluded.content_md,
  tags = excluded.tags;

insert into coach_knowledge (topic, title, content_md, tags) values
  ('recovery_indicators', $ck_recovery_indicators$Erholungs-Indikatoren$ck_recovery_indicators$, $ck_recovery_indicators$# Erholungs-Indikatoren

Erholung ist die Hälfte des Trainings. Ohne adäquate Recovery werden Trainings-Reize nicht in Adaptation umgesetzt — der Athlet wird müder, nicht fitter. Folgende Indikatoren weisen auf unzureichende Erholung hin.

## Aus den vorhandenen Lauf-Daten ableitbar

### 1. HR-Anstieg bei gleicher Power

Wenn `avgHR` bei vergleichbarer `avgPower` über 1-2 Wochen kontinuierlich steigt — siehe `hr_power_decoupling`. Klassischer Übertrainings-Vorbote.

### 2. Power-Abfall bei gleichem Empfinden

Wenn der Athlet sich gefühlt gleich anstrengt (`runType: ruhig`), aber `avgPower` deutlich niedriger als der Wochen-Schnitt für ähnliche Läufe liegt: Ermüdung, der Körper kann nicht voll abrufen.

### 3. Maximum-Puls-Reduktion

Wenn `maxHR` bei harten Einheiten deutlich unter dem üblichen Maximum bleibt: das vegetative Nervensystem ist überlastet, der Sympathikus ist nicht voll aktivierbar. Hinweis auf Übertraining.

### 4. Wochen-Volumen-Sprung

Wenn das Wochen-Volumen plötzlich um mehr als 30% steigt im Vergleich zur Vorwoche: zu großer Belastungssprung. Faustregel: maximal 10% Steigerung pro Woche, mit alle 3-4 Wochen einer reduzierten „Entlastungs-Woche" (~70% des Schnitts).

### 5. Dichte harter Einheiten

Wenn binnen 3 Tagen mehrere Z3-Z5-Einheiten stattfanden ohne ausreichende Z1-Einlage dazwischen: ungesunde Ballung. Klassische Regel: nach harter Einheit mindestens 24-48h leicht oder Pause.

## Nicht aus Lauf-Daten ableitbar (Kontext für Coach-Sprache)

- **HRV (Heart Rate Variability)** — Garmin Body Battery zeigt das, aber nicht in Sanity gepflegt
- **Subjektives Wohlbefinden / RPE** — wenn Jens das im Teaser oder Body erwähnt („müde", „schwer", „kraftlos"), gilt es als zusätzlicher Hinweis
- **Schlafqualität** — gehört zur Erholung, kein Coach-Datenpunkt

## Coach-Empfehlungen bei Übertrainings-Verdacht

Im Charakter: **„Die Constitution scheint angeschlagen."**

Konkrete Maßnahmen:
1. 3-5 Tage Z1-only oder Pause
2. Wochen-Volumen für 1 Woche um 40-50% reduzieren
3. Dann vorsichtiger Wiederaufbau
4. Auf hartnäckigen Trend achten — wenn nach 7-10 Tagen keine Besserung: ärztliche Abklärung erwägen

## Coach-Empfehlungen bei guter Erholung

Im Charakter: **„Die Constitution scheint sich zu festigen."** oder **„Die Reserven sind erfreulich intakt."**

Konkrete Maßnahmen:
1. Bisherigen Trainings-Rhythmus beibehalten
2. Vorsichtig Volumen oder Intensität erhöhen (nicht beides gleichzeitig)
3. Nächstes Wettkampf-Datum als Orientierung für Periodisierung nutzen$ck_recovery_indicators$, ARRAY['recovery', 'overtraining'])
on conflict (topic) do update set
  title = excluded.title,
  content_md = excluded.content_md,
  tags = excluded.tags;

insert into coach_knowledge (topic, title, content_md, tags) values
  ('stryd_zones', $ck_stryd_zones$Stryd-Power-Zonen (Z1-Z5)$ck_stryd_zones$, $ck_stryd_zones$# Stryd-Power-Zonen (Z1-Z5)

Die Trainings-Bereiche werden über den prozentualen Anteil der **Critical Power (CP)** definiert. CP ist der Schwellwert, bei dem aerobe und anaerobe Leistung im Gleichgewicht stehen — über CP greift der anaerobe Bereich, darunter ist die Belastung aerob bewältigbar.

## Die fünf Zonen

| Zone | Name | Anteil CP | Trainings-Zweck |
|---|---|---|---|
| **Z1** | Leicht | 65-80% CP | Regeneration, lange ruhige Einheiten, aerobe Grundlage |
| **Z2** | Moderat | 80-90% CP | Aerobe Ausdauer, klassischer „Steady-State" |
| **Z3** | Schwelle | 90-100% CP | Laktatschwelle, „Sweet Spot", oft 20-40 Minuten anhaltbar |
| **Z4** | Intervall | 100-115% CP | VO₂max, Sauerstoff-Aufnahme-Fähigkeit, 3-8 Minuten-Intervalle |
| **Z5** | Wiederholung | 115%+ CP | Anaerobe Kapazität, kurze Wiederholungen unter 2 Minuten |

## Interpretation einer Lauf-Power-Auslastung

Für einen Lauf-Post mit `avgPower` (W) und bekanntem CP wird die **Power-Auslastung** als Prozent berechnet:

```
Auslastung % = (avgPower / CP) × 100
```

**Daraus folgt die Zonen-Klassifikation des Laufs:**
- Auslastung < 80%: Z1 — Erholungs- oder Long-Run-Charakter
- 80-90%: Z2 — solider Grundlauf
- 90-100%: Z3 — Schwelle, schon anstrengend
- 100-115%: Z4 — VO₂max-Bereich, nur kurz anhaltbar
- 115%+: Z5 — anaerob, Intervall-Charakter

## Konsistenz-Check

Wenn `runType` als „ruhig" markiert ist, sollte die Auslastung in Z1 oder unteres Z2 liegen. Liegt sie höher (z.B. Z3), ist das ein Hinweis auf **Overpacing** — der Läufer war disziplinierter im Anspruch als in der Ausführung.

## Power-Variability

Das Verhältnis `maxPower / avgPower` gibt Hinweis auf den Lauf-Charakter:
- < 1.2: Sehr gleichmäßig, ohne Anstiege oder Sprints
- 1.2 - 1.5: Normaler Verlauf mit kleinen Variationen (kurze Anstiege)
- > 1.5: Intervall-Charakter, große Anstiege, oder Endspurt-Sprint$ck_stryd_zones$, ARRAY['power', 'zones'])
on conflict (topic) do update set
  title = excluded.title,
  content_md = excluded.content_md,
  tags = excluded.tags;
