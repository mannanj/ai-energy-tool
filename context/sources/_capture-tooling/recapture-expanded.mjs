// Recapture Dominion pages with all accordions expanded; save PDF, full-DOM innerText, and raw HTML.
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const items = [
  ['dominion-scams', 'https://www.dominionenergy.com/safety/scams'],
];
const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36', viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
for (const [name, url] of items) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    // dismiss cookie banner if present
    for (const sel of ['button:has-text("Accept")', 'button:has-text("I Agree")', '#onetrust-accept-btn-handler']) { try { await page.locator(sel).first().click({ timeout: 1500 }); } catch {} }
    // expand every accordion / details / aria-expanded=false control
    const n = await page.evaluate(() => {
      let c = 0;
      document.querySelectorAll('details').forEach(d => { d.open = true; c++; });
      document.querySelectorAll('[aria-expanded="false"], .accordion-button.collapsed, button.collapsed, [data-toggle="collapse"], [data-bs-toggle="collapse"]').forEach(el => { try { el.click(); c++; } catch {} });
      document.querySelectorAll('.collapse:not(.show)').forEach(el => { el.classList.add('show'); el.style.display = 'block'; c++; });
      return c;
    });
    await page.waitForTimeout(2500);
    const text = await page.evaluate(() => document.body.innerText);
    const html = await page.content();
    writeFileSync(`../${name}.txt`, `SOURCE: ${url}\nCAPTURED: ${new Date().toISOString()} (accordions expanded: ${n})\n\n${text}`);
    writeFileSync(`../${name}.html`, html);
    await page.pdf({ path: `../${name}.pdf`, printBackground: true, format: 'Letter' });
    console.log(`${name}: OK expanded=${n} textChars=${text.length} has600=${text.includes('$600')} has10=${/\$10\b/.test(text)} has866=${text.includes('866-366-4357')}`);
  } catch (e) { console.log(`${name}: FAIL ${e.message}`); }
  await page.close();
}
await browser.close();
