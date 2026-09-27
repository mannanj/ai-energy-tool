import { chromium } from 'playwright';
import fs from 'fs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const items = [
  ['dss-pipp.pdf', 'https://www.dss.virginia.gov/relief/pipp/'],
  ['dss-energy-assistance.pdf', 'https://www.dss.virginia.gov/relief/ea/'],
  ['commonhelp-home.pdf', 'https://commonhelp.virginia.gov/'],
  ['dominion-energyshare.pdf', 'https://www.dominionenergy.com/virginia/paying-my-bill/billing-options/energyshare'],
  ['dominion-energy-assistance.pdf', 'https://www.dominionenergy.com/virginia/paying-my-bill/energy-assistance'],
  ['dominion-pipp.pdf', 'https://www.dominionenergy.com/virginia/paying-my-bill/billing-options/percentage-of-income-payment-program'],
  ['dominion-budget-billing.pdf', 'https://www.dominionenergy.com/virginia/paying-my-bill/billing-options/budget-billing'],
  ['dominion-medical-conditions.pdf', 'https://www.dominionenergy.com/virginia/start-stop-service/medical-conditions'],
  ['dominion-scams.pdf', 'https://www.dominionenergy.com/virginia/protect-yourself-from-scams'],
  ['fairfax-energy-assistance.pdf', 'https://www.fairfaxcounty.gov/familyservices/public-assistance-employment-services/energy-assistance'],
  ['fairfax-csp.pdf', 'https://www.fairfaxcounty.gov/neighborhood-community-services/coordinated-services-planning'],
  ['fairfax-dfs-offices.pdf', 'https://www.fairfaxcounty.gov/familyservices/public-assistance-employment-services/human-services-centers'],
  ['hhs-poverty-guidelines-2026.pdf', 'https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines'],
  ['scc-dominion-biennial-review-2025.pdf', 'https://www.scc.virginia.gov/about-the-scc/newsreleases/release/scc-issues-order-on-dev-biennial-review-2025/scc-rules-in-dev-biennial-review-case.html'],
  ['scc-electric-service-map.pdf', 'https://www.scc.virginia.gov/consumers/public-utility/electricity-faqs/regulated-companies-service-map/'],
  ['novec-about.pdf', 'https://www.novec.com/About_NOVEC/'],
  ['koinonia-emergency-assistance.pdf', 'http://www.koinoniacares.org/emergency-assistance.html'],
  ['211-koinonia.pdf', 'https://search.211virginia.org/search/2d0109d3-0a5f-53e1-b7f5-994d1ceff4db'],
  ['211-salvation-army-fairfax.pdf', 'https://search.211virginia.org/search/690f8d35-137a-54e8-a292-adce5939537a'],
  ['united-community-locations.pdf', 'https://www.unitedcommunity.org/locations/'],
  ['united-community-energyshare-vanavigator.pdf', 'https://virginianavigator.org/program/39664/heating-and-cooling-assistance-energyshare-program'],
  ['catholic-charities-utilities.pdf', 'https://ccda.net/find-help/emergency-assistance/utilities/'],
  ['chp-weatherization.pdf', 'https://www.communityhousingpartners.org/energy-solutions/weatherization/'],
  ['211virginia-home.pdf', 'https://www.211virginia.org/'],
];

const results = [];

async function attempt(browser, filename, url, useRealisticUA) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: useRealisticUA ? UA : undefined,
    viewport: useRealisticUA ? { width: 1366, height: 900 } : undefined,
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);
    const content = (await page.content()).toLowerCase();
    const title = (await page.title()).toLowerCase();
    const blocked = /cloudflare|attention required|checking your browser|access denied|are you a human|captcha/.test(content) ||
                    /just a moment|attention required/.test(title);
    if (blocked) {
      await context.close();
      return { blocked: true };
    }
    await page.pdf({ path: filename, printBackground: true, format: 'Letter' });
    await context.close();
    return { ok: true };
  } catch (err) {
    await context.close();
    return { error: err.message };
  }
}

async function run() {
  const browser = await chromium.launch();
  for (const [filename, url] of items) {
    process.stdout.write(`=== ${filename} <- ${url} ===\n`);
    let res = await attempt(browser, filename, url, false);
    if (res.blocked || res.error) {
      process.stdout.write(`  first attempt failed (${res.blocked ? 'blocked' : res.error}), retrying with realistic UA...\n`);
      res = await attempt(browser, filename, url, true);
    }
    if (res.ok) {
      process.stdout.write(`  OK -> ${filename}\n`);
      results.push({ filename, url, status: 'OK' });
    } else if (res.blocked) {
      process.stdout.write(`  BLOCKED, taking screenshot...\n`);
      const context = await browser.newContext({ ignoreHTTPSErrors: true, userAgent: UA, viewport: { width: 1366, height: 900 } });
      const page = await context.newPage();
      const pngName = filename.replace(/\.pdf$/, '.png');
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: pngName, fullPage: true });
        process.stdout.write(`  SCREENSHOT -> ${pngName}\n`);
        results.push({ filename: pngName, url, status: 'BLOCKED' });
      } catch (err) {
        process.stdout.write(`  SCREENSHOT FAILED: ${err.message}\n`);
        results.push({ filename, url, status: 'FAILED', note: err.message });
      }
      await context.close();
    } else {
      process.stdout.write(`  FAILED: ${res.error}\n`);
      results.push({ filename, url, status: 'FAILED', note: res.error });
    }
  }
  await browser.close();
  fs.writeFileSync('capture-results.json', JSON.stringify(results, null, 2));
  process.stdout.write('\nDONE\n');
}

run();
