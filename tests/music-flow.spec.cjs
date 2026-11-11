const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
async function boot(page){
 await page.goto('/?token='+token);await expect(page.locator('[data-track="0"]')).toBeVisible();
 await page.request.post('/api/player/queue',{data:{action:'clear'}});
 await page.request.post('/api/player/mode',{data:{mode:'sequence'}});
}
async function song(page){
 await boot(page);await page.locator('[data-track="0"]').click();
 await expect.poll(async()=>(await page.request.get('/api/player')).json().then(p=>p.state)).toBe('playing');
 await page.locator('#toggle').click();await expect.poll(async()=>(await page.request.get('/api/player')).json().then(p=>p.state)).toBe('paused');
 await page.locator('#open-player').click();await expect(page.locator('.player-heading')).toBeVisible();
}

test('account stays hidden on market and settings and remains known on music pages after a refresh failure',async({page})=>{
 let signedIn=true,fail=false;
 await page.route('**/call/account',route=>route.fulfill(fail?{status:422,json:{error:'账号查询超时'}}:{json:signedIn?{id:'me',name:'客厅听众'}:null}));
 await page.route('**/call/signOut',route=>{signedIn=false;return route.fulfill({json:null});});
 await boot(page);await expect(page.locator('#account-name')).toHaveText('客厅听众');
 for(const nav of ['settings','market','search','home']){await page.locator('[data-focus="nav-'+nav+'"]').click();if(nav==='settings'||nav==='market')await expect(page.locator('#account-button')).toBeHidden();else await expect(page.locator('#account-button')).toBeVisible();await expect(page.locator('#account-name')).toHaveText('客厅听众');}
 fail=true;await page.locator('#account-button').click();await expect(page.locator('#modal-layer')).toContainText('账号查询超时');await expect(page.locator('#account-name')).toHaveText('客厅听众');await page.keyboard.press('Escape');
 fail=false;await page.locator('#account-button').click();await expect(page.locator('#modal-layer')).toContainText('客厅听众');
 await page.locator('#modal-layer [data-action="signout"]').click();await expect(page.locator('#account-name')).toHaveText('未登录');
});

test('late account response cannot replace the newly selected source account',async({page})=>{
 await page.route('**/api/sources',async route=>{const response=await route.fetch(),list=await response.json(),s=list[0];await route.fulfill({json:[s,{...s,instanceId:'second',repository:'fixture/second',manifest:{...s.manifest,name:'第二音乐源'}}]});});
 let release,started=false;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/sources/fixture/call/account',async route=>{started=true;await gate;await route.fulfill({json:{id:'first-user',name:'原账号'}});});
 await page.route('**/sources/second/call/account',route=>route.fulfill({json:{id:'second-user',name:'第二账号'}}));
 await page.route('**/sources/second/call/home',route=>route.fulfill({json:{sections:[]}}));
 await boot(page);await expect.poll(()=>started).toBe(true);await page.locator('#source-switch').click();await page.locator('[data-source="second"]').click();
 await expect(page.locator('#account-name')).toHaveText('第二账号');release();await expect(page.locator('#source-name')).toHaveText('第二音乐源');
 await expect(page.locator('#account-name')).toHaveText('第二账号');
});

test('favorites appear once on the lyrics page and keep their saved state across navigation and track changes',async({page})=>{
 let liked=true,fail=true;
 await page.route('**/call/isLiked',route=>{const ids=route.request().postDataJSON().ids;return route.fulfill({json:Object.fromEntries(ids.map(id=>[id,id==='t1'&&liked]))});});
 await page.route('**/call/like',route=>{if(fail)return route.fulfill({status:422,json:{error:'收藏失败'}});liked=route.request().postDataJSON().on;return route.fulfill({json:null});});
 await song(page);const heart=page.locator('#now-like');
 await expect(heart).toBeHidden();await expect(page.locator('[data-focus="player-like"]')).toBeVisible();
 await expect(page.locator('#now-artist')).toHaveText('The Examples');await expect(page.locator('#now-album')).toContainText('First Album');
 await page.keyboard.press('Escape');await expect(heart).toBeVisible();
 await expect(heart).toHaveAttribute('aria-pressed','true');expect(await heart.locator('svg').evaluate(n=>getComputedStyle(n).fill)).not.toBe('none');
 await heart.click();await expect(page.locator('#toast')).toHaveText('收藏失败');await expect(heart).toHaveAttribute('aria-pressed','true');
 fail=false;await heart.click();await expect(heart).toHaveAttribute('aria-pressed','false');
 await page.locator('#open-player').click();await expect(heart).toBeHidden();
 await expect(page.locator('[data-focus="player-like"]')).toHaveAttribute('aria-pressed','false');
 await page.locator('[data-focus="player-like"]').click();await expect(heart).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('Escape');await expect(heart).toBeVisible();await expect(heart).toHaveAttribute('aria-pressed','true');
 await page.locator('#open-player').click();await expect(heart).toBeHidden();
 await page.locator('#next').click();await expect(page.locator('#now-title')).toHaveText('Song 2');await expect(heart).toHaveAttribute('aria-pressed','false');
 await expect(heart).toBeHidden();await page.locator('#toggle').focus();await page.keyboard.press('ArrowDown');await expect(page.locator('#seek')).toBeFocused();
 await page.keyboard.press('Escape');await expect(heart).toBeVisible();await expect(heart).toHaveAttribute('aria-pressed','false');
});

