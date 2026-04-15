# AI Agent Techniques & Best Practices
## Compiled from Social App Project Learnings

---

## CORE PHILOSOPHY

**We have an advantage previous teams didn't:** Multi-agent analysis can stress-test systems, identify bugs, and find solutions more thoroughly than any single perspective.

**What this means:**
- Don't assume failures mean something is impossible - they may have failed from incomplete analysis
- Our job is to find the path that works, not just identify problems
- We can be more ambitious because we can test ideas more thoroughly
- Document the analysis - future teams will value seeing we anticipated and addressed concerns

---

## AGENT DEPLOYMENT STRATEGIES

### 1. TIERED AGENT SWARMS

Deploy agents in 3 experience tiers for comprehensive coverage:

#### **Tier 1: New & Creative (Fresh Perspectives)**
- 2-4 years experience equivalent
- **Strengths:** See things veterans miss, question assumptions, user-focused
- **Tasks:**
  - Find confusing patterns or unclear logic
  - Identify user-hostile implementations
  - Suggest plain-English alternatives
  - Question: "Would a first-time user understand this?"

**Example Agents:**
- "Fresh Eyes" - Finds UX issues and confusion
- "Tech-Forward" - Audits technical implementations
- "Startup-Savvy" - Identifies valuable vs worthless features

#### **Tier 2: Experienced & Reliable (Solid Execution)**
- 10-15 years experience equivalent
- **Strengths:** Know exactly what to look for, anticipate problems
- **Tasks:**
  - Predict failure modes and edge cases
  - Identify missing functionality
  - Ensure completeness and correctness
  - Question: "What will break first?"

**Example Agents:**
- "Bug Hunter" - Predicts where code will fail
- "Prior Art" - Finds similar existing solutions
- "Standards Expert" - Ensures compliance and best practices

#### **Tier 3: Senior Strategic (Big Picture)**
- 25-35 years experience equivalent
- **Strengths:** Long-term thinking, defensive strategies, architecture
- **Tasks:**
  - Design optimal system architecture
  - Plan for future evolution and scaling
  - Identify strategic weaknesses
  - Question: "How do we build this to last 20 years?"

**Example Agents:**
- "Architect" - Designs robust system structure
- "Defense Strategist" - Attacks system as adversary, then fixes it
- "Legacy Expert" - Plans long-term maintenance and evolution

---

### 2. DISCUSSION PROTOCOLS

#### **Phase 1: Individual Assessment**
All agents work in parallel, producing individual reports

#### **Phase 2: Cross-Tier Discussion**
- Tier 1 (New) present findings to Tier 2 (Experienced) for validation
- Tier 2 present findings to Tier 3 (Senior) for strategic input
- Tier 3 synthesize and provide strategic direction

#### **Phase 3: Synthesis & Decision**
- Senior agents produce final recommendations
- Voting mechanism for key decisions
- Tiebreaker: Most experienced agents decide

#### **Phase 4: Implementation Plan**
- Convert analysis into actionable tasks
- Priority ranking (P0/P1/P2/P3)
- Specific fixes with code examples

---

### 3. SYSTEMATIC DISCOVERY WALKS

When exploring a codebase or problem space:

#### **Walk Structure:**
1. **Define Primitives** - Core building blocks to analyze
   - Example: Import system, Stats calculator, Standings algorithm
2. **Define Domains** - Application areas
   - Example: Player stats, Team standings, League management
3. **Walk Every Combination** - Primitive × Domain matrix
   - Don't skip "unlikely" combinations - novel insights often there

#### **Scoring Framework:**
For each finding, score on multiple dimensions:
- **Severity** (1-5) - How critical is this issue?
- **Complexity** (1-5) - How hard to fix?
- **Impact** (1-5) - How many users affected?
- **Feasibility** (1-5) - Can it be fixed with current tech?

**Weighted Score** = (Severity × 3) + (Impact × 2) + (Feasibility × 1.5) - (Complexity × 1)

#### **Tag System:**
- `[CRITICAL]` - Blocks core functionality
- `[BLOCKER]` - Prevents deployment
- `[QUICK WIN]` - Easy fix, high value
- `[TECH DEBT]` - Future problem
- `[BORDERLINE]` - Marginal issue
- `[VARIANT OF X]` - Similar to existing issue

---

### 4. MANDATORY CHECKLISTS

Every agent must verify specific items. **DO NOT MISS A THING.**

#### **Code Review Checklist:**
- [ ] All functions have error handling
- [ ] All data inputs are validated
- [ ] All outputs are sanitized
- [ ] All database queries use proper indexing
- [ ] All async operations have timeouts
- [ ] All user-facing errors have helpful messages

#### **Security Checklist:**
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] No authentication bypasses
- [ ] No data leakage in logs
- [ ] No hardcoded credentials
- [ ] No unencrypted sensitive data

#### **Performance Checklist:**
- [ ] No N+1 queries
- [ ] No unbounded loops
- [ ] No memory leaks
- [ ] Database queries optimized
- [ ] Caching implemented where appropriate
- [ ] Rate limiting on expensive operations

---

### 5. OUTPUT REQUIREMENTS

#### **Report Structure:**
Every agent produces a report in `docs/agent-reports/[Agent-ID]-Report.md`

