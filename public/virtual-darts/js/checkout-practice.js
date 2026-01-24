/**
 * Checkout Practice Mode
 * Practice finishing checkouts with real dart patterns
 *
 * Features:
 * - Random checkout scores between 2-170 (valid checkout range)
 * - Must finish on doubles/bull
 * - Track checkout percentage by range:
 *   - 2-40 (easy doubles)
 *   - 41-80 (medium)
 *   - 81-120 (hard)
 *   - 121-170 (expert - require combos)
 * - Show checkout suggestions
 * - Save stats to localStorage
 * - Option to filter practice by range
 */

class CheckoutPractice {
    constructor(dartboard, physics, onComplete) {
        this.dartboard = dartboard;
        this.physics = physics;
        this.onComplete = onComplete;

        // Game state
        this.currentCheckout = 0;
        this.currentScore = 0; // Score remaining in current attempt
        this.dartsThrown = 0;
        this.dartsInAttempt = 0;
        this.isActive = false;
        this.checkoutsAttempted = 0;
        this.checkoutsCompleted = 0;

        // Filter settings
        this.rangeFilter = 'all'; // 'all', '2-40', '41-80', '81-120', '121-170'

        // Stats from localStorage
        this.stats = this.loadStats();

        // Checkout suggestions (from outshotTables.js)
        this.checkoutSuggestion = null;

        // Track current attempt
        this.attemptHistory = [];

        // Bogey numbers (impossible checkouts)
        this.bogeyNumbers = [169, 168, 166, 165, 163, 162, 159];
    }

    /**
     * Get the range category for a checkout score
     */
    getRange(score) {
        if (score >= 2 && score <= 40) return '2-40';
        if (score >= 41 && score <= 80) return '41-80';
        if (score >= 81 && score <= 120) return '81-120';
        if (score >= 121 && score <= 170) return '121-170';
        return null;
    }

    /**
     * Get range display name
     */
    getRangeDisplayName(range) {
        const names = {
            '2-40': 'Easy (2-40)',
            '41-80': 'Medium (41-80)',
            '81-120': 'Hard (81-120)',
            '121-170': 'Expert (121-170)'
        };
        return names[range] || range;
    }

    /**
     * Generate a random checkout in the current range
     */
    generateCheckout() {
        let min, max;

        switch (this.rangeFilter) {
            case '2-40':
                min = 2; max = 40;
                break;
            case '41-80':
                min = 41; max = 80;
                break;
            case '81-120':
                min = 81; max = 120;
                break;
            case '121-170':
                min = 121; max = 170;
                break;
            default:
                min = 2; max = 170;
        }

        let checkout;
        let attempts = 0;
        do {
            checkout = Math.floor(Math.random() * (max - min + 1)) + min;
            attempts++;
            // Avoid bogey numbers and ensure valid checkout
        } while ((this.bogeyNumbers.includes(checkout) || !this.isValidCheckout(checkout)) && attempts < 100);

        return checkout;
    }

    /**
     * Check if a score is a valid checkout
     */
    isValidCheckout(score) {
        // Bogey numbers
        if (this.bogeyNumbers.includes(score)) return false;

        // Must be between 2 and 170
        if (score < 2 || score > 170) return false;

        return true;
    }

    /**
     * Start checkout practice
     */
    start() {
        this.isActive = true;
        this.checkoutsAttempted = 0;
        this.checkoutsCompleted = 0;
        this.dartsThrown = 0;

        this.startNewCheckout();
        this.dartboard.clearDarts();
        this.updateUI();
    }

    /**
     * Stop practice
     */
    stop() {
        this.isActive = false;
    }

    /**
     * Start a new checkout attempt
     */
    startNewCheckout() {
        this.currentCheckout = this.generateCheckout();
        this.currentScore = this.currentCheckout;
        this.dartsInAttempt = 0;
        this.attemptHistory = [];
        this.checkoutsAttempted++;

        // Get checkout suggestion
        this.updateSuggestion();

        // Clear darts and update display
        this.dartboard.clearDarts();
        this.dartboard.draw();
        this.updateUI();

        // Set initial target based on suggestion
        this.setTargetFromSuggestion();
    }

