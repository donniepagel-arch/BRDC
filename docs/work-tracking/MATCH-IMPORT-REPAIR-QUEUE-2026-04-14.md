# Match Import Legacy Queue

Date: 2026-04-14
Source audit: `scripts/audit-match-imports.js`
Audit output: `docs/work-tracking/MATCH-IMPORT-AUDIT.md`
Backups: `docs/backups/match-import-repair-2026-04-14/`

## Summary

Post-normalization audit result:

- completed matches checked: 48
- pass: 42
- legacy summary: 6
- fail: 0
- error: 0

This is no longer a live failure queue. These six matches were normalized and tagged because the stored source no longer contains full throw-by-throw data.

## Legacy Summary Matches

1. Week 8: `smKBx8m5t5QJYQrXpcxV`
   D. Partlo vs neon nightmares
   Status: all 9 games are summary-only
   Action taken: top-level `legs` rebuilt from `stats.legs`; tagged `legacy_summary_only`

2. Week 10: `kC7C0NNtalEyNblHHTSW`
   K. Yasenchak vs N. Kull
   Status: all 9 games are summary-only
   Action taken: top-level `legs` rebuilt from `stats.legs`; tagged `legacy_summary_only`

3. Week 2: `fqICAD9zFe7cLgNM2m4T`
   D. Partlo vs M. Pagel
   Status: game 9 is summary-only
   Action taken: tagged `legacy_summary_only`

4. Week 6: `0vSyH2zgRdoevOv2KEgX`
   N. Mezlak vs N. Kull
   Status: games 2, 3, and 5 are summary-only
   Action taken: tagged `legacy_summary_only`

5. Week 6: `56py28cEEFO64uo8IN3U`
   E. O vs D. Russano
   Status: games 2, 3, and 5 are summary-only
   Action taken: tagged `legacy_summary_only`

6. Week 6: `JVrGYr5saQADImC451xc`
   D. Partlo vs J. Ragnoni
   Status: games 2, 3, and 5 are summary-only
   Action taken: tagged `legacy_summary_only`

## Notes

- No synthetic throws were invented.
- Match winners, scores, legs, and player summary stats were preserved.
- The audit now distinguishes clean throw-complete imports from legacy summary-only imports.
- Any future source recovery should overwrite these tagged matches with canonical throw-based imports, not layer additional patches on top.
