/**
 * Auto Suggest System
 * Phase 2 - Aim & Strategy
 * Calculates optimal shots and explains WHY
 */

// Import functions from outshotTables.js (handles both browser globals and module systems)
// These functions are defined in outshotTables.js and must be available before this file loads
const _isCheckout = (typeof isCheckout !== 'undefined') ? isCheckout : function(score) {
    // Fallback implementation if outshotTables.js hasn't loaded yet
    const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159];
    return score >= 2 && score <= 170 && !BOGEY_NUMBERS.includes(score);
};

const _isBogeyNumber = (typeof isBogeyNumber !== 'undefined') ? isBogeyNumber : function(score) {
    const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159];
    return BOGEY_NUMBERS.includes(score);
};

const _getCheckout = (typeof getCheckout !== 'undefined') ? getCheckout : function(score) {
    // Minimal fallback - will return null for most scores
    // Full checkout table is in outshotTables.js
    if (typeof OUTSHOT_TABLES !== 'undefined') {
        return OUTSHOT_TABLES[score] || null;
    }
    return null;
};

const _parseTarget = (typeof parseTarget !== 'undefined') ? parseTarget : function(target) {
    if (target === 'Bull') {
        return { segment: 50, ring: 'double-bull' };
    }
    if (target === '25' || target === 'S25') {
        return { segment: 25, ring: 'single-bull' };
    }
    const prefix = target[0];
    const number = parseInt(target.slice(1));
    let ring;
    switch (prefix) {
        case 'T': ring = 'treble'; break;
        case 'D': ring = 'double'; break;
        case 'S': ring = 'single'; break;
        default: ring = 'single';
    }
    return { segment: number, ring };
};

const _SETUP_TARGETS = (typeof SETUP_TARGETS !== 'undefined') ? SETUP_TARGETS : {
    getSetupShot: function(currentScore) {
        const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159];
        if (currentScore > 200) {
            return { target: 'T20', reason: 'Reduce score - aim for maximum' };
        }
        const afterT20 = currentScore - 60;
        if (afterT20 >= 2 && afterT20 <= 170 && !BOGEY_NUMBERS.includes(afterT20)) {
            return { target: 'T20', reason: `Leaves ${afterT20} - a valid checkout` };
        }
        const afterT19 = currentScore - 57;
        if (afterT19 >= 2 && afterT19 <= 170 && !BOGEY_NUMBERS.includes(afterT19)) {
            return { target: 'T19', reason: `Leaves ${afterT19} - a valid checkout` };
        }
        const afterT18 = currentScore - 54;
        if (afterT18 >= 2 && afterT18 <= 170 && !BOGEY_NUMBERS.includes(afterT18)) {
            return { target: 'T18', reason: `Leaves ${afterT18} - a valid checkout` };
        }
        return { target: 'T20', reason: 'Maximum scoring' };
    }
};

// Preferred finishes - easier doubles (D20, D16, D18, D12, D8, D4)
const _PREFERRED_FINISHES = (typeof PREFERRED_FINISHES !== 'undefined') ? PREFERRED_FINISHES : [40, 32, 36, 24, 16, 8];

class AutoSuggest {
    constructor() {
        // Player statistics for personalized suggestions (Phase 4)
        this.playerStats = null;
    }

    /**
     * Get suggestion for 501 game
     * @param {number} score - Current score
     * @param {number} dartsRemaining - Darts left in turn
     * @param {Array} previousThrows - Throws made this turn
     */
    suggest501(score, dartsRemaining = 3, previousThrows = []) {
        // Check for checkout opportunity
        if (_isCheckout(score)) {
            return this.suggestCheckout(score, dartsRemaining);
        }

        // Above checkout range - suggest setup/scoring
        if (score > 170) {
            return this.suggestSetup(score, dartsRemaining);
        }

        // Bogey number - need special handling
        if (_isBogeyNumber(score)) {
            return this.suggestBogeyEscape(score);
        }

        // Standard scoring situation
        return this.suggestScoring(score, dartsRemaining);
    }

