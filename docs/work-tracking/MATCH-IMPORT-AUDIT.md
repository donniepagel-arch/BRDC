# Match Import Audit Report

Generated: January 27, 2026 at 08:00 PM
League ID: aOq4Y0ETxPZ66tM1uUtP

## Summary

| Metric | Count |
|--------|-------|
| Total Matches | 90 |
| Completed | 10 |
| Scheduled | 80 |
| **PASS** | 9 |
| **FAIL** | 1 |
| **ERROR** | 0 |

---

## Expected Match Structure

- **9 sets** per match (5 singles + 4 doubles)
- **Best of 3 legs** per set (1-3 legs depending on winner)
- Each leg should have:
  - `throws[]` array with actual throw data
  - `player_stats` with player names
  - `winner` field

---

## FAILED MATCHES - 1 items

These matches need to be reimported:

### Week 2

#### D. Russano vs J. Ragnoni

- **Match ID:** `9unWmN7TmQgNEhFlhpuB`
- **Score:** 4-0
- **Status:** FAIL
- **RTF File:** `temp/trips league/week 2/russano v ragnoni.rtf`
- **Games:** 5 (5 with throws)
- **Total Legs:** 21
- **Total Darts:** 1447

**Issues:**
- Only 5 games (expected 9)

---

## PASSED MATCHES - 9 items

### Week 1: E. O vs D. Partlo

- **Match ID:** `0lxEeuAa7fEDSVeY3uCG`
- **Score:** 6-3
- **Games:** 9
- **Total Legs:** 20
- **Total Darts:** 1403

### Week 2: D. Pagel vs N. Kull

- **Match ID:** `Iychqt7Wto8S9m7proeH`
- **Score:** 8-0
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1849

### Week 1: N. Kull vs K. Yasenchak

- **Match ID:** `JqiWABEBS7Bqk8n7pKxD`
- **Score:** 3-6
- **Games:** 9
- **Total Legs:** 19
- **Total Darts:** 1308

### Week 1: J. Ragnoni vs neon nightmares

- **Match ID:** `OTYlCe3NNbinKlpZccwS`
- **Score:** 7-2
- **Games:** 9
- **Total Legs:** 20
- **Total Darts:** 1435

### Week 2: neon nightmares vs K. Yasenchak

- **Match ID:** `YFpeyQPYEQQjMLEu1eVp`
- **Score:** 7-2
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1550

### Week 2: D. Partlo vs M. Pagel

- **Match ID:** `ixNMXr2jT5f7hDD6qFDj`
- **Score:** 6-3
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1466

### Week 1: N. Mezlak vs D. Russano

- **Match ID:** `nYv1XeGTWbaxBepI6F5u`
- **Score:** 4-5
- **Games:** 9
- **Total Legs:** 19
- **Total Darts:** 1331

### Week 1: M. Pagel vs D. Pagel

- **Match ID:** `sgmoL4GyVUYP67aOS7wm`
- **Score:** 7-2
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1501

### Week 2: E. O vs N. Mezlak

- **Match ID:** `tcI1eFfOlHaTyhjaCGOj`
- **Score:** 5-4
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1488

## RTF Files Available for Reimport

Located in `temp/trips league/`:

### Week 1
- pagel v pagel MATCH.rtf
- yasenchak v kull.rtf
- partlo v olschansky.rtf
- mezlak v russano.rtf
- massimiani v ragnoni.rtf

### Week 2
- dpartlo v mpagel.rtf
- massimiani v yasenchak.rtf
- mezlak V e.o.rtf
- pagel v kull.rtf
- russano v ragnoni.rtf

