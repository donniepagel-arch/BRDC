const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Phase functions
const phase12 = require('./phase-1-2');
const phase34 = require('./phase-3-4');
const phase567 = require('./phase-5-6-7');

Object.assign(exports, phase12, phase34, phase567);
