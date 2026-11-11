const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
async function boot(page){
 await page.goto('/?token='+token);await expect(page.locator('[data-track="0"]')).toBeVisible();
 await page.request.post('/api/player/queue',{data:{action:'clear'}});
 await page.request.post('/api/preferences',{data:{sidebar:'expanded',translation:'on'}});
}
async function song(page){
 await boot(page);await page.locator('[data-track="0"]').click();
 await expect.poll(async()=>(await page.request.get('/api/player')).json().then(p=>p.state)).toBe('playing');
 await page.locator('#toggle').click();await expect.poll(async()=>(await page.request.get('/api/player')).json().then(p=>p.state)).toBe('paused');
 await page.locator('#open-player').click();
}
async function visibleFocus(page,container){
 const bounds=await page.evaluate(selector=>{const a=document.activeElement.getBoundingClientRect(),b=document.querySelector(selector).getBoundingClientRect();return {top:a.top,bottom:a.bottom,left:a.left,right:a.right,b};},container);
 expect(bounds.top).toBeGreaterThanOrEqual(bounds.b.top);expect(bounds.bottom).toBeLessThanOrEqual(bounds.b.bottom+1);
 expect(bounds.left).toBeGreaterThanOrEqual(bounds.b.left);expect(bounds.right).toBeLessThanOrEqual(bounds.b.right+1);
}

test('list dialogs enter their first item, keep focus during refresh, and confirmations enter Cancel',async({page})=>{
 await song(page);
 await page.locator('#queue-button').click();await expect(page.locator('[data-queue-jump]').first()).toBeFocused();
 await page.keyboard.press('ArrowRight');const remove=page.locator('[data-queue-remove]').first();await expect(remove).toBeFocused();
 await page.keyboard.press('Enter');await expect(page.locator('[data-queue-jump]').first()).toBeFocused();
 await page.locator('[data-action="queue-clear"]').click();await expect(page.locator('[data-action="cancel"]')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('[data-action="queue-clear"]')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#queue-button')).toBeFocused();
 await page.locator('#mode-button').click();await expect(page.locator('[data-set-mode]').first()).toBeFocused();await page.keyboard.press('Escape');
 await page.locator('[data-action="player-more"]').click();await expect(page.locator('.menu-option').first()).toBeFocused();
 await page.locator('[data-action="add-playlist"]').click();await expect(page.locator('[data-pick-playlist]').first()).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('[data-action="add-playlist"]')).toBeFocused();
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('#source-switch').click();
 await expect(page.locator('[data-source]').first()).toBeFocused();
});

test('empty and delayed list dialogs preserve an intentional action focus',async({page})=>{
 await song(page);await page.locator('[data-action="player-more"]').click();
 await page.route('**/call/playlists',route=>route.fulfill({json:[]}));await page.locator('[data-action="add-playlist"]').click();
 await expect(page.locator('#playlist-options')).toContainText('暂无可加入');await expect(page.locator('[data-action="cancel"]')).toBeFocused();
 await page.keyboard.press('Escape');await page.unroute('**/call/playlists');
 let release,started=false;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/call/playlists',async route=>{started=true;await gate;await route.fulfill({json:[{id:'delayed',name:'迟到歌单',mine:true}]});});
 await page.locator('[data-action="add-playlist"]').click();await expect.poll(()=>started).toBe(true);
 await page.keyboard.press('ArrowRight');await expect(page.locator('[data-action="create-for-track"]')).toBeFocused();
 release();await expect(page.locator('[data-pick-playlist]')).toHaveText('迟到歌单');await expect(page.locator('[data-action="create-for-track"]')).toBeFocused();
});

