# Coach-Wissen — Markdown-Quellen für die `coach_knowledge`-Tabelle

Dieses Verzeichnis ist die **Quelle der Wahrheit** für die Wissens-Einträge, die Grinshaw via `get_coach_knowledge(topic)` aus der Supabase-Tabelle `coach_knowledge` abruft.

## Verzeichnis-Konvention

- Eine Datei pro `topic`-Eintrag: `<topic>.md`
- Der Dateiname (ohne `.md`) wird als `topic`-Lookup-Key verwendet
- Die erste Zeile (`# Titel`) wird als `title` in die DB übernommen
- Der Rest des Markdowns wird als `content_md` gespeichert

## Aktuelle Einträge

| Topic | Datei | Inhalt |
|---|---|---|
| `stryd_zones` | `stryd_zones.md` | Stryd-Power-Zonen Z1-Z5, Auslastungs-Berechnung, Konsistenz-Check, Power-Variability |
| `cardiac_drift` | `cardiac_drift.md` | Pulsdrift-Definition + Interpretation, Limitationen bei nur Avg-HR-Daten, Ersatz-Indikatoren |
| `polarized_80_20` | `polarized_80_20.md` | Seiler-Modell (Norwegisches), Wochen-Verteilung Z1-Z2 vs Z4-Z5, Tempotrap-Warnung |
| `hr_power_decoupling` | `hr_power_decoupling.md` | HR/Power-Verhältnis als Effizienz-Marker, Übertrainings- vs Fitness-Trend |
| `recovery_indicators` | `recovery_indicators.md` | Erholungs-Hinweise aus Lauf-Daten, Brand-konsequente Coach-Empfehlungen |
| `pacing_discipline` | `pacing_discipline.md` | „Zu schnell"-Heuristik, Brand-Phrasen für drei Diszplin-Stufen |

## Sync zur Supabase-Tabelle

Bei Änderungen oder neuen Einträgen wird die Tabelle `coach_knowledge` per Skript oder manuell aus diesen Dateien gefüllt. Erst-Befüllung erfolgt nach der `migration-phase4-coach.sql`-Migration.

Empfohlener Sync-Workflow (Phase 1B-Folge-Step):
1. `lib/coach-knowledge/*.md` editieren
2. Skript `lib/coach-knowledge-sync.ts` ausführen (parsed jede Datei, upsert in Tabelle)
3. Grinshaw sieht die Änderung sofort beim nächsten `get_coach_knowledge`-Tool-Call

## Erweiterung

Weitere Themen, die später ergänzt werden könnten (nicht zur initialen Befüllung):
- `marathon_periodisierung` — 16-Wochen-Aufbau, Tapering
- `cp_test_methodik` — wie man CP per 3/9- oder 12-Minuten-Test ermittelt
- `running_economy` — Running-Economy-Konzept, Verbesserungs-Stellschrauben
- `temperature_effects` — Hitze/Kälte-Korrekturen für Power und HR
