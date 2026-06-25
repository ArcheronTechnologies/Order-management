import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("pageerror", e => errs.push("PAGEERR: "+e.message));
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await p.click(".club-card"); await p.waitForTimeout(150);
await p.click("#playRound"); await p.waitForTimeout(150);
await p.click("#kickOffBtn"); await p.waitForTimeout(250);
await p.click(".talk-tone"); await p.waitForTimeout(100); await p.click("#talkContinue");
await p.selectOption("#speed", "30");
let halfSeen=false, t0=Date.now();
for (let i=0;i<120;i++){
  if (await p.isVisible("#talkOverlay")) { halfSeen=true; break; }
  await p.waitForTimeout(1000);
}
const clock = await p.$eval("#clock", e=>e.textContent);
const title = await p.$eval("#talkTitle", e=>e.textContent).catch(()=>null);
const ctx = await p.$eval("#talkContext", e=>e.textContent).catch(()=>null);
console.log("half-time talk appeared:", halfSeen, "after", Math.round((Date.now()-t0)/1000)+"s", "| clock", clock);
console.log("title:", title, "| context:", ctx);
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