test('every short comment is focusable without source actions and pagination loads only on demand',async({page})=>{
 await page.route('**/api/sources',async route=>{const response=await route.fetch(),list=await response.json();list[0].capabilities.likeComment=false;await route.fulfill({json:list});});
 await song(page);const offsets=[];let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/call/comments',async route=>{const q=route.request().postDataJSON();offsets.push(q.offset);if(q.offset)await gate;await route.fulfill({json:{comments:Array.from({length:6},(_,i)=>({id:'c'+(q.offset+i),author:'听众 '+(q.offset+i),text:'第 '+(q.offset+i)+' 条短评论'})),more:q.offset===0}});});
 await page.locator('[data-action="player-comments"]').click();await expect(page.locator('.comment-card')).toHaveCount(6);
 await expect(page.locator('[data-comment-index="0"]')).toBeFocused();expect(offsets).toEqual([0]);
 await page.keyboard.press('ArrowDown');await expect(page.locator('[data-comment-index="1"]')).toBeFocused();
 await page.keyboard.press('ArrowUp');await expect(page.locator('[data-comment-index="0"]')).toBeFocused();
 for(let i=1;i<6;i++){await page.keyboard.press('ArrowDown');await expect(page.locator('[data-comment-index="'+i+'"]')).toBeFocused();await visibleFocus(page,'#comment-list');}
 await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await expect.poll(()=>offsets.length).toBe(2);expect(offsets).toEqual([0,6]);
 release();await expect(page.locator('.comment-card')).toHaveCount(12);await expect(page.locator('[data-comment-index="6"]')).toBeFocused();
 await page.keyboard.press('ArrowUp');await expect(page.locator('[data-comment-index="5"]')).toBeFocused();
 expect(offsets).toEqual([0,6]);await expect(page.locator('[data-action="comments-more"]')).toHaveCount(0);
});

test('failed lazy pages retain comments and expose a retry at the same offset',async({page})=>{
 await song(page);const offsets=[];let fail=true;
 await page.route('**/call/comments',async route=>{const q=route.request().postDataJSON();offsets.push(q.offset);if(q.offset&&fail)return route.fulfill({status:422,json:{error:'评论暂时断线'}});await route.fulfill({json:{comments:Array.from({length:5},(_,i)=>({id:'w'+(q.offset+i),author:'听众',text:'可滚动阅读的评论 '+(q.offset+i)})),more:q.offset===0}});});
 await page.locator('[data-action="player-comments"]').click();await expect(page.locator('.comment-card')).toHaveCount(5);
 await page.locator('#comment-list').evaluate(n=>{n.scrollTop=n.scrollHeight;});
 await expect(page.locator('#comment-pager')).toContainText('评论暂时断线');expect(offsets).toEqual([0,5]);
 await page.locator('#comment-list').evaluate(n=>{n.scrollTop-=50;n.dispatchEvent(new Event('scroll'));});expect(offsets).toEqual([0,5]);
 fail=false;await page.locator('[data-action="comments-more"]').click();await expect(page.locator('.comment-card')).toHaveCount(10);await expect(page.locator('[data-comment-index="5"]')).toBeFocused();
 expect(offsets).toEqual([0,5,5]);await expect(page.locator('#comment-pager')).toContainText('已展示 10 条');
});

test('mouse wheel lazy loading preserves the focused comment and reading position',async({page},testInfo)=>{
 await song(page);const offsets=[];let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/call/comments',async route=>{const q=route.request().postDataJSON();offsets.push(q.offset);if(q.offset)await gate;await route.fulfill({json:{comments:Array.from({length:8},(_,i)=>({id:'wheel-'+(q.offset+i),author:'听众 '+(q.offset+i),text:'音乐让每个平凡的日子都有了旋律。 '+(q.offset+i),likes:i})),more:q.offset===0}});});
 await page.locator('[data-action="player-comments"]').click();await expect(page.locator('[data-comment-index="0"]')).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect(page.locator('[data-comment-like="0"]')).toBeFocused();
 await page.keyboard.press('ArrowDown');await expect(page.locator('[data-comment-index="1"]')).toBeFocused();
 await page.keyboard.press('ArrowUp');await expect(page.locator('[data-comment-index="0"]')).toBeFocused();
 const box=await page.locator('#comment-list').boundingBox();await page.mouse.move(box.x+box.width-12,box.y+box.height-30);await page.mouse.wheel(0,2000);
 await expect.poll(()=>offsets.length).toBe(2);await expect.poll(()=>page.evaluate(()=>+(document.activeElement.getAttribute('data-comment-index')||0))).toBeGreaterThan(4);
 const before=await page.evaluate(()=>({focus:document.activeElement.getAttribute('data-focus'),scroll:document.querySelector('#comment-list').scrollTop}));
 release();await expect(page.locator('.comment-card')).toHaveCount(16);expect(await page.evaluate(()=>document.activeElement.getAttribute('data-focus'))).toBe(before.focus);
 expect(await page.locator('#comment-list').evaluate(n=>n.scrollTop)).toBeCloseTo(before.scroll,0);await visibleFocus(page,'#comment-list');
 await page.screenshot({path:testInfo.outputPath('comments.png')});expect(offsets).toEqual([0,8]);
});

