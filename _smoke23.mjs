import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis=s=>p.isVisible(s).catch(()=>false);
p.on("dialog", d=>d.accept());
async function dismissTalk(){ if(await vis("#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(35); await p.click("#talkContinue"); await p.waitForTimeout(35);} }
async function simSeasonRoll(){ let g=0; while(g++<28){ const r=await p.$eval("#seasonRound",e=>e.textContent).catch(()=>""); if(r.includes("complete"))break;
  await p.click("#playRound"); await p.waitForTimeout(55);
  if(await vis("#kickOffBtn")){ await p.click("#kickOffBtn"); await p.waitForTimeout(70); await dismissTalk(); if(await vis("#simMatch"))await p.click("#simMatch"); await p.waitForTimeout(70); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(70); await dismissTalk(); } }
  await p.click("#playRound"); await p.waitForTimeout(160);
  if(await vis("#app")&&await vis("#simMatch")){ await dismissTalk(); await p.click("#simMatch"); await p.waitForTimeout(130); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(130);} }
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
const cards=await p.$$(".club-card"); for(const c of cards){const n=await c.$eval(".club-name",e=>e.textContent); if(n.includes("Stockholm Exiles")){await c.click();break;}}
await p.waitForTimeout(120);
await simSeasonRoll(); await simSeasonRoll(); // two rollovers
await p.click("#clubBtn"); await p.waitForTimeout(120);
const obs=await p.$$eval("#oldBoysList li",e=>e.map(x=>x.innerText.replace(/\s+/g," ").trim()).filter(t=>!t.includes("No old boys")));
console.log("old boys after 2 seasons:", obs.length);
obs.slice(0,6).forEach(o=>console.log("  ", o));
await p.click("#clubBack"); await p.waitForTimeout(50); await p.click("#financesBtn"); await p.waitForTimeout(90);
const don=await p.$$eval("#finIncome li",e=>e.map(x=>x.textContent).filter(t=>/donation/i.test(t)));
console.log("donations income line:", JSON.stringify(don));
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
