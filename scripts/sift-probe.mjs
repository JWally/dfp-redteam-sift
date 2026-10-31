#!/usr/bin/env node
/** sift-probe.mjs — Wingstop clean Chrome: capture Sift/Forter sensors,
 *  their endpoints, cookies, and the payloads they ship. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9239');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p=>p.url().includes('wingstop')) || ctx.pages()[0];
const log = { requests:[], bundles:{}, posts:[] };
page.on('request', req => {
  const u = req.url();
  if (/sift|forter|cdn\.sift|\.ftr|ftr|sensor|_sift|__sift|205057/.test(u)) {
    log.requests.push({ method: req.method(), type: req.resourceType(), url: u.slice(0,200) });
    if (req.method()==='POST') log.posts.push({ url: u.slice(0,150), postData: (req.postData()||'').slice(0,4000) });
  }
});
page.on('response', async r => {
  const u = r.url();
  if (/\.js($|\?)/.test(u) && /sift|forter/.test(u)) { try { const body=await r.text(); if (body.length>5000) log.bundles[u]=body; } catch(_){} }
});
await page.goto('https://www.wingstop.com/', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(15000);
const state = await page.evaluate(() => ({
  cookies: document.cookie.split(';').map(c=>c.trim().split('=')[0]).filter(c=>/sift|_sift|forter|ftr/i.test(c)),
  globals: Object.keys(window).filter(k=>/sift|forter|ftr|_sift/i.test(k)).slice(0,20),
})).catch(()=>({}));
console.log('sift/forter requests:', log.requests.length);
const hosts={}; for (const r of log.requests){ try{ hosts[new URL(r.url).host]=(hosts[new URL(r.url).host]||0)+1; }catch(_){} }
console.log('hosts:', JSON.stringify(hosts,null,1));
console.log('\ncookies:', state.cookies);
console.log('globals:', state.globals);
console.log('\n=== POSTs ===');
for (const p of log.posts.slice(0,3)) { console.log('\n ', p.url); console.log('  ', p.postData.slice(0,600)); }
for (const [u,body] of Object.entries(log.bundles)) { const n=u.split('/').pop().split('?')[0]; writeFileSync('/tmp/opencode/frt/'+n, body); console.log('saved:', n, Math.round(body.length/1024)+'KB'); }
writeFileSync('/tmp/opencode/frt/sift-flow.json', JSON.stringify({requests:log.requests.slice(0,30), posts:log.posts, state},null,2));
await b.close();
