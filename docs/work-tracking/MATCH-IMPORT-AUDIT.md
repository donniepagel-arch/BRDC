# Match Import Audit Report

Generated: April 14, 2026 at 04:13 AM
League ID: aOq4Y0ETxPZ66tM1uUtP

## Summary

| Metric | Count |
|--------|-------|
| Total Matches | 90 |
| Completed | 48 |
| Scheduled | 42 |
| **PASS** | 42 |
| **LEGACY SUMMARY** | 6 |
| **FAIL** | 0 |
| **ERROR** | 0 |

---

## Expected Match Structure

- **9 sets** per match (5 singles + 4 doubles)
- **Best of 3 legs** per set (1-3 legs depending on winner)
- Preferred source-of-truth:
  - `throws[]` array with actual throw data
  - `player_stats` with player names
  - `winner` field
- Legacy-summary matches are separated instead of being counted as clean throw-complete imports.

---

## LEGACY SUMMARY MATCHES - 6 items

These matches preserve winners and player stats, but stored source no longer contains full turn-by-turn throws. They were normalized and tagged so they no longer masquerade as throw-complete imports.

### Week 6: N. Mezlak vs N. Kull

- **Match ID:** `0vSyH2zgRdoevOv2KEgX`
- **Score:** 8-1
- **Status:** LEGACY SUMMARY
- **Games:** 9 (6 with throws)
- **Total Legs:** 21
- **Total Darts:** 1458
- **Missing Throw Games:** 2, 3, 5
- **Legacy Note:** Cricket games 2, 3, and 5 only retain leg summary stats in the stored match document.

### Week 6: E. O vs D. Russano

- **Match ID:** `56py28cEEFO64uo8IN3U`
- **Score:** 4-5
- **Status:** LEGACY SUMMARY
- **Games:** 9 (6 with throws)
- **Total Legs:** 22
- **Total Darts:** 1392
- **Missing Throw Games:** 2, 3, 5
- **Legacy Note:** Cricket games 2, 3, and 5 only retain leg summary stats in the stored match document.

### Week 6: D. Partlo vs J. Ragnoni

- **Match ID:** `JVrGYr5saQADImC451xc`
- **Score:** 4-5
- **Status:** LEGACY SUMMARY
- **Games:** 9 (6 with throws)
- **Total Legs:** 23
- **Total Darts:** 1542
- **Missing Throw Games:** 2, 3, 5
- **Legacy Note:** Cricket games 2, 3, and 5 only retain leg summary stats in the stored match document.

### Week 2: D. Partlo vs M. Pagel

- **Match ID:** `fqICAD9zFe7cLgNM2m4T`
- **Score:** 6-3
- **Status:** LEGACY SUMMARY
- **Games:** 9 (8 with throws)
- **Total Legs:** 24
- **Total Darts:** 1479
- **Missing Throw Games:** 9
- **Legacy Note:** Game 9 has summary stats and winners but no preserved throw-by-throw source in the stored match document.

### Week 10: K. Yasenchak vs N. Kull

- **Match ID:** `kC7C0NNtalEyNblHHTSW`
- **Score:** 5-4
- **Status:** LEGACY SUMMARY
- **Games:** 9 (0 with throws)
- **Total Legs:** 20
- **Total Darts:** 0
- **Missing Throw Games:** 1, 2, 3, 4, 5, 6, 7, 8, 9
- **Legacy Note:** Legacy import only retained summary stats. Top-level legs were rebuilt from stats.legs without inventing throw arrays.

### Week 8: D. Partlo vs neon nightmares

- **Match ID:** `smKBx8m5t5QJYQrXpcxV`
- **Score:** 3-6
- **Status:** LEGACY SUMMARY
- **Games:** 9 (0 with throws)
- **Total Legs:** 21
- **Total Darts:** 738
- **Missing Throw Games:** 1, 2, 3, 4, 5, 6, 7, 8, 9
- **Legacy Note:** Legacy web-scrape import only retained summary stats. Top-level legs were rebuilt from stats.legs without inventing throw arrays.

## PASSED MATCHES - 42 items

### Week 1: E. O vs D. Partlo

- **Match ID:** `0lxEeuAa7fEDSVeY3uCG`
- **Score:** 6-3
- **Games:** 9
- **Total Legs:** 20
- **Total Darts:** 1419

