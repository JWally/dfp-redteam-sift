#!/usr/bin/env node
// browser-probe.mjs <site> [extraPath] — load site in headless chromium, watch for Sift sensor
import pkg from '/home/justin/Dev/ms-argus-attack-bots/node_modules/playwright/index.js';
const { chromium } = pkg;
import { writeFileSync } from 'node:fs';

const site = process.argv[2];
const extra = process.argv[3] || '';
const name = site.replace(/^https?:\/\//,'').replace(/[^a-z0-9]+/gi,'_').slice(0,40);
const out = '/tmp/opencode/sift/deep/browser/' + name + '.json';
import('node:fs').then(fs => fs.mkdirSync('/tmp/opencode/sift/deep/browser', { recursive: true }));

const b = await chromium.launch({
  headless: true,
  args: ['--no-sandbox','--disable-blink-features=AutomationControlled',
    '--host-resolver-rules=MAP hexagon-analytics.com 34.102.249.210, MAP cdn.siftscience.com 34.96.67.224, MAP api.siftscience.com 34.8.116.182, MAP cdn.sift.com 34.96.67.224'],
});
const ctx = await b.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'en-US',
  viewport: { width: 1366, height: 900 },
});
const page = await ctx.newPage();
const hits = [];
const markerJs = new Set();
page.on('request', req => {
  const u = req.url();
  if (/sift|hexagon/i.test(u)) {
    hits.push({ m: req.method(), t: req.resourceType(), u: u.slice(0, 240), body: req.method()==='POST' ? (req.postData()||'').slice(0,2500) : undefined });
  }
});
page.on('response', async r => {
  const u = r.url();
  if (/cdn\.sift/i.test(u)) {
    try { const t = await r.text(); markerJs.add(u.slice(0,150) + ' len=' + t.length); } catch(_){}
  }
});
page.on('console', msg => { const t = msg.text(); if (/sift/i.test(t)) markerJs.add('console: ' + t.slice(0,150)); });

const url = site + extra;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(9000);
} catch(e) { /* timeout etc */ }

// scroll a bit to trigger lazy loads
try { await page.mouse.wheel(0, 1500); await page.waitForTimeout(2500); await page.mouse.wheel(0, 2500); await page.waitForTimeout(3000); } catch(_){}

const state = await page.evaluate(() => {
  const globals = Object.keys(window).filter(k => /sift|hexagon/i.test(k)).slice(0,20);
  const cookies = document.cookie.split(';').map(c=>c.trim().split('=')[0]).filter(c => /sift|hexagon/i.test(c));
  const html = document.documentElement ? document.documentElement.outerHTML.slice(0, 2_000_000) : '';
  const markerHits = [];
  const re = /(_sift|cdn\.sift\.com|siftscience|hexagon-analytics|__sift)[^\s'"<>]{0,80}/gi;
  let m; const seen = new Set();
  while ((m = re.exec(html)) && markerHits.length < 40) {
    const s = m[0];
    const ctx2 = html.slice(Math.max(0,m.index-120), m.index + 120).replace(/\s+/g,' ');
    const key = s.slice(0,40);
    if (!seen.has(key)) { seen.add(key); markerHits.push(ctx2); }
  }
  return { globals, cookies, markerHits };
}).catch(e => ({ globals:[], cookies:[], markerHits:[], evalError: String(e) }));

const result = { site, url, hits, markerJs: [...markerJs], state, time: new Date().toISOString() };
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`\n===== ${site}${extra} =====`);
console.log('SIFT-RELATED REQUESTS:', hits.length);
for (const h of hits) console.log('  ', h.m, h.t, h.u);
if (hits.length === 0) console.log('   (none — no cdn.sift/hexagon traffic)');
console.log('globals:', state.globals);
console.log('cookies:', state.cookies);
const mh = state.markerHits || [];
console.log('inline markers:', mh.length);
for (const s of mh.slice(0,8)) console.log('   …' + s);
await b.close();
