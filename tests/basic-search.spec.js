import { test, expect } from '@playwright/test';

// Click consent top-level or inside common consent iframes (Firefox/WebKit often use one)
async function acceptConsentEverywhere(page) {
  // Top-level
  const top = page.locator([
    'button#bnp_btn_accept',
    'button:has-text("Accept all")',
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    '[role="dialog"] button:has-text("Accept")',
    '[aria-label*="Accept"]'
  ].join(', '));

  if (await top.first().isVisible().catch(() => false)) {
    await top.first().click().catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
  } else {
    // Common consent iframes
    const frameLoc = page.frameLocator([
      'iframe[id^="bnp"]',
      'iframe#bnp_container',
      'iframe[title*="privacy"]',
      'iframe[title*="consent"]',
      'iframe[src*="consent"]',
      'iframe[id^="sp_message_iframe"]'
    ].join(', '));

    const inFrame = frameLoc.locator([
      '#bnp_btn_accept',
      'button:has-text("Accept all")',
      'button:has-text("Accept")',
      'button:has-text("I agree")'
    ].join(', '));

    if (await inFrame.first().isVisible().catch(() => false)) {
      await inFrame.first().click().catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
    } else {
      // As a belt-and-braces fallback: try *any* frame for a visible Accept
      for (const f of page.frames()) {
        const btn = f.locator('button:has-text("Accept"), button:has-text("Accept all"), button:has-text("I agree")');
        if (await btn.first().isVisible().catch(() => false)) {
          await btn.first().click().catch(() => {});
          await page.waitForLoadState('networkidle').catch(() => {});
          break;
        }
      }
    }
  }
}

test.describe('Bing search (robust)', () => {
  test('Search Microsoft Playwright on Bing', async ({ page }) => {
    // 1) Navigate & settle
    await page.goto('https://www.bing.com', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 });

    // 2) Accept cookies (top-level or iframe)
    await acceptConsentEverywhere(page);

    // 3) Target ONLY visible search controls (input/textarea/contenteditable)
    const searchBox = page.locator([
      'form[role="search"] input:visible',
      'form[role="search"] textarea:visible',
      'form[role="search"] [contenteditable="true"]:visible',
      'input#sb_form_q:visible',
      'textarea#sb_form_q:visible',
      'input[type="search"]:visible',
      'input[name="q"]:visible',
      'input[aria-label*="Search"]:visible',
      'input[title*="Search"]:visible'
    ].join(', ')).first();

    await searchBox.waitFor({ state: 'visible', timeout: 20_000 });

    // 4) Type & submit
    await searchBox.fill('Microsoft Playwright');
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      searchBox.press('Enter')
    ]);

    // 5) Results signal stable across engines
    await Promise.race([
      page.waitForURL(/search\?q=/, { timeout: 12_000 }),
      page.locator('#b_results, #b_content, main[role="main"]').first().waitFor({ timeout: 12_000 })
    ]);

    // 6) Relaxed title check
    await expect(page).toHaveTitle(/playwright/i, { timeout: 12_000 });
  });
});