### Week 7: J. Ragnoni vs N. Mezlak

- **Match ID:** `4Y0JgqkAfMQQDvBcpOFt`
- **Score:** 3-6
- **Games:** 9
- **Total Legs:** 22
- **Total Darts:** 1362

### Week 7: K. Yasenchak vs D. Partlo

- **Match ID:** `60Gq6F41U0y0DTKn69D1`
- **Score:** 5-4
- **Games:** 9
- **Total Legs:** 22
- **Total Darts:** 1484

### Week 8: N. Mezlak vs K. Yasenchak

- **Match ID:** `7pP5l8W41wsXzr40MrZv`
- **Score:** 4-5
- **Games:** 9
- **Total Legs:** 9
- **Total Darts:** 1455

### Week 10: neon nightmares vs J. Ragnoni

- **Match ID:** `8vgs6TM9wV4UqLbLvXIn`
- **Score:** 0-9
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1478

### Week 5: N. Kull vs D. Russano

- **Match ID:** `BuvLQXPPOKdE9ewR9LKs`
- **Score:** 2-7
- **Games:** 9
- **Total Legs:** 20
- **Total Darts:** 582

### Week 8: M. Pagel vs E. O

- **Match ID:** `C7s858QLomhy3DqN8lAX`
- **Score:** 5-4
- **Games:** 9
- **Total Legs:** 9
- **Total Darts:** 1459

### Week 6: M. Pagel vs neon nightmares

- **Match ID:** `CDLsCXBVYfYUaTXZ9pLH`
- **Score:** 7-2
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1635

### Week 5: neon nightmares vs E. O

- **Match ID:** `DIwWYQ3petmZS2v0qDsH`
- **Score:** 2-7
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 0

### Week 2: N. Mezlak vs E. O

- **Match ID:** `DhKUt2hCdSEJaNRDceIz`
- **Score:** 4-5
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1500

### Week 5: K. Yasenchak vs M. Pagel

- **Match ID:** `HsFErJsZsl65vwWdPMZf`
- **Score:** 7-2
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1447

### Week 4: D. Russano vs neon nightmares

- **Match ID:** `IQ4pQ6jqQUAsvdOg0j3e`
- **Score:** 9-0
- **Games:** 9
- **Total Legs:** 20
- **Total Darts:** 1629

### Week 7: D. Russano vs M. Pagel

- **Match ID:** `ItPPsRPDEjhOG3ZT8aIb`
- **Score:** 7-2
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1125

### Week 1: N. Kull vs K. Yasenchak

- **Match ID:** `JqiWABEBS7Bqk8n7pKxD`
- **Score:** 3-6
- **Games:** 9
- **Total Legs:** 19
- **Total Darts:** 1338

### Week 6: D. Pagel vs K. Yasenchak

- **Match ID:** `Kycz0Zihx948aqz4pg9V`
- **Score:** 4-5
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1481

### Week 10: D. Pagel vs M. Pagel

- **Match ID:** `LX4TspwI5CUI6qKLQhRk`
- **Score:** 5-3
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1578

### Week 1: J. Ragnoni vs neon nightmares

- **Match ID:** `OTYlCe3NNbinKlpZccwS`
- **Score:** 7-2
- **Games:** 9
- **Total Legs:** 20
- **Total Darts:** 1449

### Week 3: E. O vs J. Ragnoni

- **Match ID:** `P57BmQcCGdfZLIxaIe5P`
- **Score:** 5-4
- **Games:** 9
- **Total Legs:** 20
- **Total Darts:** 1650

### Week 8: J. Ragnoni vs N. Kull

- **Match ID:** `Qjt79xo0WDTrZoVnxtNy`
- **Score:** 3-6
- **Games:** 9
- **Total Legs:** 9
- **Total Darts:** 1592

### Week 2: D. Pagel vs N. Kull

- **Match ID:** `RfSuCwwQUm2vvpH3e322`
- **Score:** 7-2
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1881

### Week 9: K. Yasenchak vs J. Ragnoni

- **Match ID:** `TNUKhFB5xrtTNmzmTaob`
- **Score:** 4-5
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1483

