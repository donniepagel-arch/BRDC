/**
 * Game Logger
 * Phase 4 - Integration
 * Logs games to Firebase for tournaments and history
 */

class GameLogger {
    constructor() {
        this.db = null;
        this.currentGame = null;

        // Initialize Firebase if available
        if (typeof firebase !== 'undefined') {
            try {
                this.db = firebase.firestore();
            } catch (err) {
                console.warn('Firebase not available for game logging');
            }
        }
    }

    /**
     * Start logging a new game
     */
    startGame(gameConfig) {
        this.currentGame = {
            id: this.generateGameId(),
            type: gameConfig.gameType, // '501', 'cricket'
            mode: gameConfig.mode || 'practice', // 'practice', 'tournament', 'league'
            tournamentId: gameConfig.tournamentId || null,
            leagueId: gameConfig.leagueId || null,
            matchId: gameConfig.matchId || null,

            // Players
            players: gameConfig.players || [{
                id: gameConfig.playerId,
                name: gameConfig.playerName || 'Player 1',
                side: 'home'
            }],

            // Game settings
            settings: {
                startingScore: gameConfig.startingScore || 501,
                doubleIn: gameConfig.doubleIn || false,
                doubleOut: gameConfig.doubleOut !== false,
                difficulty: gameConfig.difficulty || 'MEDIUM'
            },

            // Timing
            startedAt: Date.now(),
            endedAt: null,
            duration: null,

            // Results
            winner: null,
            finalScores: {},

            // Throws log
            throws: [],
            turns: [],

            // Stats summary
            stats: {
                home: this.createEmptyStats(),
                away: this.createEmptyStats()
            }
        };

        return this.currentGame.id;
    }

    /**
     * Create empty stats object
     */
    createEmptyStats() {
        return {
            darts: 0,
            points: 0,
            turns: 0,
            scores: [],

            // 501 specific
            checkouts: 0,
            highCheckout: 0,
            tons: 0,       // 100+
            ton40: 0,      // 140+
            ton80: 0,      // 180

            // Cricket specific
            marks: 0,
            rounds: 0,
            mpr: 0,

            // Accuracy
            trebleAttempts: 0,
            trebleHits: 0,
            doubleAttempts: 0,
            doubleHits: 0
        };
    }

