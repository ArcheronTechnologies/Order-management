import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
await p.click(".club-card"); await p.waitForTimeout(150);
await p.click("#squadBtn"); await p.waitForTimeout(200);
const badges = await p.$$eval(".role-badge", e=>e.map(x=>x.textContent));
const capSel = await p.$eval("#roleCaptain", e=>e.options[e.selectedIndex].text);
const kickOpts = await p.$$eval("#roleKicker option", e=>e.length);
const loOpts = await p.$$eval("#roleLineout option", e=>e.length); // forwards only -> fewer
console.log("role badges in table:", JSON.stringify(badges));
console.log("captain select shows:", capSel, "| kicker options:", kickOpts, "| lineout options (fwds):", loOpts);
// reassign captain to a different option
await p.selectOption("#roleCaptain", { index: 5 }); await p.waitForTimeout(200);
const newCap = await p.$eval("#roleCaptain", e=>e.options[e.selectedIndex].text);
const capBadgeCount = await p.$$eval(".role-badge.cap", e=>e.length);
console.log("after reassign captain ->", newCap, "| cap badges:", capBadgeCount);
// reload -> persisted?
await p.reload({ waitUntil:"networkidle" });
await p.click("#squadBtn"); await p.waitForTimeout(200);
const persistedCap = await p.$eval("#roleCaptain", e=>e.options[e.selectedIndex].text);
console.log("captain after reload:", persistedCap, "| persisted:", persistedCap===newCap);
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
