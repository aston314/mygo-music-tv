const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
async function boot(page){
 await page.goto('/?token='+token);await expect(page.locator('#app')).toBeVisible();
 await page.request.post('/api/preferences',{data:{theme:'light',language:'zh-CN',sidebar:'expanded'}});
 await page.request.post('/api/player/queue',{data:{action:'clear'}});
 await page.request.post('/api/player/mode',{data:{mode:'sequence'}});
 await page.reload();await expect(page.locator('#app')).toBeVisible();
}
async function song(page){await boot(page);await page.locator('[data-track="0"]').click();await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).state).toBe('playing');}
test.afterEach(async({page})=>{await page.request.post('/api/preferences',{data:{theme:'dark',language:'zh-CN',sidebar:'expanded'}});});

test('TV account dialogs prevent repeated Enter from signing out and require explicit confirmation',async({page})=>{
 await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});
 let signedIn=true,calls=0,release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/call/account',r=>r.fulfill({json:signedIn?{name:'测试听众'}:null}));
 await page.route('**/call/signOut',async r=>{calls++;await gate;signedIn=false;await r.fulfill({json:null});});
 await boot(page);await page.locator('#account-button').click();await expect(page.locator('[data-action="cancel"]')).toBeFocused();
 await page.keyboard.press('Enter');await expect(page.locator('#modal-layer')).toBeHidden();expect(calls).toBe(0);
 await page.keyboard.press('Enter');await expect(page.locator('[data-action="cancel"]')).toBeFocused();
 await page.locator('[data-action="signout"]').click();await expect(page.locator('[data-action="cancel"]')).toBeFocused();
 await expect(page.locator('.modal')).toContainText('测试听众');await page.keyboard.press('Enter');
 await expect(page.locator('[data-action="signout"]')).toBeFocused();expect(calls).toBe(0);
 await page.locator('[data-action="signout"]').click();await page.locator('[data-action="signout-confirm"]').click();
 await expect.poll(()=>calls).toBe(1);await page.locator('[data-action="signout-confirm"]').click({force:true});expect(calls).toBe(1);
 release();await expect(page.locator('#account-name')).toHaveText('未登录');await expect(page.locator('#modal-layer')).toBeHidden();
});

test('every playback mode reopens on its current item and Back preserves the choice',async({page})=>{
 await song(page);
 for(const mode of ['single','shuffle','loop','sequence']){
  await page.locator('#mode-button').click();await page.locator('[data-set-mode="'+mode+'"]').click();
  await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).mode).toBe(mode);
  await page.locator('#mode-button').click();await expect(page.locator('[data-set-mode="'+mode+'"]')).toBeFocused();
  await page.keyboard.press('Escape');expect((await(await page.request.get('/api/player')).json()).mode).toBe(mode);
 }
});

test('source settings expose only supported account operations and keep management secondary',async({page})=>{
 let supported=false,signedIn=false;
 await page.route('**/api/sources',async r=>{const response=await r.fetch(),list=await response.json();Object.assign(list[0].capabilities,{account:supported,signIn:supported,signOut:supported});await r.fulfill({json:list});});
 await page.route('**/call/account',r=>r.fulfill({json:signedIn?{name:'测试听众'}:null}));
 await boot(page);await page.locator('[data-focus="nav-settings"]').click();
 await expect(page.locator('#source-settings-actions')).toContainText('无需登录');await expect(page.locator('[data-action="login"]')).toHaveCount(0);
 await expect(page.locator('[data-action="uninstall"]')).toHaveCount(0);await page.locator('[data-action="manage-source"]').click();
 await expect(page.locator('[data-action="cancel"]')).toBeFocused();await expect(page.locator('[data-action="signout"]')).toHaveCount(0);
 await page.locator('[data-action="uninstall"]').click();await expect(page.locator('[data-action="cancel"]')).toBeFocused();await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 supported=true;await page.reload();await page.locator('[data-focus="nav-settings"]').click();await expect(page.locator('[data-action="login"]')).toBeVisible();
 await page.locator('[data-action="manage-source"]').click();await expect(page.locator('.modal')).toHaveAttribute('aria-label','管理音乐源');await expect(page.locator('[data-action="signout"]')).toHaveCount(0);await page.keyboard.press('Escape');
 signedIn=true;await page.locator('[data-action="manage-source"]').click();await expect(page.locator('[data-action="signout"]')).toBeVisible();await expect(page.locator('[data-action="cancel"]')).toBeFocused();
});