test('late comment pages cannot replace a closed panel and short final pages stop lazy loading',async({page})=>{
 await song(page);let release,started=false;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/call/comments',async route=>{started=true;await gate;await route.fulfill({json:{comments:[{id:'late',author:'迟到',text:'不能写入其他面板'}],more:true}});});
 await page.locator('[data-action="player-comments"]').click();await expect.poll(()=>started).toBe(true);await page.keyboard.press('Escape');
 await page.locator('#queue-button').click();release();await expect(page.locator('#queue-list')).toBeVisible();await expect(page.locator('#modal-layer')).not.toContainText('不能写入其他面板');
 await page.keyboard.press('Escape');await page.unroute('**/call/comments');const offsets=[];
 await page.route('**/call/comments',route=>{const q=route.request().postDataJSON();offsets.push(q.offset);return route.fulfill({json:{comments:q.offset?[]:[{id:'only',text:'唯一评论'}],more:true}});});
 await page.locator('[data-action="player-comments"]').click();await expect(page.locator('[data-comment-index="0"]')).toBeFocused();
 await page.keyboard.press('ArrowDown');await expect(page.locator('#comment-pager')).toContainText('已展示 1 条');await page.keyboard.press('ArrowDown');
 await expect(page.locator('[data-action="write-comment"]')).toBeFocused();expect(offsets).toEqual([0,1]);
});

test('fullscreen lyrics appear only on the lyrics page and preserve expand and collapse behavior',async({page})=>{
 await song(page);await page.keyboard.press('Escape');
 const full=page.locator('#lyrics-button');await expect(full).toBeHidden();
 await page.locator('#queue-button').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#queue-button')).toBeFocused();
 await page.locator('#open-player').click();await expect(full).toBeVisible();await expect(full).toHaveAttribute('data-focus','full-lyrics');
 const expand=await full.locator('path').getAttribute('d');
 await expect(page.locator('.lyric-toolbar [data-action="full-lyrics"]')).toHaveCount(0);
 expect(await full.evaluate(n=>n===n.parentNode.lastElementChild)).toBe(true);
 await full.click();await expect(page.locator('.listening')).toHaveClass(/lyrics-only/);await expect(full).toHaveAttribute('aria-pressed','true');await expect(full).toBeFocused();
 await expect(full).toHaveAttribute('aria-label','退出全屏歌词');const collapse=await full.locator('path').getAttribute('d');expect(collapse).not.toBe(expand);
 await full.click();await expect(page.locator('.listening')).not.toHaveClass(/lyrics-only/);await expect(full.locator('path')).toHaveAttribute('d',expand);await expect(full).toBeFocused();
 await full.click();await expect(full.locator('path')).toHaveAttribute('d',collapse);
 await page.keyboard.press('Escape');await expect(page.locator('.listening')).not.toHaveClass(/lyrics-only/);await expect(full).toHaveAttribute('aria-pressed','false');await expect(full).toBeFocused();
 await expect(full).toHaveAttribute('aria-label','全屏歌词');await expect(full.locator('path')).toHaveAttribute('d',expand);
 await page.keyboard.press('Escape');await expect(full).toBeHidden();await expect(page.locator('#open-player')).toBeFocused();await expect(page.locator('#page-title')).not.toHaveText('正在播放');
 for(const nav of ['settings','market','search','home']){await page.locator('[data-focus="nav-'+nav+'"]').click();await expect(full).toBeHidden();}
});

