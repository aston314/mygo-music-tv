const {test,expect}=require('@playwright/test');
const {createHash}=require('node:crypto');
const token='playwright-only-local-session-0123456789';
const copy='自愿支持 My Music+ 的开发与维护。支持与否不影响应用功能，也不提供任何音乐平台会员或额外播放权限。';
const traditional='自願支持 My Music+ 的開發與維護。支持與否不影響應用功能，也不提供任何音樂平台會員或額外播放權限。';
async function boot(page){await page.goto('/?token='+token);await expect(page.locator('#app')).toBeVisible();}
async function insideViewport(locator){
 const visible=await locator.evaluate(n=>{const r=n.getBoundingClientRect(),root=document.documentElement;return r.left>=0&&r.top>=0&&r.right<=root.clientWidth+1&&r.bottom<=root.clientHeight+1;});
 expect(visible).toBe(true);
}

for(const platform of ['browser','android-tv'])for(const theme of ['light','dark'])test(platform+' '+theme+' support keeps readable QR artwork, exact copy and a nested remote focus path',async({browser},info)=>{
 const context=await browser.newContext({viewport:{width:1280,height:720},isMobile:platform==='android-tv',deviceScaleFactor:platform==='android-tv'?2:1});
 const page=await context.newPage();
 try{
  await page.addInitScript(platform=>{window.MyGoHost={platform};},platform);
  await boot(page);await page.request.post('/api/preferences',{data:{theme,language:'zh-CN',sidebar:'expanded'}});await page.reload();
  const support=page.locator('#support-button'),account=page.locator('#account-button');
  await expect(support).toBeVisible();await expect(account).toBeVisible();
  const alignment=await support.evaluate(n=>{
   const r=n.getBoundingClientRect(),icon=n.querySelector('svg').getBoundingClientRect(),account=document.querySelector('#account-button').getBoundingClientRect();
   return {afterAccount:r.left>account.right,centered:Math.abs((r.left+r.right-icon.left-icon.right)/2)<.75&&Math.abs((r.top+r.bottom-icon.top-icon.bottom)/2)<.75,themed:getComputedStyle(n.querySelector('svg')).color===getComputedStyle(document.querySelector('.brand-mark')).color};
  });
  expect(alignment).toEqual({afterAccount:true,centered:true,themed:true});
  await support.focus();await page.keyboard.press('ArrowLeft');await expect(account).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(support).toBeFocused();await page.keyboard.press('Enter');
  const dialog=page.locator('.support-modal'),wechat=page.locator('[data-focus="support-wechat"]'),alipay=page.locator('[data-focus="support-alipay"]');
  await expect(dialog).toHaveText(copy);await expect(dialog.locator('h2')).toHaveCount(0);await expect(wechat).toBeFocused();
  for(const [width,height] of [[960,540],[1280,720],[1920,1080],[928,696]]){
   await page.setViewportSize({width,height});await expect.poll(()=>page.locator('#stage').evaluate(n=>Math.round(n.getBoundingClientRect().width))).toBe(width);
   await insideViewport(dialog);await insideViewport(wechat);await insideViewport(alipay);await insideViewport(dialog.locator('[data-action="cancel"]'));
   expect(await dialog.evaluate(n=>n.scrollHeight<=n.clientHeight+1)).toBe(true);
   const pictures=await dialog.locator('img').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {loaded:n.complete&&n.naturalWidth>0,ratio:r.width/r.height,original:n.naturalWidth/n.naturalHeight};}));
   expect(pictures).toHaveLength(2);
   for(const picture of pictures){expect(picture.loaded).toBe(true);expect(picture.ratio).toBeCloseTo(picture.original,3);}
   if(width===1280)await page.screenshot({path:info.outputPath(theme+'-support.png')});
  }
  await page.keyboard.press('ArrowRight');await expect(alipay).toBeFocused();
  await page.keyboard.press('ArrowUp');await expect(dialog.locator('[data-action="cancel"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');await expect(alipay).toBeFocused();
  const small=(await alipay.locator('img').boundingBox()).height;
  await page.keyboard.press('Enter');
  const zoom=page.locator('.support-zoom');await expect(zoom).toBeVisible();await expect(zoom).toHaveText('');
  await expect(zoom.locator('img')).toHaveAttribute('src','/images/support-alipay.png');
  await expect(zoom.locator('[data-action="cancel"]')).toBeFocused();await insideViewport(zoom);await insideViewport(zoom.locator('img'));
  expect((await zoom.locator('img').boundingBox()).height).toBeGreaterThan(small*1.4);
  await page.screenshot({path:info.outputPath(theme+'-alipay-enlarged.png')});
  await page.keyboard.press('Escape');await expect(alipay).toBeFocused();await expect(dialog).toHaveText(copy);
  await page.keyboard.press('ArrowLeft');await expect(wechat).toBeFocused();await page.keyboard.press('Enter');
  await expect(zoom.locator('img')).toHaveAttribute('src','/images/support-wechat.png');
  await zoom.locator('[data-action="cancel"]').click();await expect(wechat).toBeFocused();
  await dialog.locator('[data-action="cancel"]').click();await expect(page.locator('#modal-layer')).toBeHidden();await expect(support).toBeFocused();
 }finally{await context.close();}
});

