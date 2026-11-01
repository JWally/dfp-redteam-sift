#!/usr/bin/env node
// deep-capture.mjs <site> [path] — full beacon capture: all sift/hexagon requests incl. pixel query strings + cookies + globals + localStorage
import pkg from '/home/justin/Dev/ms-argus-attack-bots/node_modules/playwright/index.js';
const { chromium } = pkg;
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('/tmp/opencode/sift/deep/capture', { recursive: true });
const site = process.argv[2];
const extra = process.argv[3] || '';
const name = site.replace(/^https?:\/\//,'').replace(/[^a-z0-9]+/gi,'_').slice(0,40);

const b = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox','--disable-blink-features=AutomationControlled',
    '--host-resolver-rules=MAP hexagon-analytics.com 34.102.249.210, MAP cdn.siftscience.com 34.96.67.224, MAP api.siftscience.com 34.8.116.182, MAP cdn.sift.com 34.96.67.224',
  ],
});
const ctx = await b.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'en-US',
  viewport: { width: 1366, height: 900 },
});
const page = await ctx.newPage();
const reqs = [];
page.on('request', req => {
  const u = req.url();
  if (/sift|hexagon/i.test(u)) {
    reqs.push({
      ts: Date.now(), method: req.method(), type: req.resourceType(),
      url: u,
      postData: req.method()==='POST' ? (req.postData()||'').slice(0,8000) : undefined,
      headers: req.headers(),
    });
  }
});
// capture response bodies for sift scripts
const scripts = {};
page.on('response', async r => {
  const u = r.url();
  if (/cdn\.sift/i.test(u)) {
    try { scripts[u] = (await r.text()).slice(0, 300000); } catch(_){}
  }
});
const consoleMsgs = [];
page.on('console', m => { if (/sift|hexagon|content.security|violat/i.test(m.text())) consoleMsgs.push(m.text().slice(0,300)); });
const failed = [];
page.on('requestfailed', r => { if (/sift|hexagon/i.test(r.url())) failed.push(r.url().slice(0,200) + ' :: ' + (r.failure()||{}).errorText); });

const url = site + extra;
try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 50000 }); } catch(e){ console.log('nav err', e.message.slice(0,100)); }
await page.waitForTimeout(10000);
try { await page.mouse.wheel(0, 1200); await page.waitForTimeout(4000); await page.mouse.wheel(0, 2500); await page.waitForTimeout(6000); } catch(_){}
// wait for any late-beacon (beforeunload-style) sends
await page.waitForTimeout(6000);

const state = await page.evaluate(() => {
  const g = Object.keys(window).filter(k => /sift|hexagon/i.test(k)).slice(0,30).map(k => k + '=' + (typeof window[k] === 'string' ? window[k].slice(0,80) : '(obj)'));
  const c = document.cookie.split(';').filter(x => /sift|hexagon/i.test(x)).map(x => x.trim());
  const ls = {};
  try { for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(/sift|hexagon/i.test(k)) ls[k]=localStorage.getItem(k).slice(0,200); } } catch(_){}
  return { g, c, ls };
}).catch(e=>({ g:[], c:[], ls:{}, err:String(e) }));

// also record what cdn.sift scripts were requested (dedup)
const scriptReqs = [...new Set(reqs.filter(r=>/cdn\.sift/i.test(r.url)).map(r=>r.url))];
const beaconReqs = reqs.filter(r=>/hexagon|api\.sift/i.test(r.url));

console.log(`\n########## ${site}${extra} ##########`);
console.log('requests matching sift/hexagon:', reqs.length);
console.log('cdn.sift script requests:', scriptReqs);
console.log('beacon/pixel requests:', beaconReqs.length);
for (const r of beaconReqs) {
  console.log('\n---', r.method, r.type, r.url.slice(0, 4000));
  if (r.postData) console.log('POST BODY:', r.postData.slice(0, 3000));
}
console.log('\nglobals:', state.g);
console.log('cookies:', state.c);
console.log('localStorage:', state.ls);
console.log('console:', consoleMsgs);

writeFileSync('/tmp/opencode/sift/deep/capture/'+name+'.json', JSON.stringify({ site, url, reqs, scripts, consoleMsgs, state }, null, 1));
await b.close();
