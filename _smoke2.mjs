import { chromium } from "playwright";
const errs = [];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m => { if (m.type()==="error" && !m.text().includes("favicon")) errs.push(m.text()); });
p.on("pageerror", e => errs.push("PAGEERR: "+e.message));
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await p.click(".club-card"); await p.waitForTimeout(200);
// play your match -> team selection
await p.click("#playRound"); await p.waitForTimeout(200);
await p.click("#kickOffBtn"); await p.waitForTimeout(300);
// PRE-MATCH talk overlay should be visible
const overlayVisible = await p.isVisible("#talkOverlay");
const toneCount = await p.$$eval(".talk-tone", e=>e.length);
console.log("pre-talk overlay visible:", overlayVisible, "tones:", toneCount);
// pick a tone
await p.click(".talk-tone"); await p.waitForTimeout(150);
const reactRows = await p.$$eval("#talkReactionList li", e=>e.length);
const summary = await p.$eval("#talkSummary", e=>e.textContent).catch(()=>null);
console.log("reactions shown:", reactRows, "| summary:", summary);
await p.click("#talkContinue"); await p.waitForTimeout(150);
const overlayGone = !(await p.isVisible("#talkOverlay"));
console.log("overlay closed after continue:", overlayGone);
// speed up and sim to full time
await p.selectOption("#speed", "30");
// click Sim to fast-forward (but Sim bypasses half-time talk loop). Instead let it play a bit then Sim.
await p.waitForTimeout(500);
// detect half-time talk: wait for overlay to reappear during play
let halfSeen = false;
for (let i=0;i<40;i++){
  if (await p.isVisible("#talkOverlay")) { halfSeen=true; break; }
  await p.waitForTimeout(200);
}
console.log("half-time talk appeared:", halfSeen);
if (halfSeen){ await p.click(".talk-tone"); await p.waitForTimeout(100); await p.click("#talkContinue"); }
// now Sim to end
await p.waitForTimeout(200);
await p.click("#simMatch"); await p.waitForTimeout(300);
const finished = await p.$eval("#half", e=>e.textContent);
console.log("half label:", finished);
// continue -> full-time talk
await p.click("#backToSeason"); await p.waitForTimeout(200);
const ftTalk = await p.isVisible("#talkOverlay");
console.log("full-time talk visible:", ftTalk);
if (ftTalk){ await p.click(".talk-tone"); await p.waitForTimeout(100); await p.click("#talkContinue"); await p.waitForTimeout(200); }
const onSeason = await p.isVisible("#seasonView");
const snub = await p.$eval(".snub-note", e=> e.classList.contains("hidden") ? "(hidden)" : e.textContent).catch(()=>"(none)");
console.log("back on season:", onSeason, "| dressing-room note:", snub);
console.log("console errors:", errs.length ? JSON.stringify(errs) : "NONE");
await b.close();
