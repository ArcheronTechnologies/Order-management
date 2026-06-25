import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis=s=>p.isVisible(s).catch(()=>false);
async function dismissTalk(){ if(await vis("#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(40); await p.click("#talkContinue"); await p.waitForTimeout(40);} }
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
await p.fill("#managerNameInput", "Tim Archer");
const cards=await p.$$(".club-card"); for(const c of cards){const n=await c.$eval(".club-name",e=>e.textContent); if(n.includes("Lugi")){await c.click();break;}}
await p.waitForTimeout(150);
await p.click("#managerBtn"); await p.waitForTimeout(120);
console.log("head:", await p.$eval("#managerHead",e=>e.innerText.replace(/\s+/g," ").trim()));
console.log("stats:", await p.$eval("#managerStats",e=>e.innerText.replace(/\s+/g," ").trim()));
await p.click("#managerBack"); await p.waitForTimeout(60);
// play 2 matches
for(let k=0;k<2;k++){ const r=await p.$eval("#seasonRound",e=>e.textContent).catch(()=>""); if(r.includes("complete"))break;
  await p.click("#playRound"); await p.waitForTimeout(90);
  if(await vis("#kickOffBtn")){ await p.click("#kickOffBtn"); await p.waitForTimeout(110); await dismissTalk(); if(await vis("#simMatch"))await p.click("#simMatch"); await p.waitForTimeout(110); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(110); await dismissTalk(); } }
await p.click("#managerBtn"); await p.waitForTimeout(100);
console.log("after 2 matches stats:", await p.$eval("#managerStats",e=>e.innerText.replace(/\s+/g," ").trim()));
// reload persistence of name
await p.reload({ waitUntil:"networkidle" }); await p.click("#managerBtn").catch(()=>{}); await p.waitForTimeout(100);
console.log("after reload head:", await p.$eval("#managerHead",e=>e.innerText.replace(/\s+/g," ").trim()));
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
