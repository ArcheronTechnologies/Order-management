import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const SP="/tmp/claude-0/-home-user-Order-management/2a3131ff-46b6-5482-ada9-842239e9342c/scratchpad";
const vis=(p,s)=>p.isVisible(s).catch(()=>false);
async function dismissTalk(p){ if(await vis(p,"#talkOverlay")){ await p.click(".talk-tone"); await p.waitForTimeout(40); await p.click("#talkContinue"); await p.waitForTimeout(40);} }
async function shotHomeMatch(clubName, file){
  const p = await b.newPage();
  p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(clubName+":"+m.text()); });
  p.on("pageerror", e=>errs.push(clubName+" PAGEERR: "+e.message));
  await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
  // pick the club by name across both grids
  const cards = await p.$$(".club-card");
  for(const c of cards){ const n=await c.$eval(".club-name",e=>e.textContent); if(n.includes(clubName)){ await c.click(); break; } }
  await p.waitForTimeout(150);
  // advance to a home fixture
  let guard=0, started=false;
  while(guard++<12){
    const btn = await p.$eval("#playRound", e=>e.textContent).catch(()=>"");
    // is the user home this round? click play; if select shows, check title
    await p.click("#playRound"); await p.waitForTimeout(120);
    if(await vis(p,"#kickOffBtn")){
      // we're in selection; kick off and screenshot regardless
      await p.click("#kickOffBtn"); await p.waitForTimeout(200); await dismissTalk(p);
      await p.waitForTimeout(400);
      started=true; break;
    }
  }
  await p.waitForTimeout(300);
  const home = await p.$eval("#homeName",e=>e.textContent);
  const away = await p.$eval("#awayName",e=>e.textContent);
  await p.screenshot({ path: `${SP}/${file}` });
  console.log(file, "->", home, "v", away, "| started:", started);
  await p.close();
}
await shotHomeMatch("Stockholm Exiles", "env-exi.png");
await shotHomeMatch("Borås", "env-bor.png");
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
