/**
 * Fetches DartConnect recap game detail pages via puppeteer and saves them
 * as normalized txt files compatible with import-from-dc-web.js parser.
 *
 * Usage: node scripts/fetch-dc-matches.js
 */

'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URLS = [
    'https://recap.dartconnect.com/games/69c46b7f34d25fbeabf03e71',
    'https://recap.dartconnect.com/games/69c46de334d25fbeabf044c3',
    'https://recap.dartconnect.com/games/69c46c6534d25fbeabf040ab',
    'https://recap.dartconnect.com/games/69bb30ed34d25fbeabe63a04',
    'https://recap.dartconnect.com/games/69bb327534d25fbeabe63e0d',
    'https://recap.dartconnect.com/games/69c46c8034d25fbeabf040df',
    'https://recap.dartconnect.com/games/69bb331c34d25fbeabe63fd0',
];

const OUT_DIR = path.join(__dirname, '..', 'temp', 'dc-web', 'week-new');

/**
 * Normalizes body.innerText from the new DartConnect recap UI into the format
 * expected by the import-from-dc-web.js parser.
 *
 * New format game header (multi-line):
 *   Game 1.1 - Cricket
 *   \t
 *   80
 *   \t-\t
 *   74
 *   \t
 *   06:59
 *
 * Expected format (single line):
 *   Game 1.1 - Cricket\t80\t-\t74\t06:59
 */
function normalizeText(rawText) {
    const allLines = rawText.split('\n');

    // Strip boilerplate top (everything before first "Date:" line)
    let startIdx = 0;
    for (let i = 0; i < allLines.length; i++) {
        if (/^Date:/.test(allLines[i])) { startIdx = i; break; }
    }

    // Strip disclaimer bottom
    let endIdx = allLines.length;
    for (let i = allLines.length - 1; i >= 0; i--) {
        if (/^Disclaimer:/.test(allLines[i])) { endIdx = i; break; }
    }

    const lines = allLines.slice(startIdx, endIdx);
    const result = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Detect multi-line game header: "Game X.Y - FORMAT"
        const gameMatch = line.match(/^Game (\d+)\.(\d+) - (.+)$/);
        if (gameMatch && i + 6 < lines.length) {
            const leftScore  = lines[i + 2].trim();
            const rightScore = lines[i + 4].trim();
            const duration   = lines[i + 6].trim();

            if (/^\d+$/.test(leftScore) && /^\d+$/.test(rightScore) && /^[\d:]+$/.test(duration)) {
                result.push(`Game ${gameMatch[1]}.${gameMatch[2]} - ${gameMatch[3]}\t${leftScore}\t-\t${rightScore}\t${duration}`);
                i += 7;
                if (i < lines.length && lines[i].trim() === '') i++; // skip blank after header
                continue;
            }
        }

        // Strip nav/UI lines that aren't match data
        if (
            /^(More Darts!|View Legacy Report|Game Detail|Learn More|Select Report:|Summary >|Player Performance >|Match Counts >|My DCA >|Green:|Gold:|Red:)/.test(line) ||
            /^\t\t$/.test(line)
        ) {
            i++;
            continue;
        }

        result.push(line);
        i++;
    }

    return result.join('\n');
}

async function fetchAll() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    for (const url of URLS) {
        const matchId = url.split('/').pop();
        const outFile = path.join(OUT_DIR, `${matchId}.txt`);

        if (fs.existsSync(outFile)) {
            console.log(`[SKIP] ${matchId} already fetched`);
            continue;
        }

        console.log(`[FETCH] ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500)); // let JS render

        const rawText = await page.evaluate(() => document.body.innerText);
        const normalized = normalizeText(rawText);

        // Extract match identity from first player names for filename
        const playerMatch = normalized.match(/\t([A-Z][a-z]+ [A-Z][a-z]+)\t/);
        const label = playerMatch ? playerMatch[1].replace(' ', '-').toLowerCase() : matchId;

        fs.writeFileSync(outFile, normalized, 'utf8');
        console.log(`[SAVED] ${outFile}`);

        // Brief pause between requests
        await new Promise(r => setTimeout(r, 1000));
    }

    await browser.close();
    console.log('\nAll done.');
}

fetchAll().catch(err => { console.error(err); process.exit(1); });
