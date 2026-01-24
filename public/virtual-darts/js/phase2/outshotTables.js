/**
 * Outshot Tables
 * Phase 2 - Aim & Strategy
 * Complete checkout charts from 170 down to 2
 */

const OUTSHOT_TABLES = {
    // 170 - Maximum checkout (requires bull)
    170: { darts: 3, path: ['T20', 'T20', 'Bull'], desc: 'The big fish - T20, T20, Bull' },
    167: { darts: 3, path: ['T20', 'T19', 'Bull'], desc: 'T20, T19, Bull' },
    164: { darts: 3, path: ['T20', 'T18', 'Bull'], desc: 'T20, T18, Bull' },
    161: { darts: 3, path: ['T20', 'T17', 'Bull'], desc: 'T20, T17, Bull' },

    // 160 down - Standard 3-dart finishes
    160: { darts: 3, path: ['T20', 'T20', 'D20'], desc: 'Two tops and double top' },
    158: { darts: 3, path: ['T20', 'T20', 'D19'], desc: 'T20, T20, D19' },
    157: { darts: 3, path: ['T20', 'T19', 'D20'], desc: 'T20, T19, D20' },
    156: { darts: 3, path: ['T20', 'T20', 'D18'], desc: 'T20, T20, D18' },
    155: { darts: 3, path: ['T20', 'T19', 'D19'], desc: 'T20, T19, D19' },
    154: { darts: 3, path: ['T20', 'T18', 'D20'], desc: 'T20, T18, D20' },
    153: { darts: 3, path: ['T20', 'T19', 'D18'], desc: 'T20, T19, D18' },
    152: { darts: 3, path: ['T20', 'T20', 'D16'], desc: 'T20, T20, D16' },
    151: { darts: 3, path: ['T20', 'T17', 'D20'], desc: 'T20, T17, D20' },
    150: { darts: 3, path: ['T20', 'T18', 'D18'], desc: 'T20, T18, D18' },

    149: { darts: 3, path: ['T20', 'T19', 'D16'], desc: 'T20, T19, D16' },
    148: { darts: 3, path: ['T20', 'T20', 'D14'], desc: 'T20, T20, D14' },
    147: { darts: 3, path: ['T20', 'T17', 'D18'], desc: 'T20, T17, D18' },
    146: { darts: 3, path: ['T20', 'T18', 'D16'], desc: 'T20, T18, D16' },
    145: { darts: 3, path: ['T20', 'T19', 'D14'], desc: 'T20, T19, D14' },
    144: { darts: 3, path: ['T20', 'T20', 'D12'], desc: 'T20, T20, D12' },
    143: { darts: 3, path: ['T20', 'T17', 'D16'], desc: 'T20, T17, D16' },
    142: { darts: 3, path: ['T20', 'T14', 'D20'], desc: 'T20, T14, D20' },
    141: { darts: 3, path: ['T20', 'T19', 'D12'], desc: 'T20, T19, D12' },
    140: { darts: 3, path: ['T20', 'T20', 'D10'], desc: 'T20, T20, D10' },

    139: { darts: 3, path: ['T20', 'T13', 'D20'], desc: 'T20, T13, D20' },
    138: { darts: 3, path: ['T20', 'T18', 'D12'], desc: 'T20, T18, D12' },
    137: { darts: 3, path: ['T20', 'T19', 'D10'], desc: 'T20, T19, D10' },
    136: { darts: 3, path: ['T20', 'T20', 'D8'], desc: 'T20, T20, D8' },
    135: { darts: 3, path: ['T20', 'T17', 'D12'], desc: 'T20, T17, D12' },
    134: { darts: 3, path: ['T20', 'T14', 'D16'], desc: 'T20, T14, D16' },
    133: { darts: 3, path: ['T20', 'T19', 'D8'], desc: 'T20, T19, D8' },
    132: { darts: 3, path: ['T20', 'T16', 'D12'], desc: 'T20, T16, D12 (or Bull, Bull, Bull)' },
    131: { darts: 3, path: ['T20', 'T13', 'D16'], desc: 'T20, T13, D16' },
    130: { darts: 3, path: ['T20', 'T18', 'D8'], desc: 'T20, T18, D8' },

    129: { darts: 3, path: ['T19', 'T16', 'D12'], desc: 'T19, T16, D12' },
    128: { darts: 3, path: ['T18', 'T14', 'D16'], desc: 'T18, T14, D16' },
    127: { darts: 3, path: ['T20', 'T17', 'D8'], desc: 'T20, T17, D8' },
    126: { darts: 3, path: ['T19', 'T19', 'D6'], desc: 'T19, T19, D6' },
    125: { darts: 3, path: ['T20', 'T15', 'D10'], desc: 'T20, T15, D10 (or 25, T20, D20)' },
    124: { darts: 3, path: ['T20', 'T14', 'D11'], desc: 'T20, T14, D11' },
    123: { darts: 3, path: ['T19', 'T16', 'D9'], desc: 'T19, T16, D9' },
    122: { darts: 3, path: ['T18', 'T18', 'D7'], desc: 'T18, T18, D7' },
    121: { darts: 3, path: ['T20', 'T11', 'D14'], desc: 'T20, T11, D14' },
    120: { darts: 3, path: ['T20', 'S20', 'D20'], desc: 'T20, S20, D20' },

    119: { darts: 3, path: ['T19', 'T12', 'D13'], desc: 'T19, T12, D13' },
    118: { darts: 3, path: ['T20', 'S18', 'D20'], desc: 'T20, S18, D20' },
    117: { darts: 3, path: ['T20', 'S17', 'D20'], desc: 'T20, S17, D20' },
    116: { darts: 3, path: ['T20', 'S16', 'D20'], desc: 'T20, S16, D20' },
    115: { darts: 3, path: ['T20', 'S15', 'D20'], desc: 'T20, S15, D20' },
    114: { darts: 3, path: ['T20', 'S14', 'D20'], desc: 'T20, S14, D20' },
    113: { darts: 3, path: ['T20', 'S13', 'D20'], desc: 'T20, S13, D20' },
    112: { darts: 3, path: ['T20', 'S12', 'D20'], desc: 'T20, S12, D20' },
    111: { darts: 3, path: ['T20', 'S11', 'D20'], desc: 'T20, S11, D20' },
    110: { darts: 3, path: ['T20', 'S10', 'D20'], desc: 'T20, Bull (or T20, S10, D20)' },

    // 2-dart finishes (109 and below have 2-dart options)
    109: { darts: 3, path: ['T20', 'S9', 'D20'], desc: 'T20, S9, D20' },
    108: { darts: 3, path: ['T20', 'S8', 'D20'], desc: 'T20, S8, D20' },
    107: { darts: 3, path: ['T19', 'S10', 'D20'], desc: 'T19, S10, D20' },
    106: { darts: 3, path: ['T20', 'S6', 'D20'], desc: 'T20, S6, D20' },
    105: { darts: 3, path: ['T20', 'S5', 'D20'], desc: 'T20, S5, D20' },
    104: { darts: 3, path: ['T18', 'S10', 'D20'], desc: 'T18, S10, D20' },
    103: { darts: 3, path: ['T19', 'S6', 'D20'], desc: 'T19, S6, D20' },
    102: { darts: 3, path: ['T20', 'S2', 'D20'], desc: 'T20, S2, D20' },
    101: { darts: 3, path: ['T17', 'S10', 'D20'], desc: 'T17, S10, D20' },

    // Clean 2-dart checkouts
    100: { darts: 2, path: ['T20', 'D20'], desc: 'T20, D20' },
    99: { darts: 2, path: ['T19', 'D21'], desc: 'T19, D21 (or S19, S20, D20)' },
    98: { darts: 2, path: ['T20', 'D19'], desc: 'T20, D19' },
    97: { darts: 2, path: ['T19', 'D20'], desc: 'T19, D20' },
    96: { darts: 2, path: ['T20', 'D18'], desc: 'T20, D18' },
    95: { darts: 2, path: ['T19', 'D19'], desc: 'T19, D19 (or T15, Bull)' },
    94: { darts: 2, path: ['T18', 'D20'], desc: 'T18, D20' },
    93: { darts: 2, path: ['T19', 'D18'], desc: 'T19, D18' },
    92: { darts: 2, path: ['T20', 'D16'], desc: 'T20, D16' },
    91: { darts: 2, path: ['T17', 'D20'], desc: 'T17, D20' },
    90: { darts: 2, path: ['T20', 'D15'], desc: 'T20, D15 (or T18, D18)' },

    89: { darts: 2, path: ['T19', 'D16'], desc: 'T19, D16' },
    88: { darts: 2, path: ['T20', 'D14'], desc: 'T20, D14' },
    87: { darts: 2, path: ['T17', 'D18'], desc: 'T17, D18' },
    86: { darts: 2, path: ['T18', 'D16'], desc: 'T18, D16' },
    85: { darts: 2, path: ['T15', 'D20'], desc: 'T15, D20' },
    84: { darts: 2, path: ['T20', 'D12'], desc: 'T20, D12' },
    83: { darts: 2, path: ['T17', 'D16'], desc: 'T17, D16' },
    82: { darts: 2, path: ['T14', 'D20'], desc: 'T14, D20 (or Bull, D16)' },
    81: { darts: 2, path: ['T19', 'D12'], desc: 'T19, D12' },
    80: { darts: 2, path: ['T20', 'D10'], desc: 'T20, D10' },

    79: { darts: 2, path: ['T19', 'D11'], desc: 'T19, D11 (or T13, D20)' },
    78: { darts: 2, path: ['T18', 'D12'], desc: 'T18, D12' },
    77: { darts: 2, path: ['T19', 'D10'], desc: 'T19, D10' },
    76: { darts: 2, path: ['T20', 'D8'], desc: 'T20, D8' },
    75: { darts: 2, path: ['T17', 'D12'], desc: 'T17, D12' },
    74: { darts: 2, path: ['T14', 'D16'], desc: 'T14, D16' },
    73: { darts: 2, path: ['T19', 'D8'], desc: 'T19, D8' },
    72: { darts: 2, path: ['T16', 'D12'], desc: 'T16, D12' },
    71: { darts: 2, path: ['T13', 'D16'], desc: 'T13, D16' },
    70: { darts: 2, path: ['T18', 'D8'], desc: 'T18, D8 (or T10, D20)' },

    69: { darts: 2, path: ['T19', 'D6'], desc: 'T19, D6' },
    68: { darts: 2, path: ['T20', 'D4'], desc: 'T20, D4 (or T16, D10)' },
    67: { darts: 2, path: ['T17', 'D8'], desc: 'T17, D8' },
    66: { darts: 2, path: ['T10', 'D18'], desc: 'T10, D18' },
    65: { darts: 2, path: ['T19', 'D4'], desc: 'T19, D4 (or T15, D10)' },
    64: { darts: 2, path: ['T16', 'D8'], desc: 'T16, D8' },
    63: { darts: 2, path: ['T13', 'D12'], desc: 'T13, D12' },
    62: { darts: 2, path: ['T10', 'D16'], desc: 'T10, D16' },
    61: { darts: 2, path: ['T15', 'D8'], desc: 'T15, D8' },
    60: { darts: 2, path: ['S20', 'D20'], desc: 'S20, D20' },

    59: { darts: 2, path: ['S19', 'D20'], desc: 'S19, D20' },
    58: { darts: 2, path: ['S18', 'D20'], desc: 'S18, D20' },
    57: { darts: 2, path: ['S17', 'D20'], desc: 'S17, D20' },
    56: { darts: 2, path: ['T16', 'D4'], desc: 'T16, D4 (or S16, D20)' },
    55: { darts: 2, path: ['S15', 'D20'], desc: 'S15, D20' },
    54: { darts: 2, path: ['S14', 'D20'], desc: 'S14, D20' },
    53: { darts: 2, path: ['S13', 'D20'], desc: 'S13, D20' },
    52: { darts: 2, path: ['S12', 'D20'], desc: 'S12, D20 (or T12, D8)' },
    51: { darts: 2, path: ['S11', 'D20'], desc: 'S11, D20' },
    50: { darts: 1, path: ['Bull'], desc: 'Bullseye!' },

    49: { darts: 2, path: ['S9', 'D20'], desc: 'S9, D20' },
    48: { darts: 2, path: ['S8', 'D20'], desc: 'S8, D20' },
    47: { darts: 2, path: ['S7', 'D20'], desc: 'S7, D20' },
    46: { darts: 2, path: ['S6', 'D20'], desc: 'S6, D20 (or S10, D18)' },
    45: { darts: 2, path: ['S5', 'D20'], desc: 'S5, D20 (or S13, D16)' },
    44: { darts: 2, path: ['S4', 'D20'], desc: 'S4, D20 (or S12, D16)' },
    43: { darts: 2, path: ['S3', 'D20'], desc: 'S3, D20 (or S11, D16)' },
    42: { darts: 2, path: ['S10', 'D16'], desc: 'S10, D16 (or S2, D20)' },
    41: { darts: 2, path: ['S9', 'D16'], desc: 'S9, D16' },
    40: { darts: 1, path: ['D20'], desc: 'Double 20 - tops!' },

    39: { darts: 2, path: ['S7', 'D16'], desc: 'S7, D16 (or S19, D10)' },
    38: { darts: 1, path: ['D19'], desc: 'Double 19' },
    37: { darts: 2, path: ['S5', 'D16'], desc: 'S5, D16 (or S17, D10)' },
    36: { darts: 1, path: ['D18'], desc: 'Double 18' },
    35: { darts: 2, path: ['S3', 'D16'], desc: 'S3, D16' },
    34: { darts: 1, path: ['D17'], desc: 'Double 17' },
    33: { darts: 2, path: ['S1', 'D16'], desc: 'S1, D16 (or S17, D8)' },
    32: { darts: 1, path: ['D16'], desc: 'Double 16 - favorite finish!' },
    31: { darts: 2, path: ['S15', 'D8'], desc: 'S15, D8 (or S7, D12)' },
    30: { darts: 1, path: ['D15'], desc: 'Double 15' },

    29: { darts: 2, path: ['S13', 'D8'], desc: 'S13, D8' },
    28: { darts: 1, path: ['D14'], desc: 'Double 14' },
    27: { darts: 2, path: ['S11', 'D8'], desc: 'S11, D8 (or S19, D4)' },
    26: { darts: 1, path: ['D13'], desc: 'Double 13' },
    25: { darts: 2, path: ['S9', 'D8'], desc: 'S9, D8 (or S17, D4)' },
    24: { darts: 1, path: ['D12'], desc: 'Double 12' },
    23: { darts: 2, path: ['S7', 'D8'], desc: 'S7, D8 (or S15, D4)' },
    22: { darts: 1, path: ['D11'], desc: 'Double 11' },
    21: { darts: 2, path: ['S5', 'D8'], desc: 'S5, D8 (or S13, D4)' },
    20: { darts: 1, path: ['D10'], desc: 'Double 10' },

    19: { darts: 2, path: ['S3', 'D8'], desc: 'S3, D8 (or S11, D4)' },
    18: { darts: 1, path: ['D9'], desc: 'Double 9' },
    17: { darts: 2, path: ['S1', 'D8'], desc: 'S1, D8 (or S9, D4)' },
    16: { darts: 1, path: ['D8'], desc: 'Double 8' },
    15: { darts: 2, path: ['S7', 'D4'], desc: 'S7, D4' },
    14: { darts: 1, path: ['D7'], desc: 'Double 7' },
    13: { darts: 2, path: ['S5', 'D4'], desc: 'S5, D4' },
    12: { darts: 1, path: ['D6'], desc: 'Double 6' },
    11: { darts: 2, path: ['S3', 'D4'], desc: 'S3, D4' },
    10: { darts: 1, path: ['D5'], desc: 'Double 5' },

    9: { darts: 2, path: ['S1', 'D4'], desc: 'S1, D4' },
    8: { darts: 1, path: ['D4'], desc: 'Double 4' },
    7: { darts: 2, path: ['S3', 'D2'], desc: 'S3, D2' },
    6: { darts: 1, path: ['D3'], desc: 'Double 3' },
    5: { darts: 2, path: ['S1', 'D2'], desc: 'S1, D2' },
    4: { darts: 1, path: ['D2'], desc: 'Double 2' },
    3: { darts: 2, path: ['S1', 'D1'], desc: 'S1, D1' },
    2: { darts: 1, path: ['D1'], desc: 'Double 1 - madhouse!' }
};

