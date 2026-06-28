# Stryd-Power-Zonen (Z1-Z5)

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
- > 1.5: Intervall-Charakter, große Anstiege, oder Endspurt-Sprint