    /**
     * Suggest checkout path
     */
    suggestCheckout(score, dartsRemaining) {
        const checkout = _getCheckout(score);

        if (!checkout) {
            return {
                target: _parseTarget('T20'),
                reason: 'No standard checkout - reduce score',
                type: 'scoring'
            };
        }

        // Check if we have enough darts
        if (checkout.darts > dartsRemaining) {
            // Not enough darts - adjust strategy
            if (dartsRemaining === 1) {
                // Only one dart - can only hit direct doubles
                if (checkout.darts === 1) {
                    const target = _parseTarget(checkout.path[0]);
                    return {
                        target,
                        reason: `Checkout! ${checkout.desc}`,
                        type: 'checkout',
                        fullPath: checkout.path,
                        confidence: 'high'
                    };
                } else {
                    // Can't checkout with 1 dart, leave a good finish
                    return this.suggestLeaveGoodFinish(score);
                }
            } else if (dartsRemaining === 2 && checkout.darts === 3) {
                // 2 darts but need 3 - see if there's a 2-dart alternative
                return this.suggestTwoDartCheckout(score);
            }
        }

        // We have enough darts for the checkout
        const firstTarget = _parseTarget(checkout.path[0]);

        // Calculate what happens if we miss
        const missAnalysis = this.analyzeMissScenarios(score, checkout.path[0]);

        return {
            target: firstTarget,
            reason: checkout.desc,
            type: 'checkout',
            fullPath: checkout.path,
            dartsNeeded: checkout.darts,
            missAnalysis,
            confidence: this.getCheckoutConfidence(checkout)
        };
    }

    /**
     * Suggest setup shot to leave a good finish
     */
    suggestSetup(score, dartsRemaining) {
        const setup = _SETUP_TARGETS.getSetupShot(score);
        const target = _parseTarget(setup.target);

        // Calculate what we'd leave
        const scoreValue = this.getTargetValue(setup.target);
        const wouldLeave = score - scoreValue;

        // Check if that's a good leave
        const leaveQuality = this.assessLeaveQuality(wouldLeave);

        return {
            target,
            reason: setup.reason,
            type: 'setup',
            wouldLeave,
            leaveQuality,
            alternative: this.findAlternativeSetup(score)
        };
    }

    /**
     * Suggest escape from bogey number
     */
    suggestBogeyEscape(score) {
        // Find best single to hit to leave a checkout
        const escapeOptions = [];

        for (let i = 1; i <= 20; i++) {
            const newScore = score - i;
            if (_isCheckout(newScore)) {
                const checkout = _getCheckout(newScore);
                escapeOptions.push({
                    single: i,
                    leaves: newScore,
                    checkout,
                    quality: this.assessLeaveQuality(newScore)
                });
            }
        }

        // Also check bull (25)
        const afterBull = score - 25;
        if (_isCheckout(afterBull)) {
            escapeOptions.push({
                single: 25,
                leaves: afterBull,
                checkout: _getCheckout(afterBull),
                quality: this.assessLeaveQuality(afterBull)
            });
        }

        // Sort by leave quality
        escapeOptions.sort((a, b) => b.quality - a.quality);

        if (escapeOptions.length === 0) {
            // No good escape - just hit T20
            return {
                target: _parseTarget('T20'),
                reason: `${score} is tough - reduce score`,
                type: 'bogey'
            };
        }

        const best = escapeOptions[0];
        const targetStr = best.single === 25 ? '25' : `S${best.single}`;

        return {
            target: _parseTarget(targetStr),
            reason: `${score} is a bogey number. Hit ${targetStr} to leave ${best.leaves}`,
            type: 'bogey_escape',
            wouldLeave: best.leaves,
            alternatives: escapeOptions.slice(1, 3).map(o =>
                `S${o.single} leaves ${o.leaves}`
            )
        };
    }

    /**
     * Suggest scoring throw
     */
    suggestScoring(score, dartsRemaining) {
        // Default is T20
        let target = _parseTarget('T20');
        let reason = 'Maximum scoring - treble 20';

        // Check if T19 might be better (leaves better finish)
        const afterT20 = score - 60;
        const afterT19 = score - 57;

        const qualityT20 = this.assessLeaveQuality(afterT20);
        const qualityT19 = this.assessLeaveQuality(afterT19);

        if (qualityT19 > qualityT20 + 10) {
            target = _parseTarget('T19');
            reason = `T19 leaves ${afterT19} - better finish than ${afterT20}`;
        }

        return {
            target,
            reason,
            type: 'scoring',
            wouldLeave: target.segment === 20 ? afterT20 : afterT19
        };
    }

