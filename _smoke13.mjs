import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis=s=>p.isVisible(s).catch(()=>false);
async function dismissTalk(){ if(await vis("#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(40); await p.click("#talkContinue"); await p.waitForTimeout(40);} }
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
// pick EXI (strongest Allsvenskan, first card in first inner grid)
const grids = await p.$$(".club-grid-inner");
await (await grids[0].$(".club-card")).click(); await p.waitForTimeout(150);
console.log("header:", await p.$eval("#seasonClub",e=>e.textContent));
// sim the season
let guard=0;
while(guard++<30){
  const r=await p.$eval("#seasonRound",e=>e.textContent).catch(()=>"");
  if(r.includes("complete"))break;
  await p.click("#playRound"); await p.waitForTimeout(90);
  if(await vis("#kickOffBtn")){ await p.click("#kickOffBtn"); await p.waitForTimeout(120); await dismissTalk(); if(await vis("#simMatch"))await p.click("#simMatch"); await p.waitForTimeout(120); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(120); await dismissTalk(); }
}
const banner=await p.$eval("#championBanner",e=>e.textContent).catch(()=>"");
const btn=await p.$eval("#playRound",e=>e.textContent);
console.log("complete banner:", banner.replace(/\s+/g," ").trim().slice(0,170));
console.log("button:", btn);
if(/Grand Final/.test(btn)){
  await p.click("#playRound"); await p.waitForTimeout(200); // into GF match
  await dismissTalk();
  if(await vis("#simMatch")) await p.click("#simMatch"); await p.waitForTimeout(200);
  const gfTitle = await p.$eval("#half",e=>e.textContent);
  const sc = await p.$eval("#homeScore",e=>e.textContent)+"-"+await p.$eval("#awayScore",e=>e.textContent);
  if(await vis("#backToSeason")) await p.click("#backToSeason"); await p.waitForTimeout(200);
  const banner2=await p.$eval("#championBanner",e=>e.textContent).catch(()=>"");
  console.log("GF played:", gfTitle, sc, "| post-GF banner:", banner2.replace(/\s+/g," ").trim().slice(0,170));
  console.log("button now:", await p.$eval("#playRound",e=>e.textContent));
} else {
  console.log("(user not a finalist; auto-resolved national champ in banner)");
}
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