    /**
     * Update the checkout suggestion
     */
    updateSuggestion() {
        if (typeof getSuggestedShot === 'function') {
            this.checkoutSuggestion = getSuggestedShot(this.currentScore, 3 - this.dartsInAttempt);
        } else if (typeof OUTSHOT_TABLES !== 'undefined' && OUTSHOT_TABLES[this.currentScore]) {
            const outshot = OUTSHOT_TABLES[this.currentScore];
            this.checkoutSuggestion = {
                type: 'checkout',
                target: outshot.path[0],
                fullPath: outshot.path,
                reason: outshot.desc,
                dartsNeeded: outshot.darts
            };
        } else {
            this.checkoutSuggestion = null;
        }
    }

    /**
     * Set target from current suggestion
     */
    setTargetFromSuggestion() {
        if (!this.checkoutSuggestion) return null;

        const target = this.checkoutSuggestion.target;
        let targetPos = null;

        // Parse target string
        if (typeof parseTarget === 'function') {
            const parsed = parseTarget(target);
            targetPos = this.dartboard.getTargetCenter(parsed.segment, parsed.ring);
        } else {
            // Manual parsing fallback
            if (target === 'Bull') {
                targetPos = this.dartboard.getTargetCenter(50, 'double-bull');
            } else if (target === '25' || target === 'S25') {
                targetPos = this.dartboard.getTargetCenter(25, 'single-bull');
            } else {
                const prefix = target[0];
                const number = parseInt(target.slice(1));
                let ring = 'single';
                if (prefix === 'T') ring = 'treble';
                else if (prefix === 'D') ring = 'double';
                targetPos = this.dartboard.getTargetCenter(number, ring);
            }
        }

        return targetPos;
    }

    /**
     * Get target position for aiming
     */
    getTargetPosition() {
        return this.setTargetFromSuggestion();
    }

    /**
     * Process a dart hit
     */
    processHit(result) {
        if (!this.isActive) return;

        this.dartsThrown++;
        this.dartsInAttempt++;

        const hit = result.hit;
        const score = hit.score;

        // Record throw
        this.attemptHistory.push({
            dartNumber: this.dartsInAttempt,
            hit: hit,
            scoreBefore: this.currentScore,
            scoreAfter: this.currentScore - score
        });

        // Check for bust
        const newScore = this.currentScore - score;

        if (newScore < 0) {
            // Bust - went below zero
            this.showFeedback('BUST!', 'bust');
            this.endAttempt(false);
            return;
        }

        if (newScore === 1) {
            // Bust - left on 1 (can't checkout on double)
            this.showFeedback('BUST!', 'bust');
            this.endAttempt(false);
            return;
        }

        if (newScore === 0) {
            // Check if it was a double
            if (hit.multiplier === 2 || hit.segment === 50) {
                // Checkout successful!
                this.showFeedback(`CHECKOUT! ${this.currentCheckout}`, 'success');
                this.recordCheckoutSuccess();
                this.endAttempt(true);
                return;
            } else {
                // Must finish on double
                this.showFeedback('BUST! Need Double', 'bust');
                this.endAttempt(false);
                return;
            }
        }

        // Valid throw, continue
        this.currentScore = newScore;
        this.updateSuggestion();
        this.updateUI();

        // Check if all 3 darts thrown
        if (this.dartsInAttempt >= 3) {
            this.showFeedback('MISSED', 'miss');
            this.endAttempt(false);
            return;
        }

        // Highlight new target
        this.dartboard.draw();
        const targetPos = this.setTargetFromSuggestion();
        if (targetPos) {
            this.dartboard.drawCrosshair(targetPos.x, targetPos.y);
        }
    }

    /**
     * End the current attempt
     */
    endAttempt(success) {
        // Record stats for this range
        const range = this.getRange(this.currentCheckout);
        if (range) {
            if (!this.stats.ranges[range]) {
                this.stats.ranges[range] = { attempts: 0, successes: 0 };
            }
            this.stats.ranges[range].attempts++;
            if (success) {
                this.stats.ranges[range].successes++;
            }
        }

        // Update total stats
        this.stats.totalAttempts++;
        if (success) {
            this.stats.totalSuccesses++;
            this.checkoutsCompleted++;
        }

        // Save stats
        this.saveStats();

        // Start new checkout after delay
        setTimeout(() => {
            if (this.isActive) {
                this.startNewCheckout();
            }
        }, 1500);
    }

