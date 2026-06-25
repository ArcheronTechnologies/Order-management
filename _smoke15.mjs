import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis=s=>p.isVisible(s).catch(()=>false);
async function dismissTalk(){ if(await vis("#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(40); await p.click("#talkContinue"); await p.waitForTimeout(40);} }
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
// pick SPA (Spartacus, Allsvenskan South, facilities 2)
const grids=await p.$$(".club-grid-inner"); const cards=await grids[0].$$(".club-card");
let spa=null; for(const c of cards){const n=await c.$eval(".club-name",e=>e.textContent); if(n.includes("Spartacus")){spa=c;break;}}
await spa.click(); await p.waitForTimeout(150);
await p.click("#financesBtn"); await p.waitForTimeout(120);
console.log("start:", await p.$eval("#finFacilities",e=>e.textContent.replace(/\s+/g," ").trim()));
console.log("upgrade btn:", await p.$eval("#finUpgrade",e=>e.textContent), "| disabled:", await p.$eval("#finUpgrade",e=>e.disabled));
await p.click("#financesBack"); await p.waitForTimeout(80);
// sim one season + rollover to bank income
let guard=0;
while(guard++<30){ const r=await p.$eval("#seasonRound",e=>e.textContent).catch(()=>""); if(r.includes("complete"))break;
  await p.click("#playRound"); await p.waitForTimeout(75);
  if(await vis("#kickOffBtn")){ await p.click("#kickOffBtn"); await p.waitForTimeout(100); await dismissTalk(); if(await vis("#simMatch"))await p.click("#simMatch"); await p.waitForTimeout(100); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(100); await dismissTalk(); } }
await p.click("#playRound"); await p.waitForTimeout(180);
if(await vis("#app")&&await vis("#simMatch")){ await dismissTalk(); await p.click("#simMatch"); await p.waitForTimeout(180); if(await vis("#backToSeason"))await p.click("#backToSeason"); await p.waitForTimeout(180);} 
await p.click("#financesBtn"); await p.waitForTimeout(120);
const bal1=await p.$eval("#finBalance",e=>e.textContent);
const upTxt=await p.$eval("#finUpgrade",e=>e.textContent);
const upDis=await p.$eval("#finUpgrade",e=>e.disabled);
console.log("after S1:", bal1, "| upgrade:", upTxt, "| disabled:", upDis);
if(!upDis){
  await p.click("#finUpgrade"); await p.waitForTimeout(150);
  console.log("after upgrade:", await p.$eval("#finFacilities",e=>e.textContent.replace(/\s+/g," ").trim()), "|", await p.$eval("#finBalance",e=>e.textContent));
  // persist
  await p.reload({ waitUntil:"networkidle" }); await p.click("#financesBtn").catch(()=>{}); await p.waitForTimeout(120);
  console.log("after reload facilities:", await p.$eval("#finFacilities",e=>e.textContent.replace(/\s+/g," ").trim()));
}
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
