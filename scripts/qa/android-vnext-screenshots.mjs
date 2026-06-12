import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ADB = process.env.ADB || 'C:\\Users\\gcfrp\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const BASE_URL = process.env.BRDC_BASE_URL || 'https://burningriverdarts.com';
const REPORT_DIR = process.env.BRDC_REPORT_DIR || 'reports/android-vnext-screenshots';
const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

const pages = [
  ['home', '/pages/home-vnext.html'],
  ['triples', `/pages/triples-vnext.html?league_id=${LEAGUE_ID}`],
  ['messages', '/pages/messages-vnext.html'],
  ['captain', `/pages/captain-dashboard-vnext.html?league_id=${LEAGUE_ID}`],
  ['director', `/pages/league-director-vnext.html?league_id=${LEAGUE_ID}`],
  ['admin', '/pages/admin-vnext.html'],
  ['members', `/pages/members-vnext.html?league_id=${LEAGUE_ID}`]
];

async function openAndroidUrl(url, waitMs = 18000) {
  await execFileAsync(ADB, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url.replaceAll('&', '\\&')]);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

async function screenshot(localPath) {
  const remotePath = '/sdcard/brdc-vnext-shot.png';
  await execFileAsync(ADB, ['shell', 'screencap', '-p', remotePath]);
  await execFileAsync(ADB, ['pull', remotePath, localPath]);
  await execFileAsync(ADB, ['shell', 'rm', remotePath]).catch(() => {});
}

const startedAt = new Date();
const runDir = path.join(REPORT_DIR, startedAt.toISOString().replace(/[:.]/g, '-'));
await fs.mkdir(runDir, { recursive: true });

const results = [];
for (const [name, route] of pages) {
  const url = new URL(route, BASE_URL);
  url.searchParams.set('qa', String(Date.now()));
  await openAndroidUrl(url.toString());
  const file = `${name}.png`;
  await screenshot(path.join(runDir, file));
  results.push({ name, url: url.toString(), file });
}

const reportPath = path.join(runDir, 'report.json');
await fs.writeFile(reportPath, JSON.stringify({ startedAt: startedAt.toISOString(), runDir, results }, null, 2));
console.log(JSON.stringify({ reportPath, runDir, screenshots: results.map((result) => result.file) }, null, 2));
