# Pace-Disziplin und „Zu schnell"-Erkennung

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
- **Wettkampf-Nachhall** — fehlende Disziplin im Training führt im Wettkampf zu Overpacing in den ersten Kilometern
