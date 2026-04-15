const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Test data constants
// ---------------------------------------------------------------------------
const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const MATCH_ID = 'sgmoL4GyVUYP67aOS7wm';
const HOME_TEAM = 'mgR4e3zldLsM9tAnXmK8';
const AWAY_TEAM = 'U5ZEAT55xiNM9Otarafx';

// ---------------------------------------------------------------------------
// Known non-critical error patterns to ignore.
// Firebase auth/analytics, network issues in CI, and service-worker
// registration failures are expected when pages load without credentials.
// ---------------------------------------------------------------------------
const IGNORABLE_PATTERNS = [
    'Firebase',
    'firebase',
    'analytics',
    'auth/network-request-failed',
    'Failed to fetch',
    'NetworkError',
    'net::ERR_',
    'Load failed',
    'getAnalytics',
    'measurementId',
    'recaptcha',
    'service-worker',
    'ServiceWorker',
    'sw.js',
    'Loading chunk',
    'ChunkLoadError',
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'Object captured as promise rejection',
    'blocked by CORS',
    'Permission denied',                // Firestore permission denied (not authed)
    'Missing or insufficient permissions', // Firestore rules
    'PERMISSION_DENIED',
    'Could not reach Cloud Firestore',
    'unavailable',
];

/**
 * Filter collected page errors down to critical ones only.
 * Returns an array of error messages that do NOT match any ignorable pattern.
 */
function filterCriticalErrors(errors) {
    return errors.filter(msg =>
        !IGNORABLE_PATTERNS.some(pattern => msg.includes(pattern))
    );
}

/**
 * Shared smoke-test logic: navigate to the URL, wait for async content,
 * assert HTTP status < 400 and zero critical JS errors.
 */
async function smokeTest(page, path, { waitMs = 2000 } = {}) {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    const response = await page.goto(path);
    expect(response.status()).toBeLessThan(400);

    // Give async content (Firebase reads, DOM renders) time to settle
    await page.waitForTimeout(waitMs);

    const critical = filterCriticalErrors(errors);
    if (critical.length > 0) {
        console.log(`Critical errors on ${path}:`, critical);
    }
    expect(critical).toHaveLength(0);
}

// ===========================================================================
// GROUP 1 - Public pages (no params needed)
// ===========================================================================
test.describe('Public Pages', () => {

    test('/index.html loads', async ({ page }) => {
        await smokeTest(page, '/index.html');
    });

    test('/full-site.html loads', async ({ page }) => {
        await smokeTest(page, '/full-site.html');
    });

    test('/pages/glossary.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/glossary.html');
    });

    test('/pages/register.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/register.html');
    });

    test('/pages/signup.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/signup.html');
    });

    test('/pages/offline.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/offline.html');
    });

    test('/pages/dart-trader.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/dart-trader.html');
    });

    test('/pages/player-lookup.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/player-lookup.html');
    });

    test('/pages/leagues.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/leagues.html');
    });

    test('/pages/tournaments.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/tournaments.html');
    });

    test('/pages/events-hub.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/events-hub.html');
    });

    test('/pages/game-setup.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/game-setup.html');
    });
});

// ===========================================================================
// GROUP 2 - Pages needing league_id param
// ===========================================================================
test.describe('League Pages', () => {

    test('/pages/league-view.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/league-view.html?league_id=${LEAGUE_ID}`, { waitMs: 3000 });
    });

    test('/pages/league-scoreboard.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/league-scoreboard.html?league_id=${LEAGUE_ID}`, { waitMs: 3000 });
    });

    test('/pages/league-team.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/league-team.html?league_id=${LEAGUE_ID}&team_id=${HOME_TEAM}`, { waitMs: 3000 });
    });

    test('/pages/members.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/members.html?league_id=${LEAGUE_ID}`, { waitMs: 3000 });
    });

    test('/pages/league-cricket.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/league-cricket.html?league_id=${LEAGUE_ID}`, { waitMs: 3000 });
    });
});

// ===========================================================================
// GROUP 3 - Pages needing match context
// ===========================================================================
test.describe('Match Pages', () => {

    test('/pages/match-hub.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/match-hub.html?league_id=${LEAGUE_ID}&match_id=${MATCH_ID}`, { waitMs: 4000 });
    });

    test('/pages/live-scoreboard.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/live-scoreboard.html?league_id=${LEAGUE_ID}`, { waitMs: 3000 });
    });
});

