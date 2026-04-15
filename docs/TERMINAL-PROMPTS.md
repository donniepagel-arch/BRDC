# Standalone Terminal Prompts for Parallel Analysis

Copy these prompts into separate Claude Code terminal sessions for parallel analysis.

---

## Terminal 1: DartConnect Import Analysis & Fix

```
I need you to investigate and fix the DartConnect match import issues in the BRDC Firebase application located at:
/c/Users/gcfrp/projects/brdc-firebase

PROBLEM: Imported matches from DartConnect are showing incorrect stats and standings.

TASKS:
1. Find all DartConnect import code (look for: import-matches.js, parse-dartconnect, etc.)
2. Analyze how match data is parsed and imported
3. Compare imported match processing vs native match processing
4. Identify why stats (3DA, MPR) are calculated incorrectly
5. Identify why standings (wins/losses/points) are wrong
6. Fix the bugs and test the solution
7. Create a summary report of what was broken and what you fixed

Focus on functions/import-matches.js and related files.
Be thorough and test your fixes.
```

---

## Terminal 2: Site Navigation & Visual Analysis

```
I need you to analyze the site navigation and visual design of the BRDC Firebase application located at:
/c/Users/gcfrp/projects/brdc-firebase

TASKS:
1. Map out the complete site navigation structure
   - Main entry points (index.html, landing pages)
   - Navigation menus and flows
   - League navigation (create, view, manage)
   - Player dashboard navigation
   - Match/game flows
   - Admin/director areas

2. Analyze visual design and UI/UX
   - Design consistency (colors, fonts, spacing)
   - UI components and patterns
   - User experience issues
   - Mobile responsiveness
   - Accessibility concerns

3. Provide specific recommendations
   - Navigation improvements
   - Visual/design enhancements
   - UX pain points to address
   - Priority-ranked action items

Focus on public/pages/*.html and CSS files.
Create a comprehensive report with screenshots/examples where helpful.
```

---

## Terminal 3: Heartbreaker Tournament Testing

```
I need you to comprehensively test the Heartbreaker tournament system in the BRDC Firebase application located at:
/c/Users/gcfrp/projects/brdc-firebase

TASKS:
1. Find all Heartbreaker tournament code and documentation
2. Understand the match-making algorithm and rules
3. List all Heartbreaker-specific cloud functions
4. Identify existing tests and test coverage
5. Run/create tests for:
   - Tournament creation
   - Player registration
   - Match-making logic
   - Bracket generation
   - Score submission
   - Winner determination
6. Identify any bugs or edge cases
7. Create a testing report with:
   - What works correctly
   - What's broken
   - Test results
   - Recommended fixes

Search for "heartbreaker", "heart-breaker", or related files.
Be thorough and document everything.
```

---

## How to Use These Prompts

1. Open 2-3 new Claude Code terminal sessions
2. Navigate to the project directory in each: `cd /c/Users/gcfrp/projects/brdc-firebase`
3. Copy and paste one prompt per terminal
4. Let each terminal work independently
5. Collect reports when they complete

The terminals will work in parallel and provide comprehensive analysis and fixes.
