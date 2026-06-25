import { chromium } from "playwright";
const errs = [];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", (e) => errs.push("PAGEERR: " + e.message));
const vis = (s) => p.isVisible(s).catch(() => false);
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
const cards = await p.$$(".club-card"); await cards[0].click(); await p.waitForTimeout(150);

// calendar
await p.click("#calendarBtn"); await p.waitForTimeout(150);
const calRows = await p.$$eval("#calendarList li", (e) => e.length);
const calTitle = await p.$eval("#calendarTitle", (e) => e.textContent);
const miles = await p.$$eval(".cal-mile", (e) => e.map((x) => x.textContent));
console.log("calendar rows:", calRows, "| title:", calTitle, "| milestones:", JSON.stringify(miles));
await p.click("#calendarBack"); await p.waitForTimeout(100);

// compare
await p.click("#compareBtn"); await p.waitForTimeout(150);
const optsA = await p.$$eval("#compareA option", (e) => e.length);
const cmpRows = await p.$$eval(".cmp-row", (e) => e.length);
// switch player B to a different option and confirm grid updates
const bVals = await p.$$eval("#compareB option", (e) => e.map((x) => x.value));
await p.selectOption("#compareB", bVals[bVals.length - 1]); await p.waitForTimeout(120);
const headTxt = await p.$eval(".cmp-head", (e) => e.textContent.replace(/\s+/g, " ").trim());
console.log("compare optsA:", optsA, "| attr rows:", cmpRows);
console.log("compare head:", headTxt.slice(0, 80));
await p.click("#compareBack"); await p.waitForTimeout(100);

// pedia
await p.click("#pediaBtn"); await p.waitForTimeout(150);
const secs = await p.$$eval(".pedia-sec h3", (e) => e.map((x) => x.textContent));
const entries = await p.$$eval(".pedia-entry", (e) => e.length);
console.log("pedia sections:", JSON.stringify(secs), "| entries:", entries);
await p.click("#pediaBack"); await p.waitForTimeout(100);
const backToSeason = await vis("#seasonView");
console.log("returned to season:", backToSeason);

console.log("errors:", errs.length ? JSON.stringify(errs) : "NONE");
await b.close();
