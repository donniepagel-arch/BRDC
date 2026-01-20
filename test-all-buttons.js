/**
 * Comprehensive Button and Functionality Test Script
 * Tests all major buttons and features across the BRDC site
 */

const BASE_URL = 'https://us-central1-brdc-v2.cloudfunctions.net';

// Test configuration
const TEST_PIN = '39632911';  // Admin PIN

// Helper function to call Firebase functions
async function callFunction(name, data = {}) {
    const response = await fetch(`${BASE_URL}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return await response.json();
}

// Test results tracking
const results = {
    passed: [],
    failed: [],
    skipped: []
};

function logResult(test, passed, details = '') {
    if (passed) {
        results.passed.push({ test, details });
        console.log(`✅ PASS: ${test}${details ? ' - ' + details : ''}`);
    } else {
        results.failed.push({ test, details });
        console.log(`❌ FAIL: ${test}${details ? ' - ' + details : ''}`);
    }
}

function logSkip(test, reason) {
    results.skipped.push({ test, reason });
    console.log(`⏭️ SKIP: ${test} - ${reason}`);
}

// ========== PAGE LOAD TESTS ==========
async function testPageLoads() {
    console.log('\n========== PAGE LOAD TESTS ==========\n');

    const pages = [
        { name: 'Homepage', path: '/' },
        { name: 'Dashboard', path: '/pages/dashboard.html' },
        { name: 'Create League', path: '/pages/create-league.html' },
        { name: 'Create Tournament', path: '/pages/create-tournament.html' },
        { name: 'League Director', path: '/pages/league-director.html' },
        { name: 'Admin', path: '/pages/admin.html' },
        { name: 'Scorer Hub', path: '/pages/scorer-hub.html' },
    ];

    for (const page of pages) {
        try {
            const response = await fetch(`https://brdc-v2.web.app${page.path}`);
            logResult(`${page.name} page loads`, response.ok, `Status: ${response.status}`);
        } catch (e) {
            logResult(`${page.name} page loads`, false, e.message);
        }
    }
}

// ========== ADMIN FUNCTION TESTS ==========
async function testAdminFunctions() {
    console.log('\n========== ADMIN FUNCTION TESTS ==========\n');

    // Test 1: Admin login
    try {
        const result = await callFunction('adminLogin', { pin: TEST_PIN });
        logResult('Admin login (adminLogin)', result.success === true,
            `is_admin: ${result.is_admin}, name: ${result.name || 'N/A'}`);
    } catch (e) {
        logResult('Admin login (adminLogin)', false, e.message);
    }

    // Test 2: Get member permissions
    try {
        const result = await callFunction('getMemberPermissions', { player_pin: TEST_PIN });
        logResult('Get member permissions', result.success === true,
            `can_create_leagues: ${result.permissions?.can_create_leagues}`);
    } catch (e) {
        logResult('Get member permissions', false, e.message);
    }

    // Test 3: Admin get all members
    try {
        const result = await callFunction('adminGetMembers', { pin: TEST_PIN });
        logResult('Admin get members list', result.success === true,
            `Found ${result.members?.length || 0} members`);
    } catch (e) {
        logResult('Admin get members list', false, e.message);
    }

    // Test 4: Admin dashboard
    try {
        const result = await callFunction('adminGetDashboard', { pin: TEST_PIN });
        logResult('Admin get dashboard', result.success === true,
            `leagues: ${result.leagues?.length || 0}, tournaments: ${result.tournaments?.length || 0}`);
    } catch (e) {
        logResult('Admin get dashboard', false, e.message);
    }
}

// ========== GLOBAL AUTH FUNCTION TESTS ==========
async function testGlobalAuthFunctions() {
    console.log('\n========== GLOBAL AUTH FUNCTION TESTS ==========\n');

    // Test 1: Global login
    try {
        const result = await callFunction('globalLogin', { pin: TEST_PIN });
        logResult('Global login', result.success === true,
            `Name: ${result.player?.first_name || result.first_name || 'N/A'}`);
    } catch (e) {
        logResult('Global login', false, e.message);
    }

    // Test 2: Get dashboard data
    try {
        const result = await callFunction('getDashboardData', { pin: TEST_PIN });
        logResult('Get dashboard data', result.success === true,
            `leagues: ${result.leagues?.length || 0}, tournaments: ${result.tournaments?.length || 0}`);
    } catch (e) {
        logResult('Get dashboard data', false, e.message);
    }

    // Test 3: Get all players
    try {
        const result = await callFunction('getAllPlayers', {});
        logResult('Get all players', result.success === true || Array.isArray(result.players),
            `Found ${result.players?.length || 0} players`);
    } catch (e) {
        logResult('Get all players', false, e.message);
    }
}

