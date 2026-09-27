import { chromium } from 'playwright';
import fs from 'fs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const items = [
  ['commonhelp-home.pdf', 'https://commonhelp.virginia.gov/', 'networkidle'],
  ['fairfax-energy-assistance.pdf', 'https://www.fairfaxcounty.gov/familyservices/public-assistance-employment-services/energy-assistance', 'networkidle'],
  ['fairfax-csp.pdf', 'https://www.fairfaxcounty.gov/neighborhood-community-services/coordinated-services-planning', 'networkidle'],
  ['fairfax-dfs-offices.pdf', 'https://www.fairfaxcounty.gov/familyservices/office-locations', 'networkidle'],
  ['211-koinonia.pdf', 'https://search.211virginia.org/search/2d0109d3-0a5f-53e1-b7f5-994d1ceff4db', 'networkidle'],
  ['211-salvation-army-fairfax.pdf', 'https://search.211virginia.org/search/690f8d35-137a-54e8-a292-adce5939537a', 'networkidle'],
  ['united-community-locations.pdf', 'https://www.unitedcommunity.org/locations/', 'networkidle'],
  ['211virginia-home.pdf', 'https://www.211virginia.org/', 'domcontentloaded'],
  ['chp-weatherization.pdf', 'https://www.communityhousingpartners.org/energy-solutions/weatherization/', 'domcontentloaded'],
  ['united-community-energyshare-vanavigator.pdf', 'https://virginianavigator.org/program/39664/heating-and-cooling-assistance-energyshare-program', 'domcontentloaded'],
];

const results = [];

async function run() {
  const browser = await chromium.launch();
  for (const [filename, url, waitStrategy] of items) {
    process.stdout.write(`=== ${filename} <- ${url} (${waitStrategy}) ===\n`);
    const context = await browser.newContext({ ignoreHTTPSErrors: true, userAgent: UA, viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: waitStrategy, timeout: 45000 });
      await page.waitForTimeout(3000);
      await page.pdf({ path: filename, printBackground: true, format: 'Letter' });
      process.stdout.write(`  OK -> ${filename}\n`);
      results.push({ filename, url, status: 'OK' });
    } catch (err) {
      process.stdout.write(`  FAILED: ${err.message}\n`);
      const pngName = filename.replace(/\.pdf$/, '.png');
      try {
        await page.screenshot({ path: pngName, fullPage: true });
        process.stdout.write(`  SCREENSHOT -> ${pngName}\n`);
        results.push({ filename: pngName, url, status: 'BLOCKED', note: err.message });
      } catch (err2) {
        results.push({ filename, url, status: 'FAILED', note: err.message });
      }
    }
    await context.close();
  }
  await browser.close();
  fs.writeFileSync('retry-results.json', JSON.stringify(results, null, 2));
  process.stdout.write('\nDONE\n');
}
run();