test('support and account both hide without an installed source',async({page})=>{
 await page.route('**/api/sources',r=>r.fulfill({json:[]}));
 await boot(page);
 for(const pageName of ['home','search','market','settings']){
  await page.locator('[data-focus="nav-'+pageName+'"]').click();
  await expect(page.locator('#account-button')).toBeHidden();await expect(page.locator('#support-button')).toBeHidden();
 }
});

test('support and account both hide for a source without account capabilities',async({page})=>{
 await page.route('**/api/sources',async r=>{
  const response=await r.fetch(),sources=await response.json();
  sources.forEach(source=>{delete source.capabilities.account;delete source.capabilities.signIn;});
  await r.fulfill({json:sources});
 });
 await boot(page);await expect(page.locator('#account-button')).toBeHidden();await expect(page.locator('#support-button')).toBeHidden();
});

test('support stays beside a signed-out account and uses the separate Traditional Chinese catalog',async({page})=>{
 await page.route('**/call/account',r=>r.fulfill({json:null}));
 await boot(page);await expect(page.locator('#account-button')).toBeVisible();await expect(page.locator('#support-button')).toBeVisible();
 await expect(page.locator('#account-status-dot')).toBeHidden();
 await page.request.post('/api/preferences',{data:{theme:'light',language:'zh-TW',sidebar:'expanded'}});await page.reload();
 await expect(page.locator('#support-button')).toHaveAttribute('aria-label','支持開發');await page.locator('#support-button').click();
 await expect(page.locator('.support-modal')).toHaveText(traditional);await expect(page.locator('[data-focus="support-wechat"]')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#support-button')).toBeFocused();
 await page.request.post('/api/preferences',{data:{language:'zh-CN'}});
});

test('support follows account visibility across pages and leaves playback intact',async({page})=>{
 await boot(page);await page.locator('[data-focus="nav-home"]').click();await page.locator('[data-track="0"]').click();
 await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).state).toBe('playing');
 const before=await(await page.request.get('/api/player')).json();
 await page.locator('#support-button').click();await expect(page.locator('.support-modal')).toBeVisible();await page.keyboard.press('Escape');
 const after=await(await page.request.get('/api/player')).json();
 expect(after.state).toBe('playing');expect(after.index).toBe(before.index);expect(after.queue).toEqual(before.queue);
 for(const pageName of ['market','settings']){
  await page.locator('[data-focus="nav-'+pageName+'"]').click();await expect(page.locator('#account-button')).toBeHidden();
  await expect(page.locator('#support-button')).toBeHidden();
 }
 await page.locator('[data-focus="nav-home"]').click();await expect(page.locator('#account-button')).toBeVisible();await expect(page.locator('#support-button')).toBeVisible();
 await page.locator('#open-player').click();await expect(page.locator('#account-button')).toBeHidden();await expect(page.locator('#support-button')).toBeHidden();
 await page.keyboard.press('Escape');await expect(page.locator('#account-button')).toBeVisible();await expect(page.locator('#support-button')).toBeVisible();
});

test('both embedded PNGs preserve the Hongguo QR bytes and are served locally as images',async({page})=>{
 await boot(page);
 const hashes={wechat:'99e3d6f84e6ff9e64626b15e5385a76ac182ee2a83dca74cb78c63257d60a403',alipay:'d754a25b169b530736593b0babe0f024a4026ca93c15e82831da8e01fb9a1e63'};
 for(const method of ['wechat','alipay']){
  const response=await page.request.get('/images/support-'+method+'.png');
  expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/png');
  expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(hashes[method]);
 }
});
