/**
 * Cricket Logic
 * Phase 2 - Aim & Strategy
 * Strategic decision-making for cricket games
 */

const CricketLogic = {
    // Cricket numbers in order of priority
    NUMBERS: [20, 19, 18, 17, 16, 15, 'bull'],

    // Point values
    POINT_VALUES: {
        20: 20,
        19: 19,
        18: 18,
        17: 17,
        16: 16,
        15: 15,
        'bull': 25
    },

    /**
     * Get suggestion for cricket game
     * @param {Object} playerState - Player's marks and points
     * @param {Object} opponentState - Opponent's marks and points (optional)
     * @param {number} dartsRemaining - Darts left in turn
     */
    getSuggestion(playerState, opponentState = null, dartsRemaining = 3) {
        // Solo mode (no opponent)
        if (!opponentState) {
            return this.getSoloSuggestion(playerState);
        }

        // Versus mode - strategic decisions
        const pointDiff = playerState.points - opponentState.points;

        if (pointDiff > 0) {
            // We're ahead in points - focus on CLOSING
            return this.getDefensiveSuggestion(playerState, opponentState, dartsRemaining);
        } else if (pointDiff < 0) {
            // We're behind in points - focus on SCORING
            return this.getOffensiveSuggestion(playerState, opponentState, dartsRemaining);
        } else {
            // Tied - balanced approach
            return this.getBalancedSuggestion(playerState, opponentState, dartsRemaining);
        }
    },

    /**
     * Solo cricket - just close numbers in order
     */
    getSoloSuggestion(playerState) {
        for (const num of this.NUMBERS) {
            if (playerState[num] < 3) {
                const marksNeeded = 3 - playerState[num];
                return {
                    target: this.getTarget(num),
                    reason: `Close ${num === 'bull' ? 'Bulls' : num} (need ${marksNeeded} mark${marksNeeded > 1 ? 's' : ''})`,
                    type: 'close',
                    number: num,
                    marksNeeded,
                    priority: 'high'
                };
            }
        }

        // All closed!
        return {
            target: this.getTarget('bull'),
            reason: 'All numbers closed! Game complete.',
            type: 'complete'
        };
    },

    /**
     * Defensive strategy - close opponent's numbers
     */
    getDefensiveSuggestion(playerState, opponentState, dartsRemaining) {
        // Find opponent's open scoring numbers (their marks >= 3, ours < 3)
        const opponentScoringNumbers = [];

        for (const num of this.NUMBERS) {
            if (opponentState[num] >= 3 && playerState[num] < 3) {
                opponentScoringNumbers.push({
                    number: num,
                    pointValue: this.POINT_VALUES[num],
                    ourMarks: playerState[num],
                    marksToClose: 3 - playerState[num]
                });
            }
        }

        // Prioritize by point value (close their highest scoring numbers first)
        opponentScoringNumbers.sort((a, b) => b.pointValue - a.pointValue);

        if (opponentScoringNumbers.length > 0) {
            const target = opponentScoringNumbers[0];

            // Check if we can close it this turn
            const canClose = target.marksToClose <= dartsRemaining;

            return {
                target: this.getTarget(target.number),
                reason: canClose
                    ? `Close their ${target.number === 'bull' ? 'Bulls' : target.number} to stop their scoring`
                    : `Work on closing ${target.number === 'bull' ? 'Bulls' : target.number} (they're scoring ${target.pointValue}/mark)`,
                type: 'close_defensive',
                number: target.number,
                marksNeeded: target.marksToClose,
                priority: 'high',
                reasoning: `Opponent has ${target.number} open and can score ${target.pointValue} per mark`
            };
        }

        // No opponent scoring numbers - close our own numbers
        return this.getProgressSuggestion(playerState, opponentState);
    },

    /**
     * Offensive strategy - score on our open numbers
     */
    getOffensiveSuggestion(playerState, opponentState, dartsRemaining) {
        const pointsNeeded = opponentState.points - playerState.points;

        // Find our open scoring numbers (our marks >= 3, theirs < 3)
        const ourScoringNumbers = [];

        for (const num of this.NUMBERS) {
            if (playerState[num] >= 3 && opponentState[num] < 3) {
                ourScoringNumbers.push({
                    number: num,
                    pointValue: this.POINT_VALUES[num],
                    theirMarks: opponentState[num]
                });
            }
        }

        // Prioritize by point value
        ourScoringNumbers.sort((a, b) => b.pointValue - a.pointValue);

        if (ourScoringNumbers.length > 0) {
            const target = ourScoringNumbers[0];
            const marksToTie = Math.ceil(pointsNeeded / target.pointValue);

            return {
                target: this.getTarget(target.number),
                reason: `Score on ${target.number === 'bull' ? 'Bulls' : target.number} (${target.pointValue}/mark, need ~${marksToTie} to tie)`,
                type: 'score',
                number: target.number,
                priority: 'high',
                reasoning: `Down by ${pointsNeeded} points - need to score quickly`
            };
        }

        // No open scoring numbers - need to open one
        return this.getOpeningSuggestion(playerState, opponentState);
    },

    /**
     * Balanced strategy for tied games
     */
    getBalancedSuggestion(playerState, opponentState, dartsRemaining) {
        // Look for numbers where:
        // 1. We're close to closing (2 marks)
        // 2. They can score on (3+ marks)

        for (const num of this.NUMBERS) {
            // We have 2 marks, they have 3+ (dangerous)
            if (playerState[num] === 2 && opponentState[num] >= 3) {
                return {
                    target: this.getTarget(num),
                    reason: `Close ${num === 'bull' ? 'Bulls' : num} - you're at 2 marks and they can score`,
                    type: 'close_urgent',
                    number: num,
                    marksNeeded: 1,
                    priority: 'high'
                };
            }
        }

        // Look for best opportunity
        const opportunities = [];

        for (const num of this.NUMBERS) {
            if (playerState[num] < 3) {
                const theirMarks = opponentState[num];
                const ourMarks = playerState[num];

                // Score based on:
                // - Point value
                // - How close we are to closing
                // - Whether they can score
                let score = this.POINT_VALUES[num];
                score += ourMarks * 10; // Bonus for being close
                if (theirMarks >= 3) score += 20; // Urgent if they can score

                opportunities.push({
                    number: num,
                    score,
                    ourMarks,
                    theirMarks,
                    marksNeeded: 3 - ourMarks
                });
            }
        }

        opportunities.sort((a, b) => b.score - a.score);

        if (opportunities.length > 0) {
            const best = opportunities[0];
            return {
                target: this.getTarget(best.number),
                reason: `Work on ${best.number === 'bull' ? 'Bulls' : best.number} (${best.ourMarks}/3 marks)`,
                type: 'progress',
                number: best.number,
                marksNeeded: best.marksNeeded,
                priority: 'medium'
            };
        }

        // Default to highest unclosed number
        return this.getSoloSuggestion(playerState);
    },

    /**
     * Open a number for scoring
     */
    getOpeningSuggestion(playerState, opponentState) {
        // Find highest number we haven't closed that they also haven't closed
        for (const num of this.NUMBERS) {
            if (playerState[num] < 3 && opponentState[num] < 3) {
                return {
                    target: this.getTarget(num),
                    reason: `Open ${num === 'bull' ? 'Bulls' : num} for scoring potential`,
                    type: 'open',
                    number: num,
                    marksNeeded: 3 - playerState[num],
                    priority: 'medium'
                };
            }
        }

        return this.getSoloSuggestion(playerState);
    },

    /**
     * Progress suggestion - close numbers we're working on
     */
    getProgressSuggestion(playerState, opponentState) {
        // Find number we're closest to closing
        let best = null;
        let bestMarks = -1;

        for (const num of this.NUMBERS) {
            if (playerState[num] < 3 && playerState[num] > bestMarks) {
                best = num;
                bestMarks = playerState[num];
            }
        }

        if (best !== null) {
            return {
                target: this.getTarget(best),
                reason: `Finish closing ${best === 'bull' ? 'Bulls' : best} (${bestMarks}/3)`,
                type: 'close',
                number: best,
                marksNeeded: 3 - bestMarks,
                priority: 'medium'
            };
        }

        return this.getSoloSuggestion(playerState);
    },

    /**
     * Get target object for a cricket number
     */
    getTarget(num) {
        if (num === 'bull') {
            return { segment: 50, ring: 'double-bull' };
        }
        return { segment: num, ring: 'treble' };
    },

    /**
     * Calculate MPR (Marks Per Round)
     * @param {number} totalMarks - Total marks scored
     * @param {number} totalRounds - Total rounds thrown
     */
    calculateMPR(totalMarks, totalRounds) {
        if (totalRounds === 0) return 0;
        return Math.round((totalMarks / totalRounds) * 100) / 100;
    },

    /**
     * Analyze a cricket throw
     * @param {Object} hit - Hit result from dartboard
     */
    analyzeThrow(hit) {
        // Check if it's a cricket number
        if (hit.segment >= 15 && hit.segment <= 20) {
            return {
                isCricket: true,
                number: hit.segment,
                marks: hit.multiplier,
                description: `${hit.multiplier} mark${hit.multiplier > 1 ? 's' : ''} on ${hit.segment}`
            };
        }

        if (hit.segment === 25 || hit.segment === 50) {
            const marks = hit.segment === 50 ? 2 : 1;
            return {
                isCricket: true,
                number: 'bull',
                marks,
                description: hit.segment === 50 ? 'Double Bull (2 marks)' : 'Single Bull (1 mark)'
            };
        }

        return {
            isCricket: false,
            number: null,
            marks: 0,
            description: `${hit.segment} - not a cricket number`
        };
    },

    /**
     * Get status summary for cricket game
     */
    getStatusSummary(playerState, opponentState = null) {
        const status = {
            closed: [],
            open: [],
            points: playerState.points
        };

        for (const num of this.NUMBERS) {
            if (playerState[num] >= 3) {
                status.closed.push(num);
            } else {
                status.open.push({ number: num, marks: playerState[num] });
            }
        }

        if (opponentState) {
            status.pointDiff = playerState.points - opponentState.points;
            status.ahead = status.pointDiff > 0;
            status.behind = status.pointDiff < 0;
        }

        return status;
    },

    /**
     * Check if player has won
     */
    checkWin(playerState, opponentState = null) {
        // All numbers must be closed
        for (const num of this.NUMBERS) {
            if (playerState[num] < 3) {
                return { won: false, reason: `${num} not closed` };
            }
        }

        // If playing against opponent, must have equal or more points
        if (opponentState && playerState.points < opponentState.points) {
            return { won: false, reason: 'All closed but behind in points' };
        }

        return { won: true, reason: 'All numbers closed!' };
    },

    /**
     * Get mark symbols for display
     */
    getMarkSymbol(marks) {
        if (marks === 0) return '';
        if (marks === 1) return '/';
        if (marks === 2) return 'X';
        return '\u2A02'; // Circled X (closed)
    },

    /**
     * Get CSS class for mark display
     */
    getMarkClass(marks) {
        if (marks === 0) return 'marks-0';
        if (marks === 1) return 'marks-1';
        if (marks === 2) return 'marks-2';
        return 'marks-closed';
    }
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CricketLogic;
}
