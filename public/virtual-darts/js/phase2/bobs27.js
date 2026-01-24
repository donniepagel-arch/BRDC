/**
 * Bob's 27 Game Mode
 * Phase 2 - Practice Games
 * Classic practice game for improving double hitting
 *
 * Rules:
 * - Start with 27 points
 * - Target doubles 1 through 20, then double bull (21 targets total)
 * - Hit the double: add double value to score (e.g., D5 = +10)
 * - Miss all 3 darts: subtract double value from score (e.g., miss D5 = -10)
 * - If score goes negative, game over
 * - Track high scores in localStorage
 */

class Bobs27Game {
    constructor(dartboard, physics, onGameEnd) {
        this.dartboard = dartboard;
        this.physics = physics;
        this.onGameEnd = onGameEnd;

        // Game state
        this.score = 27;
        this.currentTarget = 1; // 1-20 for doubles, 21 for double bull
        this.dartsThrown = 0;
        this.dartsInRound = 0;
        this.hitsInRound = 0;
        this.isActive = false;
        this.isGameOver = false;

        // History tracking
        this.roundHistory = [];
        this.totalHits = 0;
        this.totalMisses = 0;

        // High scores from localStorage
        this.highScores = this.loadHighScores();
    }

    /**
     * Get the target double number (1-20 or 'bull' for 21)
     */
    getTargetNumber() {
        if (this.currentTarget <= 20) {
            return this.currentTarget;
        }
        return 'bull';
    }

    /**
     * Get the display name for current target
     */
    getTargetDisplayName() {
        if (this.currentTarget <= 20) {
            return `D${this.currentTarget}`;
        }
        return 'D-BULL';
    }

    /**
     * Get the point value of the current target
     */
    getTargetValue() {
        if (this.currentTarget <= 20) {
            return this.currentTarget * 2;
        }
        return 50; // Double bull
    }

    /**
     * Start a new game
     */
    start() {
        this.score = 27;
        this.currentTarget = 1;
        this.dartsThrown = 0;
        this.dartsInRound = 0;
        this.hitsInRound = 0;
        this.isActive = true;
        this.isGameOver = false;
        this.roundHistory = [];
        this.totalHits = 0;
        this.totalMisses = 0;

        this.dartboard.clearDarts();
        this.updateUI();
        this.highlightTarget();
    }

    /**
     * Stop the game
     */
    stop() {
        this.isActive = false;
    }

    /**
     * Process a dart hit
     * @param {Object} result - The hit result from physics/dartboard
     */
    processHit(result) {
        if (!this.isActive || this.isGameOver) return;

        this.dartsThrown++;
        this.dartsInRound++;

        const hit = result.hit;
        const isHit = this.checkHit(hit);

        if (isHit) {
            this.hitsInRound++;
            this.totalHits++;
            // Add the double value to score
            this.score += this.getTargetValue();
            this.showHitFeedback(true);
        } else {
            this.totalMisses++;
            this.showHitFeedback(false);
        }

        // Update display
        this.updateUI();

        // Check if round is complete (3 darts thrown)
        if (this.dartsInRound >= 3) {
            this.endRound();
        }
    }

    /**
     * Check if the hit matches the current target double
     */
    checkHit(hit) {
        // Check for double bull (target 21)
        if (this.currentTarget === 21) {
            return hit.ring === 'double-bull' || (hit.segment === 50);
        }

        // Check for number doubles
        return hit.segment === this.currentTarget && hit.multiplier === 2;
    }

    /**
     * End the current round
     */
    endRound() {
        // If no hits in round, subtract the double value
        if (this.hitsInRound === 0) {
            this.score -= this.getTargetValue();
        }

        // Record round history
        this.roundHistory.push({
            target: this.currentTarget,
            targetName: this.getTargetDisplayName(),
            hits: this.hitsInRound,
            pointChange: this.hitsInRound > 0 ? this.getTargetValue() * this.hitsInRound : -this.getTargetValue(),
            scoreAfter: this.score
        });

        // Check for game over (negative score)
        if (this.score < 0) {
            this.gameOver(false);
            return;
        }

        // Move to next target
        this.currentTarget++;
        this.dartsInRound = 0;
        this.hitsInRound = 0;

        // Check if game complete (all 21 targets done)
        if (this.currentTarget > 21) {
            this.gameOver(true);
            return;
        }

        // Clear darts and highlight new target
        this.dartboard.clearDarts();
        this.dartboard.draw();
        this.highlightTarget();
        this.updateUI();
    }

    /**
     * Game over
     */
    gameOver(completed) {
        this.isActive = false;
        this.isGameOver = true;

        const result = {
            completed,
            finalScore: this.score,
            roundsCompleted: this.currentTarget - 1,
            totalDarts: this.dartsThrown,
            totalHits: this.totalHits,
            hitPercentage: this.dartsThrown > 0 ? Math.round((this.totalHits / this.dartsThrown) * 100) : 0,
            history: this.roundHistory
        };

        // Check for new high score
        if (completed && this.score > 0) {
            const isNewHighScore = this.checkAndSaveHighScore(this.score);
            result.isNewHighScore = isNewHighScore;
        }

        // Callback
        if (this.onGameEnd) {
            this.onGameEnd(result);
        }

        return result;
    }