// ========== LEAGUE FUNCTION TESTS ==========
async function testLeagueFunctions() {
    console.log('\n========== LEAGUE FUNCTION TESTS ==========\n');

    // Test 1: Verify league PIN
    try {
        const result = await callFunction('verifyLeaguePin', { pin: TEST_PIN });
        logResult('Verify league PIN', result.success === true,
            `Name: ${result.director?.name || result.name || 'Unknown'}`);
    } catch (e) {
        logResult('Verify league PIN', false, e.message);
    }

    // Test 2: Get league templates
    try {
        const result = await callFunction('getLeagueTemplates', { director_pin: TEST_PIN });
        logResult('Get league templates', result.success === true,
            `Found ${result.templates?.length || 0} templates`);
    } catch (e) {
        logResult('Get league templates', false, e.message);
    }

    // Test 3: Get league drafts
    try {
        const result = await callFunction('getLeagueDraft', { director_pin: TEST_PIN });
        logResult('Get league drafts', result.success === true,
            `Has draft: ${result.draft ? 'Yes' : 'No'}`);
    } catch (e) {
        logResult('Get league drafts', false, e.message);
    }
}

// ========== TOURNAMENT FUNCTION TESTS ==========
async function testTournamentFunctions() {
    console.log('\n========== TOURNAMENT FUNCTION TESTS ==========\n');

    // Test 1: Get tournament templates
    try {
        const result = await callFunction('getTournamentTemplates', { director_pin: TEST_PIN });
        logResult('Get tournament templates', result.success === true,
            `Found ${result.templates?.length || 0} templates`);
    } catch (e) {
        logResult('Get tournament templates', false, e.message);
    }

    // Test 2: Get tournament draft
    try {
        const result = await callFunction('getTournamentDraft', { director_pin: TEST_PIN });
        logResult('Get tournament draft', result.success === true,
            `Has draft: ${result.draft ? 'Yes' : 'No'}`);
    } catch (e) {
        logResult('Get tournament draft', false, e.message);
    }
}

// ========== TEMPLATE/DRAFT SAVE TESTS ==========
async function testTemplateDraftSave() {
    console.log('\n========== TEMPLATE/DRAFT SAVE TESTS ==========\n');

    // Test: Save league template
    try {
        const result = await callFunction('saveLeagueTemplate', {
            director_pin: TEST_PIN,
            template_name: 'Test Template ' + Date.now(),
            template_data: { league_name: 'Test', format: 'triples_draft' }
        });
        logResult('Save league template', result.success === true,
            result.message || result.error || 'Unknown');
    } catch (e) {
        logResult('Save league template', false, e.message);
    }

    // Test: Save league draft
    try {
        const result = await callFunction('saveLeagueDraft', {
            director_pin: TEST_PIN,
            draft_data: { league_name: 'Draft Test', format: 'doubles_draft' }
        });
        logResult('Save league draft', result.success === true,
            result.message || result.error || 'Unknown');
    } catch (e) {
        logResult('Save league draft', false, e.message);
    }

    // Test: Save tournament template
    try {
        const result = await callFunction('saveTournamentTemplate', {
            director_pin: TEST_PIN,
            template_name: 'Test Tournament Template ' + Date.now(),
            template_data: { name: 'Test Tourney', format: 'single_elimination' }
        });
        logResult('Save tournament template', result.success === true,
            result.message || result.error || 'Unknown');
    } catch (e) {
        logResult('Save tournament template', false, e.message);
    }

    // Test: Save tournament draft
    try {
        const result = await callFunction('saveTournamentDraft', {
            director_pin: TEST_PIN,
            draft_data: { name: 'Draft Tourney', format: 'double_elimination' }
        });
        logResult('Save tournament draft', result.success === true,
            result.message || result.error || 'Unknown');
    } catch (e) {
        logResult('Save tournament draft', false, e.message);
    }
}