test('read-only playlist creation offers reread, retains intentional focus and recovers after a failed reread',async({page})=>{
 await page.route('**/api/sources',async r=>{const response=await r.fetch(),list=await response.json();list[0].capabilities.createPlaylist=false;await r.fulfill({json:list});});
 let count=0,fail=false,release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/call/playlists',async r=>{count++;if(count===3)await gate;await r.fulfill(fail?{status:422,json:{error:'歌单读取超时'}}:{json:count<3?[]:[{id:'fixed',name:'固定喜欢',fixed:true},{id:'writable',name:'可写歌单',mine:true}]});});
 await song(page);await page.locator('#open-player').click();await page.locator('[data-action="player-more"]').click();await page.locator('[data-action="add-playlist"]').click();
 await expect(page.locator('#playlist-options')).toContainText('音乐源官方应用');await expect(page.locator('[data-action="playlist-retry"]')).toBeFocused();await expect(page.locator('[data-action="create-for-track"]')).toHaveCount(0);
 fail=true;await page.keyboard.press('Enter');await expect(page.locator('#playlist-options')).toContainText('歌单读取超时');await expect(page.locator('[data-action="playlist-retry"]')).toHaveCount(1);
 fail=false;await page.keyboard.press('Enter');await expect.poll(()=>count).toBe(3);await page.locator('[data-action="cancel"]').focus();release();
 await expect(page.locator('[data-pick-playlist]')).toHaveText('可写歌单');await expect(page.locator('[data-action="cancel"]')).toBeFocused();
});

test('empty search has accurate guidance, session recents, and unknown track duration stays distinct from zero',async({page})=>{
 await page.route('**/call/home',async r=>{const response=await r.fetch(),data=await response.json();for(const s of data.sections||[])for(const t of s.tracks||[])t.duration=0;await r.fulfill({json:data});});
 await page.route('**/call/search',r=>r.fulfill({json:{tracks:[],more:false}}));
 await boot(page);await expect(page.locator('.track-time').first()).toHaveText('—');
 await page.locator('[data-focus="nav-search"]').click();await expect(page.locator('#search-results')).toContainText('想听什么');
 await page.locator('#search-input').fill('没有结果 <音乐>');await page.locator('[data-focus="search-submit"]').click();
 await expect(page.locator('#search-results')).toContainText('未找到相关内容');await expect(page.locator('#search-results')).toContainText('没有结果 <音乐>');
 await page.locator('[data-action="edit-search"]').click();await expect(page.locator('#search-input')).toBeFocused();
 await page.locator('[data-focus="nav-home"]').click();await page.locator('[data-focus="nav-search"]').click();
 await expect(page.locator('[data-recent-search="0"]')).toHaveText('没有结果 <音乐>');
});