    /**
     * Generate game ID
     */
    generateGameId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `vd_${timestamp}_${random}`;
    }

    /**
     * Log a throw
     */
    logThrow(throwData) {
        if (!this.currentGame) return;

        const throwLog = {
            timestamp: Date.now(),
            player: throwData.playerId || 'home',
            dartNumber: throwData.dartNumber || (this.currentGame.throws.length % 3) + 1,
            turn: Math.floor(this.currentGame.throws.length / 3) + 1,

            // Target
            target: throwData.target ? {
                segment: throwData.target.segment,
                ring: throwData.target.ring
            } : null,

            // Hit
            hit: {
                segment: throwData.hit.segment,
                ring: throwData.hit.ring,
                score: throwData.hit.score,
                multiplier: throwData.hit.multiplier
            },

            // Swipe data
            swipe: throwData.swipeQuality ? {
                quality: throwData.swipeQuality,
                speed: throwData.swipeSpeed,
                straightness: throwData.swipeStraightness
            } : null,

            // Game state after throw
            scoreAfter: throwData.scoreAfter,
            marksAfter: throwData.marksAfter
        };

        this.currentGame.throws.push(throwLog);

        // Update stats
        this.updateStats(throwData.playerId || 'home', throwData);

        return throwLog;
    }

    /**
     * Update running stats
     */
    updateStats(playerId, throwData) {
        const side = playerId === 'away' ? 'away' : 'home';
        const stats = this.currentGame.stats[side];

        stats.darts++;
        stats.points += throwData.hit.score;

        // Track accuracy
        if (throwData.target) {
            if (throwData.target.ring === 'treble') {
                stats.trebleAttempts++;
                if (throwData.hit.ring === 'treble') {
                    stats.trebleHits++;
                }
            } else if (throwData.target.ring === 'double') {
                stats.doubleAttempts++;
                if (throwData.hit.ring === 'double') {
                    stats.doubleHits++;
                }
            }
        }
    }

    /**
     * Log end of turn
     */
    logTurn(turnData) {
        if (!this.currentGame) return;

        const turnLog = {
            turnNumber: this.currentGame.turns.length + 1,
            player: turnData.playerId || 'home',
            timestamp: Date.now(),
            darts: turnData.darts || 3,
            score: turnData.totalScore,
            scoreRemaining: turnData.scoreRemaining,

            // Notable turn
            notable: null
        };

        // Check for notable scores
        if (turnData.totalScore >= 180) {
            turnLog.notable = '180';
        } else if (turnData.totalScore >= 140) {
            turnLog.notable = 'ton-40';
        } else if (turnData.totalScore >= 100) {
            turnLog.notable = 'ton';
        }

        // Track tons
        const side = turnData.playerId === 'away' ? 'away' : 'home';
        const stats = this.currentGame.stats[side];
        stats.turns++;
        stats.scores.push(turnData.totalScore);

        if (turnData.totalScore >= 180) stats.ton80++;
        else if (turnData.totalScore >= 140) stats.ton40++;
        else if (turnData.totalScore >= 100) stats.tons++;

        this.currentGame.turns.push(turnLog);

        return turnLog;
    }

    /**
     * Log cricket marks for a turn
     */
    logCricketTurn(turnData) {
        if (!this.currentGame) return;

        const side = turnData.playerId === 'away' ? 'away' : 'home';
        const stats = this.currentGame.stats[side];

        stats.marks += turnData.marks;
        stats.rounds++;

        // Track 9-mark rounds
        if (turnData.marks === 9) {
            turnData.notable = '9-mark';
        } else if (turnData.marks >= 6) {
            turnData.notable = `${turnData.marks}-mark`;
        }

        this.currentGame.turns.push({
            turnNumber: this.currentGame.turns.length + 1,
            player: turnData.playerId || 'home',
            timestamp: Date.now(),
            marks: turnData.marks,
            numbers: turnData.numbers, // Which numbers were hit
            notable: turnData.notable
        });
    }

    /**
     * Log checkout
     */
    logCheckout(checkoutData) {
        if (!this.currentGame) return;

        const side = checkoutData.playerId === 'away' ? 'away' : 'home';
        const stats = this.currentGame.stats[side];

        stats.checkouts++;
        if (checkoutData.score > stats.highCheckout) {
            stats.highCheckout = checkoutData.score;
        }

        // Add to last turn
        const lastTurn = this.currentGame.turns[this.currentGame.turns.length - 1];
        if (lastTurn) {
            lastTurn.checkout = {
                score: checkoutData.score,
                darts: checkoutData.darts,
                path: checkoutData.path
            };
        }
    }

    /**
     * End game
     */
    async endGame(result) {
        if (!this.currentGame) return null;

        this.currentGame.endedAt = Date.now();
        this.currentGame.duration = this.currentGame.endedAt - this.currentGame.startedAt;
        this.currentGame.winner = result.winner;
        this.currentGame.finalScores = result.scores;

        // Calculate final stats
        this.calculateFinalStats();

        // Save to Firebase if in tournament/league mode
        if (this.db && (this.currentGame.tournamentId || this.currentGame.leagueId)) {
            await this.saveGame();
        }

        const completedGame = this.currentGame;
        this.currentGame = null;

        return completedGame;
    }

    /**
     * Calculate final stats
     */
    calculateFinalStats() {
        const game = this.currentGame;

        for (const side of ['home', 'away']) {
            const stats = game.stats[side];

            // 3-dart average
            if (stats.darts > 0) {
                stats.threeDartAvg = Math.round((stats.points / stats.darts) * 3 * 100) / 100;
            }

            // Accuracy percentages
            if (stats.trebleAttempts > 0) {
                stats.trebleAccuracy = Math.round((stats.trebleHits / stats.trebleAttempts) * 100);
            }
            if (stats.doubleAttempts > 0) {
                stats.doubleAccuracy = Math.round((stats.doubleHits / stats.doubleAttempts) * 100);
            }

            // Cricket MPR
            if (stats.rounds > 0) {
                stats.mpr = Math.round((stats.marks / stats.rounds) * 100) / 100;
            }
        }
    }

    /**
     * Save game to Firebase
     */
    async saveGame() {
        if (!this.db || !this.currentGame) return;

        try {
            const gameRef = this.db.collection('virtualMatches').doc(this.currentGame.id);
            await gameRef.set(this.currentGame);

            // If part of a tournament, update tournament
            if (this.currentGame.tournamentId && this.currentGame.matchId) {
                await this.updateTournamentMatch();
            }

            // If part of a league, update league
            if (this.currentGame.leagueId && this.currentGame.matchId) {
                await this.updateLeagueMatch();
            }

        } catch (err) {
            console.error('Error saving game:', err);
        }
    }

    /**
     * Update tournament match with virtual game result
     */
    async updateTournamentMatch() {
        // Implementation depends on BRDC tournament structure
        // Would update the match document with the virtual game result
    }

    /**
     * Update league match with virtual game result
     */
    async updateLeagueMatch() {
        // Implementation depends on BRDC league structure
        // Would update the match document with the virtual game result
    }

    /**
     * Get current game state
     */
    getCurrentGame() {
        return this.currentGame;
    }

    /**
     * Get throw history
     */
    getThrowHistory() {
        return this.currentGame ? this.currentGame.throws : [];
    }

    /**
     * Get turn history
     */
    getTurnHistory() {
        return this.currentGame ? this.currentGame.turns : [];
    }

    /**
     * Get current stats
     */
    getCurrentStats() {
        return this.currentGame ? this.currentGame.stats : null;
    }

    /**
     * Export game as JSON
     */
    exportGame() {
        return JSON.stringify(this.currentGame, null, 2);
    }

    /**
     * Abort current game
     */
    abortGame() {
        if (!this.currentGame) return;

        this.currentGame.endedAt = Date.now();
        this.currentGame.duration = this.currentGame.endedAt - this.currentGame.startedAt;
        this.currentGame.winner = null;
        this.currentGame.aborted = true;

        const abortedGame = this.currentGame;
        this.currentGame = null;

        return abortedGame;
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameLogger;
}