**Required Sections:**
1. **Executive Summary** (1 page max)
   - What was investigated
   - Key findings summary
   - Critical recommendations

2. **Detailed Findings**
   - Issue-by-issue breakdown
   - Code references with line numbers
   - Severity and priority scores

3. **Recommendations**
   - Specific fixes with code examples
   - Priority ranking (P0/P1/P2/P3)
   - Effort estimates (Small/Medium/Large)

4. **Test Plan**
   - How to verify the fix works
   - Test cases to add
   - Regression risks

#### **Final Synthesis:**
All agent reports compile into `MASTER-ANALYSIS.md`:
- Combined executive summary
- Prioritized action items
- Cross-cutting themes
- Strategic recommendations

---

### 6. RALPH LOOP INTEGRATION

For extended autonomous operation, use Ralph Loop:

```
/ralph-loop

Deploy [Agent Type] Swarm:

Phase 1: Spawn agents in parallel to assess [area]
Phase 2: Collect reports and facilitate cross-tier discussion
Phase 3: Synthesize findings
Phase 4: Produce final recommendations

Continue until [completion criteria met]

Key question to answer: [specific decision needed]
```

**Benefits:**
- Agents work autonomously with periodic check-ins
- Multi-hour deep analysis without constant supervision
- Systematic coverage of large problem spaces

---

### 7. COMMON AGENT TYPES FOR SOFTWARE PROJECTS

#### **Analysis Agents:**
- **Code Archaeologist** - Understands legacy code and historical context
- **Bug Hunter** - Finds edge cases and failure modes
- **Performance Analyst** - Identifies bottlenecks and optimization opportunities
- **Security Auditor** - Finds vulnerabilities and attack vectors

#### **Design Agents:**
- **UX Reviewer** - Evaluates user experience and flows
- **Visual Designer** - Assesses aesthetics and consistency
- **Accessibility Expert** - Checks WCAG compliance and usability
- **Mobile Specialist** - Evaluates responsive design and touch interactions

#### **Testing Agents:**
- **Test Architect** - Designs comprehensive test strategies
- **Integration Tester** - Validates end-to-end flows
- **Load Tester** - Stress tests under various conditions
- **Chaos Engineer** - Tests failure scenarios and resilience

#### **Strategic Agents:**
- **Tech Debt Analyst** - Identifies and prioritizes refactoring
- **Scalability Planner** - Plans for growth and future needs
- **Migration Strategist** - Plans major upgrades or platform changes
- **Documentation Expert** - Ensures code is well-documented

---

### 8. AGENT PROMPTING BEST PRACTICES

#### **Be Specific:**
❌ "Analyze the dashboard"
✅ "Analyze dashboard.html lines 1-500, focusing on data loading performance and error handling"

#### **Provide Context:**
❌ "Find bugs"
✅ "Find bugs in the import system. Users report stats are wrong after importing DartConnect matches. Focus on stat calculation differences between imported vs native matches."

#### **Define Success:**
❌ "Review the code"
✅ "Review the code and produce a report with: 1) All bugs found with line numbers, 2) Severity scores, 3) Specific fixes with code examples, 4) Test cases to prevent regression"

#### **Set Boundaries:**
❌ "Make it better"
✅ "Improve error handling in functions/import-matches.js without changing the API interface or database schema"

#### **Use Thoroughness Levels:**
- `quick` - Basic search, 5-10 minutes
- `medium` - Moderate exploration, 15-30 minutes
- `very thorough` - Deep analysis, 30+ minutes

---

### 9. PARALLEL AGENT DEPLOYMENT

#### **When to Use:**
- Large codebase to analyze
- Multiple independent areas to investigate
- Time-sensitive comprehensive review needed

#### **How to Deploy:**
Send a single message with multiple agent spawns:
```
I need parallel analysis of:
1. Navigation flows
2. Visual design
3. Performance issues
4. Security vulnerabilities

[Spawn 4 agents in one message, each with specific focus]
```

#### **Coordination:**
- Each agent works independently
- Reports collected at end
- Synthesis step combines findings
- Deduplication of overlapping issues

---

### 10. SUCCESS CRITERIA

The agent swarm has succeeded when:
1. Every area of concern has been individually assessed
2. All issues identified with severity scores
3. Specific fixes proposed with code examples
4. Priority action list created for immediate execution
5. Test plan drafted to verify fixes
6. Documentation updated

**WE DO NOT MISS A THING.**

---

## REAL-WORLD EXAMPLE: DartConnect Import Fix

### **Problem:**
Imported matches showing incorrect stats and standings

### **Agent Deployment:**
1. **Import System Analyst** - Map data flow from DartConnect to database
2. **Stats Calculator Expert** - Compare imported vs native stat calculations
3. **Standings Algorithm Auditor** - Verify win/loss/point tracking logic

### **Process:**
- Phase 1: Individual analysis (parallel)
- Phase 2: Cross-comparison of findings
- Phase 3: Root cause identification
- Phase 4: Fix implementation with tests

### **Output:**
- Bug report with line numbers
- Root cause analysis
- Code fix with tests
- Verification plan

---

*Compiled: February 3, 2026*
*Based on successful multi-agent strategies from Social App patent portfolio project*
