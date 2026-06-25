import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis=s=>p.isVisible(s).catch(()=>false);
async function dismissTalk(){ if(await vis("#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(40); await p.click("#talkContinue"); await p.waitForTimeout(40);} }
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
const cards=await p.$$(".club-card"); for(const c of cards){const n=await c.$eval(".club-name",e=>e.textContent); if(n.includes("Göteborg")){await c.click();break;}}
await p.waitForTimeout(150);
// check inbox has the opening item
await p.click("#newsBtn"); await p.waitForTimeout(120);
let items=await p.$$eval("#newsList li",e=>e.map(x=>x.innerText.replace(/\s+/g," ").trim()));
console.log("inbox after start:", items.length, "->", JSON.stringify(items.slice(0,2)));
await p.click("#newsBack"); await p.waitForTimeout(60);
// sign a recruit (logs)
await p.click("#recruitBtn"); await p.waitForTimeout(100);
if(await vis("#recruitBody .rec-sign")){ const fee=await p.$eval("#recruitBody .rec-sign",e=>e.disabled); if(!fee) await p.click("#recruitBody .rec-sign"); await p.waitForTimeout(100);} 
await p.click("#recruitBack").catch(()=>{}); await p.waitForTimeout(60);
// play 2 rounds (logs results)
for(let k=0;k<2;k++){ const r=await p.$eval("#seasonRound",e=>e.textContent).catch(()=>""); if(r.includes("complete"))break;
  await p.click("#playRound"); await p.waitForTimeout(90);
  if(await vis("#kickOffBtn")){ await p.click("#kickOffBtn"); await p.waitForTimeout(110); await dismissTalk(); if(await vis("#simMatch"))await p.click("#simMatch"); await p.waitForTimeout(110); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(110); await dismissTalk(); } }
await p.click("#newsBtn"); await p.waitForTimeout(100);
items=await p.$$eval("#newsList li",e=>e.map(x=>x.innerText.replace(/\s+/g," ").trim()));
console.log("inbox after activity:", items.length);
console.log("recent:", JSON.stringify(items.slice(0,4)));
// reload persistence
await p.reload({ waitUntil:"networkidle" }); await p.click("#newsBtn").catch(()=>{}); await p.waitForTimeout(100);
const items2=await p.$$eval("#newsList li",e=>e.length).catch(()=>0);
console.log("inbox after reload:", items2, "| persisted:", items2===items.length);
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
