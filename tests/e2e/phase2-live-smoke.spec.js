const { test, expect } = require('@playwright/test');

const LEAGUE_CRICKET_URL =
    '/pages/league-cricket.html?league_id=aOq4Y0ETxPZ66tM1uUtP&match_id=DQdP5R1ba6ZzJswCljYE&game_index=1&game_number=2&from_match=true&total_games=9&home_team_name=neon+nightmares&away_team_name=N.+Mezlak&home_players=%5B%7B%22id%22%3A%22pL9CGc688Z%22%2C%22name%22%3A%22Dominick%20Russano%22%2C%22level%22%3A%22C%22%7D%5D&away_players=%5B%7B%22id%22%3A%22dFmalrT5BM%22%2C%22name%22%3A%22Dillon%20Ulisses%22%2C%22level%22%3A%22C%22%7D%5D&legs_to_win=2&cork=true&cork_rule=cork_every_leg&cork_option=home';

function collectRelevantLogs(page) {
    const logs = [];
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));
    return logs;
}

function filterRelevantLogs(logs) {
    return logs.filter(entry =>
        entry.includes('ChatDrawer') ||
        entry.includes('Error loading channels') ||
        entry.includes('Error loading conversations') ||
        entry.includes('LiveMatch') ||
        entry.includes('legsToWin') ||
        entry.includes('ReferenceError') ||
        entry.includes('Invalid Date')
    );
}

test.describe('Phase 2 Live Smoke', () => {
    test('desktop register page chat drawer resolves to unauthenticated empty state', async ({ browser, baseURL }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        const logs = collectRelevantLogs(page);

        await page.goto(`${baseURL}/pages/register.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(7000);

        await expect(page.locator('#chatDrawerRecentList')).toContainText('Log in to see messages');
        await expect(page.locator('#chatDrawerRoomList')).toContainText('Log in to see rooms');

        expect(filterRelevantLogs(logs)).toEqual([]);
        await context.close();
    });

    test('messages page unauthenticated state loads without channel/conversation loader errors', async ({ page }) => {
        const logs = collectRelevantLogs(page);

        await page.goto('/pages/messages.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        await expect(page.locator('#loginPage')).toBeVisible();

        const relevant = filterRelevantLogs(logs).filter(entry =>
            entry.includes('Error loading channels') ||
            entry.includes('Error loading conversations')
        );
        expect(relevant).toEqual([]);
    });

    test('league cricket match-context page loads without prior console regressions', async ({ browser, baseURL }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        const logs = collectRelevantLogs(page);

        await page.goto(`${baseURL}${LEAGUE_CRICKET_URL}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        await expect(page).toHaveTitle(/Cricket Scorer - BRDC/);
        await expect(page.locator('body')).toContainText('CRICKET SCORER');
        await expect(page.locator('body')).toContainText('Dominick');
        await expect(page.locator('body')).toContainText('Dillon');

        const relevant = filterRelevantLogs(logs).filter(entry =>
            entry.includes('LiveMatch') ||
            entry.includes('legsToWin') ||
            entry.includes('ReferenceError') ||
            entry.includes('Unauthorized')
        );
        expect(relevant).toEqual([]);
        await context.close();
    });
});
