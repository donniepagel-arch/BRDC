import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SITE_ORIGIN = process.env.BRDC_SITE_ORIGIN || 'https://burningriverdarts.com';
const PROJECT_ID = 'brdc-v2';
const API_KEY = 'AIzaSyDN1aYhoVt3OX5EafsNTVB09i8VFx7QM1U';
const FUNCTION_BASE = `https://us-central1-${PROJECT_ID}.cloudfunctions.net`;
const PASSWORD = 'BRDC-QA-role-test-2026!';
const tournamentId = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const SHOULD_DELETE = process.argv.includes('--delete');
const RUN_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

if (!tournamentId) {
    console.error('Usage: node scripts/qa/online-tournament-ui-role-smoke.mjs <tournament_id> [--delete]');
    process.exit(2);
}

const roles = [
    { role: 'host', email: 'qa.online.host@burningriverdarts.com' },
    { role: 'player1', email: 'qa.online.player1@burningriverdarts.com' },
    { role: 'player2', email: 'qa.online.player2@burningriverdarts.com' },
    { role: 'spectator', email: 'qa.online.spectator@burningriverdarts.com' }
];

const report = {
    run_id: RUN_ID,
    tournament_id: tournamentId,
    site_origin: SITE_ORIGIN,
    checks: [],
    cleanup: []
};

function record(role, pageName, ok, details = {}) {
    report.checks.push({ role, page: pageName, ok, ...details });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${role} ${pageName}${details.summary ? ` - ${details.summary}` : ''}`);
    if (!ok) throw new Error(`${role} ${pageName} failed`);
}

async function callFunction(name, body = {}, idToken = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const response = await fetch(`${FUNCTION_BASE}/${name}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false || payload.error) {
        throw new Error(`${name} failed (${response.status}): ${payload.error || JSON.stringify(payload)}`);
    }
    return payload;
}

async function signIn(page, email) {
    await page.goto(`${SITE_ORIGIN}/pages/register.html`, { waitUntil: 'domcontentloaded' });
    return page.evaluate(async ({ email, password }) => {
        const config = await import('/js/firebase-config.js');
        const authModule = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        const credential = await authModule.signInWithEmailAndPassword(config.auth, email, password);
        return {
            uid: credential.user.uid,
            email: credential.user.email,
            token: await credential.user.getIdToken(true)
        };
    }, { email, password: PASSWORD });
}

async function checkPage(page, role, pageName, url, requiredText) {
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const body = await page.locator('body').innerText().catch(() => '');
    const badTokens = ['NaN', 'undefined', 'null', 'PIN'].filter(token => body.includes(token));
    const ok = body.includes(requiredText) && badTokens.length === 0 && errors.length === 0;
    record(role, pageName, ok, {
        url,
        required_text: requiredText,
        bad_tokens: badTokens,
        errors
    });
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    let hostToken = null;

    try {
        for (const item of roles) {
            const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
            const page = await context.newPage();
            const authState = await signIn(page, item.email);
            if (item.role === 'host') hostToken = authState.token;

            await checkPage(
                page,
                item.role,
                'tournament-view-vnext',
                `${SITE_ORIGIN}/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`,
                'QA Online Role Test'
            );
            await checkPage(
                page,
                item.role,
                'tournament-runtime-vnext',
                `${SITE_ORIGIN}/pages/tournament-runtime-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`,
                'QA Online Role Test'
            );
            await checkPage(
                page,
                item.role,
                'messages-vnext',
                `${SITE_ORIGIN}/pages/messages-vnext.html`,
                'Messages'
            );
            await context.close();
        }
    } finally {
        await browser.close();
    }

    if (SHOULD_DELETE && hostToken) {
        const result = await callFunction('deleteTournament', { tournament_id: tournamentId }, hostToken);
        report.cleanup.push(result.message || 'Deleted tournament');
    }

    await mkdir(path.resolve('reports'), { recursive: true });
    const reportPath = path.resolve('reports', `online-tournament-ui-role-smoke-${RUN_ID}.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`REPORT ${reportPath}`);
}

main().catch(async error => {
    report.error = error.message;
    await mkdir(path.resolve('reports'), { recursive: true });
    const reportPath = path.resolve('reports', `online-tournament-ui-role-smoke-${RUN_ID}-failed.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.error(`REPORT ${reportPath}`);
    console.error(error);
    process.exitCode = 1;
});