    /**
     * Record a successful checkout
     */
    recordCheckoutSuccess() {
        // Track best checkout
        if (this.currentCheckout > this.stats.bestCheckout) {
            this.stats.bestCheckout = this.currentCheckout;
        }

        // Track checkout history (last 10)
        this.stats.recentCheckouts.push({
            score: this.currentCheckout,
            darts: this.dartsInAttempt,
            date: new Date().toISOString()
        });
        if (this.stats.recentCheckouts.length > 10) {
            this.stats.recentCheckouts.shift();
        }
    }

    /**
     * Show visual feedback
     */
    showFeedback(text, type) {
        const feedbackEl = document.getElementById('checkoutFeedback');
        if (!feedbackEl) return;

        feedbackEl.textContent = text;
        feedbackEl.className = 'checkout-feedback ' + type;
        feedbackEl.classList.remove('hidden');

        setTimeout(() => {
            feedbackEl.classList.add('hidden');
        }, 1200);
    }

    /**
     * Highlight the current target
     */
    highlightTarget() {
        if (!this.checkoutSuggestion) return;

        const target = this.checkoutSuggestion.target;

        if (target === 'Bull') {
            this.dartboard.highlightTarget(50, 'double-bull', 'rgba(255, 255, 0, 0.3)');
        } else if (target === '25' || target === 'S25') {
            this.dartboard.highlightTarget(25, 'single-bull', 'rgba(255, 255, 0, 0.3)');
        } else {
            const prefix = target[0];
            const number = parseInt(target.slice(1));
            let ring = 'single';
            if (prefix === 'T') ring = 'treble';
            else if (prefix === 'D') ring = 'double';
            this.dartboard.highlightTarget(number, ring, 'rgba(255, 255, 0, 0.3)');
        }
    }

    /**
     * Set range filter
     */
    setRangeFilter(range) {
        this.rangeFilter = range;
        if (this.isActive) {
            this.startNewCheckout();
        }
        this.updateUI();
    }

    /**
     * Update UI
     */
    updateUI() {
        // Current checkout target
        const checkoutEl = document.getElementById('checkoutTarget');
        if (checkoutEl) {
            checkoutEl.textContent = this.currentCheckout;
        }

        // Current remaining score
        const remainingEl = document.getElementById('checkoutRemaining');
        if (remainingEl) {
            remainingEl.textContent = this.currentScore;
        }

        // Darts remaining
        const dartsEl = document.getElementById('checkoutDarts');
        if (dartsEl) {
            const remaining = 3 - this.dartsInAttempt;
            dartsEl.textContent = `Darts: ${remaining}`;
        }

        // Session stats
        const sessionEl = document.getElementById('checkoutSession');
        if (sessionEl) {
            const pct = this.checkoutsAttempted > 0
                ? Math.round((this.checkoutsCompleted / this.checkoutsAttempted) * 100)
                : 0;
            sessionEl.textContent = `${this.checkoutsCompleted}/${this.checkoutsAttempted} (${pct}%)`;
        }

        // Suggestion display
        this.updateSuggestionDisplay();

        // Stats display
        this.updateStatsDisplay();
    }

    /**
     * Update suggestion display
     */
    updateSuggestionDisplay() {
        const suggestionEl = document.getElementById('checkoutSuggestion');
        if (!suggestionEl) return;

        if (!this.checkoutSuggestion) {
            suggestionEl.innerHTML = '<span class="suggestion-label">AIM:</span> <span class="suggestion-value">--</span>';
            return;
        }

        let html = `<span class="suggestion-label">AIM:</span> <span class="suggestion-value">${this.checkoutSuggestion.target}</span>`;

        if (this.checkoutSuggestion.fullPath && this.checkoutSuggestion.fullPath.length > 1) {
            html += `<div class="suggestion-path">${this.checkoutSuggestion.fullPath.join(' → ')}</div>`;
        }

        if (this.checkoutSuggestion.reason) {
            html += `<div class="suggestion-reason">${this.checkoutSuggestion.reason}</div>`;
        }

        suggestionEl.innerHTML = html;
    }

