import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.BRDC_BASE_URL || 'https://burningriverdarts.com';
const LEAGUE_ID = process.env.BRDC_LEAGUE_ID || 'aOq4Y0ETxPZ66tM1uUtP';
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_DIR = path.resolve('reports', 'triples-player-profiles', RUN_ID);

function badTokens(text) {
    return ['NaN', 'undefined', 'null'].filter(token => String(text || '').includes(token));
}

function hasEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function hasValidTeamLabel(player) {
    if (player.level === 'F' || player.team === 'Fill-in') return player.team === 'Fill-in';
    return player.team && player.team !== '-';
}

async function getMembersFromPage(page) {
    await page.goto(`${BASE_URL}/pages/members-vnext.html?league_id=${encodeURIComponent(LEAGUE_ID)}&qa=${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
        const count = Number(document.querySelector('#memberCount')?.innerText || 0);
        return count > 40 && document.querySelectorAll('.ves-member-card').length > 40;
    }, { timeout: 45000 });
    return page.evaluate(() => {
        return [...document.querySelectorAll('.ves-member-card')].map(card => {
            const url = new URL(card.href);
            return {
                id: url.searchParams.get('player_id'),
                href: card.href,
                name: card.querySelector('.ves-member-main strong')?.innerText.trim() || '',
                team: card.querySelector('.ves-member-main em')?.innerText.trim() || '',
                level: card.querySelector('.ves-member-level')?.innerText.trim() || '',
                statsText: card.querySelector('.ves-member-stats')?.innerText.trim() || '',
                text: card.innerText
            };
        });
    });
}

async function auditProfile(page, member) {
    const consoleErrors = [];
    const onConsole = message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
    };
    page.on('console', onConsole);
    await page.goto(`${BASE_URL}/pages/player-profile-vnext.html?league_id=${encodeURIComponent(LEAGUE_ID)}&player_id=${encodeURIComponent(member.id)}&qa=${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
        const hero = document.querySelector('#profileHero')?.innerText || '';
        const stats = document.querySelector('#statsGrid')?.innerText || '';
        return hero.length > 20 && stats.length > 20 && !hero.includes('Loading');
    }, { timeout: 45000 }).catch(() => null);

    const data = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const hero = document.querySelector('#profileHero')?.innerText || '';
        const stats = document.querySelector('#statsGrid')?.innerText || '';
        const details = document.querySelector('#profileDetails')?.innerText || '';
        const matches = document.querySelector('#matchList')?.innerText || '';
        const links = [...document.querySelectorAll('a[href]')].map(link => link.href);
        const detailRows = {};
        [...document.querySelectorAll('.ppv-detail-row')].forEach(row => {
            const label = row.querySelector('span')?.innerText.trim();
            const value = row.querySelector('strong')?.innerText.trim();
            if (label) detailRows[label] = value || '';
        });
        return {
            title: document.title,
            url: location.href,
            hero,
            stats,
            details,
            detailRows,
            matches,
            links,
            bodyLength: text.length,
            badText: ['NaN', 'undefined', 'null'].filter(token => text.includes(token)),
            hasClassicProfileLink: links.some(href => href.includes('/pages/player-profile.html') && !href.includes('player-profile-vnext.html')),
            hasVnextMatchLinks: links.some(href => href.includes('/pages/match-hub-vnext.html')),
            hasLeagueLink: links.some(href => href.includes('/pages/triples-vnext.html'))
        };
    });
    page.off('console', onConsole);

    const heroLower = data.hero.toLowerCase();
    const statsLower = data.stats.toLowerCase();
    const role = data.detailRows.Role || '';
    const team = data.detailRows.Team || '';
    const level = data.detailRows.Level || '';
    const email = data.detailRows.Email || '';
    const problems = [];
    const warnings = [];

    if (!heroLower.includes(member.name.toLowerCase())) problems.push('profile hero missing member name');
    if (member.level === 'F') {
        if (team !== 'Fill-in') problems.push(`fill-in team label is ${team || 'blank'}`);
        if (!/fill/i.test(role)) problems.push(`fill-in role is ${role || 'blank'}`);
        if (level !== 'F') problems.push(`fill-in level is ${level || 'blank'}`);
    } else {
        if (team !== member.team) problems.push(`team mismatch members=${member.team} profile=${team}`);
        if (!['A', 'B', 'C'].includes(level)) problems.push(`league player level is ${level || 'blank'}`);
    }
    if (!statsLower.includes('3da')) problems.push('stats grid missing 3DA');
    if (!statsLower.includes('mpr')) problems.push('stats grid missing MPR');
    if (!statsLower.includes('game win')) problems.push('stats grid missing game win percent');
    if (data.badText.length) problems.push(`bad text: ${data.badText.join(', ')}`);
    if (consoleErrors.length) problems.push(`console errors: ${consoleErrors.length}`);
    if (data.hasClassicProfileLink) problems.push('classic profile link present');
    if (!data.hasLeagueLink) problems.push('missing vnext league link');
    if (!hasEmail(email)) warnings.push('profile missing valid email/account link field');

    return {
        member,
        profile: data,
        consoleErrors,
        ok: problems.length === 0,
        problems,
        warnings
    };
}