async function catalog(page){
 const model={installed:false,job:{id:'install-new',repository:'community/cloud',instanceId:'cloud',state:'downloading',operation:'install'},updates:[{instanceId:'fixture',available:true,latestVersion:'2.0',state:'available'}]};
 await page.route('**/api/sources',async r=>{const response=await r.fetch(),list=await response.json();if(model.installed)list.push({...list[0],instanceId:'cloud',repository:'community/cloud',revision:'v1',manifest:{...list[0].manifest,name:'云端音乐'}});await r.fulfill({json:list});});
 await page.route('**/api/catalog*',r=>r.fulfill({json:{entries:[{repository:'fixture/demo',name:'mygo-music-demo',description:'演示来源'},{repository:'community/cloud',name:'mygo-music-cloud',description:'在线云端音乐'},{repository:'another/radio',name:'电台',description:'在线电台'}]}}));
 await page.route('**/api/plugins/updates',r=>r.fulfill({json:model.updates}));
 await page.route('**/api/plugins/compatibility',r=>r.fulfill({json:{entries:[{repository:'community/cloud',revision:'v1',process:['helper'],stages:{}}]}}));
 await page.route('**/api/plugins/install',r=>r.fulfill({json:model.job}));
 await page.route('**/api/jobs/install-new',r=>r.fulfill({json:model.job}));
 await page.route('**/sources/cloud/call/home',r=>r.fulfill({json:{sections:[]}}));
 return model;
}
test('market search and filters keep typing focus, persist through refresh and handle an update disappearing',async({page})=>{
 const model=await catalog(page);await boot(page);await page.locator('[data-focus="nav-market"]').click();
 await expect(page.locator('[data-catalog]')).toHaveCount(3);await expect(page.locator('[data-catalog="1"] .compatibility-badge')).toHaveText('部分功能需适配');
 await page.locator('#market-search').fill('community');await expect(page.locator('[data-catalog]')).toHaveCount(1);await expect(page.locator('#market-search')).toBeFocused();
 await page.locator('[data-market-filter="installed"]').click();await expect(page.locator('#catalog-empty')).toBeVisible();
 let refreshRelease;const refreshGate=new Promise(resolve=>refreshRelease=resolve);
 await page.route('**/api/catalog?refresh=1',async r=>{await refreshGate;await r.fulfill({json:{entries:[{repository:'fixture/demo',name:'demo',description:'演示来源'},{repository:'community/cloud',name:'cloud',description:'在线云端音乐'}]}});});
 await page.locator('[data-action="refresh-catalog"]').click();await page.locator('#market-search').fill('communit');const editor=await page.locator('#market-search').elementHandle();refreshRelease();
 await expect(page.locator('[data-action="refresh-catalog"]')).toHaveAttribute('aria-busy','false');await expect(page.locator('#market-search')).toHaveValue('communit');await expect(page.locator('#market-search')).toBeFocused();expect(await editor.evaluate(n=>n===document.getElementById('market-search'))).toBe(true);await expect(page.locator('[data-market-filter="installed"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#market-search').fill('');await expect(page.locator('[data-catalog]')).toHaveCount(1);
 await page.locator('[data-market-filter="updates"]').click();
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/plugins/check-updates',async r=>{await gate;model.updates=[];await r.fulfill({json:[]});});
 await page.locator('[data-action="check-all-updates"]').click();await page.locator('[data-catalog="0"]').focus();release();
 await expect(page.locator('#catalog-empty')).toBeVisible();await expect(page.locator('[data-market-filter="updates"]')).toBeFocused();
});

test('a completed installation cannot reopen its closed details or interrupt another page',async({page})=>{
 await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});
 const model=await catalog(page);await page.route('**/api/plugins/compatibility',r=>r.fulfill({json:{entries:[]}}));await boot(page);await page.locator('[data-focus="nav-market"]').click();
 await page.locator('[data-catalog="1"]').click();await page.locator('[data-action="install"]').click();await expect(page.locator('#catalog-update-status')).toHaveText('正在下载…');
 await expect(page.locator('[data-focus="plugin-status"]')).toBeFocused();
 await page.keyboard.press('Escape');await page.locator('[data-focus="nav-settings"]').click();await page.locator('[data-pref="icons"]').focus();
 model.installed=true;model.job={...model.job,state:'complete'};await expect(page.locator('#toast')).toHaveText('安装完成');
 await expect(page.locator('#modal-layer')).toBeHidden();await expect(page.locator('[data-pref="icons"]')).toBeFocused();await expect(page.locator('#source-name')).toHaveText('演示');
});