### Week 4: M. Pagel vs J. Ragnoni

- **Match ID:** `ZRBshDQa7pRghXNonnAs`
- **Score:** 0-9
- **Games:** 9
- **Total Legs:** 22
- **Total Darts:** 1539

### Week 8: D. Pagel vs D. Russano

- **Match ID:** `ZkFioCv3uXH0DHUY9U5Y`
- **Score:** 2-7
- **Games:** 9
- **Total Legs:** 9
- **Total Darts:** 1413

### Week 3: N. Kull vs neon nightmares

- **Match ID:** `bHKrdlJnQWbABkMWkLov`
- **Score:** 4-5
- **Games:** 9
- **Total Legs:** 22
- **Total Darts:** 1701

### Week 9: N. Kull vs M. Pagel

- **Match ID:** `bKbFUA2OEqBwP4tkUMl2`
- **Score:** 5-2
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1548

### Week 4: E. O vs K. Yasenchak

- **Match ID:** `cd313aLms9YgAEMHXJpV`
- **Score:** 5-4
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 2289

### Week 10: D. Russano vs N. Mezlak

- **Match ID:** `ctYzWU3tdIAqJQ47P7b6`
- **Score:** 5-4
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1494

### Week 10: D. Partlo vs E. O

- **Match ID:** `d0ydoWv53591zfYOGdfU`
- **Score:** 4-5
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1819

### Week 5: J. Ragnoni vs D. Pagel

- **Match ID:** `fWx1adiu9P2lli5aXWvI`
- **Score:** 6-3
- **Games:** 9
- **Total Legs:** 22
- **Total Darts:** 0

### Week 5: N. Mezlak vs D. Partlo

- **Match ID:** `hDLpbRzduIFYlgnHZFMT`
- **Score:** 5-4
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1724

### Week 7: neon nightmares vs D. Pagel

- **Match ID:** `ideiG8Q7R0UOTFucbJ26`
- **Score:** 2-7
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1536

### Week 2: neon nightmares vs K. Yasenchak

- **Match ID:** `j99cYF5bV2Se7zoNVpgi`
- **Score:** 2-7
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1572

### Week 2: D. Russano vs J. Ragnoni

- **Match ID:** `mOtQbjkiLzWc6Ea7gnkp`
- **Score:** 6-3
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1467

### Week 3: D. Russano vs K. Yasenchak

- **Match ID:** `nUT8f6Fvdi1y7St9wlGQ`
- **Score:** 4-5
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1494

### Week 1: N. Mezlak vs D. Russano

- **Match ID:** `nYv1XeGTWbaxBepI6F5u`
- **Score:** 4-5
- **Games:** 9
- **Total Legs:** 19
- **Total Darts:** 1344

### Week 4: D. Partlo vs N. Kull

- **Match ID:** `pNJ5wKPIrHPQqXQv5Nhl`
- **Score:** 6-3
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1986

### Week 3: M. Pagel vs N. Mezlak

- **Match ID:** `pw8L1xdnkTDCiorTwbWO`
- **Score:** 4-5
- **Games:** 9
- **Total Legs:** 19
- **Total Darts:** 1242

### Week 9: D. Russano vs D. Partlo

- **Match ID:** `sXqtymuHCGCBnCWrxPli`
- **Score:** 7-2
- **Games:** 9
- **Total Legs:** 20
- **Total Darts:** 1472

### Week 1: M. Pagel vs D. Pagel

- **Match ID:** `sgmoL4GyVUYP67aOS7wm`
- **Score:** 7-2
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1524

### Week 3: D. Partlo vs D. Pagel

- **Match ID:** `xX4UtSU1dms9spECerDd`
- **Score:** 2-7
- **Games:** 9
- **Total Legs:** 24
- **Total Darts:** 1695

### Week 7: N. Kull vs E. O

- **Match ID:** `xnannzDcgDARW1g8DH18`
- **Score:** 4-5
- **Games:** 9
- **Total Legs:** 21
- **Total Darts:** 1641

### Week 4: D. Pagel vs N. Mezlak

- **Match ID:** `zRWjWDe2qw7R8MC7K81i`
- **Score:** 3-6
- **Games:** 9
- **Total Legs:** 23
- **Total Darts:** 1632