    /**
     * Suggest leaving a good finish with last dart
     */
    suggestLeaveGoodFinish(score) {
        // Find single that leaves a preferred finish
        for (const preferredFinish of _PREFERRED_FINISHES) {
            const needed = score - preferredFinish;
            if (needed >= 1 && needed <= 20) {
                return {
                    target: _parseTarget(`S${needed}`),
                    reason: `Leave ${preferredFinish} for next turn`,
                    type: 'leave',
                    wouldLeave: preferredFinish
                };
            }
            // Check if treble works
            if (needed >= 3 && needed <= 60 && needed % 3 === 0) {
                const trebleNum = needed / 3;
                if (trebleNum <= 20) {
                    return {
                        target: _parseTarget(`T${trebleNum}`),
                        reason: `Leave ${preferredFinish} for next turn`,
                        type: 'leave',
                        wouldLeave: preferredFinish
                    };
                }
            }
        }

        // Default - just reduce score
        return {
            target: _parseTarget('T20'),
            reason: 'Reduce score',
            type: 'scoring'
        };
    }

    /**
     * Find two-dart checkout option
     */
    suggestTwoDartCheckout(score) {
        // Look for scores where first dart leaves a 1-dart finish
        for (let firstScore = 60; firstScore >= 1; firstScore--) {
            const remaining = score - firstScore;

            // Check if remaining is a 1-dart finish
            if (remaining >= 2 && remaining <= 50) {
                const checkout = _getCheckout(remaining);
                if (checkout && checkout.darts === 1) {
                    // Found a 2-dart path
                    const firstTarget = this.scoreToTarget(firstScore);
                    if (firstTarget) {
                        return {
                            target: _parseTarget(firstTarget),
                            reason: `${firstTarget} leaves ${remaining} (${checkout.path[0]})`,
                            type: 'checkout',
                            fullPath: [firstTarget, checkout.path[0]],
                            dartsNeeded: 2
                        };
                    }
                }
            }
        }

        // No 2-dart option found
        return this.suggestLeaveGoodFinish(score);
    }

    /**
     * Convert score to target string
     */
    scoreToTarget(score) {
        // Check trebles first (most efficient)
        if (score <= 60 && score % 3 === 0) {
            return `T${score / 3}`;
        }
        // Check doubles
        if (score <= 40 && score % 2 === 0) {
            return `D${score / 2}`;
        }
        // Check singles
        if (score <= 20) {
            return `S${score}`;
        }
        // Bull
        if (score === 25) return '25';
        if (score === 50) return 'Bull';

        return null;
    }

    /**
     * Get target value in points
     */
    getTargetValue(target) {
        const parsed = _parseTarget(target);
        if (parsed.ring === 'double-bull') return 50;
        if (parsed.ring === 'single-bull') return 25;
        if (parsed.ring === 'treble') return parsed.segment * 3;
        if (parsed.ring === 'double') return parsed.segment * 2;
        return parsed.segment;
    }

    /**
     * Assess quality of a leave (0-100)
     */
    assessLeaveQuality(score) {
        if (score < 2) return 0;
        if (score > 170) return 30; // Still need to reduce

        // Bogey numbers are bad
        if (_isBogeyNumber(score)) return 10;

        // Preferred finishes are best
        if (_PREFERRED_FINISHES.includes(score)) return 100;

        // 1-dart finishes are great
        const checkout = _getCheckout(score);
        if (checkout) {
            if (checkout.darts === 1) return 90;
            if (checkout.darts === 2) return 70;
            return 50;
        }

        return 40;
    }

    /**
     * Find alternative setup shot
     */
    findAlternativeSetup(score) {
        const alternatives = [];

        // Check T19
        const afterT19 = score - 57;
        if (afterT19 >= 2 && afterT19 <= 170 && !_isBogeyNumber(afterT19)) {
            alternatives.push({
                target: 'T19',
                leaves: afterT19,
                quality: this.assessLeaveQuality(afterT19)
            });
        }

        // Check T18
        const afterT18 = score - 54;
        if (afterT18 >= 2 && afterT18 <= 170 && !_isBogeyNumber(afterT18)) {
            alternatives.push({
                target: 'T18',
                leaves: afterT18,
                quality: this.assessLeaveQuality(afterT18)
            });
        }

        return alternatives.sort((a, b) => b.quality - a.quality)[0] || null;
    }

