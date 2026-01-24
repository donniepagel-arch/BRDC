/**
 * Main Game Controller
 * Phase 1 - MVP
 * Manages game state and coordinates all modules
 */

// ============================================================
// LOCAL STORAGE STATS PERSISTENCE (Phase 4 Integration)
// ============================================================

const STATS_STORAGE_KEY = 'virtualDartsStats';

/**
 * Create default stats object
 */
function createDefaultStats() {
    return {
        gamesPlayed: 0,
        wins: 0,
        bestCheckout: 0,
        total180s: 0,
        bestThreeDartAvg: 0,
        recentAverages: [], // Last 10 game averages
        cricketGamesPlayed: 0,
        cricketWins: 0,
        bestMPR: 0
    };
}

/**
 * Load stats from localStorage
 */
function loadStats() {
    try {
        const saved = localStorage.getItem(STATS_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge with defaults to ensure all fields exist
            return { ...createDefaultStats(), ...parsed };
        }
    } catch (e) {
        console.warn('Failed to load stats from localStorage:', e);
    }
    return createDefaultStats();
}

/**
 * Save stats to localStorage
 */
function saveStats(stats) {
    try {
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
        console.warn('Failed to save stats to localStorage:', e);
    }
}

/**
 * Update stats after a game completes
 * @param {Object} gameResult - The game result data
 * @param {string} gameResult.gameType - '501', 'cricket', or 'bobs27'
 * @param {boolean} gameResult.won - Whether the player won
 * @param {number} gameResult.dartsThrown - Total darts thrown
 * @param {number} gameResult.threeDartAvg - 3-dart average for the game
 * @param {number} [gameResult.checkout] - Checkout score (501 only)
 * @param {number} [gameResult.count180s] - Number of 180s (501 only)
 * @param {number} [gameResult.mpr] - Marks per round (cricket only)
 */
function updateStats(gameResult) {
    const stats = loadStats();

    if (gameResult.gameType === '501') {
        stats.gamesPlayed++;

        if (gameResult.won) {
            stats.wins++;

            // Track best checkout
            if (gameResult.checkout && gameResult.checkout > stats.bestCheckout) {
                stats.bestCheckout = gameResult.checkout;
            }
        }

        // Track 180s
        if (gameResult.count180s) {
            stats.total180s += gameResult.count180s;
        }

        // Track best 3-dart average
        if (gameResult.threeDartAvg && gameResult.threeDartAvg > stats.bestThreeDartAvg) {
            stats.bestThreeDartAvg = gameResult.threeDartAvg;
        }

        // Track recent averages (last 10)
        if (gameResult.threeDartAvg) {
            stats.recentAverages.push(gameResult.threeDartAvg);
            if (stats.recentAverages.length > 10) {
                stats.recentAverages.shift();
            }
        }
    } else if (gameResult.gameType === 'cricket') {
        stats.cricketGamesPlayed++;

        if (gameResult.won) {
            stats.cricketWins++;
        }

        // Track best MPR
        if (gameResult.mpr && gameResult.mpr > stats.bestMPR) {
            stats.bestMPR = gameResult.mpr;
        }
    }
    // Note: bobs27 has its own high score tracking in bobs27.js

    saveStats(stats);
    return stats;
}

/**
 * Generate HTML for lifetime stats display
 */