// Impossible checkouts (not achievable with 3 darts in double-out)
const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159];

// Preferred finishes (easier doubles)
const PREFERRED_FINISHES = [40, 32, 36, 24, 16, 8]; // D20, D16, D18, D12, D8, D4

// Setup shots - what to leave when above 170
const SETUP_TARGETS = {
    // For scores above 170, aim to leave a preferred finish
    // These are the ideal trebles to hit based on current score
    getSetupShot: function(currentScore) {
        // Standard advice: hit T20 unless specific reason not to
        if (currentScore > 200) {
            return { target: 'T20', reason: 'Reduce score - aim for maximum' };
        }

        // Calculate what we'd leave with T20
        const afterT20 = currentScore - 60;
        if (afterT20 >= 2 && afterT20 <= 170 && !BOGEY_NUMBERS.includes(afterT20)) {
            return { target: 'T20', reason: `Leaves ${afterT20} - a valid checkout` };
        }

        // Try T19
        const afterT19 = currentScore - 57;
        if (afterT19 >= 2 && afterT19 <= 170 && !BOGEY_NUMBERS.includes(afterT19)) {
            return { target: 'T19', reason: `Leaves ${afterT19} - a valid checkout` };
        }

        // Try T18
        const afterT18 = currentScore - 54;
        if (afterT18 >= 2 && afterT18 <= 170 && !BOGEY_NUMBERS.includes(afterT18)) {
            return { target: 'T18', reason: `Leaves ${afterT18} - a valid checkout` };
        }

        // Default to T20
        return { target: 'T20', reason: 'Maximum scoring' };
    }
};