test('source picker enters the current source and scrolls it into view when it is below the first item',async({page})=>{
 await page.route('**/api/sources',async route=>{const response=await route.fetch(),[s]=await response.json();await route.fulfill({json:[s,...Array.from({length:8},(_,i)=>({...s,instanceId:'extra-'+i,repository:'fixture/source-'+i,manifest:{...s.manifest,name:'音乐源 '+i}}))]});});
 await page.route('**/sources/extra-*/call/home',route=>route.fulfill({json:{sections:[]}}));
 await page.route('**/sources/extra-*/call/account',route=>route.fulfill({json:null}));
 await boot(page);await page.locator('#source-switch').click();await expect(page.locator('[data-source="fixture"]')).toBeFocused();
 await page.locator('[data-source="extra-7"]').click();await expect(page.locator('#source-name')).toHaveText('音乐源 7');
 for(const [width,height] of [[960,540],[1280,720],[1920,1080]]){
  await page.setViewportSize({width,height});await page.locator('#source-switch').click();
  const current=page.locator('[data-source="extra-7"]');await expect(current).toBeFocused();await expect(current).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-source="fixture"]')).toHaveAttribute('aria-pressed','false');await visibleFocus(page,'.modal');
  await page.keyboard.press('ArrowUp');await expect(page.locator('[data-source="extra-6"]')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#source-switch')).toBeFocused();
 }
});

test('QR login centers instructions and keeps long prompts scrollable without hiding Cancel',async({page},testInfo)=>{
 let prompt='请使用音乐服务手机 App 扫描二维码，在手机上确认登录。',qr='fixture-login',failed=false,polls=0,cancelled=0;
 await page.route('**/call/account',route=>route.fulfill({json:null}));
 await page.route('**/api/login/fixture',route=>route.fulfill({json:{ok:true}}));
 await page.route('**/api/login',route=>{if(route.request().method()==='DELETE'){cancelled++;return route.fulfill({json:{ok:true}});}polls++;return route.fulfill({json:failed?{state:'failed',message:prompt}:{state:'waiting',prompt:{qr,text:prompt}}});});
 await page.route('**/api/login/qr?*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="white"/></svg>'}));
 await boot(page);await page.locator('#account-button').click();await expect(page.locator('#login-status .qr')).toBeVisible();
 const cancel=page.locator('#modal-layer [data-action="cancel"]');await expect(cancel).toBeFocused();
 for(const [width,height] of [[960,540],[1280,720],[1920,1080]]){
  await page.setViewportSize({width,height});
  const layout=await page.locator('#login-status').evaluate(n=>{const r=n.getBoundingClientRect(),q=n.querySelector('img').getBoundingClientRect(),p=n.querySelector('p');return {center:(r.left+r.right)/2,qrCenter:(q.left+q.right)/2,align:getComputedStyle(p).textAlign};});
  expect(layout.qrCenter).toBeCloseTo(layout.center,1);expect(layout.align).toBe('center');await visibleFocus(page,'#stage');
 }
 await page.setViewportSize({width:1280,height:720});prompt='扫描二维码后，请在手机上确认授权；如果二维码过期，请取消后重新登录。'.repeat(45);
 await expect(page.locator('#login-status p')).toHaveText(prompt);await expect(cancel).toBeFocused();await visibleFocus(page,'#stage');
 expect(await page.locator('.modal').evaluate(n=>n.scrollHeight<=n.clientHeight)).toBe(true);
 await page.keyboard.press('ArrowUp');await expect(page.locator('#login-status')).toBeFocused();await page.keyboard.press('ArrowDown');
 await expect.poll(()=>page.locator('#login-status').evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
 const before=polls;await expect.poll(()=>polls).toBeGreaterThan(before);await expect(page.locator('#login-status')).toBeFocused();
 for(let i=0;i<60&&await page.locator('#login-status').evaluate(n=>n===document.activeElement);i++)await page.keyboard.press('ArrowDown');
 await expect(cancel).toBeFocused();await visibleFocus(page,'#stage');await page.screenshot({path:testInfo.outputPath('long-login-prompt.png')});
 qr='';prompt='请在手机上确认登录';await expect(page.locator('#login-status .qr')).toHaveCount(0);await expect(page.locator('#login-status p')).toHaveText(prompt);
 failed=true;prompt='登录已过期，请取消后重试。';await expect(page.locator('#login-status p')).toHaveText(prompt);await visibleFocus(page,'#stage');
 await page.keyboard.press('Escape');await expect(page.locator('#account-button')).toBeFocused();await expect.poll(()=>cancelled).toBe(1);
});

