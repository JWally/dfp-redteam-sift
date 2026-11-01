#!/usr/bin/env node
// cookie-check.mjs — verify __ssid + sift cookies and EBTH homepage beacon
import pkg from '/home/justin/Dev/ms-argus-attack-bots/node_modules/playwright/index.js';
const { chromium } = pkg;
const b = await chromium.launch({
  headless: true,
  args: ['--no-sandbox','--disable-blink-features=AutomationControlled',
    '--host-resolver-rules=MAP hexagon-analytics.com 34.102.249.210, MAP cdn.siftscience.com 34.96.67.224, MAP api.siftscience.com 34.8.116.182'],
});
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });

for (const site of ['https://www.studypool.com/', 'https://www.ebth.com/', 'https://www.ebth.com/login']) {
  const page = await ctx.newPage();
  const pixels = [];
  page.on('request', r => { if (/hexagon-analytics|api\.sift/i.test(r.url())) pixels.push(r.url().slice(0,300)); });
  await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e=>console.log('nav', e.message.slice(0,60)));
  await page.waitForTimeout(6000);
  await page.mouse.wheel(0, 2000); await page.waitForTimeout(5000);
  const cookies = (await ctx.cookies()).filter(c => /sift|ssid|uuid|sess/i.test(c.name)).map(c => c.name + '=' + c.value.slice(0,60));
  const docCookie = await page.evaluate(() => document.cookie).catch(()=> '');
  console.log(`\n== ${site} ==`);
  console.log('sift pixels:', pixels);
  console.log('ctx cookies (sift-ish):', cookies);
  console.log('docCookie sift-ish:', docCookie.split(';').map(c=>c.trim()).filter(c=>/sift|ssid/i.test(c)).join('; '));
  await page.close();
}
await b.close();
