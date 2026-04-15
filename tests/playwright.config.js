const { defineConfig } = require('@playwright/test');

const headed = process.env.PW_HEADLESS === 'false';
const slowMo = headed ? Number(process.env.PW_SLOWMO || 400) : Number(process.env.PW_SLOWMO || 0);

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 60000,
    use: {
        baseURL: 'https://brdc-v2.web.app',
        headless: !headed,
        slowMo,
        viewport: { width: 430, height: 932 },  // iPhone 14 Pro Max size
    },
});