test('a delayed sidebar preference save cannot pull focus back from the footer',async({page})=>{
 await song(page);await page.keyboard.press('Escape');await page.locator('[data-focus="nav-settings"]').click();
 let release,started=false;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/preferences',async route=>{if(route.request().method()!=='POST')return route.continue();started=true;await gate;const response=await route.fetch();await route.fulfill({response});});
 await page.locator('[data-pref="icons"]').click();await expect.poll(()=>started).toBe(true);
 await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-pref="expanded"]')).toBeFocused();await page.keyboard.press('ArrowLeft');
 await expect(page.locator('[data-focus="nav-settings"]')).toBeFocused();await page.keyboard.press('ArrowDown');await expect(page.locator('#open-player')).toBeFocused();
 release();await expect(page.locator('#app')).toHaveClass('icons');await expect(page.locator('#open-player')).toBeFocused();
 await page.keyboard.press('ArrowUp');await expect(page.locator('[data-focus="nav-settings"]')).toBeFocused();
});

for(const [width,height] of [[960,540],[1280,720],[1920,1080]])test('sidebar, rows and footer form reversible focus paths at '+width+'x'+height,async({page},testInfo)=>{
 await page.setViewportSize({width,height});await song(page);await page.keyboard.press('Escape');
 for(const mode of ['expanded','icons']){
  await page.locator('[data-focus="nav-settings"]').click();await page.locator('[data-pref="'+mode+'"]').click();
  await expect(page.locator('[data-pref="'+mode+'"]')).toHaveAttribute('aria-pressed','true');
  const layout=await page.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();return {side:r('#sidebar'),bar:r('#player-bar'),stage:r('#stage')};});
  expect(layout.side.bottom).toBeCloseTo(layout.stage.bottom,0);expect(layout.bar.left).toBeCloseTo(layout.side.right,0);
  const settings=page.locator('[data-focus="nav-settings"]');await settings.focus();await page.keyboard.press('ArrowDown');await expect(page.locator('#open-player')).toBeFocused();
  await visibleFocus(page,'#player-bar');await page.keyboard.press('ArrowLeft');await expect(settings).toBeFocused();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowUp');await expect(settings).toBeFocused();
  await page.locator('[data-focus="nav-home"]').click();const row=page.locator('[data-track="1"]');await row.focus();
  const nearest=await page.locator('#open-player').evaluate(n=>{const r=n.getBoundingClientRect(),nav=document.querySelector('#nav').getBoundingClientRect();return [...document.querySelectorAll('#nav [data-focus]')].filter(x=>{const t=x.getBoundingClientRect();return t.bottom>nav.top&&t.top<nav.bottom;}).sort((a,b)=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect(),c=(r.top+r.bottom)/2;return Math.abs((x.top+x.bottom)/2-c)-Math.abs((y.top+y.bottom)/2-c);})[0].getAttribute('data-focus');});
  await page.locator('#open-player').focus();await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-focus="'+nearest+'"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(page.locator('#open-player')).toBeFocused();await row.focus();
  await page.keyboard.press('ArrowRight');await expect(page.locator('[data-track-more="1"]')).toBeFocused();
  await page.keyboard.press('ArrowLeft');await expect(row).toBeFocused();await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-focus="nav-home"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(row).toBeFocused();
  await page.locator('[data-track="2"]').focus();await page.keyboard.press('ArrowDown');
  // All lower sections remain reachable before leaving the scroll container.
  for(const kind of ['album','show','station','browse']){await expect(page.locator('[data-kind="'+kind+'"]').first()).toBeFocused();await page.keyboard.press('ArrowDown');}
  await expect(page.locator('#open-player')).toBeFocused();
  const before=await(await page.request.get('/api/player')).json();
  for(const id of ['now-artist','now-like','previous','toggle','next','seek','mode','queue']){await page.keyboard.press(id==='mode'?'ArrowDown':'ArrowRight');await expect(page.locator('[data-focus="'+id+'"]')).toBeFocused();}
  await visibleFocus(page,'#player-bar');await page.screenshot({path:testInfo.outputPath('focus-'+mode+'.png')});
  await page.keyboard.press('ArrowRight');await expect(page.locator('#queue-button')).toBeFocused();
  const after=await(await page.request.get('/api/player')).json();expect(after.seekRevision).toBe(before.seekRevision);expect(after.state).toBe('paused');
  await page.keyboard.press('ArrowUp');await expect(page.locator('[data-kind="browse"]').first()).toBeFocused();await visibleFocus(page,'#content');
  await page.locator('#now-artist').click();await expect(page.locator('#page-title')).toHaveText('The Examples');await page.locator('[data-track="0"]').focus();
  await page.keyboard.press('ArrowLeft');expect(await page.evaluate(()=>document.querySelector('#nav').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('ArrowRight');await expect(page.locator('[data-track="0"]')).toBeFocused();await page.keyboard.press('Escape');
 }
});

