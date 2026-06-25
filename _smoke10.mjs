import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
await p.click(".club-card"); await p.waitForTimeout(150);
// open sevens cup
await p.click("#sevensBtn"); await p.waitForTimeout(200);
const onSevens = await p.isVisible("#sevensView");
const ties = await p.$$eval(".bt-tie", e=>e.length);
const round = await p.$eval("#sevensRound", e=>e.textContent);
console.log("sevens view:", onSevens, "| ties shown:", ties, "| round:", round);
// play your QF tie
await p.click("#sevensPlay"); await p.waitForTimeout(250);
const inMatch = await p.isVisible("#app");
const half = await p.$eval("#half", e=>e.textContent);
console.log("in 7s match:", inMatch, "| half:", half);
// sim to finish
await p.click("#simMatch"); await p.waitForTimeout(300);
const fin = await p.$eval("#half", e=>e.textContent);
const sc = await p.$eval("#homeScore", e=>e.textContent)+"-"+await p.$eval("#awayScore", e=>e.textContent);
console.log("after sim:", fin, "score", sc);
// continue back to cup
await p.click("#backToSeason"); await p.waitForTimeout(300);
const backCup = await p.isVisible("#sevensView");
let round2 = await p.$eval("#sevensRound", e=>e.textContent);
console.log("back on cup:", backCup, "| now:", round2);
// sim remaining rounds to completion
let guard=0;
while(guard++<6){
  const complete = (await p.$eval("#sevensRound", e=>e.textContent)).includes("complete");
  if (complete) break;
  // play or sim
  if (await p.isVisible("#sevensPlay")) { await p.click("#sevensPlay"); await p.waitForTimeout(200); if(await p.isVisible("#simMatch")){await p.click("#simMatch"); await p.waitForTimeout(250);} if(await p.isVisible("#backToSeason")){await p.click("#backToSeason"); await p.waitForTimeout(250);} }
  else if (await p.isVisible("#sevensSim")) { await p.click("#sevensSim"); await p.waitForTimeout(250); }
  else break;
}
const champ = await p.$eval("#sevensChampion", e=> e.classList.contains("hidden")?"(none)":e.textContent).catch(()=>"(none)");
const finalRound = await p.$eval("#sevensRound", e=>e.textContent);
console.log("final:", finalRound, "| champion:", champ);
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
