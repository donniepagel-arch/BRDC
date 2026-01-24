/**
 * Stats Tracker
 * Phase 4 - Integration
 * Calculates and tracks detailed statistics
 */

class StatsTracker {
    constructor() {
        // Running stats for current session
        this.sessionStats = this.createEmptySessionStats();

        // Reference to profile manager for persistence
        this.profileManager = null;
    }

    /**
     * Create empty session stats
     */
    createEmptySessionStats() {
        return {
            startTime: Date.now(),
            gamesPlayed: 0,
            gamesWon: 0,

            // Throwing stats
            totalDarts: 0,
            totalPoints: 0,

            // 501 stats
            x01: {
                legs: 0,
                wins: 0,
                totalDarts: 0,
                totalPoints: 0,
                first9Darts: 0,
                first9Points: 0,
                checkouts: 0,
                checkoutAttempts: 0,
                highCheckout: 0,
                tons: 0,
                ton40: 0,
                ton80: 0
            },

            // Cricket stats
            cricket: {
                legs: 0,
                wins: 0,
                totalMarks: 0,
                totalRounds: 0,
                fiveMarkRounds: 0,
                sixMarkRounds: 0,
                sevenMarkRounds: 0,
                eightMarkRounds: 0,
                nineMarkRounds: 0
            },

            // Accuracy by segment
            segmentAccuracy: {},

            // Accuracy by ring
            ringAccuracy: {
                treble: { attempts: 0, hits: 0 },
                double: { attempts: 0, hits: 0 },
                single: { attempts: 0, hits: 0 },
                bull: { attempts: 0, hits: 0 }
            },

            // Turn scores distribution
            turnScores: []
        };
    }

    /**
     * Set profile manager reference
     */
    setProfileManager(profileManager) {
        this.profileManager = profileManager;
    }

    /**
     * Record a throw
     */
    recordThrow(target, hit, gameType = '501') {
        this.sessionStats.totalDarts++;
        this.sessionStats.totalPoints += hit.score;

        // Update ring accuracy
        if (target) {
            const ringKey = target.ring.includes('bull') ? 'bull' :
                           target.ring === 'treble' ? 'treble' :
                           target.ring === 'double' ? 'double' : 'single';

            this.sessionStats.ringAccuracy[ringKey].attempts++;

            if (hit.ring === target.ring ||
                (ringKey === 'bull' && hit.ring.includes('bull'))) {
                this.sessionStats.ringAccuracy[ringKey].hits++;
            }

            // Update segment accuracy
            const segKey = `${target.segment}_${target.ring}`;
            if (!this.sessionStats.segmentAccuracy[segKey]) {
                this.sessionStats.segmentAccuracy[segKey] = { attempts: 0, hits: 0 };
            }
            this.sessionStats.segmentAccuracy[segKey].attempts++;

            if (hit.segment === target.segment && hit.ring === target.ring) {
                this.sessionStats.segmentAccuracy[segKey].hits++;
            }
        }

        // Update profile if available
        if (this.profileManager) {
            this.profileManager.recordAccuracy(target, hit);
        }

        // Game-specific tracking
        if (gameType === '501') {
            this.sessionStats.x01.totalDarts++;
            this.sessionStats.x01.totalPoints += hit.score;
        }
    }

    /**
     * Record a turn (3 darts)
     */
    recordTurn(turnData) {
        this.sessionStats.turnScores.push(turnData.score);

        if (turnData.gameType === '501') {
            this.record501Turn(turnData);
        } else if (turnData.gameType === 'cricket') {
            this.recordCricketTurn(turnData);
        }
    }

    /**
     * Record 501 turn
     */
    record501Turn(turnData) {
        const x01 = this.sessionStats.x01;

        // Track first 9 darts (first 3 turns)
        if (turnData.turnNumber <= 3) {
            x01.first9Darts += turnData.darts;
            x01.first9Points += turnData.score;
        }

        // Track notable scores
        if (turnData.score >= 180) {
            x01.ton80++;
        } else if (turnData.score >= 140) {
            x01.ton40++;
        } else if (turnData.score >= 100) {
            x01.tons++;
        }
    }

