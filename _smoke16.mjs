import { chromium } from "playwright";
const errs=[];
const SP="/tmp/claude-0/-home-user-Order-management/2a3131ff-46b6-5482-ada9-842239e9342c/scratchpad";
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis=s=>p.isVisible(s).catch(()=>false);
async function dismissTalk(){ if(await vis("#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(40); await p.click("#talkContinue"); await p.waitForTimeout(40);} }
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
const cards=await p.$$(".club-card"); for(const c of cards){const n=await c.$eval(".club-name",e=>e.textContent); if(n.includes("Stockholm Exiles")){await c.click();break;}}
await p.waitForTimeout(150);
await p.click("#sponsorsBtn"); await p.waitForTimeout(150);
const offers=await p.$$eval("#sponsorsOffers .sponsor-card",e=>e.length);
const slots0=await p.$eval("#sponsorsSlots",e=>e.textContent);
const firstGoal=await p.$eval("#sponsorsOffers .sp-goals",e=>e.textContent.replace(/\s+/g," ").trim());
console.log("offers:", offers, "| slots:", slots0);
console.log("sample goals:", firstGoal.slice(0,120));
// sign two
const signBtns=await p.$$("#sponsorsOffers .sp-sign");
const names=[];
for(let i=0;i<Math.min(2,signBtns.length);i++){
  // re-query each time since DOM re-renders
  const btn=(await p.$$("#sponsorsOffers .sp-sign"))[0];
  const card=await btn.evaluateHandle(b=>b.closest(".sponsor-card"));
  const nm=await card.evaluate(c=>c.querySelector(".sp-name").textContent);
  names.push(nm);
  await btn.click(); await p.waitForTimeout(120);
}
const slots1=await p.$eval("#sponsorsSlots",e=>e.textContent);
const signedCount=await p.$$eval("#sponsorsSigned .sponsor-card",e=>e.length);
console.log("signed:", names, "| slots now:", slots1, "| signed cards:", signedCount);
await p.click("#sponsorsBack"); await p.waitForTimeout(80);
// play a home match & screenshot the boards
let guard=0;
while(guard++<10){ await p.click("#playRound"); await p.waitForTimeout(110);
  if(await vis("#kickOffBtn")){ await p.click("#kickOffBtn"); await p.waitForTimeout(200); await dismissTalk(); break; } }
await p.waitForTimeout(400);
const home=await p.$eval("#homeName",e=>e.textContent);
await p.screenshot({ path: `${SP}/sponsors-board.png` });
console.log("match:", home, "(boards visible if EXI home)");
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
