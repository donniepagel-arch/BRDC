const { test, expect } = require('@playwright/test');
const admin = require('../../functions/node_modules/firebase-admin');

const BASE = 'https://burningriverdarts.com';
const FUNCTIONS_BASE = 'https://us-central1-brdc-v2.cloudfunctions.net';

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

const db = admin.firestore();

test.describe('Scorer checkpoint restore', () => {
    let createdDraftId = null;

    test.afterEach(async () => {
        if (!createdDraftId) return;
        await db.collection('pickup_games').doc(createdDraftId).delete().catch(() => null);
        createdDraftId = null;
    });

    test('x01 pickup checkpoint restores next leg state from server draft', async ({ browser }) => {
        const attachDialogs = (page) => page.on('dialog', async dialog => {
            const message = dialog.message() || '';
            if (message.includes('Resume server checkpoint?')) {
                await dialog.accept();
                return;
            }
            await dialog.accept();
        });

        const seedResponse = await fetch(`${FUNCTIONS_BASE}/savePickupGameProgress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game_type: '501',
                players: [
                    { id: null, name: 'Checkpoint A', is_bot: false },
                    { id: null, name: 'Checkpoint B', is_bot: false }
                ],
                legs: [
                    {
                        leg_number: 1,
                        format: '501',
                        winner: 'home',
                        first_throw: 'home',
                        cork_winner: null,
                        home_stats: {
                            darts_thrown: 9,
                            points_scored: 501,
                            first9_darts: 9,
                            first9_points: 501,
                            tons: 3,
                            ton_00: 0,
                            ton_20: 0,
                            ton_40: 0,
                            ton_60: 0,
                            ton_80: 2,
                            ton_forties: 0,
                            ton_eighties: 2,
                            ton_71: 0,
                            checkout: 141,
                            checkout_attempts: 1,
                            checkout_darts: 3,
                            high_score: 180,
                            first_turn_score: 180,
                            ton_points: 501,
                            threw_first: true
                        },
                        away_stats: {
                            darts_thrown: 6,
                            points_scored: 200,
                            first9_darts: 6,
                            first9_points: 200,
                            tons: 2,
                            ton_00: 0,
                            ton_20: 0,
                            ton_40: 0,
                            ton_60: 0,
                            ton_80: 0,
                            ton_forties: 0,
                            ton_eighties: 0,
                            ton_71: 0,
                            checkout: 0,
                            checkout_attempts: 0,
                            checkout_darts: 0,
                            high_score: 100,
                            first_turn_score: 100,
                            ton_points: 200,
                            threw_first: false
                        },
                        player_stats: {
                            'Checkpoint A': {
                                darts_thrown: 9,
                                points_scored: 501,
                                darts: 9,
                                points: 501,
                                average: 167,
                                tons: 3,
                                ton_80: 2,
                                checkout: 141,
                                checkout_attempts: 1,
                                checkout_darts: 3,
                                high_score: 180,
                                first_turn_score: 180,
                                first9_darts: 9,
                                first9_points: 501
                            },
                            'Checkpoint B': {
                                darts_thrown: 6,
                                points_scored: 200,
                                darts: 6,
                                points: 200,
                                average: 100,
                                tons: 2,
                                checkout: 0,
                                checkout_attempts: 0,
                                checkout_darts: 0,
                                high_score: 100,
                                first_turn_score: 100,
                                first9_darts: 6,
                                first9_points: 200
                            }
                        },
                        throws: [
                            { round: 1, home: { player: 'Checkpoint A', score: 180, remaining: 321 }, away: { player: 'Checkpoint B', score: 100, remaining: 401 } },
                            { round: 2, home: { player: 'Checkpoint A', score: 180, remaining: 141 }, away: { player: 'Checkpoint B', score: 100, remaining: 301 } },
                            { round: 3, home: { player: 'Checkpoint A', score: 141, remaining: 0, checkout: true, checkout_darts: 3 } }
                        ]
                    }
                ],
                match_config: {
                    bestOfLegs: 3,
                    bestOfSets: 1,
                    doubleOut: false,
                    masterOut: false,
                    outRule: 'straight',
                    doubleIn: false
                },
                progress: {
                    scorer_type: 'x01',
                    game_number: 1,
                    home_legs_won: 1,
                    away_legs_won: 0
                }
            })
        });
        const seedJson = await seedResponse.json();
        expect(seedResponse.ok).toBeTruthy();
        expect(seedJson.success).toBeTruthy();
        createdDraftId = seedJson.draft_id;
        expect(createdDraftId).toBeTruthy();

        const url = `${BASE}/pages/x01-scorer.html?` + new URLSearchParams({
            casual: 'true',
            cork: 'false',
            starting_score: '501',
            checkout: 'straight',
            in_rule: 'straight',
            legs_to_win: '2',
            pickup_draft_id: createdDraftId,
            home_team_name: 'Checkpoint Home',
            away_team_name: 'Checkpoint Away',
            home_players: JSON.stringify([{ name: 'Checkpoint A' }]),
            away_players: JSON.stringify([{ name: 'Checkpoint B' }]),
        }).toString();

        const restoredPage = await browser.newPage();
        attachDialogs(restoredPage);
        await restoredPage.goto(url, { waitUntil: 'domcontentloaded' });
        await restoredPage.waitForSelector('#starterModal.active', { timeout: 15000 });

        await expect(restoredPage.locator('#homeLegs')).toHaveText('1');
        await expect(restoredPage.locator('#awayLegs')).toHaveText('0');
        await expect(restoredPage.locator('#starterLegInfo')).toContainText('LEG 2');
        await expect(restoredPage.locator('#homeScore')).toHaveText('501');
        await expect(restoredPage.locator('#awayScore')).toHaveText('501');

        const savedDraft = await db.collection('pickup_games').doc(createdDraftId).get();
        expect(savedDraft.exists).toBeTruthy();
        expect(savedDraft.data().status).toBe('in_progress');
        expect(savedDraft.data().is_draft).toBe(true);
        expect(Array.isArray(savedDraft.data().legs)).toBe(true);
        expect(savedDraft.data().legs.length).toBeGreaterThanOrEqual(1);

        await restoredPage.close();
    });
});
