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

/* The service worker update prompt used to reload without activating the
   waiting worker, so it reappeared on every load forever. Nothing in this app
   should ever raise a blocking dialog. */
const dialogs = [];
page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });

const ok = (label, cond) => console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tj-nav", { timeout: 10000 });

// 1. the five sections are all present
const nav = await page.$$eval(".tj-navitem", (n) => n.map((x) => x.textContent.trim()));
const want = ["Today", "Areas", "Journal", "Review", "Talk"];
ok(`five sections in nav (${nav.join(", ")})`, want.every((w) => nav.includes(w)) && nav.length === 5);

// 2. each section renders
for (const label of want) {
  await page.click(`.tj-navitem:text-is("${label}")`);
  await page.waitForTimeout(320);
  const txt = (await page.textContent(".tj-main")) || "";
  ok(`${label} renders`, txt.trim().length > 40);
}

// 3. the nav fits without scrolling, and every target is reachable
const navBox = await page.$eval(".tj-nav-scroll", (e) => ({ sw: e.scrollWidth, cw: e.clientWidth }));
ok(`nav fits without scrolling (${navBox.sw} <= ${navBox.cw})`, navBox.sw <= navBox.cw + 1);
const small = await page.$$eval(".tj-navitem", (n) => n.filter((x) => x.getBoundingClientRect().height < 44).length);
ok(`every nav target is at least 44px tall (${small} under)`, small === 0);

// 4. the eleven areas are there, grouped, with seasons
await page.click('.tj-navitem:text-is("Areas")');
await page.waitForTimeout(400);
const areasText = (await page.textContent(".tj-main")) || "";
const areas = ["Body", "Money", "Home", "Play & rest", "Marriage", "Fatherhood", "Friendship", "Work", "Mind", "Faith", "Character"];
const missingAreas = areas.filter((a) => !areasText.includes(a));
ok(`eleven areas present${missingAreas.length ? " — missing " + missingAreas.join(", ") : ""}`, missingAreas.length === 0);
ok("grouped under the four Becoming buckets",
  ["Foundation", "Relationships", "Performance", "Identity"].every((g) => areasText.includes(g)));

// 5. focus is capped at three
for (const a of ["Body", "Money", "Home", "Marriage"]) {
  const row = page.locator(`.tj-main >> text=${a}`).first();
  await row.scrollIntoViewIfNeeded();
}
const focusBtns = await page.$$('.tj-main .tj-tap');
let clicked = 0;
for (const b of focusBtns) {
  if ((await b.textContent())?.trim() === "in focus" && clicked < 4) { await b.click().catch(() => {}); clicked++; await page.waitForTimeout(120); }
}
const focusNote = (await page.textContent(".tj-main")) || "";
ok("focus is capped at three", /3 of 3/.test(focusNote));

// 6. an area opens and offers its own record
await page.click('.tj-main >> text=Body');
await page.waitForTimeout(400);
const body = (await page.textContent(".tj-main")) || "";
ok("an area opens with stands / better / next", /Where it stands/.test(body) && /The next actual move/.test(body));
ok("an area carries its daily prompts", /Sleep/.test(body) && /Training/.test(body));

// 7. Review absorbed Patterns, decisions and the level check
await page.click('.tj-navitem:text-is("Review")');
await page.waitForTimeout(400);
const review = (await page.textContent(".tj-main")) || "";
ok("Review holds the old Patterns tabs plus decisions and the level check",
  ["Insights", "Blind spots", "Experiments", "Decisions", "Week", "Month", "Level check"].every((t) => review.includes(t)));

// 8. themes: dawn on morning Today, dusk on Talk
await page.click('.tj-navitem:text-is("Today")');
await page.waitForTimeout(320);
const isMorning = await page.$$eval('.tj-seg .tj-tap', (n) => n.map((x) => x.textContent.trim()).includes("Morning"));
if (isMorning) await page.click('.tj-seg .tj-tap:text-is("Morning")');
await page.waitForTimeout(400);
ok("morning applies .tj-dawn", await page.$eval(".tj-root", (e) => e.classList.contains("tj-dawn")));
await page.click('.tj-navitem:text-is("Talk")');
await page.waitForTimeout(500);
ok("Talk applies .tj-dusk", await page.$eval(".tj-root", (e) => e.classList.contains("tj-dusk")));

// 9. typing survives a hard refresh
await page.click('.tj-navitem:text-is("Today")');
await page.waitForTimeout(350);
const g1 = await page.waitForSelector('[aria-label="Gratitude 1"]', { timeout: 5000 });
await g1.fill("Margo asleep on my shoulder");
await page.waitForTimeout(1200);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('[aria-label="Gratitude 1"]', { timeout: 10000 });
const after = await page.inputValue('[aria-label="Gratitude 1"]');
ok(`typing survives hard refresh (got "${after}")`, after === "Margo asleep on my shoulder");

// 10. the flush path: type, immediately change day, come back
const g1b = await page.waitForSelector('[aria-label="Gratitude 2"]');
await g1b.fill("The walk before the calls started");
await page.click('[aria-label="Previous day"]');   // inside the 700ms debounce
await page.waitForTimeout(500);
await page.click('[aria-label="Next day"]');
await page.waitForTimeout(900);
const back = await page.inputValue('[aria-label="Gratitude 2"]');
ok(`text written just before leaving the day survives (got "${back}")`, back === "The walk before the calls started");