// ========== LEAGUE DIRECTOR FUNCTION TESTS ==========
async function testLeagueDirectorFunctions() {
    console.log('\n========== LEAGUE DIRECTOR FUNCTION TESTS ==========\n');

    // First get a league to test with via admin dashboard
    let testLeagueId = null;
    try {
        const dashResult = await callFunction('adminGetDashboard', { pin: TEST_PIN });
        if (dashResult.leagues && dashResult.leagues.length > 0) {
            testLeagueId = dashResult.leagues[0].id;
            console.log(`Using test league: ${testLeagueId} (${dashResult.leagues[0].name})`);
        }
    } catch (e) {
        console.log('Could not get test league from admin dashboard');
    }

    if (!testLeagueId) {
        logSkip('League director functions', 'No leagues available for testing');
        return;
    }

    // Test: Get league details
    try {
        const result = await callFunction('getLeague', { league_id: testLeagueId });
        logResult('Get league details', result.success === true || result.league != null,
            `League: ${result.league?.name || 'Unknown'}`);
    } catch (e) {
        logResult('Get league details', false, e.message);
    }

    // Test: Get league players
    try {
        const result = await callFunction('getPlayers', { league_id: testLeagueId });
        logResult('Get league players', result.success === true || Array.isArray(result.players),
            `Found ${result.players?.length || 0} players`);
    } catch (e) {
        logResult('Get league players', false, e.message);
    }

    // Test: Get league teams
    try {
        const result = await callFunction('getTeams', { league_id: testLeagueId });
        logResult('Get league teams', result.success === true || Array.isArray(result.teams),
            `Found ${result.teams?.length || 0} teams`);
    } catch (e) {
        logResult('Get league teams', false, e.message);
    }

    // Test: Get league standings
    try {
        const result = await callFunction('getStandings', { league_id: testLeagueId });
        logResult('Get league standings', result.success === true || result.standings != null,
            `Has standings data: ${result.standings ? 'Yes' : 'No'}`);
    } catch (e) {
        logResult('Get league standings', false, e.message);
    }

    // Test: Get league schedule
    try {
        const result = await callFunction('getSchedule', { league_id: testLeagueId });
        logResult('Get league schedule', result.success === true || result.schedule != null,
            `Has schedule: ${result.schedule ? 'Yes' : 'No'}`);
    } catch (e) {
        logResult('Get league schedule', false, e.message);
    }
}

// ========== HTML BUTTON ELEMENT TESTS ==========
async function testHTMLButtons() {
    console.log('\n========== HTML BUTTON ELEMENT TESTS ==========\n');

    // Check create-league.html for all expected buttons
    try {
        const response = await fetch('https://brdc-v2.web.app/pages/create-league.html');
        const html = await response.text();

        const buttons = {
            'PIN Sign In button': html.includes('verifyLeaguePin') || html.includes('pin-signin-btn') || html.includes('signInWithPin'),
            'Save Template button': html.includes('saveAsTemplate') || html.includes('SAVE TEMPLATE'),
            'Load Template button': html.includes('openTemplateModal') || html.includes('LOAD TEMPLATE'),
            'Save Draft button': html.includes('saveAsDraft') || html.includes('SAVE DRAFT'),
            'Load Draft button': html.includes('openDraftModal') || html.includes('LOAD DRAFT'),
            'Create League submit': html.includes('submitLeagueForm') || html.includes('CREATE LEAGUE'),
            'Cancel button': html.includes('CANCEL'),
            'Add Round button': html.includes('addRound') || html.includes('ADD ROUND'),
        };

        for (const [name, exists] of Object.entries(buttons)) {
            logResult(`Create League - ${name}`, exists);
        }
    } catch (e) {
        logResult('Create League HTML buttons', false, e.message);
    }

    // Check create-tournament.html for all expected buttons
    try {
        const response = await fetch('https://brdc-v2.web.app/pages/create-tournament.html');
        const html = await response.text();

        const buttons = {
            'PIN Sign In button': html.includes('lookupDirector') || html.includes('signInWithPin') || html.includes('pin-signin'),
            'Save Template button': html.includes('saveAsTemplate') || html.includes('SAVE TEMPLATE'),
            'Load Template button': html.includes('openTemplateModal') || html.includes('LOAD TEMPLATE'),
            'Add Event button': html.includes('addEvent') || html.includes('ADD EVENT'),
            'Create Tournament submit': html.includes('CREATE TOURNAMENT'),
            'Cancel button': html.includes('CANCEL'),
        };

        for (const [name, exists] of Object.entries(buttons)) {
            logResult(`Create Tournament - ${name}`, exists);
        }
    } catch (e) {
        logResult('Create Tournament HTML buttons', false, e.message);
    }

    // Check league-director.html for expected buttons
    try {
        const response = await fetch('https://brdc-v2.web.app/pages/league-director.html');
        const html = await response.text();

        const buttons = {
            'PIN login': html.includes('pin') || html.includes('PIN'),
            'Add Player': html.includes('addPlayer') || html.includes('ADD PLAYER'),
            'Create Team': html.includes('createTeam') || html.includes('CREATE TEAM'),
            'Generate Schedule': html.includes('generateSchedule') || html.includes('GENERATE'),
            'Save changes': html.includes('save') || html.includes('SAVE'),
        };

        for (const [name, exists] of Object.entries(buttons)) {
            logResult(`League Director - ${name}`, exists);
        }
    } catch (e) {
        logResult('League Director HTML buttons', false, e.message);
    }

    // Check admin.html for expected buttons
    try {
        const response = await fetch('https://brdc-v2.web.app/pages/admin.html');
        const html = await response.text();

        const buttons = {
            'Admin login': html.includes('adminLogin') || html.includes('ADMIN'),
            'Member management': html.includes('member') || html.includes('MEMBER'),
            'Permissions section': html.includes('permission') || html.includes('PERMISSION'),
            'Save permissions': html.includes('savePermissions') || html.includes('SAVE'),
        };

        for (const [name, exists] of Object.entries(buttons)) {
            logResult(`Admin - ${name}`, exists);
        }
    } catch (e) {
        logResult('Admin HTML buttons', false, e.message);
    }
}

