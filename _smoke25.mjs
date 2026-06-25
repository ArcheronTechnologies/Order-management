import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
// pick Uppsala (university club) for a strong academy
const cards=await p.$$(".club-card"); for(const c of cards){const n=await c.$eval(".club-name",e=>e.textContent); if(n.includes("Uppsala")){await c.click();break;}}
await p.waitForTimeout(150);
await p.click("#youthBtn"); await p.waitForTimeout(120);
const rows=await p.$$eval("#youthBody tr",e=>e.length);
const squad0=await p.$eval("#youthSquad",e=>e.textContent);
const first=await p.$eval("#youthBody tr",e=>e.innerText.replace(/\s+/g," ").trim());
console.log("academy intake rows:", rows, "|", squad0);
console.log("first graduate:", first.slice(0,90));
const name=await p.$eval("#youthBody tr td:nth-child(2) .full",e=>e.textContent);
await p.click("#youthBody .yp-promote"); await p.waitForTimeout(120);
console.log("after promote:", await p.$eval("#youthSquad",e=>e.textContent), "| rows:", await p.$$eval("#youthBody tr",e=>e.length));
// confirm in squad
await p.click("#youthBack"); await p.waitForTimeout(60); await p.click("#squadBtn"); await p.waitForTimeout(100);
const inSquad=await p.$$eval("#squadBody tr td:nth-child(2) .full",(els,nm)=>els.some(e=>e.textContent===nm),name);
console.log("graduate in squad:", inSquad);
// reload persistence
await p.reload({ waitUntil:"networkidle" }); await p.click("#squadBtn").catch(()=>{}); await p.waitForTimeout(100);
const still=await p.$$eval("#squadBody tr td:nth-child(2) .full",(els,nm)=>els.some(e=>e.textContent===nm),name);
console.log("still in squad after reload:", still);
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