async function main() {
    await mkdir(REPORT_DIR, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const members = await getMembersFromPage(page);

    const memberProblems = [];
    const ids = new Set();
    for (const member of members) {
        if (!member.id) memberProblems.push({ member, problem: 'missing player_id in member link' });
        if (ids.has(member.id)) memberProblems.push({ member, problem: 'duplicate player_id in members list' });
        ids.add(member.id);
        if (badTokens(member.text).length) memberProblems.push({ member, problem: `bad member card text: ${badTokens(member.text).join(', ')}` });
        if (!hasValidTeamLabel(member)) memberProblems.push({ member, problem: `invalid team label ${member.team}` });
        if (!['A', 'B', 'C', 'F'].includes(member.level)) memberProblems.push({ member, problem: `invalid level ${member.level}` });
    }

    const profileResults = [];
    for (const member of members) {
        if (!member.id) continue;
        profileResults.push(await auditProfile(page, member));
    }
    await browser.close();

    const report = {
        startedAt: RUN_ID,
        baseUrl: BASE_URL,
        leagueId: LEAGUE_ID,
        counts: {
            total: members.length,
            players: members.filter(member => member.level !== 'F').length,
            fillins: members.filter(member => member.level === 'F').length,
            duplicateIds: members.length - ids.size
        },
        memberProblems,
        profileProblems: profileResults.filter(result => !result.ok).map(result => ({
            id: result.member.id,
            name: result.member.name,
            team: result.member.team,
            level: result.member.level,
            problems: result.problems,
            consoleErrors: result.consoleErrors
        })),
        accountWarnings: profileResults.filter(result => result.warnings.length > 0).map(result => ({
            id: result.member.id,
            name: result.member.name,
            team: result.member.team,
            level: result.member.level,
            warnings: result.warnings
        })),
        results: profileResults.map(result => ({
            id: result.member.id,
            name: result.member.name,
            team: result.member.team,
            level: result.member.level,
            ok: result.ok,
            problems: result.problems,
            warnings: result.warnings
        }))
    };

    report.ok = report.memberProblems.length === 0 && report.profileProblems.length === 0;
    const reportPath = path.join(REPORT_DIR, 'report.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
        ok: report.ok,
        reportPath,
        counts: report.counts,
        memberProblems: report.memberProblems.length,
        profileProblems: report.profileProblems.length,
        accountWarnings: report.accountWarnings.length,
        sampleProblems: report.profileProblems.slice(0, 10)
    }, null, 2));
    if (!report.ok) process.exitCode = 1;
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
