import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
await p.click(".club-card"); await p.waitForTimeout(200);
const intenOpts = await p.$$eval("#trainIntensity option", e=>e.map(x=>x.value));
const focusOpts = await p.$$eval("#trainFocus option", e=>e.map(x=>x.value));
console.log("intensity opts:", JSON.stringify(intenOpts), "| focus opts:", JSON.stringify(focusOpts));
await p.selectOption("#trainIntensity", "hard");
await p.selectOption("#trainFocus", "setpiece");
const hint = await p.$eval("#trainHint", e=>e.textContent);
console.log("hint after hard:", hint);
// play one match to trigger training, check note
async function dismissTalk(){ if(await p.isVisible("#talkOverlay").catch(()=>0)){ await p.click(".talk-tone"); await p.waitForTimeout(60); await p.click("#talkContinue"); await p.waitForTimeout(60);} }
await p.click("#playRound"); await p.waitForTimeout(150);
if(await p.isVisible("#kickOffBtn")) await p.click("#kickOffBtn"); await p.waitForTimeout(200);
await dismissTalk();
if(await p.isVisible("#simMatch")) await p.click("#simMatch"); await p.waitForTimeout(150);
if(await p.isVisible("#backToSeason")) await p.click("#backToSeason"); await p.waitForTimeout(150);
await dismissTalk(); await p.waitForTimeout(200);
const note = await p.$eval(".snub-note", e=> e.classList.contains("hidden")?"(hidden)":e.textContent).catch(()=>"(none)");
console.log("note after round (should mention training 💪):", note);
// reload persistence of training plan
await p.reload({ waitUntil:"networkidle" });
const inten2 = await p.$eval("#trainIntensity", e=>e.value);
const focus2 = await p.$eval("#trainFocus", e=>e.value);
console.log("after reload intensity:", inten2, "focus:", focus2, "| persisted:", inten2==="hard"&&focus2==="setpiece");
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
