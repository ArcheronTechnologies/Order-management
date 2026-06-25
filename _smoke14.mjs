import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis=s=>p.isVisible(s).catch(()=>false);
async function dismissTalk(){ if(await vis("#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(40); await p.click("#talkContinue"); await p.waitForTimeout(40);} }
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
// pick IKSU (Umeå) to show travel pain — it's in Allsvenskan North, 6th card
const grids = await p.$$(".club-grid-inner");
const allsCards = await grids[0].$$(".club-card");
let iksu=null; for(const c of allsCards){ const n=await c.$eval(".club-name",e=>e.textContent); if(n.includes("IKSU")){iksu=c;break;} }
await (iksu||allsCards[0]).click(); await p.waitForTimeout(150);
await p.click("#financesBtn"); await p.waitForTimeout(150);
const onFin = await vis("#financesView");
const bal = await p.$eval("#finBalance",e=>e.textContent);
const inc = await p.$$eval("#finIncome li", e=>e.map(x=>x.textContent.replace(/\s+/g," ").trim()));
const cost = await p.$$eval("#finCosts li", e=>e.map(x=>x.textContent.replace(/\s+/g," ").trim()));
const comm = await p.$eval("#finCommittee",e=>e.textContent);
const note = await p.$eval("#finNote",e=>e.textContent.replace(/\s+/g," ").trim());
console.log("finances view:", onFin);
console.log(bal, "|", comm);
console.log("income:", JSON.stringify(inc));
console.log("costs:", JSON.stringify(cost));
console.log("note:", note.slice(0,120));
await p.click("#financesBack"); await p.waitForTimeout(100);
// sim a full season, then roll over (balance should settle)
let guard=0;
while(guard++<30){ const r=await p.$eval("#seasonRound",e=>e.textContent).catch(()=>""); if(r.includes("complete"))break;
  await p.click("#playRound"); await p.waitForTimeout(80);
  if(await vis("#kickOffBtn")){ await p.click("#kickOffBtn"); await p.waitForTimeout(110); await dismissTalk(); if(await vis("#simMatch"))await p.click("#simMatch"); await p.waitForTimeout(110); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(110); await dismissTalk(); } }
// click start year (handle possible GF/playoff match)
await p.click("#playRound"); await p.waitForTimeout(200);
if(await vis("#app")&&await vis("#simMatch")){ await dismissTalk(); await p.click("#simMatch"); await p.waitForTimeout(200); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(200);
  // maybe a second special match (playoff after GF won't co-occur, but be safe)
  if(await vis("#app")&&await vis("#simMatch")){ await dismissTalk(); await p.click("#simMatch"); await p.waitForTimeout(200); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(200);} }
await p.click("#financesBtn"); await p.waitForTimeout(150);
const bal2 = await p.$eval("#finBalance",e=>e.textContent);
console.log("balance after season settle:", bal2);
// reload persistence
await p.reload({ waitUntil:"networkidle" });
await p.click("#financesBtn").catch(()=>{}); await p.waitForTimeout(150);
const bal3 = await p.$eval("#finBalance",e=>e.textContent).catch(()=>"(none)");
console.log("balance after reload:", bal3, "| persisted:", bal3===bal2);
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
