import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
async function dismissTalk(){ if(await p.isVisible("#talkOverlay").catch(()=>0)){ await p.click(".talk-tone"); await p.waitForTimeout(60); await p.click("#talkContinue"); await p.waitForTimeout(60);} }
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
await p.click(".club-card"); await p.waitForTimeout(150);
await p.click("#playRound"); await p.waitForTimeout(150);
if(await p.isVisible("#kickOffBtn")) await p.click("#kickOffBtn"); await p.waitForTimeout(200);
await dismissTalk();
// let it play a bit at high speed
await p.selectOption("#speed", "30"); await p.waitForTimeout(2500);
const rows = await p.$$eval(".stat-row", e=>e.length);
const labels = await p.$$eval(".stat-label", e=>e.map(x=>x.textContent.replace(/\s+/g," ").trim()).filter(Boolean));
const possText = await p.$eval(".stat-row .sv", e=>e.textContent);
const panelText = await p.$eval("#statsPanel", e=>e.innerText.replace(/\n+/g," | "));
console.log("stat rows:", rows);
console.log("panel:", panelText);
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
