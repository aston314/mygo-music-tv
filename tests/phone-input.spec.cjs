const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
async function boot(page){await page.goto('/?token='+token);await expect(page.locator('#app')).toBeVisible();await page.request.post('/api/preferences',{data:{theme:'light',language:'zh-CN',sidebar:'expanded'}});await page.reload();await expect(page.locator('#app')).toBeVisible();}
function phoneURL(data){const u=new URL(data.url);u.hostname='127.0.0.1';return u.href;}
async function openScan(page,target){
 const started=page.waitForResponse(r=>r.url().endsWith('/api/input-session')&&r.request().method()==='POST');
 await page.locator('[data-action="scan-'+target+'"]').click();const response=await started;expect(response.ok()).toBe(true);const data=await response.json();await expect(page.locator('#scan-qr')).toBeVisible();await expect(page.locator('#scan-status')).toBeFocused();return data;
}
async function phone(browser,data){const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();await page.goto(phoneURL(data));await expect(page.locator('#phone-form')).toBeVisible();return {page,context};}
test.afterEach(async({request})=>{
 const headers={Authorization:'Bearer '+token};
 expect((await request.delete('/api/input-session?before='+Date.now(),{headers})).ok()).toBe(true);
 expect((await request.post('/api/preferences',{headers,data:{theme:'dark',language:'zh-CN'}})).ok()).toBe(true);
});

test('phone resource search keeps source and type, focuses results, and never starts playback',async({page,browser},info)=>{
 await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});await boot(page);await page.request.post('/api/player/queue',{data:{action:'clear'}});
 const calls=[];await page.route('**/call/search',async r=>{const params=r.request().postDataJSON();calls.push({url:r.request().url(),params});await r.fulfill({json:{albums:[{id:'a1',name:'手机找来的专辑',imageUrl:''}],more:true}});});
 await page.locator('[data-focus="nav-search"]').click();await page.locator('[data-search-kind="albums"]').click();await page.locator('#search-input').fill('原词');const data=await openScan(page,'resource');
 expect(data.target).toBe('resource');expect(data.initial).toBe('原词');expect(data.context).toBe('演示 · 专辑');await expect(page.locator('#scan-expiry')).toContainText('二维码有效期');
 const mobile=await phone(browser,data);await expect(mobile.page.locator('#query')).toHaveValue('原词');await expect(mobile.page.locator('#context')).toHaveText('演示 · 专辑');await expect(page.locator('#scan-status')).toHaveText('手机已连接，请在手机上输入');
 await page.screenshot({path:info.outputPath('light-resource-qr.png')});await mobile.page.screenshot({path:info.outputPath('phone-resource.png')});
 await mobile.page.locator('#query').fill('中文 <专辑> 🎵');await mobile.page.locator('#submit').click();await expect(mobile.page.locator('#status')).toHaveText('已发送到电视，请在电视上查看搜索结果');
 await page.bringToFront();await expect(page.locator('#modal-layer')).toBeHidden({timeout:10000});await expect(page.locator('#search-input')).toHaveValue('中文 <专辑> 🎵');await expect(page.locator('[data-item="0"]')).toBeFocused();
 expect(calls).toHaveLength(1);expect(calls[0].url).toContain('/sources/fixture/');expect(calls[0].params).toMatchObject({query:'中文 <专辑> 🎵',kind:'albums',offset:0});expect((await(await page.request.get('/api/player')).json()).queue).toHaveLength(0);
 await mobile.context.close();
});

test('phone plugin search preserves installed filter and does not install or change source',async({page,browser})=>{
 await page.route('**/api/catalog*',r=>r.fulfill({json:{entries:[{repository:'fixture/demo',name:'demo',description:'当前来源'},{repository:'community/cloud',name:'cloud',description:'云端音乐'}]}}));
 await boot(page);await page.locator('[data-focus="nav-market"]').click();await page.locator('[data-market-filter="installed"]').click();const before=await page.locator('#source-name').textContent();
 let installs=0;await page.route('**/api/plugins/install',r=>{installs++;return r.abort();});const data=await openScan(page,'plugins');const mobile=await phone(browser,data);
 await expect(mobile.page.locator('#target')).toHaveText('搜索插件');await expect(mobile.page.locator('#context')).toHaveText('搜索插件 · 已安装');
 await mobile.page.locator('#query').fill('cloud');await mobile.page.locator('#submit').click();await expect(page.locator('#catalog-empty')).toBeVisible();await expect(page.locator('#market-search')).toHaveValue('cloud');await expect(page.locator('[data-market-filter="installed"]')).toBeFocused();
 await expect(page.locator('[data-market-filter="installed"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#source-name')).toHaveText(before);expect(installs).toBe(0);
 await page.locator('[data-market-filter="all"]').click();await expect(page.locator('[data-catalog]')).toHaveCount(1);await expect(page.locator('[data-catalog="1"]')).toBeVisible();await mobile.context.close();
});

