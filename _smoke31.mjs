import { chromium } from "playwright";
const errs = [];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", (e) => errs.push("PAGEERR: " + e.message));
const vis = (s) => p.isVisible(s).catch(() => false);
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
const cards = await p.$$(".club-card"); await cards[0].click(); await p.waitForTimeout(150);

await p.click("#youthBtn"); await p.waitForTimeout(150);
const intake0 = await p.$$eval("#youthBody .yp-academy", (e) => e.length);
const acad0 = await p.$$eval("#academyBody tr", (e) => e.length);
console.log("graduates with U18/U20 button:", intake0, "| academy rows (empty msg = 1):", acad0);
if (intake0 === 0) { console.log("no graduates this club/seed — skipping"); await b.close(); process.exit(0); }

// send first graduate to U18/U20
await p.click("#youthBody .yp-academy"); await p.waitForTimeout(150);
const acad1 = await p.$$eval("#academyBody .ap-promote", (e) => e.length);
console.log("after send -> academy promote buttons:", acad1);

// reload, persistence check
await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(200);
await p.click("#youthBtn").catch(() => {}); await p.waitForTimeout(150);
const acadAfterReload = await p.$$eval("#academyBody .ap-promote", (e) => e.length);
console.log("academy after reload:", acadAfterReload);

// promote one from academy to seniors
const before = acadAfterReload;
await p.click("#academyBody .ap-promote"); await p.waitForTimeout(150);
const acadAfterPromote = await p.$$eval("#academyBody .ap-promote", (e) => e.length);
console.log("academy after promote:", acadAfterPromote, "(was", before + ")");

// inbox lines
await p.click("#youthBack").catch(() => {}); await p.waitForTimeout(80);
await p.click("#newsBtn").catch(() => {}); await p.waitForTimeout(120);
const news = await p.$$eval("#newsList li", (e) => e.map((x) => x.textContent));
console.log("academy news:", JSON.stringify(news.filter((t) => /U18\/U20|steps up/i.test(t)).slice(0, 2)));
console.log("errors:", errs.length ? JSON.stringify(errs) : "NONE");
await b.close();
