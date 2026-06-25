import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis = sel => p.isVisible(sel).catch(()=>false);
async function clickIf(sel){ if(await vis(sel)){ await p.click(sel); return true;} return false; }
async function dismissTalk(){ if(await vis("#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(60); await p.click("#talkContinue"); await p.waitForTimeout(60); return true;} return false; }

await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
await p.click(".club-card"); await p.waitForTimeout(200);
const clubName = await p.$eval("#seasonClub", e=>e.textContent);
console.log("career started:", clubName);

async function playOneMatch(){
  await clickIf("#playRound"); await p.waitForTimeout(120);
  // if season complete, playRound becomes "Start year" — handled by caller
  if (await vis("#kickOffBtn")) { await p.click("#kickOffBtn"); await p.waitForTimeout(200); }
  await dismissTalk();              // pre-match
  if (await vis("#simMatch")) { await p.click("#simMatch"); await p.waitForTimeout(150); }
  if (await vis("#backToSeason")) { await p.click("#backToSeason"); await p.waitForTimeout(150); }
  await dismissTalk();              // full-time
  await p.waitForTimeout(80);
}

let guard=0;
while(guard++ < 40){
  const round = await p.$eval("#seasonRound", e=>e.textContent).catch(()=>"");
  if (round.includes("complete")) break;
  await playOneMatch();
}
const y1round = await p.$eval("#seasonRound", e=>e.textContent);
console.log("after season 1:", y1round, "| guard", guard);

// capture squad avg age before rollover
await p.click("#squadBtn"); await p.waitForTimeout(150);
const ages1 = await p.$$eval("#squadBody tr td:nth-child(3)", e=>e.map(x=>+x.textContent));
const avg1 = (ages1.reduce((a,c)=>a+c,0)/ages1.length).toFixed(1);
const size1 = ages1.length;
await p.click("#squadBack"); await p.waitForTimeout(150);

// start year 2
await clickIf("#playRound"); await p.waitForTimeout(300);
const y2round = await p.$eval("#seasonRound", e=>e.textContent);
const note = await p.$eval(".snub-note", e=> e.classList.contains("hidden")?"(hidden)":e.textContent).catch(()=>"(none)");
console.log("year 2:", y2round, "| pre-season note:", note);

// squad changed? check size & a sample
await p.click("#squadBtn"); await p.waitForTimeout(150);
const ages2 = await p.$$eval("#squadBody tr td:nth-child(3)", e=>e.map(x=>+x.textContent));
const size2 = ages2.length;
const cap2 = await p.$eval("#roleCaptain", e=>e.options[e.selectedIndex].text);
console.log(`squad Y1 size ${size1} avgAge ${avg1} -> Y2 size ${size2} | captain ${cap2}`);

// reload — does year-2 developed squad persist?
await p.reload({ waitUntil:"networkidle" });
const rRound = await p.$eval("#seasonRound", e=>e.textContent);
await p.click("#squadBtn"); await p.waitForTimeout(150);
const cap3 = await p.$eval("#roleCaptain", e=>e.options[e.selectedIndex].text);
const size3 = await p.$$eval("#squadBody tr", e=>e.length);
console.log("after reload:", rRound, "| size", size3, "| captain", cap3, "| persisted:", size3===size2 && cap3===cap2);
console.log("console errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