test('installation stays in the market, keeps queue and source, then uses the plugin only on explicit action',async({page})=>{
 const model=await catalog(page);await song(page);const before=await(await page.request.get('/api/player')).json();
 await page.locator('[data-focus="nav-market"]').click();await page.locator('[data-catalog="1"]').click();await page.locator('[data-action="install"]').click();
 model.installed=true;model.job={...model.job,state:'complete'};await expect(page.locator('[data-action="use-plugin"]')).toBeFocused();
 await expect(page.locator('[data-focus="nav-market"]')).toHaveClass('active');await expect(page.locator('#source-name')).toHaveText('演示');
 const after=await(await page.request.get('/api/player')).json();expect(after.generation).toBe(before.generation);expect(after.queue).toEqual(before.queue);expect(after.media).toBe(before.media);
 await page.keyboard.press('Escape');await expect(page.locator('[data-catalog="1"]')).toBeFocused();await expect(page.locator('[data-catalog="1"] .install-badge')).toHaveText('已安装');
 await expect(page.locator('[data-catalog="1"] .card-name')).toHaveText('云端音乐');await page.locator('[data-catalog="1"]').click();await page.locator('[data-action="use-plugin"]').click();
 await expect(page.locator('#source-name')).toHaveText('云端音乐');await expect(page.locator('[data-focus="nav-home"]')).toHaveClass('active');
});

for(const isMobile of [false,true])test((isMobile?'WebView':'desktop')+' revised market and grouped settings fit all verification sizes',async({browser},info)=>{
 const context=await browser.newContext({viewport:{width:1280,height:720},isMobile,deviceScaleFactor:isMobile?2:1}),page=await context.newPage();
 await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});await catalog(page);await boot(page);
 for(const theme of ['light','dark']){
  await page.request.post('/api/preferences',{data:{theme,language:isMobile?'zh-TW':'zh-CN'}});await page.reload();await expect(page.locator('#app')).toBeVisible();
  for(const [width,height] of [[960,540],[1280,720],[1920,1080],[1280,800]]){
   await page.setViewportSize({width,height});await page.locator('[data-focus="nav-market"]').click();await page.locator('[data-market-filter="all"]').focus();
   const rows=await page.locator('[data-catalog]').evaluateAll(nodes=>nodes.map(n=>({top:n.querySelector('.card-top').getBoundingClientRect().top,bottom:n.querySelector('.card-bottom').getBoundingClientRect().bottom})));
   expect(Math.max(...rows.map(r=>r.top))-Math.min(...rows.map(r=>r.top))).toBeLessThan(1);expect(Math.max(...rows.map(r=>r.bottom))-Math.min(...rows.map(r=>r.bottom))).toBeLessThan(1);
   await page.locator('[data-catalog="0"]').focus();
   const bounds=await page.locator('[data-catalog="0"]').evaluate(n=>{const r=n.getBoundingClientRect(),c=n.closest('#content').getBoundingClientRect(),b=n.querySelector('.card-bottom').getBoundingClientRect();return {inside:r.left>=c.left&&r.right<=c.right&&r.top>=c.top&&r.bottom<=c.bottom,bottom:b.bottom<=c.bottom};});
   expect(bounds.inside).toBe(true);expect(bounds.bottom).toBe(true);
   await page.screenshot({path:info.outputPath(theme+'-market-'+width+'x'+height+'.png')});
   await page.locator('[data-focus="nav-settings"]').click();await page.locator('[data-action="manage-source"]').focus();
   const aligned=await page.locator('#source-settings-actions button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));expect(Math.max(...aligned)-Math.min(...aligned)).toBeLessThan(1);
   await page.screenshot({path:info.outputPath(theme+'-settings-'+width+'x'+height+'.png')});
  }
 }
 await context.close();
});
