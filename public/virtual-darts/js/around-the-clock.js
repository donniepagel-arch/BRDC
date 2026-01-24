/**
 * Around the Clock Game Mode
 * Practice game for hitting every number in sequence
 *
 * Rules:
 * - Hit numbers 1 through 20 in order, then bullseye to finish
 * - Any hit on the target number counts (single, double, or treble)
 * - Track time elapsed and total darts thrown
 * - Save best times to localStorage
 */

class AroundTheClockGame {
    constructor(dartboard, physics, onGameEnd) {
        this.dartboard = dartboard;
        this.physics = physics;
        this.onGameEnd = onGameEnd;

        // Game state
        this.currentTarget = 1; // 1-20, then 21 for bull
        this.dartsThrown = 0;
        this.isActive = false;
        this.isGameOver = false;

        // Timer
        this.startTime = null;
        this.elapsedTime = 0;
        this.timerInterval = null;

        // Best times from localStorage
        this.bestTimes = this.loadBestTimes();
    }

    /**
     * Get the current target number (1-20 or 'bull' for 21)
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
            return this.currentTarget.toString();
        }
        return 'BULL';
    }

    /**
     * Start a new game
     */
    start() {
        this.currentTarget = 1;
        this.dartsThrown = 0;
        this.isActive = true;
        this.isGameOver = false;
        this.startTime = Date.now();
        this.elapsedTime = 0;

        // Start timer
        this.startTimer();

        this.dartboard.clearDarts();
        this.updateUI();
        this.highlightTarget();
    }

    /**
     * Stop the game
     */
    stop() {
        this.isActive = false;
        this.stopTimer();
    }

    /**
     * Start the game timer
     */
    startTimer() {
        this.stopTimer(); // Clear any existing timer
        this.timerInterval = setInterval(() => {
            if (this.isActive && !this.isGameOver) {
                this.elapsedTime = Date.now() - this.startTime;
                this.updateTimerDisplay();
            }
        }, 100);
    }

    /**
     * Stop the game timer
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Format time in MM:SS.s format
     */
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const tenths = Math.floor((ms % 1000) / 100);

