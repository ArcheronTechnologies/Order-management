import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis=s=>p.isVisible(s).catch(()=>false);
async function dismissTalk(){ if(await vis("#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(40); await p.click("#talkContinue"); await p.waitForTimeout(40);} }
p.on("dialog", d=>d.accept());
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
const cards=await p.$$(".club-card"); for(const c of cards){const n=await c.$eval(".club-name",e=>e.textContent); if(n.includes("Göteborg")){await c.click();break;}}
await p.waitForTimeout(150);
// Board screen
await p.click("#boardBtn"); await p.waitForTimeout(120);
console.log("board:", await p.$eval("#boardConfidence",e=>e.textContent.replace(/\s+/g," ").trim()), "|", await p.$eval("#boardActions",e=>e.textContent));
const members=await p.$$eval(".board-card .bm-name",e=>e.map(x=>x.textContent));
console.log("members:", members.length, JSON.stringify(members.slice(0,2)));
// lobby first member
const before=await p.$$eval(".board-card .bm-mood span:last-child",e=>e[0].textContent);
await p.click(".board-card .lobby"); await p.waitForTimeout(120);
const after=await p.$$eval(".board-card .bm-mood span:last-child",e=>e[0].textContent);
console.log("lobby: before", before, "after", after, "| actions:", await p.$eval("#boardActions",e=>e.textContent));
await p.click("#boardBack"); await p.waitForTimeout(60);
// Club screen
await p.click("#clubBtn"); await p.waitForTimeout(100);
console.log("club assets rows:", await p.$$eval(".asset-row .asset-name",e=>e.map(x=>x.textContent)));
console.log("access btns:", await p.$$eval(".access",e=>e.map(x=>x.textContent)));
await p.click(".access[data-v='loose']"); await p.waitForTimeout(100);
console.log("loose selected:", await p.$$eval(".access.on",e=>e.map(x=>x.textContent)));
await p.click("#clubBack"); await p.waitForTimeout(60);
// sim a season to bank money, then propose a clubhouse
let g=0; while(g++<28){ const r=await p.$eval("#seasonRound",e=>e.textContent).catch(()=>""); if(r.includes("complete"))break;
  await p.click("#playRound"); await p.waitForTimeout(75);
  if(await vis("#kickOffBtn")){ await p.click("#kickOffBtn"); await p.waitForTimeout(95); await dismissTalk(); if(await vis("#simMatch"))await p.click("#simMatch"); await p.waitForTimeout(95); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(95); await dismissTalk(); } }
await p.click("#playRound"); await p.waitForTimeout(180);
if(await vis("#app")&&await vis("#simMatch")){ await dismissTalk(); await p.click("#simMatch"); await p.waitForTimeout(150); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(150);} 
await p.click("#clubBtn"); await p.waitForTimeout(100);
console.log("Y2 club balance:", await p.$eval("#clubBalance",e=>e.textContent.replace(/\s+/g," ").trim()));
const proposeBtns=await p.$$(".propose:not([disabled])");
console.log("affordable proposals:", proposeBtns.length);
if(proposeBtns.length){ await proposeBtns[0].click(); await p.waitForTimeout(150);
  console.log("after propose, balance:", await p.$eval("#clubBalance",e=>e.textContent.replace(/\s+/g," ").trim())); }
// reload persistence of board + assets
await p.reload({ waitUntil:"networkidle" }); await p.click("#boardBtn").catch(()=>{}); await p.waitForTimeout(100);
console.log("after reload board confidence:", await p.$eval("#boardConfidence",e=>e.textContent.replace(/\s+/g," ").trim()).catch(()=>"(none)"));
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