    /**
     * Highlight the current target on the dartboard
     */
    highlightTarget() {
        const targetNum = this.getTargetNumber();

        if (targetNum === 'bull') {
            // Highlight double bull (center)
            const targetPos = this.dartboard.getTargetCenter(50, 'double-bull');
            if (targetPos) {
                this.dartboard.highlightTarget(50, 'double-bull', 'rgba(255, 255, 0, 0.3)');
            }
        } else {
            // Highlight the double ring for the number
            const targetPos = this.dartboard.getTargetCenter(targetNum, 'double');
            if (targetPos) {
                this.dartboard.highlightTarget(targetNum, 'double', 'rgba(255, 255, 0, 0.3)');
            }
        }
    }

    /**
     * Get target center for aiming
     */
    getTargetPosition() {
        const targetNum = this.getTargetNumber();
        if (targetNum === 'bull') {
            return this.dartboard.getTargetCenter(50, 'double-bull');
        }
        return this.dartboard.getTargetCenter(targetNum, 'double');
    }

    /**
     * Show visual feedback for hit/miss
     */
    showHitFeedback(isHit) {
        const feedbackEl = document.getElementById('bobs27Feedback');
        if (!feedbackEl) return;

        feedbackEl.textContent = isHit ? `HIT! +${this.getTargetValue()}` : 'MISS';
        feedbackEl.className = 'bobs27-feedback ' + (isHit ? 'hit' : 'miss');
        feedbackEl.classList.remove('hidden');

        setTimeout(() => {
            feedbackEl.classList.add('hidden');
        }, 800);
    }

    /**
     * Update the game UI
     */
    updateUI() {
        // Current score
        const scoreEl = document.getElementById('bobs27Score');
        if (scoreEl) {
            scoreEl.textContent = this.score;
            scoreEl.classList.toggle('negative', this.score < 0);
        }

        // Current target
        const targetEl = document.getElementById('bobs27Target');
        if (targetEl) {
            targetEl.textContent = this.getTargetDisplayName();
        }

        // Darts in round
        const dartsEl = document.getElementById('bobs27Darts');
        if (dartsEl) {
            const remaining = 3 - this.dartsInRound;
            dartsEl.textContent = `Darts: ${remaining}`;
        }

        // Progress
        const progressEl = document.getElementById('bobs27Progress');
        if (progressEl) {
            progressEl.textContent = `${this.currentTarget}/21`;
        }

        // Progress bar
        const progressBarEl = document.getElementById('bobs27ProgressBar');
        if (progressBarEl) {
            const percent = ((this.currentTarget - 1) / 21) * 100;
            progressBarEl.style.width = `${percent}%`;
        }

        // Round history (last few)
        this.updateHistoryDisplay();
    }

    /**
     * Update the round history display
     */
    updateHistoryDisplay() {
        const historyEl = document.getElementById('bobs27History');
        if (!historyEl) return;

        // Show last 5 rounds
        const recentHistory = this.roundHistory.slice(-5);

        if (recentHistory.length === 0) {
            historyEl.innerHTML = '<div class="history-empty">No rounds completed yet</div>';
            return;
        }

        let html = '';
        for (const round of recentHistory) {
            const changeClass = round.pointChange >= 0 ? 'positive' : 'negative';
            const changePrefix = round.pointChange >= 0 ? '+' : '';
            html += `
                <div class="history-row">
                    <span class="history-target">${round.targetName}</span>
                    <span class="history-hits">${round.hits}/3</span>
                    <span class="history-change ${changeClass}">${changePrefix}${round.pointChange}</span>
                </div>
            `;
        }

        historyEl.innerHTML = html;
    }

    /**
     * Load high scores from localStorage
     */
    loadHighScores() {
        try {
            const saved = localStorage.getItem('bobs27HighScores');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading Bob\'s 27 high scores:', e);
            return [];
        }
    }

    /**
     * Save high scores to localStorage
     */
    saveHighScores() {
        try {
            localStorage.setItem('bobs27HighScores', JSON.stringify(this.highScores));
        } catch (e) {
            console.error('Error saving Bob\'s 27 high scores:', e);
        }
    }

    /**
     * Check if score is a new high score and save it
     */
    checkAndSaveHighScore(score) {
        const entry = {
            score,
            date: new Date().toISOString(),
            hits: this.totalHits,
            darts: this.dartsThrown
        };

        // Add to high scores
        this.highScores.push(entry);

        // Sort by score descending
        this.highScores.sort((a, b) => b.score - a.score);

        // Keep only top 10
        this.highScores = this.highScores.slice(0, 10);

        // Save
        this.saveHighScores();

        // Check if this is the new #1
        return this.highScores[0].score === score && this.highScores[0].date === entry.date;
    }

    /**
     * Get high scores list
     */
    getHighScores() {
        return this.highScores;
    }

    /**
     * Get current game status
     */
    getStatus() {
        return {
            isActive: this.isActive,
            isGameOver: this.isGameOver,
            score: this.score,
            currentTarget: this.currentTarget,
            targetName: this.getTargetDisplayName(),
            dartsInRound: this.dartsInRound,
            dartsThrown: this.dartsThrown,
            roundsCompleted: this.currentTarget - 1,
            totalHits: this.totalHits,
            hitPercentage: this.dartsThrown > 0 ? Math.round((this.totalHits / this.dartsThrown) * 100) : 0
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Bobs27Game;
}