        return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
    }

    /**
     * Process a dart hit
     * @param {Object} result - The hit result from physics/dartboard
     */
    processHit(result) {
        if (!this.isActive || this.isGameOver) return;

        this.dartsThrown++;

        const hit = result.hit;
        const isHit = this.checkHit(hit);

        if (isHit) {
            this.showHitFeedback(true, hit);

            // Move to next target
            this.currentTarget++;

            // Check if game is complete (hit all 20 + bull)
            if (this.currentTarget > 21) {
                this.gameComplete();
                return;
            }

            // Clear board and highlight new target
            this.dartboard.clearDarts();
            this.dartboard.draw();
            this.highlightTarget();
        } else {
            this.showHitFeedback(false, hit);
        }

        // Update display
        this.updateUI();
    }

    /**
     * Check if the hit matches the current target
     */
    checkHit(hit) {
        // Check for bull (target 21)
        if (this.currentTarget === 21) {
            // Accept either single bull (25) or double bull (50)
            return hit.segment === 25 || hit.segment === 50;
        }

        // Check for number hit (any ring: single, double, or treble)
        return hit.segment === this.currentTarget;
    }

    /**
     * Game completed successfully
     */
    gameComplete() {
        this.isActive = false;
        this.isGameOver = true;
        this.stopTimer();

        const finalTime = this.elapsedTime;
        const isNewBest = this.checkAndSaveBestTime(finalTime);

        const result = {
            completed: true,
            finalTime: finalTime,
            formattedTime: this.formatTime(finalTime),
            dartsThrown: this.dartsThrown,
            isNewBestTime: isNewBest
        };

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
            // Highlight bull
            const targetPos = this.dartboard.getTargetCenter(50, 'bull');
            if (targetPos) {
                this.dartboard.highlightTarget(50, 'bull', 'rgba(255, 255, 0, 0.3)');
            }
        } else {
            // Highlight the entire segment (use outer-single for visibility)
            const targetPos = this.dartboard.getTargetCenter(targetNum, 'outer-single');
            if (targetPos) {
                this.dartboard.highlightTarget(targetNum, 'outer-single', 'rgba(255, 255, 0, 0.3)');
            }
        }
    }

    /**
     * Get target center for aiming
     */
    getTargetPosition() {
        const targetNum = this.getTargetNumber();
        if (targetNum === 'bull') {
            return this.dartboard.getTargetCenter(50, 'bull');
        }
        // Aim for treble for efficiency, but any hit counts
        return this.dartboard.getTargetCenter(targetNum, 'treble');
    }

    /**
     * Show visual feedback for hit/miss
     */
    showHitFeedback(isHit, hit) {
        const feedbackEl = document.getElementById('atcFeedback');
        if (!feedbackEl) return;

        if (isHit) {
            let hitText = 'HIT!';
            if (hit.multiplier === 3) {
                hitText = 'TREBLE!';
            } else if (hit.multiplier === 2) {
                hitText = 'DOUBLE!';
            }
            feedbackEl.textContent = hitText;
        } else {
            feedbackEl.textContent = hit.score > 0 ? `${hit.score}` : 'MISS';
        }

        feedbackEl.className = 'atc-feedback ' + (isHit ? 'hit' : 'miss');
        feedbackEl.classList.remove('hidden');

        setTimeout(() => {
            feedbackEl.classList.add('hidden');
        }, 600);
    }

    /**
     * Update the game UI
     */
    updateUI() {
        // Current target
        const targetEl = document.getElementById('atcTarget');
        if (targetEl) {
            targetEl.textContent = this.getTargetDisplayName();
        }

        // Progress
        const progressEl = document.getElementById('atcProgress');
        if (progressEl) {
            progressEl.textContent = `${this.currentTarget - 1}/21`;
        }

        // Progress bar
        const progressBarEl = document.getElementById('atcProgressBar');
        if (progressBarEl) {
            const percent = ((this.currentTarget - 1) / 21) * 100;
            progressBarEl.style.width = `${percent}%`;
        }

        // Darts thrown
        const dartsEl = document.getElementById('atcDarts');
        if (dartsEl) {
            dartsEl.textContent = `Darts: ${this.dartsThrown}`;
        }

        // Update timer
        this.updateTimerDisplay();
    }

    /**
     * Update the timer display
     */
    updateTimerDisplay() {
        const timerEl = document.getElementById('atcTimer');
        if (timerEl) {
            timerEl.textContent = this.formatTime(this.elapsedTime);
        }
    }

    /**
     * Load best times from localStorage
     */
    loadBestTimes() {
        try {
            const saved = localStorage.getItem('virtualDarts_aroundTheClock_bestTimes');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading Around the Clock best times:', e);
            return [];
        }
    }

    /**
     * Save best times to localStorage
     */
    saveBestTimes() {
        try {
            localStorage.setItem('virtualDarts_aroundTheClock_bestTimes', JSON.stringify(this.bestTimes));
        } catch (e) {
            console.error('Error saving Around the Clock best times:', e);
        }
    }

    /**
     * Check if time is a new best and save it
     */
    checkAndSaveBestTime(timeMs) {
        const entry = {
            time: timeMs,
            formattedTime: this.formatTime(timeMs),
            darts: this.dartsThrown,
            date: new Date().toISOString()
        };

        // Add to best times
        this.bestTimes.push(entry);

        // Sort by time ascending (fastest first)
        this.bestTimes.sort((a, b) => a.time - b.time);

        // Keep only top 5
        this.bestTimes = this.bestTimes.slice(0, 5);

        // Save
        this.saveBestTimes();

        // Check if this is the new #1
        return this.bestTimes[0].time === timeMs && this.bestTimes[0].date === entry.date;
    }

    /**
     * Get best times list
     */
    getBestTimes() {
        return this.bestTimes;
    }

    /**
     * Get current game status
     */
    getStatus() {
        return {
            isActive: this.isActive,
            isGameOver: this.isGameOver,
            currentTarget: this.currentTarget,
            targetName: this.getTargetDisplayName(),
            dartsThrown: this.dartsThrown,
            elapsedTime: this.elapsedTime,
            formattedTime: this.formatTime(this.elapsedTime),
            targetsCompleted: this.currentTarget - 1
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AroundTheClockGame;
}
