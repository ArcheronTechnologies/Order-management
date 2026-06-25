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
await p.selectOption("#speed","30"); await p.waitForTimeout(1500);
// open subs
const subsBtnVisible = await p.isVisible("#subsBtn");
await p.click("#subsBtn"); await p.waitForTimeout(200);
const overlayUp = await p.isVisible("#subsOverlay");
const offOpts = await p.$$eval("#subOff option", e=>e.length);
const onOpts = await p.$$eval("#subOn option", e=>e.map(x=>x.text));
const usedBefore = await p.$eval("#subsUsed", e=>e.textContent);
const offName = await p.$eval("#subOff", e=>e.options[e.selectedIndex].text);
const onName = await p.$eval("#subOn", e=>e.options[e.selectedIndex].text);
console.log("subsBtn visible:", subsBtnVisible, "| overlay:", overlayUp, "| off opts:", offOpts, "| bench opts:", onOpts.length);
console.log("used before:", usedBefore);
console.log("subbing OFF:", offName, "-> ON:", onName);
// make the sub
await p.click("#makeSubBtn"); await p.waitForTimeout(200);
const usedAfter = await p.$eval("#subsUsed", e=>e.textContent);
console.log("used after:", usedAfter);
// the on player should now be in off list (on field), removed from bench
const offOptsAfter = await p.$$eval("#subOff option", e=>e.map(x=>x.text));
const onNowOnField = offOptsAfter.some(t=>t.includes(onName.split("·")[1].trim()));
console.log("substituted player now on field:", onNowOnField);
await p.click("#subsClose"); await p.waitForTimeout(150);
const overlayClosed = !(await p.isVisible("#subsOverlay"));
// commentary mentions substitution
const comm = await p.$$eval("#events li", e=>e.map(x=>x.textContent));
const subInComm = comm.some(t=>/Substitution/i.test(t));
console.log("overlay closed:", overlayClosed, "| sub in commentary:", subInComm);
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
