# Cardiac Drift (Pulsdrift)

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
- **Diff maxHR - avgHR**: Sehr nahe Werte deuten auf konsistente Belastung, große Differenz auf Endspurt oder Intervall-Charakter.