    /**
     * Record cricket turn
     */
    recordCricketTurn(turnData) {
        const cricket = this.sessionStats.cricket;

        cricket.totalMarks += turnData.marks;
        cricket.totalRounds++;

        // Track high mark rounds
        if (turnData.marks >= 9) cricket.nineMarkRounds++;
        else if (turnData.marks >= 8) cricket.eightMarkRounds++;
        else if (turnData.marks >= 7) cricket.sevenMarkRounds++;
        else if (turnData.marks >= 6) cricket.sixMarkRounds++;
        else if (turnData.marks >= 5) cricket.fiveMarkRounds++;
    }

    /**
     * Record checkout attempt
     */
    recordCheckoutAttempt(score, hit, success) {
        const x01 = this.sessionStats.x01;

        x01.checkoutAttempts++;

        if (success) {
            x01.checkouts++;
            if (score > x01.highCheckout) {
                x01.highCheckout = score;
            }
        }
    }

    /**
     * Record game result
     */
    recordGameResult(result) {
        this.sessionStats.gamesPlayed++;
        if (result.won) {
            this.sessionStats.gamesWon++;
        }

        if (result.gameType === '501') {
            this.sessionStats.x01.legs++;
            if (result.won) {
                this.sessionStats.x01.wins++;
            }
        } else if (result.gameType === 'cricket') {
            this.sessionStats.cricket.legs++;
            if (result.won) {
                this.sessionStats.cricket.wins++;
            }
        }

        // Save to profile
        if (this.profileManager) {
            this.profileManager.recordGameResult(result);
        }
    }

    /**
     * Calculate 3-dart average
     */
    get3DA() {
        if (this.sessionStats.totalDarts === 0) return 0;
        return Math.round((this.sessionStats.totalPoints / this.sessionStats.totalDarts) * 3 * 100) / 100;
    }

    /**
     * Calculate first 9 average
     */
    getFirst9Avg() {
        const x01 = this.sessionStats.x01;
        if (x01.first9Darts === 0) return 0;
        return Math.round((x01.first9Points / x01.first9Darts) * 3 * 100) / 100;
    }

    /**
     * Calculate checkout percentage
     */
    getCheckoutPercentage() {
        const x01 = this.sessionStats.x01;
        if (x01.checkoutAttempts === 0) return 0;
        return Math.round((x01.checkouts / x01.checkoutAttempts) * 100);
    }

    /**
     * Calculate MPR (Marks Per Round)
     */
    getMPR() {
        const cricket = this.sessionStats.cricket;
        if (cricket.totalRounds === 0) return 0;
        return Math.round((cricket.totalMarks / cricket.totalRounds) * 100) / 100;
    }

    /**
     * Get accuracy for a ring type
     */
    getRingAccuracy(ringType) {
        const ring = this.sessionStats.ringAccuracy[ringType];
        if (!ring || ring.attempts === 0) return 0;
        return Math.round((ring.hits / ring.attempts) * 100);
    }

    /**
     * Get summary stats
     */
    getSummary() {
        return {
            sessionDuration: Date.now() - this.sessionStats.startTime,
            gamesPlayed: this.sessionStats.gamesPlayed,
            gamesWon: this.sessionStats.gamesWon,
            winRate: this.sessionStats.gamesPlayed > 0
                ? Math.round((this.sessionStats.gamesWon / this.sessionStats.gamesPlayed) * 100)
                : 0,
            totalDarts: this.sessionStats.totalDarts,
            threeDartAvg: this.get3DA(),
            first9Avg: this.getFirst9Avg(),
            checkoutPct: this.getCheckoutPercentage(),
            mpr: this.getMPR(),
            tons: this.sessionStats.x01.tons + this.sessionStats.x01.ton40 + this.sessionStats.x01.ton80,
            ton80s: this.sessionStats.x01.ton80,
            highCheckout: this.sessionStats.x01.highCheckout,
            trebleAccuracy: this.getRingAccuracy('treble'),
            doubleAccuracy: this.getRingAccuracy('double'),
            bullAccuracy: this.getRingAccuracy('bull')
        };
    }