test('Back and refresh revoke old phone capabilities and restore the originating action',async({page,browser})=>{
 await boot(page);await page.locator('[data-focus="nav-search"]').click();const first=await openScan(page,'resource'),mobile=await phone(browser,first);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/input-session')&&r.request().method()==='POST');await page.locator('[data-action="scan-refresh"]').click();const second=await(await response).json();expect(second.id).not.toBe(first.id);
 const rejected=await mobile.page.request.post(new URL('/input/session',phoneURL(first)).href,{headers:{Authorization:'Bearer '+new URL(first.url).hash.slice(1)},data:{target:'resource',value:'迟到'}}).catch(()=>null);expect(rejected===null||rejected.status()===410).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('[data-action="scan-resource"]')).toBeFocused();await expect(page.locator('#search-input')).toHaveValue('');
 await expect.poll(async()=>(await page.request.get('/api/input-session?id='+second.id)).status()).toBe(410);await mobile.context.close();
});

test('remote search actions reach scan input, trap modal focus and retain direct keyboard search',async({page})=>{
 await boot(page);
 for(const target of ['resource','plugins']){
  await page.locator('[data-focus="nav-'+(target==='resource'?'search':'market')+'"]').click();
  const submit=page.locator('[data-focus="'+(target==='resource'?'search-submit':'market-search-submit')+'"]');
  await page.locator(target==='resource'?'#search-input':'#market-search').focus();await page.keyboard.press('ArrowDown');await expect(submit).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(page.locator('[data-action="scan-'+target+'"]')).toBeFocused();
  const created=page.waitForResponse(r=>r.url().endsWith('/api/input-session')&&r.request().method()==='POST');
  await page.keyboard.press('Enter');const data=await(await created).json();await expect(page.locator('#scan-status')).toBeFocused();
  await page.evaluate(before=>window.MyGo.cancelScanInput(before),data.serverNow-1000);await expect(page.locator('#scan-status')).toBeFocused();
  await page.keyboard.press('ArrowDown');await expect(page.locator('.scan-input-modal .actions [data-focus]:focus')).toHaveCount(1);
  await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-action="cancel"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(page.locator('[data-action="scan-refresh"]')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('[data-action="scan-'+target+'"]')).toBeFocused();
 }
 await page.locator('[data-focus="nav-search"]').click();const input=page.locator('#search-input');await input.fill('Song');
 await page.keyboard.press('Enter');await expect(page.locator('[data-track="0"]')).toBeVisible();await expect(input).toHaveValue('Song');await expect(page.locator('#modal-layer')).toBeHidden();
});

test('Android editing handoff calls the shared direction router for both search fields',async({page})=>{
 await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};window.Android={startSearchEditing(){window.editStarted=(window.editStarted||0)+1;},finishSearchEditing(){window.editFinished=(window.editFinished||0)+1;}};});
 await boot(page);
 for(const target of ['resource','plugins']){
  await page.locator('[data-focus="nav-'+(target==='resource'?'search':'market')+'"]').click();
  const input=page.locator(target==='resource'?'#search-input':'#market-search');await input.focus();await input.fill('保留文字');
  expect(await page.evaluate(()=>window.MyGo.nativeEditDirection('ArrowRight'))).toBe(false);await expect(input).toBeFocused();
  expect(await page.evaluate(()=>window.MyGo.nativeEditDirection('ArrowDown'))).toBe(true);
  await expect(page.locator('[data-focus="'+(target==='resource'?'search-submit':'market-search-submit')+'"]')).toBeFocused();await expect(input).toHaveValue('保留文字');
  await page.keyboard.press('ArrowRight');await expect(page.locator('[data-action="scan-'+target+'"]')).toBeFocused();
 }
 expect(await page.evaluate(()=>window.editStarted)).toBeGreaterThan(0);expect(await page.evaluate(()=>window.editFinished)).toBeGreaterThan(0);
});