test('player credits connect artist songs, artist albums and album tracks while preserving audio and return focus',async({page})=>{
 await song(page);const before=await(await page.request.get('/api/player')).json();
 await page.locator('[data-focus="player-artist"]').click();await expect(page.locator('#page-title')).toHaveText('The Examples');await expect(page.locator('[data-track]')).toHaveCount(3);
 await expect(page.locator('#content h2')).toHaveCount(0);
 await page.locator('[data-detail-section="albums"]').click();await expect(page.locator('[data-kind="album"]')).toHaveCount(1);
 const album=page.locator('[data-kind="album"]');await album.click();await expect(page.locator('#page-title')).toHaveText('First Album');await expect(page.locator('[data-track]')).toHaveCount(3);
 await expect(page.locator('#content h2')).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(page.locator('[data-detail-section="albums"]')).toHaveAttribute('aria-pressed','true');await expect(album).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('.player-heading')).toBeVisible();await expect(page.locator('[data-focus="player-artist"]')).toBeFocused();
 await page.locator('[data-focus="player-album"]').click();await expect(page.locator('#page-title')).toHaveText('First Album');await page.keyboard.press('Escape');await expect(page.locator('[data-focus="player-album"]')).toBeFocused();
 const after=await(await page.request.get('/api/player')).json();expect(after.generation).toBe(before.generation);expect(after.media).toBe(before.media);expect(after.state).toBe('paused');
});

test('focused seek shows a circular thumb and adjusts inline without a dialog',async({page})=>{
 await song(page);await page.locator('#seek').focus();
 const style=await page.locator('#seek').evaluate(n=>{const s=getComputedStyle(n),dot=n.querySelector('.progress-thumb'),d=getComputedStyle(dot),r=dot.getBoundingClientRect();return {outline:s.outlineStyle,shadow:s.boxShadow,background:s.backgroundColor,radius:d.borderRadius,width:r.width,height:r.height};});
 expect(style.outline).toBe('none');expect(style.shadow).toBe('none');expect(style.background).toBe('rgba(0, 0, 0, 0)');expect(style.width).toBe(style.height);expect(style.radius).toBe('50%');
 await page.keyboard.press('Enter');await expect(page.locator('#modal-layer')).toBeHidden();
 const before=await(await page.request.get('/api/player')).json();
 await page.keyboard.press('ArrowRight');await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).seekRevision).toBe(before.seekRevision+1);
 await expect(page.locator('#seek')).toBeFocused();await expect(page.locator('#modal-layer')).toBeHidden();
 await page.keyboard.press('ArrowLeft');await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).seekRevision).toBe(before.seekRevision+2);
 await page.keyboard.press('ArrowDown');await expect(page.locator('#queue-button')).toBeFocused();
 await page.keyboard.press('ArrowUp');await expect(page.locator('#seek')).toBeFocused();
});

test('collaborations offer every credited artist and return to the same footer control',async({page})=>{
 await song(page);const p=await(await page.request.get('/api/player')).json();
 const t={...p.queue[0],artists:[{id:'a1',name:'歌手一'},{id:'a2',name:'歌手二'}]};
 await page.request.post('/api/player/play',{data:{queue:[t],index:0}});await expect(page.locator('#now-artist')).toHaveText('歌手一 / 歌手二');
 let artistID;await page.route('**/call/artist',async route=>{artistID=route.request().postDataJSON().id;await route.fulfill({json:{artist:{id:artistID,name:'歌手二'},tracks:[],albums:[]}});});
 await page.locator('[data-focus="player-artist"]').click();await expect(page.locator('[data-credit-artist]')).toHaveCount(2);await page.locator('[data-credit-artist="1"]').click();
 await expect(page.locator('#page-title')).toHaveText('歌手二');expect(artistID).toBe('a2');
 await page.keyboard.press('Escape');await expect(page.locator('[data-focus="player-artist"]')).toBeFocused();
});

test('playing credits and their account keep the original source after browsing another source',async({page})=>{
 await page.route('**/api/sources',async route=>{const response=await route.fetch(),list=await response.json(),s=list[0];await route.fulfill({json:[s,{...s,instanceId:'second',repository:'fixture/second',manifest:{...s.manifest,name:'第二音乐源'}}]});});
 await page.route('**/sources/fixture/call/account',route=>route.fulfill({json:{id:'first-user',name:'播放源账号'}}));
 await page.route('**/sources/second/call/account',route=>route.fulfill({json:{id:'second-user',name:'浏览源账号'}}));
 await page.route('**/sources/second/call/home',route=>route.fulfill({json:{sections:[]}}));
 await song(page);await expect(page.locator('#account-button')).toBeHidden();
 await page.locator('#lyrics-button').click();await expect(page.locator('#account-button')).toBeHidden();await page.keyboard.press('Escape');
 await page.keyboard.press('Escape');await page.locator('#source-switch').click();await page.locator('[data-source="second"]').click();await expect(page.locator('#account-name')).toHaveText('浏览源账号');
 await page.locator('#now-artist').click();await expect(page.locator('#page-title')).toHaveText('The Examples');await expect(page.locator('#account-name')).toHaveText('播放源账号');
 await page.locator('[data-detail-section="albums"]').click();await page.locator('[data-kind="album"]').click();await expect(page.locator('#page-title')).toHaveText('First Album');await expect(page.locator('[data-track]')).toHaveCount(3);
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await expect(page.locator('#account-name')).toHaveText('浏览源账号');await expect(page.locator('#now-artist')).toBeFocused();
});
