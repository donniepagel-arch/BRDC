/**
 * Virtual Darts Configuration
 * Change PHASE_LEVEL to enable features incrementally
 */

const CONFIG = {
    // Set this to 1, 2, 3, 4, or 5 to enable phases
    PHASE_LEVEL: 2,

    // Canvas settings
    CANVAS: {
        WIDTH: 800,
        HEIGHT: 800,
        BOARD_RADIUS: 340,
        BOARD_CENTER_X: 400,
        BOARD_CENTER_Y: 380
    },

    // Dartboard dimensions (in pixels, proportional to real board)
    BOARD: {
        DOUBLE_OUTER: 340,
        DOUBLE_INNER: 320,
        TREBLE_OUTER: 210,
        TREBLE_INNER: 190,
        SINGLE_OUTER: 320,
        SINGLE_INNER: 210,
        BULL_OUTER: 32,
        BULL_INNER: 12.7,
        WIRE_WIDTH: 1.5
    },

    // Segment order (clockwise from top)
    SEGMENTS: [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5],

    // Colors
    COLORS: {
        BLACK: '#1a1a1a',
        WHITE: '#f5f5dc',
        RED: '#cc0000',
        GREEN: '#006400',
        BULL_GREEN: '#006400',
        BULL_RED: '#cc0000',
        WIRE: '#c0c0c0',
        BACKGROUND: '#2a2a2a',
        NUMBER: '#f5f5dc'
    },

    // Physics constants
    PHYSICS: {
        MIN_VELOCITY: 5,
        MAX_VELOCITY: 20,
        GRAVITY: 9.8,
        DRAG_COEFFICIENT: 0.02,

        // Swipe interpretation (adjusted for mobile - lower values for smaller screens)
        MIN_SWIPE_LENGTH: 30,      // Reduced for easier mobile swipe detection
        MAX_SWIPE_LENGTH: 300,     // Reduced from 400 for mobile touch
        MIN_SWIPE_SPEED: 200,      // Reduced for easier mobile swipe detection
        MAX_SWIPE_SPEED: 2500,     // Reduced from 3000 for mobile touch

        // Error scaling
        RELEASE_ERROR_SCALE: 120,
        STRAIGHTNESS_PENALTY: 0.5,

        // Launch angles (degrees)
        MIN_ANGLE: 35,
        MAX_ANGLE: 55
    },

    // Difficulty presets
    DIFFICULTY: {
        EASY: {
            speedTolerance: 0.4,
            releaseTolerance: 0.5,
            straightnessTolerance: 20,
            randomError: 25
        },
        MEDIUM: {
            speedTolerance: 0.25,
            releaseTolerance: 0.3,
            straightnessTolerance: 10,
            randomError: 15
        },
        HARD: {
            speedTolerance: 0.15,
            releaseTolerance: 0.15,
            straightnessTolerance: 5,
            randomError: 8
        },
        PRO: {
            speedTolerance: 0.05,
            releaseTolerance: 0.05,
            straightnessTolerance: 2,
            randomError: 3
        }
    },

    // Practice mode settings
    PRACTICE: {
        THROWS_REQUIRED: 20,
        TARGET_RADIUS: 100
    },

    // Game settings
    GAME: {
        DARTS_PER_TURN: 3,
        X01_START: 501,
        DOUBLE_IN: false,
        DOUBLE_OUT: true
    },

    // Tip levels (Phase 2)
    TIP_LEVELS: {
        1: { name: 'Basic', showTarget: true, showPoints: true, showReasoning: false, showPath: false, showWedge: false, showStats: false },
        2: { name: 'Intermediate', showTarget: true, showPoints: true, showReasoning: true, showPath: true, showWedge: false, showStats: false },
        3: { name: 'Advanced', showTarget: true, showPoints: true, showReasoning: true, showPath: true, showWedge: true, showStats: false },
        4: { name: 'Pro', showTarget: true, showPoints: true, showReasoning: true, showPath: true, showWedge: true, showStats: true }
    }
};

// Current difficulty (can be changed by user)
let currentDifficulty = 'MEDIUM';

// Get current difficulty settings
function getDifficulty() {
    return CONFIG.DIFFICULTY[currentDifficulty];
}

// Set difficulty
function setDifficulty(level) {
    if (CONFIG.DIFFICULTY[level]) {
        currentDifficulty = level;
    }
}

// Check if a phase is enabled
function isPhaseEnabled(phase) {
    return CONFIG.PHASE_LEVEL >= phase;
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, getDifficulty, setDifficulty, isPhaseEnabled };
}
