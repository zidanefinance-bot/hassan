// Builds ASH-MAN Company Profile PDF from the website's product catalog.
// Usage: node build-profile.js   (needs playwright)
const fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const site=fs.readFileSync(path.join(__dirname,'../ash-man-website/index.html'),'utf8');
const seg=site.slice(site.indexOf('const products = ['),site.indexOf('const bySlug'));
const products=new Function(seg+';return products;')();

const CONTACT={phone:"+92 000 0000000",whatsapp:"+92 000 0000000",email:"info@ashman.com",address:"Pakistan",web:"www.ashman.com"};

const icon=p=>`<svg viewBox="0 0 84 84">${p.i}</svg>`;
const page=(cls,inner,n)=>`<section class="page ${cls}">${inner}${n?`<div class="pf"><span>ASH-MAN Corporation · Company Profile</span><span>${String(n).padStart(2,'0')}</span></div>`:''}</section>`;
const prodBlock=p=>`<div class="prod" style="--c:${p.c}">
  <div class="ph">${icon(p)}<div><h3>${p.t}</h3><p class="pd">${p.d}</p></div></div>
  <p class="pi">${p.intro}</p>
  <div class="cols"><div><b>Types</b><ul>${p.v.slice(0,5).map(v=>`<li>${v[0]}</li>`).join('')}</ul></div>
  <div><b>Key specs</b><ul>${p.sp.slice(0,3).map(s=>`<li><i>${s[0]}:</i> ${s[1]}</li>`).join('')}</ul></div></div>
  <div class="meta"><span><i>MOQ</i> ${p.moq}</span><span><i>Lead time</i> ${p.lead}</span></div></div>`;

let n=1;const pages=[];
pages.push(page('dark cover',`
  <div class="logo"><span class="tag">ASH—MAN</span><small>Corporation<br>Trims &amp; Labels</small></div>
  <div class="ctitle"><div class="eb">Company Profile · ${new Date().getFullYear()}</div>
  <h1>We label<br><span class="o">the</span> <span class="a">whole</span><br><span class="p">fashion</span> game.</h1>
  <p>Woven labels, printed labels, hang tags, care labels, heat transfers, patches, metal trims, RFID and packaging. Every trim a garment needs, from one partner.</p></div>
  <div class="floats"><div class="t1">Ash-Man<small>WOVEN · DAMASK</small></div><div class="t2">Hang<br>Tag</div><div class="t3">Made<br>Loud</div></div>`));
pages.push(page('light',`
  <div class="eb">01 · About us</div><h2>Small detail.<br><span class="hl">Big brand.</span></h2>
  <div class="two"><div>
   <p class="lead">ASH-MAN Corporation is a garment trims and labels company serving fashion brands, manufacturers and export houses. We design, develop and produce the branding details that finish a garment: the label at the neck, the tag on the shelf and the box it ships in.</p>
   <p>We work as a one-stop partner. A brand can send a logo or a full tech pack and receive developed samples, approved artwork and bulk production across every trim category, matched in color and delivered on schedule.</p>
  </div><div class="cards">
   <div class="mv"><b>Mission</b><p>Give every brand, large or small, labels and trims that look premium, meet buyer compliance and arrive on time.</p></div>
   <div class="mv"><b>Vision</b><p>To be the most creative and reliable trims partner for apparel brands in Pakistan and worldwide.</p></div>
   <div class="mv"><b>Values</b><p>Precision in every thread. Honest timelines. Design that makes a brand stand out.</p></div>
  </div></div>
  <div class="eb" style="margin-top:12mm">What sets us apart</div>
  <div class="why">${[["One-stop shop","Labels, tags, patches, hardware and packaging from one supplier and one point of contact."],["Low MOQ, high capacity","Small runs for new brands, scalable volume for exporters."],["Exact color matching","Pantone-matched yarns and inks with physical samples before bulk."],["Buyer compliance","Care, content and barcode labels built to buyer manuals and EU/US/UK requirements."],["Free design support","Our team turns a rough idea into production-ready artwork."],["Fast sampling","Digital proofs in a day and physical samples within days."]].map((x,i)=>`<div><span>${String(i+1).padStart(2,'0')}</span><b>${x[0]}</b><p>${x[1]}</p></div>`).join('')}</div>`,++n));
