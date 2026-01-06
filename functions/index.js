/**
 * BRDC Tournament System - Firebase Cloud Functions
 * Main entry point for all backend functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Tournament Functions
const { createTournament } = require('./tournaments/create');
const { generateBracket } = require('./tournaments/brackets');
const { submitMatchResult } = require('./tournaments/matches');

// Export all functions
exports.createTournament = createTournament;
exports.generateBracket = generateBracket;
exports.submitMatchResult = submitMatchResult;

// Phase functions
const phase12 = require('./phase-1-2');
const phase34 = require('./phase-3-4');
const phase567 = require('./phase-5-6-7');

Object.assign(exports, phase12, phase34, phase567);

// Additional tournament day functions
const additional = require('./additional-functions');
Object.assign(exports, additional);
