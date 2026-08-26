import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/* Resolve a chromium already on the machine rather than pinning a build number
   — playwright's expected build moves with its version, the installed one does
   not. CHROME_PATH wins if set. */
function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !fs.existsSync(root)) return undefined;
  for (const dir of fs.readdirSync(root).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
    const bin = path.join(root, dir, "chrome-linux", "chrome");
    if (fs.existsSync(bin)) return bin;
  }
  return undefined;
}

/* defaults to the local preview; point at a deploy with
   TJ_URL=https://… node scripts/smoke.mjs */
const URL = process.env.TJ_URL || "http://localhost:4173/";
const errors = [];
const exe = findChromium();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({ viewport: { width: 1024, height: 1366 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

const ok = (label, cond) => console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tj-nav", { timeout: 10000 });

// 1. all nine sections present in nav
const nav = await page.$$eval(".tj-navitem", (n) => n.map((x) => x.textContent.trim()));
const want = ["Today", "People", "Faith", "Journal", "Patterns", "Judgment", "Library", "Becoming", "Talk"];
ok(`nine sections in nav (${nav.join(", ")})`, want.every((w) => nav.includes(w)) && nav.length === 9);

// 2. each section renders
for (const label of want) {
  await page.click(`.tj-navitem:text-is("${label}")`);
  await page.waitForTimeout(320);
  const txt = (await page.textContent(".tj-main")) || "";
  ok(`${label} renders`, txt.trim().length > 40);
}

// 3. Judgment no longer offers Deals; Decisions/Calls/Language remain
await page.click('.tj-navitem:text-is("Judgment")');
await page.waitForTimeout(320);
const jTabs = await page.$$eval(".tj-seg .tj-tap", (n) => n.map((x) => x.textContent.trim()));
ok(`Judgment tabs = ${jTabs.join(", ")}`, !jTabs.includes("Deals") && ["Decisions", "Calls", "Language"].every((t) => jTabs.includes(t)));

// 4. themes: dawn on morning Today, dusk on Talk
await page.click('.tj-navitem:text-is("Today")');
await page.waitForTimeout(320);
const isMorning = await page.$$eval('.tj-seg .tj-tap', (n) => n.map((x) => x.textContent.trim()).includes("Morning"));
if (isMorning) await page.click('.tj-seg .tj-tap:text-is("Morning")');
await page.waitForTimeout(400);
ok("morning applies .tj-dawn", await page.$eval(".tj-root", (e) => e.classList.contains("tj-dawn")));
await page.click('.tj-navitem:text-is("Talk")');
await page.waitForTimeout(500);
ok("Talk applies .tj-dusk", await page.$eval(".tj-root", (e) => e.classList.contains("tj-dusk")));

// 5. typing survives a hard refresh
await page.click('.tj-navitem:text-is("Today")');
await page.waitForTimeout(350);
const g1 = await page.waitForSelector('[aria-label="Gratitude 1"]', { timeout: 5000 });
await g1.fill("Margo asleep on my shoulder");
await page.waitForTimeout(1200);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('[aria-label="Gratitude 1"]', { timeout: 10000 });
const after = await page.inputValue('[aria-label="Gratitude 1"]');
ok(`typing survives hard refresh (got "${after}")`, after === "Margo asleep on my shoulder");

// 6. the flush path: type, immediately change day, come back
const g1b = await page.waitForSelector('[aria-label="Gratitude 2"]');
await g1b.fill("The walk before the calls started");
await page.click('[aria-label="Previous day"]');   // inside the 700ms debounce
await page.waitForTimeout(500);
await page.click('[aria-label="Next day"]');
await page.waitForTimeout(900);
const back = await page.inputValue('[aria-label="Gratitude 2"]');
ok(`text written just before leaving the day survives (got "${back}")`, back === "The walk before the calls started");

// 7. AI affordance with no key reads as unavailable, and nothing crashes
await page.click('.tj-navitem:text-is("Patterns")');
await page.waitForTimeout(400);
const patterns = (await page.textContent(".tj-main")) || "";
ok("no key: Patterns still renders its counted layer", /Themes|Nothing counted yet/.test(patterns));

// 8. 640px reading measure intact
await page.click('.tj-navitem:text-is("Faith")');
await page.waitForTimeout(300);
const w = await page.$eval(".tj-main", (e) => e.getBoundingClientRect().width);
ok(`.tj-main stays at the 640 reading measure (${Math.round(w)}px)`, Math.round(w) <= 640);

// 9. export → fresh profile → import round trip
await page.click('.tj-navitem:text-is("Journal")');
await page.waitForTimeout(350);
const entry = await page.waitForSelector('[aria-label="Journal entry"]');
await entry.fill("A line I would be upset to lose in a restore.");
await page.click('button:text-is("Save entry")');
await page.waitForTimeout(1800);

await page.click('[aria-label="Settings"]');
await page.waitForTimeout(400);
await page.click('.tj-sheet .tj-tap:text-is("Data")');
await page.waitForTimeout(300);
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.click('text=Export everything as JSON'),
]);
const backup = path.join(os.tmpdir(), "tj3-backup.json");
await download.saveAs(backup);
const bundle = JSON.parse(fs.readFileSync(backup, "utf8"));
ok("export excludes the API key", !Object.keys(bundle.data || {}).includes("tj:apikey"));
ok(`export contains journal + day records (${Object.keys(bundle.data || {}).length} keys)`,
  Object.keys(bundle.data || {}).some((k) => k.startsWith("tj:journal:")) &&
  Object.keys(bundle.data || {}).some((k) => k.startsWith("tj:day:")));

// a genuinely fresh profile — new context, empty storage
const ctx2 = await browser.newContext({ viewport: { width: 1024, height: 1366 } });
const p2 = await ctx2.newPage();
p2.on("pageerror", (e) => errors.push("PAGEERROR(import): " + e.message));
await p2.goto(URL, { waitUntil: "networkidle" });
await p2.waitForSelector(".tj-nav", { timeout: 10000 });
await p2.click('[aria-label="Settings"]');
await p2.waitForTimeout(400);
await p2.click('.tj-sheet .tj-tap:text-is("Data")');
await p2.waitForTimeout(300);
await p2.setInputFiles('.tj-import input[type="file"]', backup);
await p2.waitForTimeout(1500);
await p2.click('.tj-navitem:text-is("Journal")');
await p2.waitForTimeout(600);
const restored = (await p2.textContent(".tj-main")) || "";
ok("fresh profile imports the backup with entries intact",
  restored.includes("A line I would be upset to lose in a restore."));

console.log(errors.length ? `\nCONSOLE ERRORS (${errors.length}):\n` + errors.join("\n") : "\nno console errors");
await browser.close();