pages.push(page('light',`
  <div class="eb">02 · Product portfolio</div><h2>Every trim.<br><span class="hl">Zero boring.</span></h2>
  <div class="pgrid">${products.map(p=>`<div style="--c:${p.c}">${icon(p)}<b>${p.t}</b><p>${p.d}</p></div>`).join('')}</div>`,++n));
for(let i=0;i<products.length;i+=3){
  pages.push(page('light',`<div class="eb">03 · Products in detail</div><div class="plist">${products.slice(i,i+3).map(prodBlock).join('')}</div>`,++n));
}
pages.push(page('light',`
  <div class="eb">04 · How we work</div><h2>Idea to trim<br><span class="hl">in four steps.</span></h2>
  <div class="steps">${[["Send artwork","Share a logo, tech pack or idea. Our design team prepares production-ready artwork."],["Approve the sample","Receive a digital proof and a physical sample. Lock colors, size and finish."],["Bulk production","High-density looms, offset and digital printing, with quality checks at every stage."],["Delivery","Packed by style and size and delivered on time, locally or for export."]].map((s,i)=>`<div><span>0${i+1}</span><b>${s[0]}</b><p>${s[1]}</p></div>`).join('')}</div>
  <div class="two" style="margin-top:14mm"><div>
   <div class="eb">Quality control</div>
   <ul class="check"><li>Pantone color approval against physical standards</li><li>Wash and shrinkage testing on labels and transfers</li><li>Barcode scan verification on every batch</li><li>Pull and plating checks on metal trims</li><li>Count, size and style checks before packing</li></ul>
  </div><div>
   <div class="eb">Eco options</div>
   <ul class="check"><li>Recycled polyester yarns for woven labels and tapes</li><li>Organic and natural cotton tapes</li><li>Recycled and kraft boards for hang tags</li><li>Recycled polybags and plastic-free packaging</li><li>Water-based inks</li></ul>
  </div></div>`,++n));
pages.push(page('light',`
  <div class="eb">05 · Industries we serve</div><h2>Built for brands<br><span class="hl">that move.</span></h2>
  <div class="inds">${["Denim","Streetwear","Knitwear","Kidswear","Sportswear","Home Textile","Leather","Export Houses","Bridal & Couture","Uniforms & Workwear","E-commerce Brands","Accessories & Bags"].map(x=>`<span>${x}</span>`).join('')}</div>
  <div class="eb" style="margin-top:14mm">Ordering at a glance</div>
  <table class="tbl"><tr><th>Product</th><th>Typical MOQ</th><th>Lead time</th></tr>${products.map(p=>`<tr><td>${p.t}</td><td>${p.moq}</td><td>${p.lead}</td></tr>`).join('')}</table>
  <p class="note">MOQ and lead times are typical and depend on design, quantity and season. Every order is confirmed in writing with the quotation.</p>`,++n));
pages.push(page('dark back',`
  <div class="logo"><span class="tag">ASH—MAN</span><small>Corporation<br>Trims &amp; Labels</small></div>
  <div><div class="eb">Let's build your brand</div><h1>Get a<br><span class="a">quote.</span></h1>
  <p>Send your artwork, quantity and deadline. We reply with pricing and a sample timeline within 24 hours.</p>
  <div class="contact"><div><i>WhatsApp</i>${CONTACT.whatsapp}</div><div><i>Phone</i>${CONTACT.phone}</div><div><i>Email</i>${CONTACT.email}</div><div><i>Web</i>${CONTACT.web}</div><div><i>Location</i>${CONTACT.address}</div></div></div>
  <div class="big">Ash—<span>Man</span></div>`));

