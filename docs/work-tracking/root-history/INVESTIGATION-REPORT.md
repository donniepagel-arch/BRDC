# Investigation Report: Match Hub Notable Throws

**Date:** February 7, 2026  
**Investigator:** Claude Haiku 4.5  
**Status:** COMPLETE - Ready for implementation

---

## Executive Summary

**Question:** Why can't Match Hub display cork indicators, checkout values, and cricket closeouts?

**Answer:** Firestore throw data lacks detection fields. High scores are stored, but aren't flagged as "notable" events.

**Solution:** Add detection phase to match import pipeline (8.5 hour effort, 5-phase implementation)

**Impact:** Full-featured Match Hub with professional-grade match analytics

---

## What We Found

### Data Inspection Results

Analyzed Pagel v Pagel Week 1 match (sgmoL4GyVUYP67aOS7wm):
- 51 throws total
- All contain raw data (scores, remaining, marks, hits)
- **0 throws have detection fields**

### High Scores Present But Unmarked

```
X01 throws:
  Christian Ketchum: 140 (ton-plus level, no marker)
  Joe Peters: 101 (ton level, no marker)

Cricket throws:
  Joe Peters: 5 marks (high, no marker)
  Donnie Pagel: 5 marks (high, no marker)
```

### What's Missing

| Field | Purpose | Status |
|-------|---------|--------|
| `notable` | Flags 180s, tons, ton-pluses | MISSING |
| `checkout` | Marks checkout throws | MISSING |
| `checkout_darts` | Counts darts on checkout round | MISSING |
| `closed_out` | Marks cricket closeout throw | MISSING |
| `closeout_darts` | Counts darts on closeout | MISSING |

---

## The Documents

### 1. THROW-DATA-ANALYSIS.md (Root Level)
**What:** Detailed analysis of what's missing and why

**Contains:**
- Evidence of missing fields
- Current data structure
- Implications for UI and stats
- Root cause analysis
- Solution strategy overview

**Read this to:** Understand the problem deeply

---

### 2. THROW-DATA-DETECTION.md (Root Level)
**What:** Complete 5-phase implementation plan

**Contains:**
- Phase-by-phase breakdown
- Code examples and patterns
- Cloud function updates
- Render-time fallback strategy
- Migration script design
- Testing plan
- Timeline and effort estimates
- Files to create/modify

**Read this to:** Understand how to solve it

---

### 3. DETECTION-REQUIREMENTS.md (Root Level)
**What:** Specification for each detection field

**Contains:**
- Exact field definitions
- Detection logic for each field
- Data structure examples
- Display usage guidance
- Stats aggregation rules
- Validation requirements

**Read this to:** Know exactly what to build

---

### 4. SUMMARY.md (Root Level)
**What:** High-level overview for executives/stakeholders

**Contains:**
- Problem statement
- Root cause (brief)
- Solution overview
- Impact summary
- Timeline and cost/benefit
- File locations

**Read this to:** Get the quick story

---

### 5. THROW-DATA-MISSING.md (docs/work-tracking/)
**What:** Discovery summary and next steps

**Contains:**
- Problem statement
- Evidence
- Solution architecture
- Timeline breakdown
- Next steps checklist
- File references

**Read this to:** Track progress on this initiative

---

### 6. THROW-DATA-DETECTION-CHECKLIST.md (docs/work-tracking/)
**What:** Step-by-step implementation checklist

**Contains:**
- 7 phases with detailed tasks
- Success criteria for each phase
- Quick reference
- Blockers and dependencies
- Approval signoff

**Read this to:** Execute the implementation

---

## How to Use These Documents

### For Project Approval
1. Read: SUMMARY.md (2 min)
2. Read: THROW-DATA-ANALYSIS.md (5 min)
3. Discuss timeline and effort

### For Implementation
1. Read: THROW-DATA-DETECTION.md (15 min)
2. Use: DETECTION-REQUIREMENTS.md as spec
3. Follow: THROW-DATA-DETECTION-CHECKLIST.md for tasks
4. Reference: Code examples in THROW-DATA-DETECTION.md

### For Testing
1. Reference: Testing section in THROW-DATA-DETECTION.md
2. Use: DETECTION-REQUIREMENTS.md for validation
3. Track: Progress in THROW-DATA-DETECTION-CHECKLIST.md

---

## Key Files to Create

Phase 1-2 (New Matches):
```
lib/throw-detectors.js           - Detection functions
scripts/import-match-from-rtf.js - Modified to enrich throws
functions/importMatchData.js     - Modified to preserve fields
```

Phase 4 (Old Matches):
```
lib/throw-display-helpers.js     - Render-time fallback
public/js/match-hub.js           - Updated to use detection
```

Phase 5 (Migration):
```
scripts/add-detection-fields-to-matches.js - Backfill all matches
```

---

## Timeline Summary

| Phase | Hours | What |
|-------|-------|------|
| 1 | 2 | Detection library |
| 2 | 1 | Import integration |
| 3 | 0.5 | Cloud functions |
| 4 | 1 | UI fallback |
| 5 | 2 | Migration script |
| 6-7 | 2 | Testing & deploy |
| **TOTAL** | **8.5** | **Full solution** |

---

## Next Steps (Priority Order)

1. **Review** THROW-DATA-DETECTION.md
2. **Approve** proceeding with implementation
3. **Implement** Phase 1-2 (detection library + import integration)
4. **Test** with new RTF match import
5. **Deploy** Phase 3 (cloud functions)
6. **Deploy** Phase 4 (UI fallback)
7. **Run** Phase 5 migration
8. **Update** Match Hub with cork/checkout/closeout display
9. **Test** UI in production
10. **Document** in CLAUDE.md

---

## Questions & Answers

**Q: Can we just detect at render time?**  
A: Yes, Phase 4 provides fallback detection. But storing in Firestore is better for:
- Leaderboard stats (precomputable)
- Stats aggregation
- Performance (no client-side detection)
- Archive quality (data immutable)

**Q: Will this break existing matches?**  
A: No. Phase 4 provides fallback for old matches. Phase 5 migration adds fields retroactively.

**Q: What if detection is wrong?**  
A: Unit tests verify detection logic. Data structure allows fields to be null if uncertain.

**Q: Can we start without migration?**  
A: Yes. Phase 1-4 makes new matches work. Phase 5 backfills old ones (can run separately).

---

## Success Criteria

✅ New matches have detection fields  
✅ Old matches work with fallback  
✅ Match Hub shows cork indicators  
✅ Match Hub shows checkout values  
✅ Match Hub shows cricket closeouts  
✅ Leaderboards show notable stats  
✅ No performance regression  
✅ All tests pass  

---

## Location Index

**Root Level Files:**
- `THROW-DATA-ANALYSIS.md` - Detailed analysis
- `THROW-DATA-DETECTION.md` - Implementation plan
- `DETECTION-REQUIREMENTS.md` - Spec for each field
- `SUMMARY.md` - Executive summary

**Work Tracking:**
- `docs/work-tracking/THROW-DATA-MISSING.md` - Discovery summary
- `docs/work-tracking/THROW-DATA-DETECTION-CHECKLIST.md` - Task checklist

**This Report:**
- `INVESTIGATION-REPORT.md` - You are here

---

## Contact & Support

For questions about this investigation:
- See THROW-DATA-DETECTION.md Phase sections
- See DETECTION-REQUIREMENTS.md for specs
- See THROW-DATA-DETECTION-CHECKLIST.md for task breakdown

For implementation support:
- Follow the checklist
- Reference code examples in THROW-DATA-DETECTION.md
- Check CLAUDE.md for project conventions

