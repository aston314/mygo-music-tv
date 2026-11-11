const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const acorn = require('acorn');
const token = 'playwright-only-local-session-0123456789';
async function boot(page) { await page.goto('/?token=' + token); await expect(page.locator('#app')).toBeVisible(); await expect(page.locator('[data-track="0"]')).toBeVisible(); }

test('page script parses on the Android 6 JavaScript baseline', () => {
  for (const file of ['ui/app.js','ui/i18n.js','ui/locales/zh-CN.js','ui/locales/zh-TW.js']) acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 5 });
});

test('fixed canvas scales without rearranging, and remote focus remains visible', async ({ page }) => {
  await page.route('**/api/catalog', route => route.fulfill({ json:{ entries:[0,1,2].map(i => ({repository:'fixture/source-' + i,name:'Source ' + i})) } }));
  await boot(page);
  for (const size of [[960, 540], [1280, 720], [1920, 1080]]) {
    await page.setViewportSize({ width:size[0], height:size[1] });
    await expect.poll(async () => Math.round((await page.locator('#stage').boundingBox()).width)).toBe(size[0]);
    expect(Math.round((await page.locator('#stage').boundingBox()).height)).toBe(size[1]);
    await page.locator('[data-focus="nav-market"]').click();
    await expect(page.locator('[data-catalog="0"]')).toBeVisible();
    const cards = await page.locator('[data-catalog]').evaluateAll(nodes => nodes.map(n => ({top:n.getBoundingClientRect().top,left:n.getBoundingClientRect().left})));
    expect(cards).toHaveLength(3); expect(cards[0].top).toBeCloseTo(cards[2].top, 1); expect(cards[2].left).toBeGreaterThan(cards[1].left);
    await page.locator('[data-catalog="0"]').focus(); await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => document.activeElement.hasAttribute('data-focus'))).toBe(true);
    const r = await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { top:r.top,bottom:r.bottom }; });
    expect(r.top).toBeGreaterThanOrEqual(0); expect(r.bottom).toBeLessThanOrEqual(size[1]);
  }
});

test('market modal traps directional focus and returns to the same card', async ({ page }) => {
  await boot(page); await page.locator('[data-focus="nav-market"]').click();
  const card = page.locator('[data-catalog="0"]'); await card.click();
  await expect(page.locator('[data-action="cancel"]')).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(page.locator('[data-action="install"]')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('#modal-layer')).toBeHidden(); await expect(card).toBeFocused();
});

test('market marks installation by repository and keeps status badges readable across TV sizes', async ({ page }, testInfo) => {
  await page.route('**/api/catalog*', route => route.fulfill({ json:{ entries:[
    { repository:'Fixture/Demo', name:'客厅音乐', description:'已安装的在线音乐源。' },
    { repository:'another/demo', name:'客厅音乐', description:'同名的另一个社区音乐源。' },
    { repository:'community/long-source', name:'名字很长的在线音乐来源示例', description:'社区在线音乐源插件。' }
  ] } }));
  await boot(page);
  await page.locator('[data-focus="nav-market"]').click();
  const installed = page.locator('[data-catalog="0"]');
  const available = page.locator('[data-catalog="1"]');
  await expect(installed.locator('.install-badge')).toHaveText('已安装');
  await expect(available.locator('.install-badge')).toHaveText('未安装');
  await expect(page.locator('.plugin-card.is-installed')).toHaveCount(1);
  await expect(installed.locator('.card-bottom')).toHaveText('查看与更新');
  await expect(available.locator('.card-bottom')).toHaveText('查看与安装');
  for (const [width,height] of [[960,540],[1280,720],[1920,1080]]) {
    await page.setViewportSize({width,height});
    const badges = await page.locator('.plugin-card .install-badge').evaluateAll(nodes => nodes.map(node => {
      const card = node.closest('.plugin-card').getBoundingClientRect();
      const badge = node.getBoundingClientRect();
      return { clipped:node.scrollWidth > node.clientWidth, inside:badge.left >= card.left && badge.right <= card.right && badge.top >= card.top && badge.bottom <= card.bottom };
    }));
    expect(badges.every(badge => !badge.clipped && badge.inside)).toBe(true);
    await installed.focus();
    await page.keyboard.press('ArrowRight');
    await expect(available).toBeFocused();
    if (width === 1280) await page.screenshot({path:testInfo.outputPath('market-status.png')});
  }
  await installed.click();
  await expect(page.locator('#modal-layer .install-badge')).toHaveText('已安装');
  await expect(page.locator('[data-action="install"]')).toHaveText('检查并更新');
  await page.keyboard.press('Escape');
  await expect(installed).toBeFocused();
  await available.click();
  await expect(page.locator('#modal-layer .install-badge')).toHaveText('未安装');
  await expect(page.locator('[data-action="install"]')).toHaveText('安装插件');
});

