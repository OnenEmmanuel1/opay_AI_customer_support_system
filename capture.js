const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PORT = 3001; // The port we spawned OPay on
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

const pagesToCapture = [
    { name: '01-landing-page.png', path: '/' },
    { name: '02-login.png', path: '/auth/login' },
    { name: '03-register.png', path: '/auth/register' }
];

async function run() {
    if (!fs.existsSync(SCREENSHOT_DIR)){
        fs.mkdirSync(SCREENSHOT_DIR);
    }

    console.log('Launching browser...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    for (const item of pagesToCapture) {
        console.log(`Navigating to ${BASE_URL}${item.path}...`);
        try {
            await page.goto(`${BASE_URL}${item.path}`, { waitUntil: 'networkidle0' });
            
            const screenshotPath = path.join(SCREENSHOT_DIR, item.name);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`Saved screenshot: ${screenshotPath}`);
        } catch (error) {
            console.error(`Failed to capture ${item.path}:`, error.message);
        }
    }

    await browser.close();
    console.log('All screenshots captured successfully.');
}

run();
