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
