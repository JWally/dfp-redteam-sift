#!/usr/bin/env node
// beacon-lab.mjs — controlled test of s.js beacon behavior
import pkg from '/home/justin/Dev/ms-argus-attack-bots/node_modules/playwright/index.js';
const { chromium } = pkg;

const args = [
  '--no-sandbox','--disable-blink-features=AutomationControlled',
  '--host-resolver-rules=MAP hexagon-analytics.com 34.102.249.210, MAP cdn.siftscience.com 34.96.67.224, MAP api.siftscience.com 34.8.116.182',
];
const b = await chromium.launch({ headless: true, args });
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
const outbound = [];
await page.addInitScript(() => {
  // hook every outbound URL: Image src, fetch, XHR, sendBeacon, script src
  const origImgSrc = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
  try {
    Object.defineProperty(Image.prototype, 'src', {
      set(v) { window.__out = window.__out || []; window.__out.push('img:' + v.slice(0, 500)); return origImgSrc.set.call(this, v); },
      get() { return origImgSrc.get.call(this); }, configurable: true,
    });
  } catch(e) {}
  const of = window.fetch;
  window.fetch = function(...a) { window.__out = window.__out || []; window.__out.push('fetch:' + String(a[0]).slice(0,500)); return of.apply(this, a); };
  const ox = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u) { window.__out = window.__out || []; window.__out.push('xhr:' + m + ' ' + String(u).slice(0,500)); return ox.apply(this, arguments); };
  const osb = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
  if (osb) navigator.sendBeacon = function(u, d) { window.__out = window.__out || []; window.__out.push('beacon:' + String(u).slice(0,500)); return osb(u, d); };
  window.__errs = [];
  window.addEventListener('error', e => window.__errs.push('error:' + e.message.slice(0,200) + ' @' + (e.filename||'').slice(0,100)));
  window.addEventListener('unhandledrejection', e => window.__errs.push('reject:' + String(e.reason).slice(0,200)));
});

// Mode 1: blank page, simulate a merchant's snippet (like StudyPool), load s.js
await page.setContent(`<!doctype html><html><head><title>Test Page</title></head><body><h1>hi</h1></body></html>`);
await page.evaluate(() => {
  window._sift = window._sift || [];
  window._sift.push(['_setAccount', '19f6874a79']);
  window._sift.push(['_setUserId', '']);
  window._sift.push(['_setSessionId', 'test-session-123']);
  window._sift.push(['_trackPageview']);
  const e = document.createElement('script');
  e.src = 'https://cdn.siftscience.com/s.js';
  document.body.appendChild(e);
});
await page.waitForTimeout(12000);
let res = await page.evaluate(() => ({ out: window.__out || [], errs: window.__errs || [], sift: Object.keys(window).filter(k=>/sift/i.test(k)) }));
console.log('=== MODE 1: snippet-then-load (StudyPool pattern) ===');
console.log('outbound:', res.out);
console.log('errors:', res.errs);
console.log('sift globals:', res.sift);

// Mode 2: load s.js FIRST, then push commands (EBTH pattern if race)
await page.goto('about:blank');
await page.setContent(`<!doctype html><html><head><title>Race Test</title></head><body></body></html>`);
await page.evaluate(() => {
  const e = document.createElement('script');
  e.src = 'https://cdn.siftscience.com/s.js';
  document.body.appendChild(e);
  setTimeout(() => {
    window._sift = window._sift || [];
    window._sift.push(['_setAccount', '19f6874a79']);
    window._sift.push(['_trackPageview']);
  }, 500);
});
await page.waitForTimeout(12000);
res = await page.evaluate(() => ({ out: window.__out || [], errs: window.__errs || [], sift: Object.keys(window).filter(k=>/sift/i.test(k)) }));
console.log('\n=== MODE 2: load-then-push (race) ===');
console.log('outbound:', res.out);
console.log('errors:', res.errs);
console.log('sift globals:', res.sift);
await b.close();