test('search result can start actual fixture audio and changes queue on ended', async ({ page }) => {
  await boot(page); await page.locator('[data-focus="nav-search"]').click();
  await page.locator('#search-input').fill('song'); await page.locator('[data-focus="search-submit"]').click();
  await expect(page.locator('[data-track="0"]')).toBeVisible(); await page.locator('[data-track="0"]').click();
  await expect.poll(async () => (await page.request.get('/api/player')).json().then(p => p.state)).toBe('playing');
  const p = await (await page.request.get('/api/player')).json();
  expect(p.media).toMatch(/^\/media\/[a-f0-9]{48}$/); expect(p.queue[p.index].source).toBe('fixture');
  await page.locator('#open-player').click();
  await expect(page.locator('.player-heading h2')).toHaveText(p.queue[0].name);
  const range = await page.request.get(p.media, { headers: { Range:'bytes=0-63' } }); expect(range.status()).toBe(206); expect((await range.body()).length).toBe(64);
  await page.request.post('/api/player/event', { data:{generation:p.generation,state:'ended',position:p.duration,duration:p.duration} });
  await expect.poll(async () => (await page.request.get('/api/player')).json().then(n => n.index)).toBe(1);
  await expect(page.locator('.player-heading h2')).toHaveText(p.queue[1].name);
});

test('late list response cannot replace a newly selected page', async ({ page }) => {
  await boot(page);
  await page.route('**/call/liked', async route => { await new Promise(r => setTimeout(r, 500)); await route.fulfill({ json:{tracks:[{id:'late',name:'SHOULD NOT APPEAR',duration:1000,album:{},source:'fixture'}]} }); });
  await page.locator('[data-focus="nav-liked"]').click();
  await page.locator('[data-focus="nav-settings"]').click();
  await page.waitForTimeout(700); await expect(page.locator('#page-title')).toHaveText('设置'); await expect(page.locator('#content')).not.toContainText('SHOULD NOT APPEAR');
});

test('sidebar setting persists with focus, and Back cancels the exit dialog', async ({ page }) => {
  await boot(page); await page.locator('[data-focus="nav-settings"]').click();
  await page.locator('[data-pref="icons"]').click(); await expect(page.locator('[data-pref="icons"]')).toBeFocused();
  await page.reload(); await expect(page.locator('#app')).toHaveClass('icons');
  await page.locator('[data-focus="nav-settings"]').click(); await page.locator('[data-action="exit-confirm"]').click();
  await expect(page.locator('[data-action="cancel"]')).toBeFocused(); await page.keyboard.press('Escape'); await expect(page.locator('#modal-layer')).toBeHidden();
  await page.locator('[data-pref="expanded"]').click();
});

test('legacy remote keys respect sidebar boundaries and return from detail to the original card', async ({ page }) => {
  await boot(page);
  const home = page.locator('[data-focus="nav-home"]');
  await home.focus();
  await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {keyCode:40,bubbles:true})));
  await expect(page.locator('[data-focus="nav-search"]')).toBeFocused();
  const settings = page.locator('[data-focus="nav-settings"]');
  await settings.focus(); await page.keyboard.press('ArrowDown'); await expect(page.locator('#open-player')).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(settings).toBeFocused();
  await home.click();
  const album = page.locator('[data-kind="album"]').first();
  await album.click(); await expect(page.locator('[data-action="play-all"]')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(album).toBeFocused();
  await page.locator('[data-track="0"]').focus(); await page.keyboard.press('ArrowLeft'); await expect(home).toBeFocused();
});