// ===========================================================================
// GROUP 4 - PIN-gated pages (verify the PIN input renders)
// ===========================================================================
test.describe('PIN-Gated Pages', () => {

    test('/pages/dashboard.html shows PIN gate', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const response = await page.goto('/pages/dashboard.html');
        expect(response.status()).toBeLessThan(400);

        await page.waitForTimeout(2000);

        // The PIN input or login form should be present
        const pinInput = page.locator('#pinInput, input[type="password"], .login-box, .pin-input');
        await expect(pinInput.first()).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('/pages/admin.html shows PIN gate', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const response = await page.goto('/pages/admin.html');
        expect(response.status()).toBeLessThan(400);

        await page.waitForTimeout(2000);

        const pinInput = page.locator('#pinInput, input[type="password"], .login-box, .pin-input');
        await expect(pinInput.first()).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('/pages/director-dashboard.html shows PIN gate', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const response = await page.goto(`/pages/director-dashboard.html?league_id=${LEAGUE_ID}`);
        expect(response.status()).toBeLessThan(400);

        await page.waitForTimeout(2000);

        const pinInput = page.locator('#pinInput, input[type="password"], .login-box, .pin-input');
        await expect(pinInput.first()).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('/pages/stat-verification.html shows PIN gate', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const response = await page.goto('/pages/stat-verification.html');
        expect(response.status()).toBeLessThan(400);

        await page.waitForTimeout(2000);

        const pinInput = page.locator('#pinInput, input[type="password"], .login-box, .pin-input');
        await expect(pinInput.first()).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('/pages/captain-dashboard.html shows login gate', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const response = await page.goto(`/pages/captain-dashboard.html?league_id=${LEAGUE_ID}`);
        expect(response.status()).toBeLessThan(400);

        await page.waitForTimeout(2000);

        // Captain dashboard uses email login modal, not PIN
        const loginGate = page.locator('#loginModal, #loginEmail, #pinInput, input[type="password"], .login-box');
        await expect(loginGate.first()).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });
});

// ===========================================================================
// GROUP 5 - Player / Profile pages
// ===========================================================================
test.describe('Player & Profile Pages', () => {

    test('/pages/player-profile.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/player-profile.html');
    });

    test('/pages/team-profile.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/team-profile.html?league_id=${LEAGUE_ID}&team_id=${HOME_TEAM}`, { waitMs: 3000 });
    });

    test('/pages/friends.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/friends.html');
    });

    test('/pages/messages.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/messages.html');
    });
});

// ===========================================================================
// GROUP 6 - Scorer pages
// ===========================================================================
test.describe('Scorer Pages', () => {

    test('/scorers/x01.html loads', async ({ page }) => {
        await smokeTest(page, '/scorers/x01.html');
    });

    test('/scorers/cricket.html loads', async ({ page }) => {
        await smokeTest(page, '/scorers/cricket.html');
    });
});

// ===========================================================================
// GROUP 7 - Tournament / creation pages (may show empty states)
// ===========================================================================
test.describe('Tournament & Creation Pages', () => {

    test('/pages/create-league.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/create-league.html');
    });

    test('/pages/create-tournament.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/create-tournament.html');
    });

    test('/pages/bracket.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/bracket.html');
    });

    test('/pages/knockout.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/knockout.html');
    });

    test('/pages/tournament-bracket.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/tournament-bracket.html');
    });

    test('/pages/tournament-view.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/tournament-view.html');
    });
});

// ===========================================================================
// GROUP 8 - Social / Misc pages
// ===========================================================================
test.describe('Social & Misc Pages', () => {

    test('/pages/chat-room.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/chat-room.html');
    });

    test('/pages/draft-room.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/draft-room.html');
    });

    test('/pages/stream-director.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/stream-director.html');
    });

    test('/pages/bot-management.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/bot-management.html');
    });

    test('/pages/conversation.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/conversation.html');
    });

    test('/pages/dart-trader-listing.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/dart-trader-listing.html');
    });

    test('/pages/event-view.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/event-view.html');
    });

    test('/pages/player-registration.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/player-registration.html');
    });
});

// ===========================================================================
// GROUP 9 - Matchmaker pages
// ===========================================================================
test.describe('Matchmaker Pages', () => {

    test('/pages/matchmaker-mingle.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/matchmaker-mingle.html');
    });

    test('/pages/matchmaker-bracket.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/matchmaker-bracket.html');
    });

    test('/pages/matchmaker-register.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/matchmaker-register.html');
    });

    test('/pages/matchmaker-view.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/matchmaker-view.html');
    });

    test('/pages/matchmaker-tv.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/matchmaker-tv.html');
    });

    test('/pages/matchmaker-director.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/matchmaker-director.html');
    });
});

// ===========================================================================
// GROUP 10 - Additional pages found on disk
// ===========================================================================
test.describe('Additional Pages', () => {

    test('/pages/match-confirm.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/match-confirm.html?league_id=${LEAGUE_ID}&match_id=${MATCH_ID}`);
    });

    test('/pages/match-transition.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/match-transition.html?league_id=${LEAGUE_ID}&match_id=${MATCH_ID}`);
    });

    test('/pages/live-match.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/live-match.html?league_id=${LEAGUE_ID}&match_id=${MATCH_ID}`);
    });

    test('/pages/league-director.html loads', async ({ page }) => {
        await smokeTest(page, `/pages/league-director.html?league_id=${LEAGUE_ID}`);
    });

    test('/pages/x01-scorer.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/x01-scorer.html');
    });

    test('/pages/debug-review.html loads', async ({ page }) => {
        await smokeTest(page, '/pages/debug-review.html');
    });
});
