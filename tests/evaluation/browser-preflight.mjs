import { chromium } from '../../webapp/node_modules/@playwright/test/index.mjs';
const browser = await chromium.launch();
try {
  console.log(JSON.stringify({ version: browser.version(), executable: chromium.executablePath() }));
} finally {
  await browser.close();
}
