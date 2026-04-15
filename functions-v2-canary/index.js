const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { createAuthHandlers } = require('./src/auth-http-handlers');
const { createImportDebugHandlers } = require('./src/import-debug-http-handlers');
const { getMessagingServices } = require('./src/messaging-config');

admin.initializeApp();

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const handlers = createAuthHandlers({ admin, db, getMessagingServices });
const importDebugHandlers = createImportDebugHandlers({ db });

const publicHttpOptions = { region: 'us-central1', invoker: 'public' };

exports.recoverPinV2Canary = onRequest(publicHttpOptions, handlers.recoverPin);
exports.registerNewPlayerV2Canary = onRequest(publicHttpOptions, handlers.registerNewPlayer);
exports.registerPlayerSimpleV2Canary = onRequest(publicHttpOptions, handlers.registerPlayerSimple);
exports.recoverPinV2 = onRequest(publicHttpOptions, handlers.recoverPin);
exports.registerNewPlayerV2 = onRequest(publicHttpOptions, handlers.registerNewPlayer);
exports.registerPlayerSimpleV2 = onRequest(publicHttpOptions, handlers.registerPlayerSimple);
exports.getMatchDetailsV2Canary = onRequest(publicHttpOptions, importDebugHandlers.getMatchDetails);
exports.getMatchDetailsV2 = onRequest(publicHttpOptions, importDebugHandlers.getMatchDetails);
