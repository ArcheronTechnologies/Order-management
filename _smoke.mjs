import { chromium } from "playwright";
const errs = [];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
p.on("pageerror", e => errs.push("PAGEERR: "+e.message));
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
// pick first club
await p.click(".club-card");
await p.waitForTimeout(300);
// squad view
const squadBtn = await p.$("#squadBtn");
if (squadBtn) { await squadBtn.click(); await p.waitForTimeout(300); }
const rows = await p.$$eval("#squadBody tr", rs => rs.length);
const tags = await p.$$eval(".tag", ts => ts.map(t=>t.textContent));
const repNote = await p.$eval(".rep-note", e=>e.textContent).catch(()=>null);
console.log("squad rows:", rows);
console.log("tags:", JSON.stringify(tags));
console.log("repNote (from season view):", repNote);
console.log("console errors:", errs.length ? JSON.stringify(errs) : "NONE");
await b.close();