for(const [width,height] of [[960,540],[1280,720],[1920,1080]])test('lyrics view keeps controls on the left and offers reversible remote paths at '+width+'x'+height,async({page})=>{
 await page.setViewportSize({width,height});await song(page);
 await expect(page.locator('#open-player')).toBeHidden();await expect(page.locator('.now-meta')).toBeHidden();
 const bounds=await page.evaluate(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect();return {controls:rect('#player-bar'),lyrics:rect('.lyric-column'),tools:rect('.player-tools'),stage:rect('#stage')};});
 expect(bounds.controls.right).toBeLessThan(bounds.lyrics.left);expect(bounds.controls.top).toBeGreaterThanOrEqual(bounds.tools.bottom);expect(bounds.lyrics.bottom).toBeGreaterThan(bounds.controls.bottom-2);
 await page.locator('#toggle').focus();await page.keyboard.press('ArrowDown');await expect(page.locator('#seek')).toBeFocused();await page.keyboard.press('ArrowDown');await expect(page.locator('#queue-button')).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect(page.locator('#lyrics-button')).toBeFocused();await page.keyboard.press('ArrowRight');await expect(page.locator('[data-focus="translation"]')).toBeFocused();
 await page.keyboard.press('ArrowLeft');await expect(page.locator('#toggle')).toBeFocused();await page.keyboard.press('ArrowUp');expect(await page.evaluate(()=>document.querySelector('.record-column').contains(document.activeElement))).toBe(true);
 await page.locator('#lyrics-button').click();await expect(page.locator('.record-column')).toBeHidden();await visibleFocus(page,'#stage');
 await page.keyboard.press('Escape');await expect(page.locator('#lyrics-button')).toBeFocused();await visibleFocus(page,'#player-bar');
 await page.keyboard.press('Escape');await expect(page.locator('#open-player')).toBeVisible();await expect(page.locator('.now-meta')).toBeVisible();
 const decorations=await page.locator('.credit-link').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>getComputedStyle(n).textDecorationLine));expect(decorations.every(x=>x==='none')).toBe(true);
});

test('icon sidebar has a source symbol and keeps radio and settings drawings within their SVG bounds',async({page})=>{
 await boot(page);await page.locator('[data-focus="nav-settings"]').click();await page.locator('[data-pref="icons"]').click();await expect(page.locator('#app')).toHaveClass('icons');
 await expect(page.locator('.source-icon svg')).toBeVisible();await expect(page.locator('.source-dot')).toBeHidden();
 const settings=await page.locator('[data-focus="nav-settings"]').boundingBox(),nav=await page.locator('#nav').boundingBox();
 expect(settings.y).toBeGreaterThanOrEqual(nav.y);expect(settings.y+settings.height).toBeLessThanOrEqual(nav.y+nav.height);
 for(const selector of ['.source-icon svg','[data-focus="nav-stations"] svg','[data-focus="nav-settings"] svg']){
  const box=await page.locator(selector).evaluate(n=>{const r=n.getBBox();return {left:r.x,top:r.y,right:r.x+r.width,bottom:r.y+r.height};});
  expect(box.left).toBeGreaterThanOrEqual(1);expect(box.top).toBeGreaterThanOrEqual(1);expect(box.right).toBeLessThanOrEqual(23);expect(box.bottom).toBeLessThanOrEqual(23);
 }
 await page.locator('[data-focus="nav-stations"]').focus();await visibleFocus(page,'#nav');
 await page.locator('[data-focus="nav-settings"]').click();await page.locator('[data-pref="expanded"]').click();
});
