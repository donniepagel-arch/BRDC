/**
 * Profile Manager
 * Phase 4 - Integration
 * Manages player profiles with Firebase integration
 */

class ProfileManager {
    constructor() {
        // Firebase references
        this.db = null;
        this.auth = null;

        // Current user
        this.currentUser = null;
        this.profile = null;

        // Local cache
        this.localProfile = this.loadLocalProfile();

        // Initialize Firebase if available
        this.initFirebase();
    }

    /**
     * Initialize Firebase connection
     */
    async initFirebase() {
        // Check if Firebase is available
        if (typeof firebase !== 'undefined') {
            try {
                this.db = firebase.firestore();
                this.auth = firebase.auth();

                // Listen for auth state changes
                this.auth.onAuthStateChanged((user) => {
                    if (user) {
                        this.currentUser = user;
                        this.loadProfile();
                    } else {
                        this.currentUser = null;
                        this.profile = null;
                    }
                });
            } catch (err) {
                console.warn('Firebase initialization failed:', err);
            }
        }
    }

    /**
     * Load local profile from localStorage
     */
    loadLocalProfile() {
        const saved = localStorage.getItem('virtualDartsProfile');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return this.createDefaultProfile();
            }
        }
        return this.createDefaultProfile();
    }

    /**
     * Create default profile
     */
    createDefaultProfile() {
        return {
            id: this.generateLocalId(),
            name: 'Guest',
            createdAt: Date.now(),

            // Throw baseline
            baseline: null,

            // Settings
            settings: {
                difficulty: 'MEDIUM',
                tipLevel: 2,
                soundEnabled: true,
                soundVolume: 0.5
            },

            // Virtual darts stats
            stats: {
                gamesPlayed: 0,
                gamesWon: 0,
                totalDarts: 0,
                totalPoints: 0,

                // 501 stats
                x01: {
                    gamesPlayed: 0,
                    gamesWon: 0,
                    bestGame: null, // Lowest darts to checkout
                    totalCheckouts: 0,
                    highCheckout: 0,
                    averageDarts: 0
                },

                // Cricket stats
                cricket: {
                    gamesPlayed: 0,
                    gamesWon: 0,
                    highMPR: 0,
                    totalMarks: 0,
                    totalRounds: 0,
                    nineDartRounds: 0
                },

                // Accuracy tracking
                accuracy: {
                    trebleAttempts: 0,
                    trebleHits: 0,
                    doubleAttempts: 0,
                    doubleHits: 0,
                    bullAttempts: 0,
                    bullHits: 0
                }
            },

            // Game history (last 50 games)
            history: [],

            // Achievements
            achievements: []
        };
    }

    /**
     * Generate local ID
     */
    generateLocalId() {
        return 'local_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get current profile
     */
    getProfile() {
        return this.profile || this.localProfile;
    }

    /**
     * Load profile from Firebase
     */
    async loadProfile() {
        if (!this.db || !this.currentUser) {
            return this.localProfile;
        }

        try {
            const docRef = this.db.collection('players')
                .doc(this.currentUser.uid)
                .collection('virtualDarts')
                .doc('profile');

            const doc = await docRef.get();

            if (doc.exists) {
                this.profile = doc.data();
                // Sync with local
                localStorage.setItem('virtualDartsProfile', JSON.stringify(this.profile));
            } else {
                // Create new profile
                this.profile = this.createDefaultProfile();
                this.profile.id = this.currentUser.uid;
                this.profile.name = this.currentUser.displayName || 'Player';
                await this.saveProfile();
            }

            return this.profile;
        } catch (err) {
            console.error('Error loading profile:', err);
            return this.localProfile;
        }
    }

    /**
     * Save profile
     */
    async saveProfile() {
        const profile = this.getProfile();

        // Always save locally
        localStorage.setItem('virtualDartsProfile', JSON.stringify(profile));

        // Save to Firebase if authenticated
        if (this.db && this.currentUser) {
            try {
                const docRef = this.db.collection('players')
                    .doc(this.currentUser.uid)
                    .collection('virtualDarts')
                    .doc('profile');

                await docRef.set(profile);
            } catch (err) {
                console.error('Error saving profile to Firebase:', err);
            }
        }
    }

    /**
     * Update baseline
     */
    async updateBaseline(baseline) {
        const profile = this.getProfile();
        profile.baseline = baseline;
        await this.saveProfile();
    }

    /**
     * Get baseline
     */
    getBaseline() {
        const profile = this.getProfile();
        return profile.baseline;
    }

    /**
     * Update settings
     */
    async updateSettings(settings) {
        const profile = this.getProfile();
        profile.settings = { ...profile.settings, ...settings };
        await this.saveProfile();
    }

    /**
     * Get settings
     */
    getSettings() {
        const profile = this.getProfile();
        return profile.settings;
    }

    /**
     * Record game result
     */
    async recordGameResult(gameResult) {
        const profile = this.getProfile();

        // Update overall stats
        profile.stats.gamesPlayed++;
        if (gameResult.won) {
            profile.stats.gamesWon++;
        }
        profile.stats.totalDarts += gameResult.darts;
        profile.stats.totalPoints += gameResult.points || 0;

        // Update game-specific stats
        if (gameResult.gameType === '501') {
            this.update501Stats(profile, gameResult);
        } else if (gameResult.gameType === 'cricket') {
            this.updateCricketStats(profile, gameResult);
        }

        // Add to history (keep last 50)
        profile.history.unshift({
            ...gameResult,
            timestamp: Date.now()
        });
        if (profile.history.length > 50) {
            profile.history = profile.history.slice(0, 50);
        }

        // Check achievements
        this.checkAchievements(profile, gameResult);

        await this.saveProfile();
    }

    /**
     * Update 501 stats
     */
    update501Stats(profile, gameResult) {
        const x01 = profile.stats.x01;

        x01.gamesPlayed++;
        if (gameResult.won) {
            x01.gamesWon++;

            // Track best game
            if (!x01.bestGame || gameResult.darts < x01.bestGame) {
                x01.bestGame = gameResult.darts;
            }

            // Checkout stats
            if (gameResult.checkout) {
                x01.totalCheckouts++;
                if (gameResult.checkout > x01.highCheckout) {
                    x01.highCheckout = gameResult.checkout;
                }
            }
        }

        // Recalculate average
        const totalDarts = profile.history
            .filter(g => g.gameType === '501' && g.won)
            .reduce((sum, g) => sum + g.darts, 0);
        const gamesWon = x01.gamesWon;
        x01.averageDarts = gamesWon > 0 ? Math.round(totalDarts / gamesWon) : 0;
    }

    /**
     * Update cricket stats
     */
    updateCricketStats(profile, gameResult) {
        const cricket = profile.stats.cricket;

        cricket.gamesPlayed++;
        if (gameResult.won) {
            cricket.gamesWon++;
        }

        // MPR tracking
        if (gameResult.mpr && gameResult.mpr > cricket.highMPR) {
            cricket.highMPR = gameResult.mpr;
        }

        cricket.totalMarks += gameResult.marks || 0;
        cricket.totalRounds += gameResult.rounds || 0;

        if (gameResult.nineDartRounds) {
            cricket.nineDartRounds += gameResult.nineDartRounds;
        }
    }

    /**
     * Update accuracy stats
     */
    async recordAccuracy(target, hit) {
        const profile = this.getProfile();
        const accuracy = profile.stats.accuracy;

        if (target.ring === 'treble') {
            accuracy.trebleAttempts++;
            if (hit.ring === 'treble') {
                accuracy.trebleHits++;
            }
        } else if (target.ring === 'double') {
            accuracy.doubleAttempts++;
            if (hit.ring === 'double') {
                accuracy.doubleHits++;
            }
        } else if (target.ring === 'double-bull' || target.ring === 'single-bull') {
            accuracy.bullAttempts++;
            if (hit.ring === 'double-bull' || hit.ring === 'single-bull') {
                accuracy.bullHits++;
            }
        }

        // Don't save on every throw - batch save
        // await this.saveProfile();
    }

    /**
     * Get accuracy percentages
     */
    getAccuracyStats() {
        const profile = this.getProfile();
        const accuracy = profile.stats.accuracy;

        return {
            treble: accuracy.trebleAttempts > 0
                ? Math.round((accuracy.trebleHits / accuracy.trebleAttempts) * 100)
                : null,
            double: accuracy.doubleAttempts > 0
                ? Math.round((accuracy.doubleHits / accuracy.doubleAttempts) * 100)
                : null,
            bull: accuracy.bullAttempts > 0
                ? Math.round((accuracy.bullHits / accuracy.bullAttempts) * 100)
                : null
        };
    }

    /**
     * Check for new achievements
     */
    checkAchievements(profile, gameResult) {
        const newAchievements = [];

        // First game
        if (profile.stats.gamesPlayed === 1) {
            newAchievements.push({
                id: 'first_game',
                name: 'First Steps',
                description: 'Completed your first game',
                icon: '🎯'
            });
        }

        // First win
        if (profile.stats.gamesWon === 1) {
            newAchievements.push({
                id: 'first_win',
                name: 'Winner!',
                description: 'Won your first game',
                icon: '🏆'
            });
        }

        // 10 games
        if (profile.stats.gamesPlayed === 10) {
            newAchievements.push({
                id: 'ten_games',
                name: 'Getting Serious',
                description: 'Played 10 games',
                icon: '📊'
            });
        }

        // High checkout (100+)
        if (gameResult.checkout >= 100 &&
            !profile.achievements.find(a => a.id === 'ton_checkout')) {
            newAchievements.push({
                id: 'ton_checkout',
                name: 'Ton Out',
                description: 'Hit a checkout of 100+',
                icon: '💯'
            });
        }

        // High checkout (170)
        if (gameResult.checkout === 170) {
            newAchievements.push({
                id: 'max_checkout',
                name: 'The Big Fish',
                description: 'Hit the maximum checkout of 170',
                icon: '🐟'
            });
        }

        // Add new achievements
        for (const achievement of newAchievements) {
            if (!profile.achievements.find(a => a.id === achievement.id)) {
                profile.achievements.push({
                    ...achievement,
                    unlockedAt: Date.now()
                });
            }
        }

        return newAchievements;
    }

    /**
     * Get leaderboard stats for current user
     */
    getLeaderboardEntry() {
        const profile = this.getProfile();

        return {
            id: profile.id,
            name: profile.name,
            gamesPlayed: profile.stats.gamesPlayed,
            gamesWon: profile.stats.gamesWon,
            winRate: profile.stats.gamesPlayed > 0
                ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100)
                : 0,
            best501: profile.stats.x01.bestGame,
            highCheckout: profile.stats.x01.highCheckout,
            highMPR: profile.stats.cricket.highMPR
        };
    }

    /**
     * Reset stats (keep baseline and settings)
     */
    async resetStats() {
        const profile = this.getProfile();
        const baseline = profile.baseline;
        const settings = profile.settings;

        // Reset to default
        const newProfile = this.createDefaultProfile();
        newProfile.id = profile.id;
        newProfile.name = profile.name;
        newProfile.baseline = baseline;
        newProfile.settings = settings;
        newProfile.createdAt = profile.createdAt;

        if (this.profile) {
            this.profile = newProfile;
        }
        this.localProfile = newProfile;

        await this.saveProfile();
    }

    /**
     * Export profile data
     */
    exportProfile() {
        const profile = this.getProfile();
        return JSON.stringify(profile, null, 2);
    }

    /**
     * Import profile data
     */
    async importProfile(jsonString) {
        try {
            const imported = JSON.parse(jsonString);

            // Validate structure
            if (!imported.stats || !imported.settings) {
                throw new Error('Invalid profile format');
            }

            if (this.profile) {
                this.profile = imported;
            }
            this.localProfile = imported;

            await this.saveProfile();
            return true;
        } catch (err) {
            console.error('Import failed:', err);
            return false;
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileManager;
}
