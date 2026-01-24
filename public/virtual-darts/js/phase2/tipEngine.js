/**
 * Tip Engine
 * Phase 2 - Aim & Strategy
 * Adjustable tip levels from basic to pro
 */

class TipEngine {
    constructor() {
        // Current tip level (1-4)
        this.level = 2; // Default to intermediate

        // Load saved preference
        const saved = localStorage.getItem('virtualDartsTipLevel');
        if (saved) {
            this.level = parseInt(saved);
        }
    }

    /**
     * Set tip level
     * @param {number} level - 1 (Basic), 2 (Intermediate), 3 (Advanced), 4 (Pro)
     */
    setLevel(level) {
        if (level >= 1 && level <= 4) {
            this.level = level;
            localStorage.setItem('virtualDartsTipLevel', level.toString());
        }
    }

    /**
     * Get current level name
     */
    getLevelName() {
        return CONFIG.TIP_LEVELS[this.level]?.name || 'Unknown';
    }

    /**
     * Get current level settings
     */
    getLevelSettings() {
        return CONFIG.TIP_LEVELS[this.level];
    }

    /**
     * Format a suggestion based on current tip level
     * @param {Object} suggestion - Raw suggestion from AutoSuggest
     * @param {Object} context - Additional context (score, game state, etc.)
     */
    formatTip(suggestion, context = {}) {
        const settings = this.getLevelSettings();
        const tip = {
            level: this.level,
            levelName: this.getLevelName()
        };

        // Level 1: Basic - Just target and points
        if (settings.showTarget) {
            tip.target = this.formatTarget(suggestion.target);
            tip.targetDisplay = this.getTargetDisplay(suggestion.target);
        }

        if (settings.showPoints) {
            tip.points = this.getTargetPoints(suggestion.target);
        }

        // Level 2: Intermediate - Add reasoning and path
        if (settings.showReasoning) {
            tip.reason = suggestion.reason;
        }

        if (settings.showPath && suggestion.fullPath) {
            tip.path = suggestion.fullPath.join(' -> ');
            tip.pathSteps = suggestion.fullPath.map(t => ({
                target: t,
                points: this.getPointsFromString(t)
            }));
        }

        // Level 3: Advanced - Add wedge strategies and board geography
        if (settings.showWedge) {
            tip.wedgeInfo = this.getWedgeInfo(suggestion, context);
            tip.missAnalysis = this.formatMissAnalysis(suggestion.missAnalysis);
        }

        // Level 4: Pro - Add personal stats and success rates
        if (settings.showStats) {
            tip.stats = this.getPersonalStats(suggestion.target, context);
            tip.successRate = this.getSuccessRate(suggestion.target, context);
        }

        return tip;
    }

    /**
     * Format target for display
     */
    formatTarget(target) {
        if (!target) return 'T20';

        if (target.ring === 'double-bull') return 'Bull';
        if (target.ring === 'single-bull') return '25';

        const prefix = target.ring === 'treble' ? 'T' :
                       target.ring === 'double' ? 'D' : 'S';
        return `${prefix}${target.segment}`;
    }

    /**
     * Get display-friendly target description
     */
    getTargetDisplay(target) {
        if (!target) return 'Treble 20';

        if (target.ring === 'double-bull') return 'Bullseye (50)';
        if (target.ring === 'single-bull') return 'Outer Bull (25)';

        const ringName = target.ring === 'treble' ? 'Treble' :
                         target.ring === 'double' ? 'Double' : 'Single';
        return `${ringName} ${target.segment}`;
    }

    /**
     * Get points for a target
     */
    getTargetPoints(target) {
        if (!target) return 60;

        if (target.ring === 'double-bull') return 50;
        if (target.ring === 'single-bull') return 25;

        const multiplier = target.ring === 'treble' ? 3 :
                           target.ring === 'double' ? 2 : 1;
        return target.segment * multiplier;
    }

    /**
     * Get points from target string (e.g., "T20" -> 60)
     */
    getPointsFromString(targetStr) {
        if (targetStr === 'Bull') return 50;
        if (targetStr === '25') return 25;

        const prefix = targetStr[0];
        const number = parseInt(targetStr.slice(1));

        if (prefix === 'T') return number * 3;
        if (prefix === 'D') return number * 2;
        return number;
    }

    /**
     * Get wedge shot information (Level 3+)
     */
    getWedgeInfo(suggestion, context) {
        if (!context.score) return null;

        // Check if there's a wedge shot for this score
        if (typeof AutoSuggest !== 'undefined') {
            const autoSuggest = new AutoSuggest();
            const wedge = autoSuggest.getWedgeShot(context.score);
            if (wedge) {
                return {
                    available: true,
                    description: wedge.target,
                    reason: wedge.reason,
                    outcomes: wedge.outcomes.map(o =>
                        `${o.hit} (${this.getPointsFromString(o.hit)}) -> leaves ${o.leaves} (${o.result})`
                    )
                };
            }
        }

        return { available: false };
    }

    /**
     * Format miss analysis for display (Level 3+)
     */
    formatMissAnalysis(missAnalysis) {
        if (!missAnalysis || missAnalysis.length === 0) return null;

        return missAnalysis.map(scenario => ({
            direction: scenario.direction,
            description: `Miss ${scenario.direction}: ${scenario.hit} (${scenario.score}) -> leaves ${scenario.leaves}`,
            isGood: scenario.leaves >= 2 && scenario.leaves <= 170 && !isBogeyNumber(scenario.leaves)
        }));
    }