    /**
     * Get detailed stats object
     */
    getDetailedStats() {
        return {
            session: this.sessionStats,
            summary: this.getSummary(),
            accuracy: {
                byRing: Object.fromEntries(
                    Object.entries(this.sessionStats.ringAccuracy).map(([ring, data]) => [
                        ring,
                        data.attempts > 0
                            ? Math.round((data.hits / data.attempts) * 100)
                            : 0
                    ])
                ),
                bySegment: Object.fromEntries(
                    Object.entries(this.sessionStats.segmentAccuracy)
                        .filter(([_, data]) => data.attempts >= 5)
                        .sort((a, b) => b[1].attempts - a[1].attempts)
                        .slice(0, 10)
                        .map(([seg, data]) => [
                            seg,
                            Math.round((data.hits / data.attempts) * 100)
                        ])
                )
            },
            distribution: this.getTurnScoreDistribution()
        };
    }

    /**
     * Get turn score distribution
     */
    getTurnScoreDistribution() {
        const scores = this.sessionStats.turnScores;
        if (scores.length === 0) return {};

        const distribution = {
            '0-20': 0,
            '21-40': 0,
            '41-60': 0,
            '61-80': 0,
            '81-99': 0,
            '100-119': 0,
            '120-139': 0,
            '140-159': 0,
            '160-180': 0
        };

        for (const score of scores) {
            if (score <= 20) distribution['0-20']++;
            else if (score <= 40) distribution['21-40']++;
            else if (score <= 60) distribution['41-60']++;
            else if (score <= 80) distribution['61-80']++;
            else if (score <= 99) distribution['81-99']++;
            else if (score <= 119) distribution['100-119']++;
            else if (score <= 139) distribution['120-139']++;
            else if (score <= 159) distribution['140-159']++;
            else distribution['160-180']++;
        }

        return distribution;
    }

    /**
     * Generate stats HTML
     */
    generateStatsHTML() {
        const summary = this.getSummary();

        return `
            <div class="stats-panel">
                <h3>Session Stats</h3>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${summary.threeDartAvg}</div>
                        <div class="stat-label">3-Dart Avg</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${summary.first9Avg}</div>
                        <div class="stat-label">First 9 Avg</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${summary.checkoutPct}%</div>
                        <div class="stat-label">Checkout %</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${summary.mpr}</div>
                        <div class="stat-label">MPR</div>
                    </div>
                </div>

                <div class="stats-section">
                    <h4>Games</h4>
                    <p>Played: ${summary.gamesPlayed} | Won: ${summary.gamesWon} (${summary.winRate}%)</p>
                </div>

                <div class="stats-section">
                    <h4>High Scores</h4>
                    <p>Tons: ${summary.tons} | 180s: ${summary.ton80s} | High Checkout: ${summary.highCheckout || '-'}</p>
                </div>

                <div class="stats-section">
                    <h4>Accuracy</h4>
                    <p>Treble: ${summary.trebleAccuracy}% | Double: ${summary.doubleAccuracy}% | Bull: ${summary.bullAccuracy}%</p>
                </div>
            </div>
        `;
    }

    /**
     * Reset session stats
     */
    resetSession() {
        this.sessionStats = this.createEmptySessionStats();
    }

    /**
     * Export stats as JSON
     */
    exportStats() {
        return JSON.stringify(this.getDetailedStats(), null, 2);
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatsTracker;
}