// 11. AI affordance with no key reads as unavailable, and nothing crashes
await page.click('.tj-navitem:text-is("Review")');
await page.waitForTimeout(400);
const patterns = (await page.textContent(".tj-main")) || "";
ok("no key: Review still renders its counted layer", /Themes|Nothing counted yet/.test(patterns));

// 12. 640px reading measure intact
await page.click('.tj-navitem:text-is("Journal")');
await page.waitForTimeout(300);
const w = await page.$eval(".tj-main", (e) => e.getBoundingClientRect().width);
ok(`.tj-main stays at the 640 reading measure (${Math.round(w)}px)`, Math.round(w) <= 640);

// 13. export → fresh profile → import round trip
await page.click('.tj-navitem:text-is("Journal")');
await page.waitForTimeout(350);
/* tapping the field drops the app into distraction-free focus mode, which
   remounts the textarea — so click, let it settle, then type like a person */
await page.click('[aria-label="Journal entry"]');
await page.waitForTimeout(400);
await page.keyboard.type("A line I would be upset to lose in a restore.");
await page.waitForTimeout(300);
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

// 14. the serif face is actually served by the app, not silently falling back
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tj-nav", { timeout: 10000 });
const fontOk = await page.evaluate(async () => {
  await document.fonts.ready;
  return Array.from(document.fonts).some(
    (f) => f.family.includes("Newsreader") && f.status === "loaded"
  );
});
ok("self-hosted Newsreader loads (design does not fall back to Georgia)", fontOk);
const thirdParty = await page.evaluate(() =>
  performance.getEntriesByType("resource")
    .map((r) => new URL(r.name).host)
    .filter((h) => h && h !== location.host)
);
ok(`no third-party requests${thirdParty.length ? " — " + [...new Set(thirdParty)].join(", ") : ""}`, thirdParty.length === 0);

// 15. no blocking dialogs anywhere in that whole run, including across reloads
ok(`no blocking dialogs${dialogs.length ? " — saw: " + dialogs.join(" | ") : ""}`, dialogs.length === 0);


// 16. the data half: areas track numbers, not just feelings
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".tj-nav", { timeout: 10000 });
await page.click('.tj-navitem:text-is("Areas")');
await page.waitForTimeout(400);
await page.click('.tj-main >> text=Body');
await page.waitForTimeout(500);
const bodyPage = (await page.textContent(".tj-main")) || "";
ok("an area leads with stat tiles", /Sleep/.test(bodyPage) && /Weight/.test(bodyPage) && /Energy/.test(bodyPage));
ok("an area offers a trend with ranges", /Trend/.test(bodyPage) && /30d/.test(bodyPage) && /1y/.test(bodyPage));
ok("an area offers a log for today", /Log today/.test(bodyPage));

// log two numbers and confirm they persist and plot
const nums = await page.$$(".tj-num");
ok(`numeric inputs render (${nums.length})`, nums.length >= 2);
await nums[0].fill("7.5");
await page.waitForTimeout(200);
await nums[1].fill("182");
await page.waitForTimeout(1800);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".tj-nav", { timeout: 10000 });
await page.click('.tj-navitem:text-is("Areas")');
await page.waitForTimeout(400);
await page.click('.tj-main >> text=Body');
await page.waitForTimeout(500);
const again = await page.$$eval(".tj-num", (n) => n.map((x) => x.value));
ok(`logged metrics survive a reload (${again.slice(0, 2).join(", ")})`, again[0] === "7.5" && again[1] === "182");
/* one day of data draws nothing, correctly — a trend needs days. Log across
   three of them and confirm the chart then appears. */
ok("a single day shows the empty trend state rather than a misleading line",
  /Not enough logged yet/.test((await page.textContent(".tj-main")) || ""));
for (const v of ["7.0", "8.0"]) {
  await page.click('[aria-label="Previous day"]');
  await page.waitForTimeout(600);
  const n = await page.$$(".tj-num");
  await n[0].fill(v);
  await page.waitForTimeout(1700);
}
/* the trend window ends on the day being viewed, so come back to today
   before asking whether three days of data plot */
await page.click('[aria-label="Next day"]');
await page.waitForTimeout(500);
await page.click('[aria-label="Next day"]');
await page.waitForTimeout(900);
const svgs = await page.$$eval(".tj-main svg", (n) => n.length);
ok(`charts render as inline svg once there are days to plot (${svgs})`, svgs > 0);
const polyline = await page.$$eval(".tj-main svg path", (n) => n.filter((x) => (x.getAttribute("d") || "").includes("L")).length);
ok(`the trend draws a real line (${polyline} paths)`, polyline > 0);

// 17. journal reads like a product, not a form
await page.click('.tj-navitem:text-is("Journal")');
await page.waitForTimeout(450);
const j = (await page.textContent(".tj-main")) || "";
ok("journal leads with counted stats", /Days written/.test(j) && /Current run/.test(j) && /Words kept/.test(j));
ok("journal offers write / by hand / history", /Write/.test(j) && /By hand/.test(j) && /History/.test(j));
ok("journal offers prompt cards", (await page.$$(".tj-prompt")).length >= 6);


console.log(errors.length ? `\nCONSOLE ERRORS (${errors.length}):\n` + errors.join("\n") : "\nno console errors");
await browser.close();
