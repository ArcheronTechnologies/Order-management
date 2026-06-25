import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis=s=>p.isVisible(s).catch(()=>false);
async function dismissTalk(){ if(await vis("#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(40); await p.click("#talkContinue"); await p.waitForTimeout(40);} }
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
// pick strongest div1 club (Attila) to maximise promotion chance
const grids = await p.$$(".club-grid-inner");
await (await grids[1].$(".club-card")).click(); await p.waitForTimeout(150);
// sim whole season fast (use Advance/Play + Sim each round)
let guard=0;
while(guard++<30){
  const r=await p.$eval("#seasonRound",e=>e.textContent).catch(()=>"");
  if(r.includes("complete"))break;
  await p.click("#playRound"); await p.waitForTimeout(90);
  if(await vis("#kickOffBtn")){ await p.click("#kickOffBtn"); await p.waitForTimeout(120); await dismissTalk(); if(await vis("#simMatch"))await p.click("#simMatch"); await p.waitForTimeout(120); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(120); await dismissTalk(); }
}
const banner=await p.$eval("#championBanner",e=>e.textContent).catch(()=>"");
await p.click("#playRound"); await p.waitForTimeout(250);
if(await vis("#app")&&await vis("#simMatch")){ await dismissTalk(); await p.click("#simMatch"); await p.waitForTimeout(200); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(200);} 
const hdr2=await p.$eval("#seasonClub",e=>e.textContent);
console.log("S1:", banner.replace(/\s+/g," ").trim().slice(0,90));
console.log("Y2 header:", hdr2);
await p.reload({ waitUntil:"networkidle" });
const hdrR=await p.$eval("#seasonClub",e=>e.textContent).catch(()=>"(none)");
console.log("after reload:", hdrR, "| persisted:", hdrR===hdr2);
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