function generateLifetimeStatsHTML(stats) {
    const avgRecent = stats.recentAverages.length > 0
        ? (stats.recentAverages.reduce((a, b) => a + b, 0) / stats.recentAverages.length).toFixed(1)
        : '-';

    const x01WinRate = stats.gamesPlayed > 0
        ? Math.round((stats.wins / stats.gamesPlayed) * 100)
        : 0;

    const cricketWinRate = stats.cricketGamesPlayed > 0
        ? Math.round((stats.cricketWins / stats.cricketGamesPlayed) * 100)
        : 0;

    return `
        <div class="lifetime-stats">
            <h3>Lifetime Stats</h3>
            <div class="stat-grid">
                <div class="stat">
                    <span class="stat-label">501 Games</span>
                    <span class="stat-value">${stats.gamesPlayed}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">501 Wins</span>
                    <span class="stat-value">${stats.wins} (${x01WinRate}%)</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Best Checkout</span>
                    <span class="stat-value">${stats.bestCheckout || '-'}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Total 180s</span>
                    <span class="stat-value">${stats.total180s}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Best 3DA</span>
                    <span class="stat-value">${stats.bestThreeDartAvg ? stats.bestThreeDartAvg.toFixed(1) : '-'}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Avg (Last 10)</span>
                    <span class="stat-value">${avgRecent}</span>
                </div>
            </div>
            ${stats.cricketGamesPlayed > 0 ? `
            <div class="stat-grid cricket-stats">
                <div class="stat">
                    <span class="stat-label">Cricket Games</span>
                    <span class="stat-value">${stats.cricketGamesPlayed}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Cricket Wins</span>
                    <span class="stat-value">${stats.cricketWins} (${cricketWinRate}%)</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Best MPR</span>
                    <span class="stat-value">${stats.bestMPR ? stats.bestMPR.toFixed(2) : '-'}</span>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

// ============================================================
// END LOCAL STORAGE STATS PERSISTENCE
// ============================================================

class VirtualDarts {
    constructor() {
        // Canvas setup
        this.canvas = document.getElementById('dartboard');
        this.ctx = this.canvas.getContext('2d');

        // Set canvas size (internal resolution stays fixed for consistent physics)
        this.canvas.width = CONFIG.CANVAS.WIDTH;
        this.canvas.height = CONFIG.CANVAS.HEIGHT;

        // Handle responsive canvas sizing
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('orientationchange', () => {
            // Delay to let orientation change complete
            setTimeout(this.handleResize, 100);
        });
        this.handleResize();

        // Initialize components
        this.dartboard = new Dartboard(this.canvas);
        this.physics = new Physics(this.dartboard);
        this.practiceMode = new PracticeMode(this.dartboard, this.physics, this.onPracticeComplete.bind(this));
        this.swipeDetector = new SwipeDetector(this.canvas, this.onSwipe.bind(this));

        // Game state
        this.state = {
            mode: 'menu', // 'menu', 'practice', 'game', 'results'
            baseline: null,
            currentTarget: null,
            dartsThrown: 0,
            dartsInTurn: 0,
            score: CONFIG.GAME.X01_START,
            turnScore: 0,
            gameType: '501', // '501', 'cricket'
            isAnimating: false,
            // Stats tracking for current game
            count180s: 0,
            totalMarks: 0,
            totalRounds: 0
        };

        // Turn history
        this.turnHistory = [];

        // Achievement tracking for current game
        this.gameTurnScores = [];  // Track each turn score for 180 detection
        this.lastCheckoutScore = 0; // Track checkout score for achievement

        // Load lifetime stats from localStorage on initialization
        this.lifetimeStats = loadStats();

        // Bind UI handlers
        this.bindUI();

        // Initial draw
        this.dartboard.draw();

        // Show menu
        this.showScreen('menu');

        // Phase 2+ components (loaded conditionally)
        this.aimSystem = null;
        this.autoSuggest = null;
        this.tipEngine = null;

        // Phase 3+ components
        this.collisionSystem = null;
        this.ochePosition = null;

        // Phase 4+ components
        this.profileManager = null;
        this.gameLogger = null;
        this.statsTracker = null;

        // Bob's 27 game instance
        this.bobs27Game = null;

        // Around the Clock game instance
        this.aroundTheClockGame = null;

        // Checkout Practice game instance
        this.checkoutPracticeGame = null;

        // Initialize phase-specific features
        this.initPhases();
    }

    /**
     * Initialize phase-specific features
     */
    initPhases() {
        // Phase 2: Aim & Strategy
        if (isPhaseEnabled(2)) {
            if (typeof AimSystem !== 'undefined') {
                this.aimSystem = new AimSystem(this.dartboard, this.onTargetSelected.bind(this));
            }
            if (typeof AutoSuggest !== 'undefined') {
                this.autoSuggest = new AutoSuggest();
            }
            if (typeof TipEngine !== 'undefined') {
                this.tipEngine = new TipEngine();
            }
        }

        // Phase 3: Advanced
        if (isPhaseEnabled(3)) {
            if (typeof CollisionSystem !== 'undefined') {
                this.collisionSystem = new CollisionSystem(this.dartboard);
            }
            if (typeof OchePosition !== 'undefined') {
                this.ochePosition = new OchePosition();
            }
        }

        // Phase 4: Integration
        if (isPhaseEnabled(4)) {
            if (typeof ProfileManager !== 'undefined') {
                this.profileManager = new ProfileManager();
            }
            if (typeof GameLogger !== 'undefined') {
                this.gameLogger = new GameLogger();
            }
            if (typeof StatsTracker !== 'undefined') {
                this.statsTracker = new StatsTracker();
            }
        }
    }

    /**
     * Bind UI event handlers
     */
    bindUI() {
        // Menu buttons
        document.getElementById('btnPractice')?.addEventListener('click', () => this.startPractice());
        document.getElementById('btn501')?.addEventListener('click', () => this.startGame('501'));
        document.getElementById('btnCricket')?.addEventListener('click', () => this.startGame('cricket'));
        document.getElementById('btnBobs27')?.addEventListener('click', () => this.startBobs27());

        // Practice buttons
        document.getElementById('btnSkipPractice')?.addEventListener('click', () => this.skipPractice());

        // Game buttons
        document.getElementById('btnEndTurn')?.addEventListener('click', () => this.endTurn());
        document.getElementById('btnNewGame')?.addEventListener('click', () => this.showScreen('menu'));

        // Results buttons
        document.getElementById('btnPlayAgain')?.addEventListener('click', () => this.startGame(this.state.gameType));
        document.getElementById('btnMainMenu')?.addEventListener('click', () => this.showScreen('menu'));

        // Bob's 27 buttons
        document.getElementById('btnBobs27Quit')?.addEventListener('click', () => this.quitBobs27());
        document.getElementById('btnBobs27PlayAgain')?.addEventListener('click', () => this.startBobs27());
        document.getElementById('btnBobs27Menu')?.addEventListener('click', () => this.showScreen('menu'));

        // Around the Clock buttons
        document.getElementById('btnAroundTheClock')?.addEventListener('click', () => this.startAroundTheClock());
        document.getElementById('btnAtcQuit')?.addEventListener('click', () => this.quitAroundTheClock());
        document.getElementById('btnAtcPlayAgain')?.addEventListener('click', () => this.startAroundTheClock());
        document.getElementById('btnAtcMenu')?.addEventListener('click', () => this.showScreen('menu'));

        // Checkout Practice buttons
        document.getElementById('btnCheckoutPractice')?.addEventListener('click', () => this.startCheckoutPractice());
        document.getElementById('btnCheckoutSkip')?.addEventListener('click', () => this.skipCheckout());
        document.getElementById('btnCheckoutQuit')?.addEventListener('click', () => this.quitCheckoutPractice());

        // Difficulty selector
        document.getElementById('difficultySelect')?.addEventListener('change', (e) => {
            setDifficulty(e.target.value);
        });
    }

    /**
     * Handle window resize for responsive canvas
     */
    handleResize() {
        const gameArea = document.querySelector('.game-area');
        if (!gameArea) return;

        // Get available space
        const maxWidth = gameArea.clientWidth - 20; // 10px padding each side
        const maxHeight = window.innerHeight * 0.6; // Max 60% of viewport height

        // Calculate best fit while maintaining aspect ratio
        const canvasAspect = CONFIG.CANVAS.WIDTH / CONFIG.CANVAS.HEIGHT;
        let displayWidth = Math.min(maxWidth, CONFIG.CANVAS.WIDTH);
        let displayHeight = displayWidth / canvasAspect;

        if (displayHeight > maxHeight) {
            displayHeight = maxHeight;
            displayWidth = displayHeight * canvasAspect;
        }

        // Apply CSS sizing (canvas internal resolution stays the same)
        this.canvas.style.width = Math.floor(displayWidth) + 'px';
        this.canvas.style.height = Math.floor(displayHeight) + 'px';
    }

    /**
     * Show a specific screen
     */
    showScreen(screen) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));

        // Show requested screen
        const screenEl = document.getElementById(`screen-${screen}`);
        if (screenEl) {
            screenEl.classList.remove('hidden');
        }

        this.state.mode = screen;

        // Re-calculate canvas size when showing game screens
        if (screen === 'game' || screen === 'practice' || screen === 'bobs27' || screen === 'aroundtheclock' || screen === 'checkout') {
            setTimeout(() => this.handleResize(), 50);
        }
    }

    /**
     * Start practice mode
     */
    startPractice() {
        this.state.mode = 'practice';
        this.showScreen('practice');

        // Set practice target (center of board)
        this.state.currentTarget = {
            x: CONFIG.CANVAS.BOARD_CENTER_X,
            y: CONFIG.CANVAS.BOARD_CENTER_Y
        };

        // Draw target indicator
        this.dartboard.draw();
        this.dartboard.highlightTarget(50, 'bull', 'rgba(255, 255, 0, 0.2)');

        // Start practice mode
        this.practiceMode.start();

        // Update instructions
        this.updatePracticeInstructions();
    }

    /**
     * Update practice instructions
     */
    updatePracticeInstructions() {
        const instructionsEl = document.getElementById('practiceInstructions');
        if (instructionsEl) {
            instructionsEl.innerHTML = `
                <p>Swipe upward to throw darts at the target.</p>
                <p>Throw naturally - we're learning your style.</p>
                <p>Don't aim too carefully, just throw!</p>
            `;
        }
    }

    /**
     * Skip practice mode
     */
    skipPractice() {
        this.state.baseline = this.practiceMode.getDefaultBaseline();
        this.showScreen('menu');
    }

    /**
     * Called when practice mode completes
     */
    onPracticeComplete(baseline) {
        this.state.baseline = baseline;

        // Save baseline to localStorage
        localStorage.setItem('virtualDartsBaseline', JSON.stringify(baseline));

        // Show results
        this.showPracticeResults(baseline);
    }

    /**
     * Show practice results
     */
    showPracticeResults(baseline) {
        this.showScreen('practice-results');

        const resultsEl = document.getElementById('practiceResultsContent');
        if (!resultsEl) return;

        let html = `
            <div class="baseline-summary">
                <h3>Your Throw Profile</h3>
                <div class="stat-grid">
                    <div class="stat">
                        <span class="stat-label">Consistency</span>
                        <span class="stat-value">${baseline.consistency}%</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Grouping</span>
                        <span class="stat-value">${Math.round(baseline.groupingRadius)}px</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Avg Speed</span>
                        <span class="stat-value">${Math.round(baseline.avgSpeed)} px/s</span>
                    </div>
                </div>
            </div>
        `;

        // Strengths
        if (baseline.analysis.strengths.length > 0) {
            html += `<div class="analysis-section strengths">
                <h4>Strengths</h4>
                <ul>${baseline.analysis.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
            </div>`;
        }

        // Weaknesses
        if (baseline.analysis.weaknesses.length > 0) {
            html += `<div class="analysis-section weaknesses">
                <h4>Areas to Improve</h4>
                <ul>${baseline.analysis.weaknesses.map(w => `<li>${w}</li>`).join('')}</ul>
            </div>`;
        }

        // Tendencies
        if (baseline.analysis.tendencies.length > 0) {
            html += `<div class="analysis-section tendencies">
                <h4>Tendencies</h4>
                <ul>${baseline.analysis.tendencies.map(t => `<li>${t}</li>`).join('')}</ul>
            </div>`;
        }

        // Recommendations
        if (baseline.recommendations.length > 0) {
            html += `<div class="analysis-section recommendations">
                <h4>Recommendations</h4>
                <ul>${baseline.recommendations.map(r => `<li><strong>${r.text}</strong>${r.note ? `<br><small>${r.note}</small>` : ''}</li>`).join('')}</ul>
            </div>`;
        }

        resultsEl.innerHTML = html;
    }

    /**
     * Start a game
     */
    startGame(gameType) {
        this.state.gameType = gameType;
        this.state.mode = 'game';
        this.state.dartsThrown = 0;
        this.state.dartsInTurn = 0;
        this.state.turnScore = 0;
        this.turnHistory = [];

        // Reset game-specific stats tracking
        this.state.count180s = 0;
        this.state.totalMarks = 0;
        this.state.totalRounds = 0;

        // Reset achievement tracking for new game
        this.gameTurnScores = [];
        this.lastCheckoutScore = 0;

        // Load baseline from storage if not in state
        if (!this.state.baseline) {
            const saved = localStorage.getItem('virtualDartsBaseline');
            this.state.baseline = saved ? JSON.parse(saved) : this.practiceMode.getDefaultBaseline();
        }

        // Initialize game-specific state
        if (gameType === '501') {
            this.state.score = CONFIG.GAME.X01_START;
            this.start501();
        } else if (gameType === 'cricket') {
            this.initCricket();
            this.startCricket();
        }

        this.showScreen('game');
        this.dartboard.clearDarts();
        this.dartboard.draw();
        this.updateGameUI();
        this.setDefaultTarget();
    }

    /**
     * Start 501 game
     */
    start501() {
        // Hide cricket scoreboard if it was visible
        const scoreboard = document.getElementById('cricketScoreboard');
        if (scoreboard) {
            scoreboard.classList.add('hidden');
        }
        this.state.score = CONFIG.GAME.X01_START;
        this.updateScoreDisplay();
    }

    /**
     * Initialize cricket state
     */
    initCricket() {
        this.state.cricketState = {
            player: {
                20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, bull: 0,
                points: 0
            },
            numbers: [20, 19, 18, 17, 16, 15, 'bull']
        };
    }

    /**
     * Start cricket game
     */
    startCricket() {
        // Show the cricket scoreboard
        const scoreboard = document.getElementById('cricketScoreboard');
        if (scoreboard) {
            scoreboard.classList.remove('hidden');
        }
        this.updateCricketDisplay();
    }

    /**
     * Set default target based on game type
     */
    setDefaultTarget() {
        if (this.state.gameType === '501') {
            // Default to T20
            this.state.currentTarget = this.dartboard.getTargetCenter(20, 'treble');
        } else {
            // Cricket: default to 20
            this.state.currentTarget = this.dartboard.getTargetCenter(20, 'treble');
        }

        // Highlight target
        if (this.state.currentTarget) {
            this.dartboard.draw();
            this.dartboard.drawCrosshair(this.state.currentTarget.x, this.state.currentTarget.y);
        }
    }

    /**
     * Start Bob's 27 game
     */
    startBobs27() {
        this.state.mode = 'bobs27';
        this.state.gameType = 'bobs27';

        // Load baseline from storage if not in state
        if (!this.state.baseline) {
            const saved = localStorage.getItem('virtualDartsBaseline');
            this.state.baseline = saved ? JSON.parse(saved) : this.practiceMode.getDefaultBaseline();
        }

        // Initialize Bob's 27 game if not already
        if (!this.bobs27Game) {
            this.bobs27Game = new Bobs27Game(
                this.dartboard,
                this.physics,
                this.onBobs27End.bind(this)
            );
        }

        // Start the game
        this.bobs27Game.start();

        this.showScreen('bobs27');
        this.dartboard.clearDarts();
        this.dartboard.draw();

        // Set target to current double
        this.setBobs27Target();
    }

    /**
     * Set the target for Bob's 27
     */
    setBobs27Target() {
        if (!this.bobs27Game) return;

        const targetPos = this.bobs27Game.getTargetPosition();
        if (targetPos) {
            this.state.currentTarget = targetPos;
            this.dartboard.draw();
            this.bobs27Game.highlightTarget();
            this.dartboard.drawCrosshair(targetPos.x, targetPos.y);
        }
    }

    /**
     * Quit Bob's 27 game
     */
    quitBobs27() {
        if (this.bobs27Game) {
            this.bobs27Game.stop();
        }
        this.showScreen('menu');
    }

    /**
     * Handle Bob's 27 game end
     */
    onBobs27End(result) {
        this.showBobs27Results(result);
    }

    /**
     * Show Bob's 27 results
     */
    showBobs27Results(result) {
        this.showScreen('bobs27-results');

        const titleEl = document.getElementById('bobs27ResultTitle');
        const contentEl = document.getElementById('bobs27ResultsContent');

        if (titleEl) {
            if (result.completed) {
                titleEl.textContent = result.isNewHighScore ? 'NEW HIGH SCORE!' : 'Game Complete!';
                titleEl.className = result.isNewHighScore ? 'new-highscore' : '';
            } else {
                titleEl.textContent = 'Game Over';
                titleEl.className = 'game-over';
            }
        }

        if (contentEl) {
            let html = `
                <div class="bobs27-final-score ${result.finalScore < 0 ? 'negative' : ''}">
                    <span class="final-score-label">Final Score</span>
                    <span class="final-score-value">${result.finalScore}</span>
                </div>

                <div class="stat-grid">
                    <div class="stat">
                        <span class="stat-label">Rounds</span>
                        <span class="stat-value">${result.roundsCompleted}/21</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Darts</span>
                        <span class="stat-value">${result.totalDarts}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Hits</span>
                        <span class="stat-value">${result.totalHits}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Hit %</span>
                        <span class="stat-value">${result.hitPercentage}%</span>
                    </div>
                </div>
            `;

            // Add round-by-round summary for completed games
            if (result.history && result.history.length > 0) {
                html += `
                    <div class="bobs27-round-summary">
                        <h4>Round Summary</h4>
                        <div class="round-summary-grid">
                `;

                for (const round of result.history) {
                    const changeClass = round.pointChange >= 0 ? 'positive' : 'negative';
                    const changePrefix = round.pointChange >= 0 ? '+' : '';
                    html += `
                        <div class="round-summary-row">
                            <span class="round-target">${round.targetName}</span>
                            <span class="round-hits">${round.hits}/3</span>
                            <span class="round-change ${changeClass}">${changePrefix}${round.pointChange}</span>
                        </div>
                    `;
                }

                html += `
                        </div>
                    </div>
                `;
            }

            contentEl.innerHTML = html;
        }

        // Update high scores display
        this.updateBobs27HighScores();
    }

    /**
     * Update Bob's 27 high scores display
     */
    updateBobs27HighScores() {
        const listEl = document.getElementById('bobs27HighScoresList');
        if (!listEl || !this.bobs27Game) return;

        const highScores = this.bobs27Game.getHighScores();

        if (highScores.length === 0) {
            listEl.innerHTML = '<div class="no-highscores">No high scores yet</div>';
            return;
        }

        let html = '';
        for (let i = 0; i < highScores.length; i++) {
            const entry = highScores[i];
            const date = new Date(entry.date).toLocaleDateString();
            html += `
                <div class="highscore-row ${i === 0 ? 'top-score' : ''}">
                    <span class="highscore-rank">#${i + 1}</span>
                    <span class="highscore-score">${entry.score}</span>
                    <span class="highscore-date">${date}</span>
                </div>
            `;
        }

        listEl.innerHTML = html;
    }

    /**
     * Handle Bob's 27 swipe
     */
    handleBobs27Swipe(swipeData) {
        if (!this.bobs27Game || !this.bobs27Game.isActive) return;

        const target = this.state.currentTarget || this.bobs27Game.getTargetPosition();

        // Calculate throw with baseline
        const result = this.physics.calculateThrow(swipeData, target, this.state.baseline);

        // Check for collisions (Phase 3)
        if (this.collisionSystem && this.dartboard.darts.length > 0) {
            const collision = this.collisionSystem.checkCollision(result, this.dartboard.darts);
            if (collision.collided) {
                result.x = collision.newX;
                result.y = collision.newY;
                result.hit = this.dartboard.calculateHit(result.x, result.y);
                result.deflected = true;
            }
        }

        // Process hit in Bob's 27
        this.bobs27Game.processHit(result);

        // Animate and add dart
        this.animateThrow(swipeData, result);

        // Update target if round changed
        if (this.bobs27Game.isActive) {
            setTimeout(() => this.setBobs27Target(), 100);
        }
    }

    /**
     * Handle swipe input
     */
    onSwipe(swipeData) {
        if (this.state.isAnimating) return;

        // Handle based on current mode
        if (this.state.mode === 'practice') {
            this.handlePracticeSwipe(swipeData);
        } else if (this.state.mode === 'game') {
            this.handleGameSwipe(swipeData);
        } else if (this.state.mode === 'bobs27') {
            this.handleBobs27Swipe(swipeData);
        } else if (this.state.mode === 'aroundtheclock') {
            this.handleAroundTheClockSwipe(swipeData);
        } else if (this.state.mode === 'checkout') {
            this.handleCheckoutPracticeSwipe(swipeData);
        }
    }

    /**
     * Handle swipe during practice
     */
    handlePracticeSwipe(swipeData) {
        // Use center as target for practice
        const target = this.state.currentTarget || {
            x: CONFIG.CANVAS.BOARD_CENTER_X,
            y: CONFIG.CANVAS.BOARD_CENTER_Y
        };

        // Calculate throw
        const result = this.physics.calculateThrow(swipeData, target, null);

        // Record in practice mode
        this.practiceMode.recordThrow(swipeData, result);

        // Animate throw
        this.animateThrow(swipeData, result);
    }

    /**
     * Handle swipe during game
     */
    handleGameSwipe(swipeData) {
        if (this.state.dartsInTurn >= CONFIG.GAME.DARTS_PER_TURN) return;

        const target = this.state.currentTarget || {
            x: CONFIG.CANVAS.BOARD_CENTER_X,
            y: CONFIG.CANVAS.BOARD_CENTER_Y
        };

        // Calculate throw with baseline
        const result = this.physics.calculateThrow(swipeData, target, this.state.baseline);

        // Check for collisions (Phase 3)
        if (this.collisionSystem && this.dartboard.darts.length > 0) {
            const collision = this.collisionSystem.checkCollision(result, this.dartboard.darts);
            if (collision.collided) {
                result.x = collision.newX;
                result.y = collision.newY;
                result.hit = this.dartboard.calculateHit(result.x, result.y);
                result.deflected = true;
            }
        }

        // Process hit based on game type
        if (this.state.gameType === '501') {
            this.process501Hit(result);
        } else {
            this.processCricketHit(result);
        }

        // Animate and add dart
        this.animateThrow(swipeData, result);

        this.state.dartsInTurn++;
        this.state.dartsThrown++;

        // Update UI
        this.updateGameUI();

        // Check for turn end
        if (this.state.dartsInTurn >= CONFIG.GAME.DARTS_PER_TURN) {
            setTimeout(() => this.promptEndTurn(), 500);
        }
    }

    /**
     * Process a 501 hit
     */
    process501Hit(result) {
        const score = result.hit.score;
        const newScore = this.state.score - score;

        // Check for bust
        if (newScore < 0 || (newScore === 1 && CONFIG.GAME.DOUBLE_OUT)) {
            // Bust - turn ends, score reverts
            this.showBust();
            return;
        }

        // Check for checkout requirement
        if (newScore === 0 && CONFIG.GAME.DOUBLE_OUT && result.hit.multiplier !== 2) {
            // Must finish on a double
            this.showBust();
            return;
        }

        // Valid score
        this.state.turnScore += score;
        this.state.score = newScore;

        // Record hit
        this.turnHistory.push({
            hit: result.hit,
            scoreAfter: this.state.score,
            timestamp: Date.now()
        });

        // Update display
        this.updateScoreDisplay();

        // Check for game win
        if (this.state.score === 0) {
            // Track checkout score for achievements (the turn score is the checkout)
            this.lastCheckoutScore = this.state.turnScore;
            this.gameWon();
        }
    }

    /**
     * Process a cricket hit
     */
    processCricketHit(result) {
        const hit = result.hit;
        const state = this.state.cricketState;

        // Determine which number was hit
        let number = null;
        if (hit.segment >= 15 && hit.segment <= 20) {
            number = hit.segment;
        } else if (hit.segment === 25 || hit.segment === 50) {
            number = 'bull';
        }

        if (!number || !state.numbers.includes(number)) {
            // Not a cricket number
            return;
        }

        // Calculate marks
        // For bulls: segment 25 (outer bull) = 1 mark, segment 50 (inner/double bull) = 2 marks
        // For numbered segments: use the multiplier (single=1, double=2, treble=3)
        let marks;
        if (number === 'bull') {
            marks = hit.segment === 50 ? 2 : 1;
        } else {
            marks = hit.multiplier;
        }

        // Track total marks for MPR calculation
        this.state.totalMarks += marks;

        // Apply marks
        const currentMarks = state.player[number];
        const newMarks = currentMarks + marks;

        if (currentMarks < 3) {
            // Still closing
            const marksToClose = Math.min(marks, 3 - currentMarks);
            state.player[number] = Math.min(3, newMarks);

            // Points for excess marks (if opponent hasn't closed - in solo we don't track)
            const excessMarks = marks - marksToClose;
            if (excessMarks > 0 && state.player[number] >= 3) {
                const pointValue = number === 'bull' ? 25 : number;
                state.player.points += excessMarks * pointValue;
            }
        }

        // Record hit
        this.turnHistory.push({
            hit: result.hit,
            number,
            marks,
            timestamp: Date.now()
        });

        // Update display
        this.updateCricketDisplay();

        // Check for win (all numbers closed)
        if (this.checkCricketWin()) {
            this.gameWon();
        }
    }

    /**
     * Check if cricket game is won
     */
    checkCricketWin() {
        const state = this.state.cricketState;
        for (const num of state.numbers) {
            if (state.player[num] < 3) return false;
        }
        return true;
    }

    /**
     * Show bust message
     */
    showBust() {
        const bustEl = document.getElementById('bustMessage');
        if (bustEl) {
            bustEl.classList.remove('hidden');
            setTimeout(() => bustEl.classList.add('hidden'), 2000);
        }

        // End turn immediately
        this.state.dartsInTurn = CONFIG.GAME.DARTS_PER_TURN;
    }

    /**
     * End the current turn
     */
    endTurn() {
        // Track 180s in 501 games
        if (this.state.gameType === '501' && this.state.turnScore === 180) {
            this.state.count180s++;
            // Also record for achievements - check for 180 achievement immediately
            if (typeof AchievementSystem !== 'undefined') {
                AchievementSystem.recordTurnScore(180);
            }
        }

        // Track turn scores for achievement system
        if (this.state.gameType === '501' && this.state.turnScore > 0) {
            this.gameTurnScores.push(this.state.turnScore);
        }

        // Track rounds for cricket MPR calculation
        if (this.state.gameType === 'cricket') {
            this.state.totalRounds++;
        }

        this.state.dartsInTurn = 0;
        this.state.turnScore = 0;
        this.turnHistory = [];
        this.dartboard.clearDarts();
        this.dartboard.draw();
        this.setDefaultTarget();
        this.updateGameUI();
    }

    /**
     * Prompt user to end turn
     */
    promptEndTurn() {
        const endTurnBtn = document.getElementById('btnEndTurn');
        if (endTurnBtn) {
            endTurnBtn.classList.add('pulse');
        }
    }

    /**
     * Game won
     */
    gameWon() {
        this.showScreen('results');

        // Calculate game stats for persistence
        let gameStats = {
            gameType: this.state.gameType,
            won: true,
            dartsThrown: this.state.dartsThrown
        };

        const resultsEl = document.getElementById('gameResults');

        if (this.state.gameType === '501') {
            // Calculate 3-dart average for 501
            const avg = this.state.dartsThrown > 0
                ? Math.round((CONFIG.GAME.X01_START / this.state.dartsThrown) * 3 * 100) / 100
                : 0;

            // Check if the last turn was a 180 (game won without endTurn being called)
            if (this.state.turnScore === 180) {
                this.state.count180s++;
            }

            // Get checkout value from the last hit
            const lastHit = this.turnHistory.length > 0 ? this.turnHistory[this.turnHistory.length - 1] : null;
            const checkout = lastHit ? lastHit.hit.score : 0;

            // Store for achievement tracking
            this.lastCheckoutScore = checkout;

            gameStats.threeDartAvg = avg;
            gameStats.count180s = this.state.count180s;
            gameStats.checkout = checkout;

            if (resultsEl) {
                resultsEl.innerHTML = `
                    <h2>Game Complete!</h2>
                    <div class="result-stats">
                        <div class="stat">
                            <span class="stat-label">Darts</span>
                            <span class="stat-value">${this.state.dartsThrown}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">3-Dart Avg</span>
                            <span class="stat-value">${avg}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Checkout</span>
                            <span class="stat-value">${checkout}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">180s</span>
                            <span class="stat-value">${this.state.count180s}</span>
                        </div>
                    </div>
                `;
            }
        } else if (this.state.gameType === 'cricket') {
            // Account for the final round (game won without endTurn)
            this.state.totalRounds++;

            // Calculate MPR for cricket
            const mpr = this.state.totalRounds > 0
                ? Math.round((this.state.totalMarks / this.state.totalRounds) * 100) / 100
                : 0;

            gameStats.mpr = mpr;
            gameStats.totalMarks = this.state.totalMarks;
            gameStats.totalRounds = this.state.totalRounds;

            if (resultsEl) {
                resultsEl.innerHTML = `
                    <h2>Game Complete!</h2>
                    <div class="result-stats">
                        <div class="stat">
                            <span class="stat-label">Darts</span>
                            <span class="stat-value">${this.state.dartsThrown}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">MPR</span>
                            <span class="stat-value">${mpr}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Marks</span>
                            <span class="stat-value">${this.state.totalMarks}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Rounds</span>
                            <span class="stat-value">${this.state.totalRounds}</span>
                        </div>
                    </div>
                `;
            }
        }

        // Save stats to localStorage and get updated lifetime stats
        this.lifetimeStats = updateStats(gameStats);

        // Display lifetime stats on the results screen
        if (resultsEl) {
            resultsEl.innerHTML += generateLifetimeStatsHTML(this.lifetimeStats);
        }

        // Track achievements on game completion
        this.recordGameAchievements(true);
    }

    /**
     * Record achievements when a game completes
     * @param {boolean} won - Whether the player won
     */
    recordGameAchievements(won) {
        if (typeof AchievementSystem === 'undefined') return;

        // Get current difficulty setting
        const difficultySelect = document.getElementById('difficultySelect');
        const difficulty = difficultySelect ? difficultySelect.value : 'MEDIUM';

        // Build game data for achievements
        const gameData = {
            gameType: this.state.gameType,
            won: won,
            dartsUsed: this.state.dartsThrown,
            difficulty: difficulty,
            checkoutScore: this.lastCheckoutScore,
            turnScores: this.gameTurnScores
        };

        // Record game completion in achievement system
        AchievementSystem.recordGameComplete(gameData);

        // Check for checkout achievement (if there was a checkout)
        if (this.lastCheckoutScore >= 80) {
            AchievementSystem.recordCheckout(this.lastCheckoutScore);
        }
    }

    /**
     * Animate dart throw
     */
    animateThrow(swipeData, result) {
        this.state.isAnimating = true;

        const startPos = { x: swipeData.startX, y: this.canvas.height };
        const endPos = { x: result.x, y: result.y };

        const trajectory = this.physics.calculateTrajectory(startPos, endPos, 20);
        let frame = 0;

        const animate = () => {
            if (frame >= trajectory.length) {
                // Animation complete - add dart
                this.dartboard.addDart(result.x, result.y);
                this.state.isAnimating = false;

                // Show swipe quality popup if available
                if (result.swipeQuality !== undefined) {
                    this.showSwipeQuality(result.swipeQuality);
                }
                return;
            }

            // Draw frame
            this.dartboard.draw();

            // Draw trajectory line (fading)
            const ctx = this.ctx;
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 200, 0, 0.3)';
            ctx.lineWidth = 2;
            for (let i = 0; i < frame; i++) {
                if (i === 0) {
                    ctx.moveTo(trajectory[i].x, trajectory[i].y);
                } else {
                    ctx.lineTo(trajectory[i].x, trajectory[i].y);
                }
            }
            ctx.stroke();

            // Draw dart at current position
            const pos = trajectory[frame];
            this.dartboard.drawDart(pos.x, pos.y, '#ff6600');

            frame++;
            requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     * Update game UI
     */
    updateGameUI() {
        // Update darts remaining
        const dartsEl = document.getElementById('dartsRemaining');
        if (dartsEl) {
            const remaining = CONFIG.GAME.DARTS_PER_TURN - this.state.dartsInTurn;
            dartsEl.textContent = `Darts: ${remaining}`;
        }

        // Update turn score
        const turnScoreEl = document.getElementById('turnScore');
        if (turnScoreEl) {
            turnScoreEl.textContent = `Turn: ${this.state.turnScore}`;
        }

        // End turn button state
        const endTurnBtn = document.getElementById('btnEndTurn');
        if (endTurnBtn) {
            endTurnBtn.disabled = this.state.dartsInTurn === 0;
            if (this.state.dartsInTurn < CONFIG.GAME.DARTS_PER_TURN) {
                endTurnBtn.classList.remove('pulse');
            }
        }
    }

    /**
     * Update 501 score display
     */
    updateScoreDisplay() {
        const scoreEl = document.getElementById('currentScore');
        if (scoreEl) {
            scoreEl.textContent = this.state.score;
        }
    }

    /**
     * Update cricket display
     */
    updateCricketDisplay() {
        const state = this.state.cricketState;

        // Update each number
        for (const num of state.numbers) {
            const el = document.getElementById(`cricket-${num}`);
            if (el) {
                const marks = state.player[num];
                el.innerHTML = this.getCricketMarks(marks);
            }
        }

        // Update points
        const pointsEl = document.getElementById('cricketPoints');
        if (pointsEl) {
            pointsEl.textContent = state.player.points;
        }
    }

    /**
     * Get cricket mark symbols
     */
    getCricketMarks(count) {
        if (count === 0) return '';
        if (count === 1) return '/';
        if (count === 2) return 'X';
        return '<span class="closed">X</span>';
    }

    /**
     * Target selected callback (Phase 2)
     */
    onTargetSelected(target) {
        this.state.currentTarget = target;
        this.dartboard.draw();
        this.dartboard.drawCrosshair(target.x, target.y);
    }

    /**
     * Handle tap for target selection
     */
    handleTap(x, y) {
        if (this.state.mode !== 'game') return;

        // Phase 2: Use aim system if available
        if (this.aimSystem && isPhaseEnabled(2)) {
            this.aimSystem.handleTap(x, y);
        } else {
            // Phase 1: Direct target selection
            this.state.currentTarget = { x, y };
            this.dartboard.draw();
            this.dartboard.drawCrosshair(x, y);
        }
    }

    // ============================================================
    // AROUND THE CLOCK GAME METHODS
    // ============================================================

    /**
     * Start Around the Clock game
     */
    startAroundTheClock() {
        this.state.mode = 'aroundtheclock';
        this.state.gameType = 'aroundtheclock';

        // Load baseline from storage if not in state
        if (!this.state.baseline) {
            const saved = localStorage.getItem('virtualDartsBaseline');
            this.state.baseline = saved ? JSON.parse(saved) : this.practiceMode.getDefaultBaseline();
        }

        // Initialize Around the Clock game if not already
        if (!this.aroundTheClockGame) {
            this.aroundTheClockGame = new AroundTheClockGame(
                this.dartboard,
                this.physics,
                this.onAroundTheClockEnd.bind(this)
            );
        }

        // Start the game
        this.aroundTheClockGame.start();

        this.showScreen('aroundtheclock');
        this.dartboard.clearDarts();
        this.dartboard.draw();

        // Set target to current number
        this.setAroundTheClockTarget();
    }

    /**
     * Set the target for Around the Clock
     */
    setAroundTheClockTarget() {
        if (!this.aroundTheClockGame) return;

        const targetPos = this.aroundTheClockGame.getTargetPosition();
        if (targetPos) {
            this.state.currentTarget = targetPos;
            this.dartboard.draw();
            this.aroundTheClockGame.highlightTarget();
            this.dartboard.drawCrosshair(targetPos.x, targetPos.y);
        }
    }

    /**
     * Quit Around the Clock game
     */
    quitAroundTheClock() {
        if (this.aroundTheClockGame) {
            this.aroundTheClockGame.stop();
        }
        this.showScreen('menu');
    }

    /**
     * Handle Around the Clock game end
     */
    onAroundTheClockEnd(result) {
        this.showAroundTheClockResults(result);
    }

    /**
     * Show Around the Clock results
     */
    showAroundTheClockResults(result) {
        this.showScreen('atc-results');

        const titleEl = document.getElementById('atcResultTitle');
        const contentEl = document.getElementById('atcResultsContent');

        if (titleEl) {
            titleEl.textContent = result.isNewBestTime ? 'NEW BEST TIME!' : 'Complete!';
            titleEl.className = result.isNewBestTime ? 'new-best-time' : '';
        }

        if (contentEl) {
            contentEl.innerHTML = `
                <div class="atc-final-time">
                    <span class="final-time-label">Final Time</span>
                    <span class="final-time-value">${result.formattedTime}</span>
                </div>

                <div class="stat-grid">
                    <div class="stat">
                        <span class="stat-label">Darts</span>
                        <span class="stat-value">${result.dartsThrown}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Targets</span>
                        <span class="stat-value">21/21</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Avg Darts/Target</span>
                        <span class="stat-value">${(result.dartsThrown / 21).toFixed(1)}</span>
                    </div>
                </div>
            `;
        }

        // Update best times display
        this.updateAroundTheClockBestTimes();
    }

    /**
     * Update Around the Clock best times display
     */
    updateAroundTheClockBestTimes() {
        const listEl = document.getElementById('atcBestTimesList');
        if (!listEl || !this.aroundTheClockGame) return;

        const bestTimes = this.aroundTheClockGame.getBestTimes();

        if (bestTimes.length === 0) {
            listEl.innerHTML = '<div class="no-best-times">No best times yet</div>';
            return;
        }

        let html = '';
        for (let i = 0; i < bestTimes.length; i++) {
            const entry = bestTimes[i];
            const date = new Date(entry.date).toLocaleDateString();
            html += `
                <div class="best-time-row ${i === 0 ? 'top-time' : ''}">
                    <span class="best-time-rank">#${i + 1}</span>
                    <span class="best-time-value">${entry.formattedTime}</span>
                    <span class="best-time-darts">${entry.darts} darts</span>
                    <span class="best-time-date">${date}</span>
                </div>
            `;
        }

        listEl.innerHTML = html;
    }

    /**
     * Handle Around the Clock swipe
     */
    handleAroundTheClockSwipe(swipeData) {
        if (!this.aroundTheClockGame || !this.aroundTheClockGame.isActive) return;

        const target = this.state.currentTarget || this.aroundTheClockGame.getTargetPosition();

        // Calculate throw with baseline
        const result = this.physics.calculateThrow(swipeData, target, this.state.baseline);

        // Check for collisions (Phase 3)
        if (this.collisionSystem && this.dartboard.darts.length > 0) {
            const collision = this.collisionSystem.checkCollision(result, this.dartboard.darts);
            if (collision.collided) {
                result.x = collision.newX;
                result.y = collision.newY;
                result.hit = this.dartboard.calculateHit(result.x, result.y);
                result.deflected = true;
            }
        }

        // Process hit in Around the Clock
        this.aroundTheClockGame.processHit(result);

        // Animate and add dart
        this.animateThrow(swipeData, result);

        // Update target if game is still active
        if (this.aroundTheClockGame.isActive) {
            setTimeout(() => this.setAroundTheClockTarget(), 100);
        }
    }

    // ============================================================
    // CHECKOUT PRACTICE GAME METHODS
    // ============================================================

    /**
     * Start Checkout Practice mode
     */
    startCheckoutPractice() {
        this.state.mode = 'checkout';
        this.state.gameType = 'checkout';

        // Load baseline from storage if not in state
        if (!this.state.baseline) {
            const saved = localStorage.getItem('virtualDartsBaseline');
            this.state.baseline = saved ? JSON.parse(saved) : this.practiceMode.getDefaultBaseline();
        }

        // Initialize Checkout Practice game if not already
        if (!this.checkoutPracticeGame) {
            this.checkoutPracticeGame = new CheckoutPractice(
                this.dartboard,
                this.physics,
                null // No end callback needed - it's continuous practice
            );
        }

        // Start the practice
        this.checkoutPracticeGame.start();

        this.showScreen('checkout');
        this.dartboard.clearDarts();
        this.dartboard.draw();

        // Set initial target
        this.setCheckoutTarget();
    }

    /**
     * Set the target for Checkout Practice
     */
    setCheckoutTarget() {
        if (!this.checkoutPracticeGame) return;

        const targetPos = this.checkoutPracticeGame.getTargetPosition();
        if (targetPos) {
            this.state.currentTarget = targetPos;
            this.dartboard.draw();
            this.checkoutPracticeGame.highlightTarget();
            this.dartboard.drawCrosshair(targetPos.x, targetPos.y);
        }
    }

    /**
     * Skip current checkout (generate new one)
     */
    skipCheckout() {
        if (!this.checkoutPracticeGame || !this.checkoutPracticeGame.isActive) return;

        this.checkoutPracticeGame.startNewCheckout();
        this.dartboard.clearDarts();
        this.dartboard.draw();
        this.setCheckoutTarget();
    }

    /**
     * Quit Checkout Practice
     */
    quitCheckoutPractice() {
        if (this.checkoutPracticeGame) {
            this.checkoutPracticeGame.stop();
        }
        this.showScreen('menu');
    }

    /**
     * Handle Checkout Practice swipe
     */
    handleCheckoutPracticeSwipe(swipeData) {
        if (!this.checkoutPracticeGame || !this.checkoutPracticeGame.isActive) return;

        const target = this.state.currentTarget || this.checkoutPracticeGame.getTargetPosition();

        // Calculate throw with baseline
        const result = this.physics.calculateThrow(swipeData, target, this.state.baseline);

        // Check for collisions (Phase 3)
        if (this.collisionSystem && this.dartboard.darts.length > 0) {
            const collision = this.collisionSystem.checkCollision(result, this.dartboard.darts);
            if (collision.collided) {
                result.x = collision.newX;
                result.y = collision.newY;
                result.hit = this.dartboard.calculateHit(result.x, result.y);
                result.deflected = true;
            }
        }

        // Process hit in Checkout Practice
        this.checkoutPracticeGame.processHit(result);

        // Animate and add dart
        this.animateThrow(swipeData, result);

        // Update target if needed
        if (this.checkoutPracticeGame.isActive) {
            setTimeout(() => this.setCheckoutTarget(), 100);
        }
    }

    /**
     * Show swipe quality popup after each throw
     * @param {number} quality - Swipe quality percentage (0-100)
     */
    showSwipeQuality(quality) {
        const popup = document.getElementById('swipeQualityPopup');
        if (!popup) return;

        const percentEl = popup.querySelector('.swipe-quality-percent');
        const labelEl = popup.querySelector('.swipe-quality-label');
        if (!percentEl || !labelEl) return;

        // Determine quality tier and label
        let tier, label;
        if (quality >= 90) {
            tier = 'excellent';
            label = 'EXCELLENT';
        } else if (quality >= 70) {
            tier = 'good';
            label = 'GOOD';
        } else if (quality >= 50) {
            tier = 'ok';
            label = 'OK';
        } else {
            tier = 'poor';
            label = 'POOR';
        }

        // Update content
        percentEl.textContent = `${quality}%`;
        labelEl.textContent = label;

        // Reset classes and apply new tier
        popup.className = 'swipe-quality-popup ' + tier;

        // Clear any existing timeout
        if (this.swipeQualityTimeout) {
            clearTimeout(this.swipeQualityTimeout);
        }

        // Start fade out after 1 second, then hide after animation completes
        this.swipeQualityTimeout = setTimeout(() => {
            popup.classList.add('fade-out');
            setTimeout(() => {
                popup.classList.add('hidden');
                popup.classList.remove('fade-out');
            }, 500);
        }, 1000);
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new VirtualDarts();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualDarts;
}
