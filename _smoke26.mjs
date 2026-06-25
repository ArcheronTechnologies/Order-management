import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
const vis=s=>p.isVisible(s).catch(()=>false);
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
const cards=await p.$$(".club-card"); await cards[0].click(); await p.waitForTimeout(150);
await p.click("#playRound"); await p.waitForTimeout(150);
if(await vis("#kickOffBtn")){ await p.click("#kickOffBtn"); await p.waitForTimeout(250); }
// press conference should appear first
const pressUp = await vis("#pressOverlay");
const q = await p.$eval("#pressQuestion", e=>e.textContent).catch(()=>"");
const tones = await p.$$eval("#pressTones .talk-tone", e=>e.map(x=>x.textContent.replace(/\s+/g," ").trim()));
console.log("press overlay:", pressUp, "| context:", await p.$eval("#pressContext",e=>e.textContent).catch(()=>""));
console.log("question:", q);
console.log("tones:", JSON.stringify(tones));
// answer confident
await p.click("#pressTones .talk-tone"); await p.waitForTimeout(150);
const pressGone = !(await vis("#pressOverlay"));
const talkUp = await vis("#talkOverlay");
console.log("after answer: press gone:", pressGone, "| team talk up:", talkUp);
// dismiss team talk
if(talkUp){ await p.click("#talkTones .talk-tone"); await p.waitForTimeout(80); await p.click("#talkContinue"); await p.waitForTimeout(80);}
const playing = await vis("#app");
console.log("match playing view:", playing);
// check inbox for presser line
await p.click("#simMatch"); await p.waitForTimeout(150);
await p.click("#backToSeason"); await p.waitForTimeout(120);
if(await vis("#talkOverlay")){ await p.click("#talkTones .talk-tone").catch(()=>{}); await p.waitForTimeout(60); await p.click("#talkContinue").catch(()=>{}); await p.waitForTimeout(120);}
await p.click("#newsBtn").catch(()=>{}); await p.waitForTimeout(100);
const pressNews = await p.$$eval("#newsList li", e=>e.map(x=>x.textContent).filter(t=>/Presser/i.test(t)));
console.log("presser in inbox:", JSON.stringify(pressNews.slice(0,1)));
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
