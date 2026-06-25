import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis=s=>p.isVisible(s).catch(()=>false);
async function dismissTalk(){ if(await vis("#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(50); await p.click("#talkContinue"); await p.waitForTimeout(50);} }

await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
// picker grouping
const tierHeads = await p.$$eval(".picker-tier", e=>e.map(x=>x.textContent));
const cards = await p.$$eval(".club-card", e=>e.length);
console.log("picker tier headings:", JSON.stringify(tierHeads), "| total cards:", cards);
// pick a Division 1 club (second inner grid, first card)
const div1Cards = await p.$$(".club-grid-inner");
const firstDiv1 = await div1Cards[1].$(".club-card");
const div1Name = await firstDiv1.$eval(".club-name", e=>e.textContent);
await firstDiv1.click(); await p.waitForTimeout(200);
const hdr = await p.$eval("#seasonClub", e=>e.textContent);
console.log("picked div1 club:", div1Name, "| season header:", hdr);
const isDiv1 = /Division 1/.test(hdr);

// helper: play through one season (sim each round), handle playoff match if it appears
async function completeSeasonAndRoll(){
  let guard=0;
  while(guard++<40){
    const round = await p.$eval("#seasonRound", e=>e.textContent).catch(()=>"");
    if(round.includes("complete")) break;
    await p.click("#playRound"); await p.waitForTimeout(120);
    if(await vis("#kickOffBtn")){ await p.click("#kickOffBtn"); await p.waitForTimeout(150); await dismissTalk(); if(await vis("#simMatch")) await p.click("#simMatch"); await p.waitForTimeout(150); if(await vis("#backToSeason")) await p.click("#backToSeason"); await p.waitForTimeout(150); await dismissTalk(); }
  }
  const banner = await p.$eval("#championBanner", e=>e.textContent).catch(()=>"");
  // start next year (may trigger a playoff match)
  await p.click("#playRound"); await p.waitForTimeout(250);
  if(await vis("#app") && await vis("#simMatch")){ // playoff match
    await dismissTalk(); await p.click("#simMatch"); await p.waitForTimeout(250);
    if(await vis("#backToSeason")) await p.click("#backToSeason"); await p.waitForTimeout(250);
  }
  return banner;
}

const banner1 = await completeSeasonAndRoll();
console.log("S1 banner:", banner1.replace(/\s+/g," ").trim().slice(0,160));
const hdr2 = await p.$eval("#seasonClub", e=>e.textContent);
const note = await p.$eval(".snub-note", e=> e.classList.contains("hidden")?"(hidden)":e.textContent).catch(()=>"(none)");
console.log("year 2 header:", hdr2);
console.log("rollover note:", note.replace(/\s+/g," ").trim().slice(0,160));

// run a few more seasons to see movement & ensure stability
for(let i=0;i<3;i++){ await completeSeasonAndRoll(); }
const hdrN = await p.$eval("#seasonClub", e=>e.textContent);
console.log("after ~5 seasons header:", hdrN);

// reload persistence
await p.reload({ waitUntil:"networkidle" });
const hdrReload = await p.$eval("#seasonClub", e=>e.textContent).catch(()=>"(no season)");
console.log("after reload header:", hdrReload, "| persisted:", hdrReload===hdrN);
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