    /**
     * Get personal statistics for target (Level 4)
     */
    getPersonalStats(target, context) {
        // This would pull from Firebase in Phase 4
        // For now, return placeholder
        return {
            attempts: 0,
            hits: 0,
            accuracy: null,
            lastHit: null
        };
    }

    /**
     * Get success rate for target (Level 4)
     */
    getSuccessRate(target, context) {
        // This would calculate from player history in Phase 4
        // For now, return estimated rates based on difficulty
        const difficulty = getDifficulty();

        if (!target) return null;

        // Estimated success rates by ring type
        const baseRates = {
            'treble': 15,
            'double': 25,
            'single': 60,
            'inner-single': 50,
            'outer-single': 55,
            'double-bull': 5,
            'single-bull': 15
        };

        const baseRate = baseRates[target.ring] || 30;

        // Adjust for difficulty
        const difficultyMultiplier = {
            'EASY': 1.5,
            'MEDIUM': 1.0,
            'HARD': 0.7,
            'PRO': 0.5
        }[currentDifficulty] || 1.0;

        return Math.round(baseRate * difficultyMultiplier);
    }

    /**
     * Generate tip HTML for UI display
     */
    generateTipHTML(suggestion, context = {}) {
        const tip = this.formatTip(suggestion, context);
        const settings = this.getLevelSettings();

        let html = `<div class="tip-container tip-level-${this.level}">`;

        // Target (always shown)
        html += `<div class="tip-target">
            <span class="tip-label">Target:</span>
            <span class="tip-value">${tip.target}</span>
            <span class="tip-points">(${tip.points})</span>
        </div>`;

        // Reasoning (Level 2+)
        if (settings.showReasoning && tip.reason) {
            html += `<div class="tip-reason">${tip.reason}</div>`;
        }

        // Full path (Level 2+)
        if (settings.showPath && tip.path) {
            html += `<div class="tip-path">
                <span class="tip-label">Path:</span>
                <span class="tip-value">${tip.path}</span>
            </div>`;
        }

        // Wedge info (Level 3+)
        if (settings.showWedge && tip.wedgeInfo?.available) {
            html += `<div class="tip-wedge">
                <span class="tip-label">Wedge Shot:</span>
                <span class="tip-value">${tip.wedgeInfo.description}</span>
                <div class="tip-wedge-reason">${tip.wedgeInfo.reason}</div>
            </div>`;
        }

        // Miss analysis (Level 3+)
        if (settings.showWedge && tip.missAnalysis) {
            html += `<div class="tip-miss-analysis">
                <span class="tip-label">If you miss:</span>
                <ul>`;
            for (const scenario of tip.missAnalysis) {
                const className = scenario.isGood ? 'miss-ok' : 'miss-bad';
                html += `<li class="${className}">${scenario.description}</li>`;
            }
            html += `</ul></div>`;
        }

        // Success rate (Level 4)
        if (settings.showStats && tip.successRate) {
            html += `<div class="tip-success-rate">
                <span class="tip-label">Est. Success:</span>
                <span class="tip-value">${tip.successRate}%</span>
            </div>`;
        }

        html += '</div>';

        return html;
    }

    /**
     * Get simple text tip (for voice/screen readers)
     */
    getTextTip(suggestion, context = {}) {
        const tip = this.formatTip(suggestion, context);
        const settings = this.getLevelSettings();

        let text = `Aim for ${tip.targetDisplay}`;

        if (settings.showPoints) {
            text += ` for ${tip.points} points`;
        }

        if (settings.showReasoning && tip.reason) {
            text += `. ${tip.reason}`;
        }

        if (settings.showPath && tip.path) {
            text += `. Full path: ${tip.path}`;
        }

        return text;
    }

    /**
     * Create settings UI
     */
    createSettingsUI() {
        const settings = this.getLevelSettings();

        let html = `<div class="tip-settings">
            <h3>Tip Level</h3>
            <div class="tip-presets">`;

        for (let level = 1; level <= 4; level++) {
            const levelSettings = CONFIG.TIP_LEVELS[level];
            const isActive = this.level === level;
            html += `<button class="tip-preset ${isActive ? 'active' : ''}"
                     onclick="game.tipEngine.setLevel(${level}); game.tipEngine.updateSettingsUI();">
                ${levelSettings.name}
            </button>`;
        }

        html += `</div>
            <div class="tip-toggles">
                <h4>Current Settings:</h4>
                <ul>
                    <li>Show Target: ${settings.showTarget ? 'Yes' : 'No'}</li>
                    <li>Show Points: ${settings.showPoints ? 'Yes' : 'No'}</li>
                    <li>Show Reasoning: ${settings.showReasoning ? 'Yes' : 'No'}</li>
                    <li>Show Path: ${settings.showPath ? 'Yes' : 'No'}</li>
                    <li>Show Wedge Shots: ${settings.showWedge ? 'Yes' : 'No'}</li>
                    <li>Show Personal Stats: ${settings.showStats ? 'Yes' : 'No'}</li>
                </ul>
            </div>
        </div>`;

        return html;
    }

    /**
     * Update settings UI after change
     */
    updateSettingsUI() {
        const container = document.getElementById('tipSettingsContainer');
        if (container) {
            container.innerHTML = this.createSettingsUI();
        }

        // Also update any active tip display
        const tipDisplay = document.getElementById('currentTip');
        if (tipDisplay && window.game) {
            // Re-render current tip at new level
            // This would need the current suggestion context
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TipEngine;
}