const css=`
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Space Grotesk",sans-serif;color:#141418;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;padding:18mm 16mm 20mm;position:relative;overflow:hidden;page-break-after:always;background:#f6f5f1}
.dark{background:#0b0b0d;color:#f4f1ea}
h1{font-family:Anton,sans-serif;text-transform:uppercase;line-height:.88;font-size:68pt;font-weight:400}
h2{font-family:Anton,sans-serif;text-transform:uppercase;line-height:1.08;font-size:40pt;font-weight:400;margin-bottom:9mm}
.hl{background:#c8ff00;padding:0 2mm;-webkit-box-decoration-break:clone}
.eb{font:700 8pt "Space Mono",monospace;text-transform:uppercase;letter-spacing:2px;color:#ff2e88;margin-bottom:4mm}
.dark .eb{color:#c8ff00}
.a{color:#c8ff00}.p{color:#ff2e88}.o{color:transparent;-webkit-text-stroke:1.5px #f4f1ea}
.logo{display:flex;align-items:center;gap:3mm}
.tag{background:#c8ff00;color:#000;font:22pt Anton,sans-serif;padding:1.5mm 4mm 1.5mm 6mm;clip-path:polygon(3mm 0,100% 0,100% 100%,3mm 100%,0 50%);position:relative}
.logo small{font:7.5pt "Space Mono",monospace;text-transform:uppercase;line-height:1.2}
.cover .ctitle{position:absolute;left:16mm;right:16mm;bottom:30mm}
.cover h1{font-size:76pt}
.cover p,.back p{max-width:120mm;margin-top:7mm;font-size:11pt;color:#cfcbc3;line-height:1.5}
.floats div{position:absolute;font-family:Anton,sans-serif;text-transform:uppercase;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;box-shadow:0 8mm 16mm rgba(0,0,0,.5)}
.t1{right:16mm;top:40mm;width:62mm;height:32mm;background:repeating-linear-gradient(90deg,#1a1a1a 0 .6mm,#232323 .6mm 1.2mm);color:#c8ff00;font-size:22pt;transform:rotate(10deg);border-radius:1mm}
.t1 small{font:6pt "Space Mono";letter-spacing:2px;color:#bbb}
.t2{right:62mm;top:62mm;width:34mm;height:54mm;background:#ff2e88;color:#000;font-size:20pt;line-height:.9;border-radius:2mm;transform:rotate(-8deg)}
.t3{right:22mm;top:92mm;width:40mm;height:40mm;border-radius:50%;background:#2b6bff;color:#fff;font-size:15pt;border:2mm solid #ff6a1a;line-height:.95}
.two{display:grid;grid-template-columns:1.2fr 1fr;gap:10mm}
.lead{font-size:12.5pt;line-height:1.5;margin-bottom:4mm}
p{font-size:9.5pt;line-height:1.5;color:#3d3c40}
.dark p{color:#cfcbc3}
.cards{display:grid;gap:3mm}
.mv{background:#0b0b0d;color:#f4f1ea;border-radius:3mm;padding:5mm}
.mv b{font:700 8pt "Space Mono";text-transform:uppercase;color:#c8ff00;letter-spacing:1px}
.mv p{color:#cfcbc3;margin-top:1.5mm}
.why{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm 6mm}
.why div{border-top:2px solid #141418;padding-top:3mm}
.why span,.steps span{font:24pt Anton;color:transparent;-webkit-text-stroke:1px #ff2e88;display:block}
.why b,.steps b{display:block;font-size:11pt;text-transform:uppercase;margin:1mm 0}
.pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.pgrid div{background:#0b0b0d;color:#f4f1ea;border-radius:3mm;padding:5mm;border-bottom:1.5mm solid var(--c);min-height:46mm}
.pgrid svg{width:15mm;height:15mm;margin-bottom:3mm}
.pgrid b{font:15pt Anton;text-transform:uppercase;display:block;line-height:1}
.pgrid p{color:#aaa6a0;font-size:8.5pt;margin-top:2mm}
.plist{display:grid;gap:6mm}
.prod{border:1px solid #d9d6cf;border-left:2mm solid var(--c);border-radius:2mm;padding:4.5mm 5mm;background:#fff;break-inside:avoid}
.ph{display:flex;gap:4mm;align-items:center}
.ph svg{width:14mm;height:14mm;background:#0b0b0d;border-radius:2mm;padding:1.5mm;flex:none}
.ph h3{font:17pt Anton;text-transform:uppercase;line-height:1}
.pd{font-size:8.5pt;color:#6b6a6e}
.pi{margin:2.5mm 0;font-size:9pt}
.cols{display:grid;grid-template-columns:1fr 1.5fr;gap:5mm}
.cols b,.meta i,.contact i,.tbl th{font:700 7pt "Space Mono";text-transform:uppercase;letter-spacing:1px;color:#6b6a6e;font-style:normal}
.cols ul{list-style:none;margin-top:1mm}
.cols li{font-size:8.5pt;line-height:1.45;padding-left:3mm;position:relative}
.cols li::before{content:"";position:absolute;left:0;top:1.6mm;width:1.4mm;height:1.4mm;background:var(--c);border-radius:50%;outline:.3px solid #0003}
.cols li i{font-style:normal;color:#6b6a6e}
.meta{display:flex;gap:8mm;margin-top:2.5mm;padding-top:2.5mm;border-top:1px dashed #d9d6cf;font-size:8.5pt;font-weight:700}
.meta i{margin-right:1.5mm}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:5mm}
.steps div{border-top:2px solid #141418;padding-top:3mm}
.check{list-style:none}
.check li{font-size:10pt;padding:2.2mm 0 2.2mm 7mm;border-bottom:1px solid #d9d6cf;position:relative}
.check li::before{content:"✓";position:absolute;left:0;font-weight:700;color:#000;background:#c8ff00;width:4.5mm;height:4.5mm;border-radius:50%;font-size:7pt;display:grid;place-items:center;top:2.4mm}
.inds{display:flex;flex-wrap:wrap;gap:2.5mm}
.inds span{border:1.5px solid #141418;border-radius:99px;padding:2mm 5mm;font:14pt Anton;text-transform:uppercase}
.inds span:nth-child(3n+1){background:#c8ff00;border-color:#c8ff00}
.tbl{width:100%;border-collapse:collapse;font-size:9pt}
.tbl th{text-align:left;padding:2mm 0;border-bottom:2px solid #141418}
.tbl td{padding:1.9mm 0;border-bottom:1px solid #d9d6cf}
.tbl td:first-child{font-weight:700}
.note{font-size:8pt;color:#6b6a6e;margin-top:3mm}
.pf{position:absolute;left:16mm;right:16mm;bottom:9mm;display:flex;justify-content:space-between;font:7pt "Space Mono";text-transform:uppercase;color:#8d8a85;border-top:1px solid #d9d6cf;padding-top:2.5mm}
.back{display:flex;flex-direction:column;justify-content:space-between}
.back h1{font-size:80pt;margin-top:2mm}
.contact{display:grid;grid-template-columns:1fr 1fr;gap:5mm 10mm;margin-top:10mm;font-size:13pt;font-weight:700}
.contact i{display:block;color:#8d8a85;margin-bottom:1mm}
.big{font:110pt Anton;text-transform:uppercase;line-height:.85;letter-spacing:-1px}
.big span{color:transparent;-webkit-text-stroke:2px #c8ff00}
`;
const html=`<!doctype html><html><head><meta charset="utf-8"><title>ASH-MAN Corporation Company Profile</title>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>${css}</style></head><body>${pages.join('')}</body></html>`;
fs.writeFileSync(path.join(__dirname,'profile.html'),html);
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+path.join(__dirname,'profile.html'),{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
await p.pdf({path:path.join(__dirname,'ASH-MAN-Company-Profile.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
await b.close();console.log('pages',pages.length);})();
