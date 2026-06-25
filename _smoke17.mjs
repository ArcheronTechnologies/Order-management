import { chromium } from "playwright";
const errs=[];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const p = await b.newPage();
p.on("console", m=>{ if(m.type()==="error" && !m.text().includes("404")) errs.push(m.text()); });
p.on("pageerror", e=>errs.push("PAGEERR: "+e.message));
await p.goto("http://localhost:4173/", { waitUntil:"networkidle" });
// pick a Division 1 club (free signings) - Borås
const cards=await p.$$(".club-card"); for(const c of cards){const n=await c.$eval(".club-name",e=>e.textContent); if(n.includes("Borås")){await c.click();break;}}
await p.waitForTimeout(150);
await p.click("#recruitBtn"); await p.waitForTimeout(150);
const onView=await p.isVisible("#recruitView");
const rows=await p.$$eval("#recruitBody tr",e=>e.length);
const squad0=await p.$eval("#recruitSquad",e=>e.textContent);
const note=await p.$eval("#recruitNote",e=>e.textContent);
const firstRow=await p.$eval("#recruitBody tr",e=>e.innerText.replace(/\s+/g," ").trim());
console.log("recruit view:", onView, "| pool rows:", rows, "|", squad0);
console.log("note:", note.slice(0,80));
console.log("first recruit:", firstRow.slice(0,90));
// sign first recruit
const signName = await p.$eval("#recruitBody tr td:nth-child(2) .full", e=>e.textContent);
await p.click("#recruitBody .rec-sign"); await p.waitForTimeout(150);
const squad1=await p.$eval("#recruitSquad",e=>e.textContent);
const rows1=await p.$$eval("#recruitBody tr",e=>e.length);
console.log("signed:", signName, "| now", squad1, "| pool rows:", rows1);
// confirm in squad view
await p.click("#recruitBack"); await p.waitForTimeout(80);
await p.click("#squadBtn"); await p.waitForTimeout(120);
const inSquad = await p.$$eval("#squadBody tr td:nth-child(2) .full", (els,nm)=>els.some(e=>e.textContent===nm), signName);
console.log("recruit now in squad:", inSquad);
// reload persistence
await p.reload({ waitUntil:"networkidle" }); await p.click("#squadBtn").catch(()=>{}); await p.waitForTimeout(120);
const stillThere = await p.$$eval("#squadBody tr td:nth-child(2) .full", (els,nm)=>els.some(e=>e.textContent===nm), signName);
console.log("still in squad after reload:", stillThere);
console.log("errors:", errs.length?JSON.stringify(errs):"NONE");
await b.close();