    /**
     * Update stats display
     */
    updateStatsDisplay() {
        const statsEl = document.getElementById('checkoutStatsDisplay');
        if (!statsEl) return;

        let html = '<div class="checkout-stats-grid">';

        const ranges = ['2-40', '41-80', '81-120', '121-170'];
        for (const range of ranges) {
            const rangeStats = this.stats.ranges[range] || { attempts: 0, successes: 0 };
            const pct = rangeStats.attempts > 0
                ? Math.round((rangeStats.successes / rangeStats.attempts) * 100)
                : 0;

            const isActive = this.rangeFilter === range || this.rangeFilter === 'all';
            const rangeClass = isActive ? 'active' : '';

            html += `
                <div class="checkout-range-stat ${rangeClass}" data-range="${range}">
                    <div class="range-label">${range}</div>
                    <div class="range-pct">${pct}%</div>
                    <div class="range-count">${rangeStats.successes}/${rangeStats.attempts}</div>
                </div>
            `;
        }

        html += '</div>';

        // Overall stats
        const totalPct = this.stats.totalAttempts > 0
            ? Math.round((this.stats.totalSuccesses / this.stats.totalAttempts) * 100)
            : 0;

        html += `
            <div class="checkout-overall-stats">
                <div class="overall-stat">
                    <span class="stat-label">Total</span>
                    <span class="stat-value">${this.stats.totalSuccesses}/${this.stats.totalAttempts} (${totalPct}%)</span>
                </div>
                <div class="overall-stat">
                    <span class="stat-label">Best</span>
                    <span class="stat-value">${this.stats.bestCheckout || '-'}</span>
                </div>
            </div>
        `;

        statsEl.innerHTML = html;

        // Add click handlers for range filter
        const rangeEls = statsEl.querySelectorAll('.checkout-range-stat');
        rangeEls.forEach(el => {
            el.addEventListener('click', () => {
                const range = el.dataset.range;
                if (this.rangeFilter === range) {
                    // Toggle back to all
                    this.setRangeFilter('all');
                } else {
                    this.setRangeFilter(range);
                }
            });
        });
    }

    /**
     * Load stats from localStorage
     */
    loadStats() {
        const defaultStats = {
            ranges: {
                '2-40': { attempts: 0, successes: 0 },
                '41-80': { attempts: 0, successes: 0 },
                '81-120': { attempts: 0, successes: 0 },
                '121-170': { attempts: 0, successes: 0 }
            },
            totalAttempts: 0,
            totalSuccesses: 0,
            bestCheckout: 0,
            recentCheckouts: []
        };

        try {
            const saved = localStorage.getItem('virtualDarts_checkout_stats');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults
                return { ...defaultStats, ...parsed, ranges: { ...defaultStats.ranges, ...parsed.ranges } };
            }
        } catch (e) {
            console.error('Error loading checkout stats:', e);
        }

        return defaultStats;
    }

    /**
     * Save stats to localStorage
     */
    saveStats() {
        try {
            localStorage.setItem('virtualDarts_checkout_stats', JSON.stringify(this.stats));
        } catch (e) {
            console.error('Error saving checkout stats:', e);
        }
    }

    /**
     * Reset stats
     */
    resetStats() {
        this.stats = {
            ranges: {
                '2-40': { attempts: 0, successes: 0 },
                '41-80': { attempts: 0, successes: 0 },
                '81-120': { attempts: 0, successes: 0 },
                '121-170': { attempts: 0, successes: 0 }
            },
            totalAttempts: 0,
            totalSuccesses: 0,
            bestCheckout: 0,
            recentCheckouts: []
        };
        this.saveStats();
        this.updateUI();
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isActive: this.isActive,
            currentCheckout: this.currentCheckout,
            currentScore: this.currentScore,
            dartsInAttempt: this.dartsInAttempt,
            checkoutsAttempted: this.checkoutsAttempted,
            checkoutsCompleted: this.checkoutsCompleted,
            rangeFilter: this.rangeFilter,
            suggestion: this.checkoutSuggestion
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CheckoutPractice;
}
