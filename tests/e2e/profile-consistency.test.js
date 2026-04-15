const { test, expect } = require('@playwright/test');

const BASE      = 'https://brdc-v2.web.app';
const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const MATCH_ID  = 'sgmoL4GyVUYP67aOS7wm';
const PLAYER_ID = 'X2DMb9bP4Q8fy9yr5Fam'; // Donnie Pagel
const TEAM_ID   = 'mgR4e3zldLsM9tAnXmK8'; // M. Pagel team

// Get a computed style property — works even on display:none parents
async function getStyle(page, selector, prop) {
    return page.evaluate(
        ([sel, p]) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            return window.getComputedStyle(el)[p];
        },
        [selector, prop]
    );
}

test.describe('Profile Visual Consistency', () => {

    // ── Player Profile ─────────────────────────────────────────────────────

    test('player profile: header is full-bleed (no 3px card border)', async ({ page }) => {
        await page.goto(
            `${BASE}/pages/player-profile.html?player_id=${PLAYER_ID}&league_id=${LEAGUE_ID}`,
            { waitUntil: 'domcontentloaded' }
        );
        await page.waitForTimeout(1500);

        // CSS checks work regardless of auth state — element is in DOM even when hidden
        const borderWidth = await getStyle(page, '.profile-header-card', 'borderTopWidth');
        expect(borderWidth, 'Header card should have no thick top border').toBe('0px');

        const borderRadius = await getStyle(page, '.profile-header-card', 'borderRadius');
        expect(borderRadius, 'Header card should have no border-radius').toBe('0px');

        const boxShadow = await getStyle(page, '.profile-header-card', 'boxShadow');
        expect(boxShadow, 'Header card should have no box-shadow').toBe('none');

        await page.screenshot({ path: 'test-results/player-profile-header.png', fullPage: false });
    });

    test('player profile: tabs are sticky with underline active state', async ({ page }) => {
        await page.goto(
            `${BASE}/pages/player-profile.html?player_id=${PLAYER_ID}&league_id=${LEAGUE_ID}`,
            { waitUntil: 'domcontentloaded' }
        );
        await page.waitForTimeout(1500);

        const position = await getStyle(page, '.dashboard-tabs', 'position');
        expect(position, 'Tabs should be sticky').toBe('sticky');

        const top = await getStyle(page, '.dashboard-tabs', 'top');
        expect(top, 'Tabs should stick at 56px').toBe('56px');

        // Active tab: should NOT be solid pink (#FF469A = rgb(255, 70, 154))
        const activeBg = await getStyle(page, '.dash-tab.active', 'backgroundColor');
        expect(activeBg, 'Active tab should not have solid pink fill').not.toBe('rgb(255, 70, 154)');

        // Active tab: should have pink bottom border
        const activeBorderBottom = await getStyle(page, '.dash-tab.active', 'borderBottomColor');
        expect(activeBorderBottom, 'Active tab should have pink bottom border').toBe('rgb(255, 70, 154)');

        await page.screenshot({ path: 'test-results/player-profile-tabs.png', fullPage: false });
    });

    // ── Team Profile ───────────────────────────────────────────────────────

    test('team profile: header is full-bleed (no 3px card border)', async ({ page }) => {
        await page.goto(
            `${BASE}/pages/team-profile.html?league_id=${LEAGUE_ID}&team_id=${TEAM_ID}`,
            { waitUntil: 'domcontentloaded' }
        );

        // Team profile reads Firestore directly — wait for the header to render
        await page.waitForSelector('.team-header-card', { timeout: 20000 });

        const borderWidth = await getStyle(page, '.team-header-card', 'borderTopWidth');
        expect(borderWidth, 'Team header should have no thick top border').toBe('0px');

        const borderRadius = await getStyle(page, '.team-header-card', 'borderRadius');
        expect(borderRadius, 'Team header should have no border-radius').toBe('0px');

        const boxShadow = await getStyle(page, '.team-header-card', 'boxShadow');
        expect(boxShadow, 'Team header should have no box-shadow').toBe('none');

        await page.screenshot({ path: 'test-results/team-profile-header.png', fullPage: false });
    });

    test('team profile: tabs are sticky with underline active state', async ({ page }) => {
        await page.goto(
            `${BASE}/pages/team-profile.html?league_id=${LEAGUE_ID}&team_id=${TEAM_ID}`,
            { waitUntil: 'domcontentloaded' }
        );

        await page.waitForSelector('.tabs', { timeout: 20000 });

        const position = await getStyle(page, '.tabs', 'position');
        expect(position, 'Team tabs should be sticky').toBe('sticky');

        const top = await getStyle(page, '.tabs', 'top');
        expect(top, 'Tabs should stick at 56px').toBe('56px');

        const activeBg = await getStyle(page, '.tab.active', 'backgroundColor');
        expect(activeBg, 'Active tab should not have solid pink fill').not.toBe('rgb(255, 70, 154)');

        const activeBorderBottom = await getStyle(page, '.tab.active', 'borderBottomColor');
        expect(activeBorderBottom, 'Active tab should have pink bottom border').toBe('rgb(255, 70, 154)');

        await page.screenshot({ path: 'test-results/team-profile-tabs.png', fullPage: false });
    });

    // ── Match Hub Reference ────────────────────────────────────────────────

    test('match hub: sticky tabs confirmed as reference', async ({ page }) => {
        await page.goto(
            `${BASE}/pages/match-hub.html?league_id=${LEAGUE_ID}&match_id=${MATCH_ID}`,
            { waitUntil: 'domcontentloaded' }
        );

        await page.waitForSelector('.match-header-card, #mainContent, #loadingState', { timeout: 20000 });
        await page.waitForTimeout(2000);

        await page.screenshot({ path: 'test-results/match-hub-reference.png', fullPage: false });

        // Confirm match hub itself has sticky tab-nav (the design we're matching)
        const tabPos = await getStyle(page, '.tab-nav', 'position');
        expect(tabPos, 'Match hub tab-nav should be sticky').toBe('sticky');
    });

});
