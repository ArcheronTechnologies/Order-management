import { chromium } from "playwright";
const errs = [];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", (e) => errs.push("PAGEERR: " + e.message));
const vis = (s) => p.isVisible(s).catch(() => false);
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
const cards = await p.$$(".club-card"); await cards[0].click(); await p.waitForTimeout(150);

await p.click("#playRound"); await p.waitForTimeout(150);
if (await vis("#kickOffBtn")) { await p.click("#kickOffBtn"); await p.waitForTimeout(250); }
// pre-match club-page post
const preTitle = await p.$eval("#pressTitle", (e) => e.textContent).catch(() => "");
const prePrompt = await p.$eval("#pressQuestion", (e) => e.textContent).catch(() => "");
console.log("pre-match title:", preTitle);
console.log("pre-match prompt:", prePrompt);
if (await vis("#pressOverlay")) { await p.click("#pressTones .talk-tone"); await p.waitForTimeout(150); }
if (await vis("#talkOverlay")) { await p.click("#talkTones .talk-tone"); await p.waitForTimeout(80); await p.click("#talkContinue"); await p.waitForTimeout(120); }
if (await vis("#simMatch")) { await p.click("#simMatch"); }
await p.waitForTimeout(400);
await p.click("#backToSeason"); await p.waitForTimeout(200);
if (await vis("#talkOverlay")) { await p.click("#talkTones .talk-tone"); await p.waitForTimeout(80); await p.click("#talkContinue"); await p.waitForTimeout(150); }
const postTitle = await p.$eval("#pressTitle", (e) => e.textContent).catch(() => "");
console.log("full-time title:", postTitle);
if (await vis("#pressOverlay")) { await p.click("#pressTones .talk-tone"); await p.waitForTimeout(150); }

await p.click("#newsBtn").catch(() => {}); await p.waitForTimeout(150);
const news = await p.$$eval("#newsList li", (e) => e.map((x) => x.textContent));
console.log("club-page lines:", JSON.stringify(news.filter((t) => /Club page/i.test(t)).slice(0, 2)));
console.log("player social lines:", JSON.stringify(news.filter((t) => /🗨️/.test(t)).slice(0, 2)));
console.log("any old media tags (should be empty):", JSON.stringify(news.filter((t) => /Presser|Post-match:|📰|pundit/i.test(t)).slice(0, 2)));
console.log("errors:", errs.length ? JSON.stringify(errs) : "NONE");
await b.close();