// ========== MODAL TESTS ==========
async function testModals() {
    console.log('\n========== MODAL TESTS ==========\n');

    // Check that modal CSS exists in create-league.html
    try {
        const response = await fetch('https://brdc-v2.web.app/pages/create-league.html');
        const html = await response.text();

        const modalElements = {
            'Template modal HTML': html.includes('templateModal'),
            'Draft modal HTML': html.includes('draftModal'),
            'Modal overlay CSS': html.includes('.modal-overlay'),
            'Modal card CSS': html.includes('.modal-card'),
            'Modal close button': html.includes('modal-close'),
            'Template list container': html.includes('templateList'),
            'Draft list container': html.includes('draftList'),
        };

        for (const [name, exists] of Object.entries(modalElements)) {
            logResult(`Create League - ${name}`, exists);
        }
    } catch (e) {
        logResult('Modal elements', false, e.message);
    }

    // Check modals in create-tournament.html
    try {
        const response = await fetch('https://brdc-v2.web.app/pages/create-tournament.html');
        const html = await response.text();

        const modalElements = {
            'Template modal HTML': html.includes('templateModal'),
            'Modal overlay': html.includes('modal-overlay') || html.includes('modal'),
        };

        for (const [name, exists] of Object.entries(modalElements)) {
            logResult(`Create Tournament - ${name}`, exists);
        }
    } catch (e) {
        logResult('Tournament modal elements', false, e.message);
    }
}

// ========== DEBUG FUNCTIONS ==========
async function testDebugFunctions() {
    console.log('\n========== DEBUG/VERIFY FUNCTIONS ==========\n');

    // Test: Debug check PIN
    try {
        const result = await callFunction('debugCheckPin', { pin: TEST_PIN });
        logResult('Debug check PIN', result.success === true,
            `player_id: ${result.player_id}, name: ${result.player_name}`);
    } catch (e) {
        logResult('Debug check PIN', false, e.message);
    }

    // Test: Debug list all templates
    try {
        const result = await callFunction('debugListAllTemplates', {});
        logResult('Debug list all templates', result.success === true,
            `League templates: ${result.league_templates?.length || 0}, Tournament templates: ${result.tournament_templates?.length || 0}`);
    } catch (e) {
        logResult('Debug list all templates', false, e.message);
    }
}

// ========== MAIN TEST RUNNER ==========
async function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     BRDC COMPREHENSIVE BUTTON & FUNCTION TEST SUITE    ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║  Started: ${new Date().toLocaleString().padEnd(43)}║`);
    console.log('╚════════════════════════════════════════════════════════╝');

    await testPageLoads();
    await testAdminFunctions();
    await testGlobalAuthFunctions();
    await testLeagueFunctions();
    await testTournamentFunctions();
    await testTemplateDraftSave();
    await testLeagueDirectorFunctions();
    await testHTMLButtons();
    await testModals();
    await testDebugFunctions();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                        ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║  ✅ Passed:  ${String(results.passed.length).padEnd(42)}║`);
    console.log(`║  ❌ Failed:  ${String(results.failed.length).padEnd(42)}║`);
    console.log(`║  ⏭️  Skipped: ${String(results.skipped.length).padEnd(42)}║`);
    console.log('╚════════════════════════════════════════════════════════╝');

    if (results.failed.length > 0) {
        console.log('\n❌ FAILED TESTS:');
        results.failed.forEach(f => console.log(`   - ${f.test}: ${f.details}`));
    }

    return results;
}

// Run tests
runAllTests().then(results => {
    console.log('\nTest run complete!');
}).catch(err => {
    console.error('Test runner error:', err);
});
