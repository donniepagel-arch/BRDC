const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Test data constants
// ---------------------------------------------------------------------------
const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Known-bad PIN for testing login failure (do NOT use a real player PIN)
const BAD_PIN = '12345678';

// ---------------------------------------------------------------------------
// Known non-critical error patterns to ignore.
// Firebase auth/analytics, network issues, and service-worker failures are
// expected when pages load without credentials.
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
    'Permission denied',
    'Missing or insufficient permissions',
    'PERMISSION_DENIED',
    'Could not reach Cloud Firestore',
    'unavailable',
    'PayPal',
    'paypal',
    'zoid',
];

/**
 * Filter collected page errors down to critical ones only.
 */
function filterCriticalErrors(errors) {
    return errors.filter(msg =>
        !IGNORABLE_PATTERNS.some(pattern => msg.includes(pattern))
    );
}

/**
 * Standard page load helper: navigate, wait, collect errors.
 */
async function loadPage(page, path, { waitMs = 2500 } = {}) {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    const response = await page.goto(path);
    expect(response.status()).toBeLessThan(400);

    await page.waitForTimeout(waitMs);
    return errors;
}

// ===========================================================================
// 1. SIGNUP PAGE  (/pages/signup.html)
// ===========================================================================
test.describe('Signup Page', () => {

    test('Page loads with signup form visible', async ({ page }) => {
        const errors = await loadPage(page, '/pages/signup.html');

        // The signup card and form should be visible
        await expect(page.locator('#signupForm')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.signup-card').first()).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('Form has first name, last name, email fields', async ({ page }) => {
        await loadPage(page, '/pages/signup.html');

        await expect(page.locator('#firstName')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#lastName')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#email')).toBeVisible({ timeout: 5000 });

        // Check field types
        await expect(page.locator('#firstName')).toHaveAttribute('type', 'text');
        await expect(page.locator('#lastName')).toHaveAttribute('type', 'text');
        await expect(page.locator('#email')).toHaveAttribute('type', 'email');
    });

    test('Form has phone number and skill level fields', async ({ page }) => {
        await loadPage(page, '/pages/signup.html');

        await expect(page.locator('#phone')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#level')).toBeVisible({ timeout: 5000 });

        // Skill level is a dropdown with A/B/C/Not Sure options
        const options = page.locator('#level option');
        const count = await options.count();
        expect(count).toBeGreaterThanOrEqual(4); // Placeholder + A + B + C + Not Sure
    });

    test('Form has submit button', async ({ page }) => {
        await loadPage(page, '/pages/signup.html');

        const submitBtn = page.locator('#submitBtn');
        await expect(submitBtn).toBeVisible({ timeout: 5000 });
        await expect(submitBtn).toHaveAttribute('type', 'submit');
    });

    test('Required fields have required attribute', async ({ page }) => {
        await loadPage(page, '/pages/signup.html');

        // First name, last name, and email are marked as required
        await expect(page.locator('#firstName')).toHaveAttribute('required', '');
        await expect(page.locator('#lastName')).toHaveAttribute('required', '');
        await expect(page.locator('#email')).toHaveAttribute('required', '');
    });

    test('Shows BRDC branding', async ({ page }) => {
        await loadPage(page, '/pages/signup.html');

        // Logo visible
        const logo = page.locator('.logo');
        await expect(logo).toBeVisible({ timeout: 5000 });

        // Brand title
        const brandTitle = page.locator('.brand-title');
        await expect(brandTitle).toBeVisible({ timeout: 5000 });
        await expect(brandTitle).toHaveText('BRDC');
    });

    test('Success screen is hidden initially', async ({ page }) => {
        await loadPage(page, '/pages/signup.html');

        const successScreen = page.locator('#successScreen');
        // Success screen should NOT be visible (display: none by default)
        await expect(successScreen).not.toBeVisible();
    });

    test('Has "Already have an account?" link', async ({ page }) => {
        await loadPage(page, '/pages/signup.html');

        const loginLink = page.locator('.footer-text a');
        await expect(loginLink).toBeVisible({ timeout: 5000 });
        await expect(loginLink).toHaveText('Log in here');
    });
});

// ===========================================================================
// 2. REGISTER PAGE  (/pages/register.html)
// ===========================================================================
test.describe('Register Page (New Player Registration)', () => {

    test('Page loads with registration form visible', async ({ page }) => {
        const errors = await loadPage(page, '/pages/register.html');

        await expect(page.locator('#registerForm')).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('Has first name, last name, email, phone fields', async ({ page }) => {
        await loadPage(page, '/pages/register.html');

        await expect(page.locator('#firstName')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#lastName')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#email')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#phone')).toBeVisible({ timeout: 5000 });
    });

    test('Has PIN field with maxlength 4', async ({ page }) => {
        await loadPage(page, '/pages/register.html');

        const pinField = page.locator('#chosenPin');
        await expect(pinField).toBeVisible({ timeout: 5000 });
        await expect(pinField).toHaveAttribute('maxlength', '4');
    });

    test('Has photo upload area', async ({ page }) => {
        await loadPage(page, '/pages/register.html');

        const avatarUpload = page.locator('#avatarUpload, .avatar-upload');
        await expect(avatarUpload.first()).toBeVisible({ timeout: 5000 });
    });

    test('Has submit button with "CREATE ACCOUNT" text', async ({ page }) => {
        await loadPage(page, '/pages/register.html');

        const submitBtn = page.locator('#submitBtn');
        await expect(submitBtn).toBeVisible({ timeout: 5000 });
        await expect(submitBtn).toHaveText('CREATE ACCOUNT');
    });

    test('Header bar shows BRDC branding and HOME link', async ({ page }) => {
        await loadPage(page, '/pages/register.html');

        const headerLogo = page.locator('.header-logo');
        await expect(headerLogo).toBeVisible({ timeout: 5000 });

        const homeBtn = page.locator('.back-btn');
        await expect(homeBtn).toBeVisible({ timeout: 5000 });
        await expect(homeBtn).toHaveText('HOME');
    });

    test('Has "Already have an account?" sign-in link', async ({ page }) => {
        await loadPage(page, '/pages/register.html');

        const signInLink = page.locator('a.back-link');
        await expect(signInLink).toBeVisible({ timeout: 5000 });
        await expect(signInLink).toHaveText('Sign In');
    });
});

// ===========================================================================
// 3. DASHBOARD LOGIN  (/pages/dashboard.html)
// ===========================================================================
test.describe('Dashboard Login', () => {

    test('Page loads with login overlay visible', async ({ page }) => {
        const errors = await loadPage(page, '/pages/dashboard.html');

        const loginOverlay = page.locator('#loginOverlay');
        await expect(loginOverlay).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('Shows BRDC logo on login', async ({ page }) => {
        await loadPage(page, '/pages/dashboard.html');

        const logo = page.locator('#loginOverlay img.login-logo, #loginOverlay img[alt="BRDC"]');
        await expect(logo.first()).toBeVisible({ timeout: 5000 });
    });

    test('PIN input exists with correct attributes', async ({ page }) => {
        await loadPage(page, '/pages/dashboard.html');

        const pinInput = page.locator('#pinInput');
        await expect(pinInput).toBeVisible({ timeout: 5000 });
        await expect(pinInput).toHaveAttribute('maxlength', '8');
        await expect(pinInput).toHaveAttribute('inputmode', 'numeric');
        await expect(pinInput).toHaveAttribute('type', 'password');
    });

    test('Login button exists', async ({ page }) => {
        await loadPage(page, '/pages/dashboard.html');

        const loginBtn = page.locator('#loginBtn');
        await expect(loginBtn).toBeVisible({ timeout: 5000 });
        await expect(loginBtn).toHaveText('LOGIN');
    });

    test('PIN input accepts numeric input', async ({ page }) => {
        await loadPage(page, '/pages/dashboard.html');

        const pinInput = page.locator('#pinInput');
        await pinInput.fill('99887766');
        await expect(pinInput).toHaveValue('99887766');
    });

    test('Entering wrong PIN shows error message', async ({ page }) => {
        await loadPage(page, '/pages/dashboard.html');

        // Type a known-bad PIN
        const pinInput = page.locator('#pinInput');
        await pinInput.fill(BAD_PIN);

        // Click login
        const loginBtn = page.locator('#loginBtn');
        await loginBtn.click();

        // Wait for the cloud function call and error to appear
        await page.waitForTimeout(5000);

        // Error message should become visible
        const errorDiv = page.locator('#loginError');
        await expect(errorDiv).toBeVisible({ timeout: 10000 });
    });

    test('Error is hidden initially', async ({ page }) => {
        await loadPage(page, '/pages/dashboard.html');

        const errorDiv = page.locator('#loginError');
        // Should have the 'hidden' class initially
        await expect(errorDiv).not.toBeVisible();
    });

    test('Short PIN triggers validation error', async ({ page }) => {
        await loadPage(page, '/pages/dashboard.html');

        // Enter too-short PIN (only 4 digits)
        const pinInput = page.locator('#pinInput');
        await pinInput.fill('1234');

        const loginBtn = page.locator('#loginBtn');
        await loginBtn.click();

        await page.waitForTimeout(1500);

        // Dashboard requires exactly 8 digits - should show inline error
        const errorDiv = page.locator('#loginError');
        await expect(errorDiv).toBeVisible({ timeout: 5000 });
        const errorText = await errorDiv.textContent();
        expect(errorText.toLowerCase()).toContain('8-digit');
    });

    test('Login form title shows LOGIN', async ({ page }) => {
        await loadPage(page, '/pages/dashboard.html');

        const formTitle = page.locator('.login-form-title');
        await expect(formTitle.first()).toBeVisible({ timeout: 5000 });
        const text = await formTitle.first().textContent();
        expect(text.toUpperCase()).toContain('LOGIN');
    });
});

// ===========================================================================
// 4. PLAYER REGISTRATION  (/pages/player-registration.html)
// ===========================================================================
test.describe('Player Registration (Event)', () => {

    test('Page loads without crashing', async ({ page }) => {
        // This page requires event_id and tournament_id params.
        // Without them, it should show an error state but not crash.
        const errors = await loadPage(page, '/pages/player-registration.html');

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('Shows error state when no event_id provided', async ({ page }) => {
        await loadPage(page, '/pages/player-registration.html', { waitMs: 3000 });

        // Should show some error or empty state since no event_id
        const appContainer = page.locator('#appContainer');
        await expect(appContainer).toBeVisible({ timeout: 5000 });
        const content = await appContainer.textContent();
        // Should contain error message about missing params
        expect(content.toLowerCase()).toContain('error');
    });
});

// ===========================================================================
// 5. STAT VERIFICATION  (/pages/stat-verification.html)
// ===========================================================================
test.describe('Stat Verification', () => {

    test('Page loads with login screen active', async ({ page }) => {
        const errors = await loadPage(page, '/pages/stat-verification.html');

        const loginScreen = page.locator('#loginScreen');
        await expect(loginScreen).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('PIN input visible on login screen', async ({ page }) => {
        await loadPage(page, '/pages/stat-verification.html');

        const pinInput = page.locator('#pinInput');
        await expect(pinInput).toBeVisible({ timeout: 5000 });
        await expect(pinInput).toHaveAttribute('maxlength', '8');
        await expect(pinInput).toHaveAttribute('inputmode', 'numeric');
    });

    test('Login button visible', async ({ page }) => {
        await loadPage(page, '/pages/stat-verification.html');

        const loginBtn = page.locator('.login-btn');
        await expect(loginBtn).toBeVisible({ timeout: 5000 });
        await expect(loginBtn).toHaveText('LOGIN');
    });

    test('Shows "VERIFY YOUR STATS" title', async ({ page }) => {
        await loadPage(page, '/pages/stat-verification.html');

        const title = page.locator('.login-title');
        await expect(title).toBeVisible({ timeout: 5000 });
        const text = await title.textContent();
        expect(text.toUpperCase()).toContain('VERIFY YOUR STATS');
    });

    test('Login box has expected structure', async ({ page }) => {
        await loadPage(page, '/pages/stat-verification.html');

        await expect(page.locator('.login-box')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.login-form-title')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.login-links')).toBeVisible({ timeout: 5000 });
    });

    test('Setup screen is hidden initially', async ({ page }) => {
        await loadPage(page, '/pages/stat-verification.html');

        // The setup screen should not have the 'active' class
        const setupScreen = page.locator('#setupScreen');
        await expect(setupScreen).not.toBeVisible();
    });

    test('Short PIN shows error', async ({ page }) => {
        await loadPage(page, '/pages/stat-verification.html');

        const pinInput = page.locator('#pinInput');
        await pinInput.fill('1234');

        const loginBtn = page.locator('.login-btn');
        await loginBtn.click();

        await page.waitForTimeout(1500);

        // Should show error about invalid PIN
        const errorDiv = page.locator('#loginError');
        await expect(errorDiv).toBeVisible({ timeout: 5000 });
    });

    test('Wrong PIN shows player not found error', async ({ page }) => {
        await loadPage(page, '/pages/stat-verification.html');

        const pinInput = page.locator('#pinInput');
        await pinInput.fill(BAD_PIN);

        const loginBtn = page.locator('.login-btn');
        await loginBtn.click();

        // Wait for cloud function to respond
        await page.waitForTimeout(6000);

        // Should show error (either "not found" or login error)
        const errorDiv = page.locator('#loginError');
        await expect(errorDiv).toBeVisible({ timeout: 10000 });
    });
});

// ===========================================================================
// 6. CREATE LEAGUE  (/pages/create-league.html)
// ===========================================================================
test.describe('Create League', () => {

    test('Page loads with form', async ({ page }) => {
        const errors = await loadPage(page, '/pages/create-league.html');

        // The first wizard step (Director Information) should be visible
        const firstStep = page.locator('.wizard-step.active[data-step="1"]');
        await expect(firstStep).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('Has league name input', async ({ page }) => {
        await loadPage(page, '/pages/create-league.html');

        // League name is in step 2 (not visible on initial load)
        const leagueNameInput = page.locator('#leagueName');
        // Check it exists in DOM (but not necessarily visible)
        await expect(leagueNameInput).toBeAttached({ timeout: 5000 });
        await expect(leagueNameInput).toHaveAttribute('type', 'text');
        await expect(leagueNameInput).toHaveAttribute('required', '');
    });

    test('League name has minimum length validation', async ({ page }) => {
        await loadPage(page, '/pages/create-league.html');

        const leagueNameInput = page.locator('#leagueName');
        await expect(leagueNameInput).toHaveAttribute('minlength', '3');
    });

    test('Has header bar with BRDC branding', async ({ page }) => {
        await loadPage(page, '/pages/create-league.html');

        const headerTitle = page.locator('.header-title');
        await expect(headerTitle).toBeVisible({ timeout: 5000 });

        const headerLogo = page.locator('.header-logo');
        await expect(headerLogo).toBeVisible({ timeout: 5000 });
    });

    test('Has wizard progress indicator', async ({ page }) => {
        await loadPage(page, '/pages/create-league.html');

        // Wizard steps should be visible
        const progressSteps = page.locator('.progress-step');
        const count = await progressSteps.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test('Has back button', async ({ page }) => {
        await loadPage(page, '/pages/create-league.html');

        const backBtn = page.locator('.back-btn');
        await expect(backBtn).toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// 7. CREATE TOURNAMENT  (/pages/create-tournament.html)
// ===========================================================================
test.describe('Create Tournament', () => {

    test('Page loads with form', async ({ page }) => {
        const errors = await loadPage(page, '/pages/create-tournament.html');

        // Tournament name input should be present
        const nameInput = page.locator('[name="tournament_name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('Has tournament name input', async ({ page }) => {
        await loadPage(page, '/pages/create-tournament.html');

        const nameInput = page.locator('[name="tournament_name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        await expect(nameInput).toHaveAttribute('required', '');
    });

    test('Has venue name input', async ({ page }) => {
        await loadPage(page, '/pages/create-tournament.html');

        const venueInput = page.locator('[name="venue_name"]');
        await expect(venueInput).toBeVisible({ timeout: 5000 });
    });

    test('Has venue address input', async ({ page }) => {
        await loadPage(page, '/pages/create-tournament.html');

        const addressInput = page.locator('[name="venue_address"]');
        await expect(addressInput).toBeVisible({ timeout: 5000 });
    });

    test('Has tournament date input', async ({ page }) => {
        await loadPage(page, '/pages/create-tournament.html');

        const dateInput = page.locator('[name="tournament_date"]');
        await expect(dateInput).toBeVisible({ timeout: 5000 });
        await expect(dateInput).toHaveAttribute('type', 'date');
        await expect(dateInput).toHaveAttribute('required', '');
    });

    test('Has header bar with branding', async ({ page }) => {
        await loadPage(page, '/pages/create-tournament.html');

        const headerTitle = page.locator('.header-title');
        await expect(headerTitle).toBeVisible({ timeout: 5000 });

        const backBtn = page.locator('.back-btn');
        await expect(backBtn).toBeVisible({ timeout: 5000 });
    });

    test('Has inline PIN sign-in section', async ({ page }) => {
        await loadPage(page, '/pages/create-tournament.html');

        // The tournament creator has an inline PIN sign-in
        const pinSignIn = page.locator('.pin-signin-container, .pin-signin-input');
        await expect(pinSignIn.first()).toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// 8. CAPTAIN DASHBOARD  (PIN-gated)
// ===========================================================================
test.describe('Captain Dashboard', () => {

    test('Page loads (may show PIN gate or empty state)', async ({ page }) => {
        const errors = await loadPage(
            page,
            `/pages/captain-dashboard.html?league_id=${LEAGUE_ID}`,
            { waitMs: 3000 }
        );

        // Should either show a PIN input or some form of content
        const pinInput = page.locator('#pinInput, input[type="password"], .login-box, .pin-input');
        const pageBody = page.locator('body');

        // Page should have rendered something
        const bodyText = await pageBody.textContent();
        expect(bodyText.length).toBeGreaterThan(0);

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });
});

// ===========================================================================
// 9. DIRECTOR DASHBOARD  (PIN-gated)
// ===========================================================================
test.describe('Director Dashboard', () => {

    test('Page loads with login overlay', async ({ page }) => {
        const errors = await loadPage(
            page,
            `/pages/director-dashboard.html?league_id=${LEAGUE_ID}`,
            { waitMs: 3000 }
        );

        const loginOverlay = page.locator('#loginOverlay');
        await expect(loginOverlay).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('PIN input visible', async ({ page }) => {
        await loadPage(
            page,
            `/pages/director-dashboard.html?league_id=${LEAGUE_ID}`,
            { waitMs: 3000 }
        );

        const pinInput = page.locator('#pinInput');
        await expect(pinInput).toBeVisible({ timeout: 5000 });
        await expect(pinInput).toHaveAttribute('maxlength', '8');
        await expect(pinInput).toHaveAttribute('inputmode', 'numeric');
    });

    test('Login button visible with correct text', async ({ page }) => {
        await loadPage(
            page,
            `/pages/director-dashboard.html?league_id=${LEAGUE_ID}`,
            { waitMs: 3000 }
        );

        const loginBtn = page.locator('#loginBtn');
        await expect(loginBtn).toBeVisible({ timeout: 5000 });
        const text = await loginBtn.textContent();
        expect(text.toUpperCase()).toContain('ENTER DASHBOARD');
    });

    test('Shows Tournament Director title', async ({ page }) => {
        await loadPage(
            page,
            `/pages/director-dashboard.html?league_id=${LEAGUE_ID}`,
            { waitMs: 3000 }
        );

        const title = page.locator('.login-title');
        await expect(title).toBeVisible({ timeout: 5000 });
        const text = await title.textContent();
        expect(text.toUpperCase()).toContain('TOURNAMENT DIRECTOR');
    });

    test('Wrong PIN shows error', async ({ page }) => {
        await loadPage(
            page,
            `/pages/director-dashboard.html?league_id=${LEAGUE_ID}`,
            { waitMs: 3000 }
        );

        const pinInput = page.locator('#pinInput');
        await pinInput.fill(BAD_PIN);

        const loginBtn = page.locator('#loginBtn');
        await loginBtn.click();

        // Wait for cloud function response
        await page.waitForTimeout(6000);

        // Should show error
        const errorEl = page.locator('#loginError');
        await expect(errorEl).toBeVisible({ timeout: 10000 });
    });
});

// ===========================================================================
// 10. ADMIN PAGE  (PIN-gated)
// ===========================================================================
test.describe('Admin Page', () => {

    test('Page loads with login screen', async ({ page }) => {
        const errors = await loadPage(page, '/pages/admin.html');

        const loginScreen = page.locator('#loginScreen');
        await expect(loginScreen).toBeVisible({ timeout: 5000 });

        const critical = filterCriticalErrors(errors);
        expect(critical).toHaveLength(0);
    });

    test('PIN input visible', async ({ page }) => {
        await loadPage(page, '/pages/admin.html');

        const pinInput = page.locator('#pinInput');
        await expect(pinInput).toBeVisible({ timeout: 5000 });
        await expect(pinInput).toHaveAttribute('inputmode', 'numeric');
    });

    test('Login button visible', async ({ page }) => {
        await loadPage(page, '/pages/admin.html');

        const loginBtn = page.locator('.brdc-btn, .login-btn').first();
        await expect(loginBtn).toBeVisible({ timeout: 5000 });
        const text = await loginBtn.textContent();
        expect(text.toUpperCase()).toContain('LOGIN');
    });

    test('Shows ADMIN LOGIN title', async ({ page }) => {
        await loadPage(page, '/pages/admin.html');

        const loginCard = page.locator('.login-card');
        await expect(loginCard).toBeVisible({ timeout: 5000 });

        const title = page.locator('.login-card h2');
        await expect(title).toBeVisible({ timeout: 5000 });
        const text = await title.textContent();
        expect(text.toUpperCase()).toContain('ADMIN');
    });

    test('Shows BRDC logo', async ({ page }) => {
        await loadPage(page, '/pages/admin.html');

        const logo = page.locator('.login-card img[alt="BRDC"]');
        await expect(logo).toBeVisible({ timeout: 5000 });
    });

    test('Admin content is hidden before login', async ({ page }) => {
        await loadPage(page, '/pages/admin.html');

        // Admin content should not be displayed
        const adminContent = page.locator('#adminContent');
        // The element exists but should be hidden (display: none via CSS or inline)
        const isVisible = await adminContent.isVisible();
        expect(isVisible).toBe(false);
    });
});

// ===========================================================================
// 11. CROSS-PAGE NAVIGATION LINKS
// ===========================================================================
test.describe('Cross-Page Navigation', () => {

    test('Signup page links to login (home)', async ({ page }) => {
        await loadPage(page, '/pages/signup.html');

        const loginLink = page.locator('.footer-text a[href="/"]');
        await expect(loginLink).toBeVisible({ timeout: 5000 });
    });

    test('Register page links to dashboard', async ({ page }) => {
        await loadPage(page, '/pages/register.html');

        const dashboardLink = page.locator('a[href="/pages/dashboard.html"]');
        await expect(dashboardLink.first()).toBeVisible({ timeout: 5000 });
    });

    test('Stat verification links back to dashboard', async ({ page }) => {
        await loadPage(page, '/pages/stat-verification.html');

        const dashboardLink = page.locator('.login-links a[href="/pages/dashboard.html"]');
        await expect(dashboardLink).toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// 12. FORM INTERACTION (non-destructive)
// ===========================================================================
test.describe('Form Interactions', () => {

    test('Signup - can type in all fields', async ({ page }) => {
        await loadPage(page, '/pages/signup.html');

        await page.fill('#firstName', 'Test');
        await page.fill('#lastName', 'User');
        await page.fill('#email', 'test@example.com');
        await page.fill('#phone', '2165551234');

        await expect(page.locator('#firstName')).toHaveValue('Test');
        await expect(page.locator('#lastName')).toHaveValue('User');
        await expect(page.locator('#email')).toHaveValue('test@example.com');
    });

    test('Signup - can select skill level', async ({ page }) => {
        await loadPage(page, '/pages/signup.html');

        await page.selectOption('#level', 'B');
        await expect(page.locator('#level')).toHaveValue('B');
    });

    test('Register - can type in all fields', async ({ page }) => {
        await loadPage(page, '/pages/register.html');

        await page.fill('#firstName', 'Test');
        await page.fill('#lastName', 'Player');
        await page.fill('#email', 'test@example.com');
        await page.fill('#phone', '5551234567');
        await page.fill('#chosenPin', '9876');

        await expect(page.locator('#firstName')).toHaveValue('Test');
        await expect(page.locator('#lastName')).toHaveValue('Player');
        await expect(page.locator('#email')).toHaveValue('test@example.com');
        await expect(page.locator('#chosenPin')).toHaveValue('9876');
    });

    test('Dashboard PIN input restricts to maxlength 8', async ({ page }) => {
        await loadPage(page, '/pages/dashboard.html');

        const pinInput = page.locator('#pinInput');
        await pinInput.fill('123456789012');

        // maxlength should truncate to 8 chars
        const value = await pinInput.inputValue();
        expect(value.length).toBeLessThanOrEqual(8);
    });

    test('Admin PIN input is a password field', async ({ page }) => {
        await loadPage(page, '/pages/admin.html');

        const pinInput = page.locator('#pinInput');
        await expect(pinInput).toHaveAttribute('type', 'password');
    });
});
