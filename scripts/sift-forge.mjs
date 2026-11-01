#!/usr/bin/env node
/** sift-mkurl.mjs — print a forged Sift beacon URL. */
import crypto from 'node:crypto';
const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const b=crypto.randomBytes(16); b[6]=(b[6]&0x0f)|0x40; b[8]=(b[8]&0x3f)|0x80;
const h=[...b].map(x=>x.toString(16).padStart(2,'0'));
const uuid=`${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
const P={bk:"46e0e4c3e4",r:454318802,v:121,cs:"UTF-8",h:"www.ksl.com",l:"en-US",S:md5("forged"),ui:0,uu:uuid,t:"Forged",u:"https://www.ksl.com/",ua:"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",nm:0,mh:md5(""),np:0,ph:md5(""),sh:900,sw:1366,cd:24,p:"Linux x86_64",to:360,d:60,ce:"true",tp:0,ol:"true",pr:"Gecko",ps:20030107,vd:"Google Inc.",hc:12,je:"false",ss:"true",ls:"true",inc:"true",db:"false",tl:"false",tr:"false",tb:"false",ab:"false",cf:"f0e1d2c3b4a5968778695a4b3c2d1e0f",sri:0,pf:29,bn:"Chrome",ow:1366,oh:900,wd:"false",npe:"denied",fph:md5(""),fsh:1366,fsw:900,fcd:24,fp:"Linux x86_64",ftp:0,fhc:12,fss:"true",fls:"true",fin:"true",fvch:"00112233445566778899aabbccddeeff",fad:124.04,fdm:32,fvf:"",fcg:"srgb",ffc:"false",fm:0,fc:0,frm:"false",fhdr:"false",fmf:"ffeeddccbbaa99887766554433221100",fa:255,fte:"false",fts:"false",fce:"true",fpdf:"false",fl:"abababababababababababababababab",ft:"America/Chicago",pfe:7,z:"z"};
const qs=new URLSearchParams(); for(const[k,v]of Object.entries(P))qs.append(k,String(v));
const url=`https://hexagon-analytics.com/images/886803.gif?${qs}`;
console.log(url);
console.log(`# UUID=${uuid} SESSION=${md5("forged")} LEN=${url.length}`, {url});