test('a slow creation or submitted status cannot apply after leaving the page or backgrounding',async({page})=>{
 await boot(page);await page.locator('[data-focus="nav-search"]').click();let release,created;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/input-session',async r=>{if(r.request().method()!=='POST')return r.continue();const response=await r.fetch();created=await response.json();await gate;await r.fulfill({response});});
 await page.locator('[data-action="scan-resource"]').click();await expect.poll(()=>!!created).toBe(true);await page.keyboard.press('Escape');await page.locator('[data-focus="nav-market"]').click();release();await expect.poll(async()=>(await page.request.get('/api/input-session?id='+created.id)).status()).toBe(410);
 await page.unroute('**/api/input-session');await page.locator('[data-focus="nav-search"]').click();const data=await openScan(page,'resource');
 let releaseStatus,started=false;const statusGate=new Promise(resolve=>releaseStatus=resolve);
 await page.route('**/api/input-session?id=*',async r=>{if(r.request().method()!=='GET')return r.continue();started=true;await statusGate;await r.fulfill({json:{...data,state:'submitted',value:'迟到搜索'}});});
 await expect.poll(()=>started).toBe(true);await page.evaluate(()=>window.MyGo.cancelScanInput());await expect(page.locator('[data-action="scan-resource"]')).toBeFocused();releaseStatus();await page.locator('[data-focus="nav-home"]').click();await expect(page.locator('[data-focus="nav-home"]')).toHaveClass('active');await expect(page.locator('#modal-layer')).toBeHidden();
 await page.locator('[data-focus="nav-search"]').click();await expect(page.locator('#search-input')).toHaveValue('');
});

test('expired and unavailable sessions offer recovery and search failures preserve the received keyword',async({page,browser})=>{
 await boot(page);await page.locator('[data-focus="nav-search"]').click();let unavailable=true;
 await page.route('**/api/input-session',r=>r.request().method()==='POST'&&unavailable?r.fulfill({status:422,json:{error:'未找到可用的局域网地址，请检查网络连接'}}):r.continue());
 await page.locator('[data-action="scan-resource"]').click();await expect(page.locator('#scan-status')).toHaveText('未找到可用的局域网地址，请检查网络连接');await expect(page.locator('[data-action="scan-refresh"]')).toBeFocused();
 unavailable=false;const response=page.waitForResponse(r=>r.url().endsWith('/api/input-session')&&r.request().method()==='POST');await page.keyboard.press('Enter');const data=await(await response).json();
 await page.route('**/api/input-session?id=*',r=>r.request().method()==='GET'?r.fulfill({json:{...data,state:'expired'}}):r.continue());await expect(page.locator('#scan-status')).toHaveText('扫码连接已失效，请重新扫码');await expect(page.locator('#scan-qr')).toBeHidden();await page.keyboard.press('Escape');await page.unroute('**/api/input-session?id=*');
 let fail=true;await page.route('**/call/search',r=>r.fulfill(fail?{status:422,json:{error:'搜索服务超时'}}:{json:{tracks:[],more:false}}));const fresh=await openScan(page,'resource'),mobile=await phone(browser,fresh);await mobile.page.locator('#query').fill('保留这个词');await mobile.page.locator('#submit').click();
 await expect(page.locator('[data-action="search-retry"]')).toBeFocused();await expect(page.locator('#search-input')).toHaveValue('保留这个词');fail=false;await page.keyboard.press('Enter');await expect(page.locator('[data-action="edit-search"]')).toBeFocused();await expect(page.locator('#search-results')).toContainText('保留这个词');await mobile.context.close();
});

for(const isMobile of [false,true])test((isMobile?'WebView':'desktop')+' QR dialog, search actions and phone page fit both themes and languages',async({browser},info)=>{
 const context=await browser.newContext({viewport:{width:1280,height:720},isMobile,deviceScaleFactor:isMobile?2:1}),page=await context.newPage();await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});await boot(page);
 for(const theme of ['light','dark']){
  await page.request.post('/api/preferences',{data:{theme,language:isMobile?'zh-TW':'zh-CN'}});await page.reload();await expect(page.locator('#app')).toBeVisible();
  for(const target of ['resource','plugins']){
   await page.locator('[data-focus="nav-'+(target==='resource'?'search':'market')+'"]').click();const data=await openScan(page,target);const mobile=await phone(browser,data);await expect(mobile.page.locator('html')).toHaveAttribute('data-theme',theme);
   for(const [width,height]of [[960,540],[1280,720],[1920,1080],[1280,800]]){
    await page.setViewportSize({width,height});for(const focus of ['scan-status','cancel','scan-refresh']){await page.locator('[data-focus="'+focus+'"]').focus();await expect.poll(()=>page.locator('[data-focus="'+focus+'"]').evaluate(n=>{const a=n.getBoundingClientRect(),b=n.closest('.modal').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom&&b.bottom<=document.documentElement.clientHeight;})).toBe(true);}
    if(width===1280&&height===720)await page.screenshot({path:info.outputPath(theme+'-'+target+'-qr.png')});
   }
   await mobile.page.screenshot({path:info.outputPath(theme+'-'+target+'-phone.png')});await mobile.context.close();await page.keyboard.press('Escape');await expect(page.locator('[data-action="scan-'+target+'"]')).toBeFocused();
  }
 }
 await context.close();
});