/**
 * Get checkout info for a score
 * @param {number} score - Current score
 * @returns {Object|null} Checkout info or null if not possible
 */
function getCheckout(score) {
    return OUTSHOT_TABLES[score] || null;
}

/**
 * Check if a score is a valid checkout
 */
function isCheckout(score) {
    return score >= 2 && score <= 170 && !BOGEY_NUMBERS.includes(score);
}

/**
 * Check if a score is a bogey number
 */
function isBogeyNumber(score) {
    return BOGEY_NUMBERS.includes(score);
}

/**
 * Get suggested shot based on current score
 */
function getSuggestedShot(score, dartsRemaining = 3) {
    // If it's a checkout, return the checkout path
    if (isCheckout(score)) {
        const checkout = getCheckout(score);
        if (checkout && checkout.darts <= dartsRemaining) {
            return {
                type: 'checkout',
                target: checkout.path[0],
                fullPath: checkout.path,
                reason: checkout.desc,
                dartsNeeded: checkout.darts
            };
        }
    }

    // If above checkout range, suggest setup shot
    if (score > 170) {
        const setup = SETUP_TARGETS.getSetupShot(score);
        return {
            type: 'setup',
            target: setup.target,
            reason: setup.reason
        };
    }

    // Bogey number - need to adjust
    if (isBogeyNumber(score)) {
        // Find a single that leaves a valid checkout
        for (let i = 1; i <= 20; i++) {
            const newScore = score - i;
            if (isCheckout(newScore)) {
                return {
                    type: 'bogey_escape',
                    target: `S${i}`,
                    reason: `${score} is a bogey - hit S${i} to leave ${newScore}`
                };
            }
        }
    }

    // Default to T20
    return {
        type: 'scoring',
        target: 'T20',
        reason: 'Maximum scoring area'
    };
}

/**
 * Parse target string to segment and ring
 * @param {string} target - e.g., "T20", "D16", "S19", "Bull"
 * @returns {Object} { segment, ring }
 */
function parseTarget(target) {
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
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        OUTSHOT_TABLES,
        BOGEY_NUMBERS,
        PREFERRED_FINISHES,
        SETUP_TARGETS,
        getCheckout,
        isCheckout,
        isBogeyNumber,
        getSuggestedShot,
        parseTarget
    };
}