    /**
     * Analyze what happens if we miss the intended target
     */
    analyzeMissScenarios(score, target) {
        const parsed = _parseTarget(target);
        const scenarios = [];

        // Get adjacent segments
        const segments = CONFIG.SEGMENTS;
        const idx = segments.indexOf(parsed.segment);

        if (idx !== -1) {
            const leftSeg = segments[(idx - 1 + 20) % 20];
            const rightSeg = segments[(idx + 1) % 20];

            // Miss left
            const leftScore = parsed.ring === 'treble' ? leftSeg * 3 :
                              parsed.ring === 'double' ? leftSeg * 2 : leftSeg;
            scenarios.push({
                direction: 'left',
                hit: `${parsed.ring === 'treble' ? 'T' : parsed.ring === 'double' ? 'D' : 'S'}${leftSeg}`,
                score: leftScore,
                leaves: score - leftScore
            });

            // Miss right
            const rightScore = parsed.ring === 'treble' ? rightSeg * 3 :
                               parsed.ring === 'double' ? rightSeg * 2 : rightSeg;
            scenarios.push({
                direction: 'right',
                hit: `${parsed.ring === 'treble' ? 'T' : parsed.ring === 'double' ? 'D' : 'S'}${rightSeg}`,
                score: rightScore,
                leaves: score - rightScore
            });

            // Miss single (hit single instead of treble/double)
            if (parsed.ring === 'treble' || parsed.ring === 'double') {
                scenarios.push({
                    direction: 'single',
                    hit: `S${parsed.segment}`,
                    score: parsed.segment,
                    leaves: score - parsed.segment
                });
            }
        }

        return scenarios;
    }

    /**
     * Get confidence level for a checkout
     */
    getCheckoutConfidence(checkout) {
        // Based on typical dart player success rates
        if (checkout.darts === 1) {
            // Single dart finish
            if (checkout.path[0] === 'Bull') return 'medium';
            if (checkout.path[0].startsWith('D')) return 'high';
        }
        if (checkout.darts === 2) return 'medium';
        if (checkout.darts === 3) return 'low';
        return 'medium';
    }

    /**
     * Get suggestion for cricket game
     * @param {Object} playerState - Player's cricket state
     * @param {Object} opponentState - Opponent's cricket state (optional for solo)
     */
    suggestCricket(playerState, opponentState = null) {
        // Use cricket logic module if available
        if (typeof CricketLogic !== 'undefined') {
            return CricketLogic.getSuggestion(playerState, opponentState);
        }

        // Simple fallback logic
        const numbers = [20, 19, 18, 17, 16, 15, 'bull'];

        // Find first unclosed number
        for (const num of numbers) {
            if (playerState[num] < 3) {
                const marksNeeded = 3 - playerState[num];
                return {
                    target: num === 'bull' ?
                        { segment: 50, ring: 'double-bull' } :
                        { segment: num, ring: 'treble' },
                    reason: `Close ${num} (need ${marksNeeded} more mark${marksNeeded > 1 ? 's' : ''})`,
                    type: 'close',
                    marksNeeded
                };
            }
        }

        // All closed - we won!
        return {
            target: { segment: 50, ring: 'double-bull' },
            reason: 'All numbers closed!',
            type: 'complete'
        };
    }

    /**
     * Get wedge shot suggestion (advanced)
     * @param {number} score - Current score
     */
    getWedgeShot(score) {
        // Wedge shots are when aiming between two segments gives good outcomes either way
        const wedgeShots = {
            46: {
                target: '6/10 wedge',
                position: { segment: 6, ring: 'single', offset: 'right' },
                outcomes: [
                    { hit: 'S6', leaves: 40, result: 'D20' },
                    { hit: 'S10', leaves: 36, result: 'D18' },
                    { hit: 'T6', leaves: 28, result: 'D14' },
                    { hit: 'T10', leaves: 16, result: 'D8' }
                ],
                reason: 'All outcomes leave makeable doubles'
            },
            45: {
                target: '5/20 wedge',
                position: { segment: 5, ring: 'single', offset: 'left' },
                outcomes: [
                    { hit: 'S5', leaves: 40, result: 'D20' },
                    { hit: 'S20', leaves: 25, result: 'Need 2 darts' }
                ],
                reason: 'S5 leaves tops, S20 still achievable'
            }
        };

        return wedgeShots[score] || null;
    }

    /**
     * Set player statistics for personalized suggestions
     */
    setPlayerStats(stats) {
        this.playerStats = stats;
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutoSuggest;
}
