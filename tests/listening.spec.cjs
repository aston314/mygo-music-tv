const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
async function boot(page){
 await page.goto('/?token='+token);
 await expect(page.locator('[data-track="0"]')).toBeVisible();
 await page.request.post('/api/player/mode',{data:{mode:'sequence'}});
 await page.request.post('/api/player/queue',{data:{action:'clear'}});
 await page.request.post('/api/preferences',{data:{sidebar:'expanded',translation:'on'}});
}
async function seekTo(page,ms){
 const duration=(await(await page.request.get('/api/player')).json()).duration;
 await expect(page.locator('#seek')).toHaveAttribute('aria-valuemax',String(duration));
 const r=await page.locator('#seek .progress-track').boundingBox();
 await page.mouse.click(r.x+r.width*ms/duration,r.y+r.height/2);
}
async function song(page,beforePlayer){
 await boot(page);await page.locator('[data-track="0"]').click();
 await expect.poll(async()=>(await page.request.get('/api/player')).json().then(p=>p.state)).toBe('playing');
 await page.locator('#toggle').click();
 await expect.poll(async()=>(await page.request.get('/api/player')).json().then(p=>p.state)).toBe('paused');
 if(beforePlayer)await beforePlayer();
 await page.locator('#open-player').click();await expect(page.locator('.player-heading')).toBeVisible();
}

test('resizing recenters paused lyrics without replacing the line or moving focus',async({page})=>{
 let requests=0;
 await song(page,()=>page.route('**/lyrics?id=t1',route=>{
  requests++;
  return route.fulfill({json:{timed:true,lines:[{start:0,text:'暂停时歌词也应该根据可用空间重新居中，长句换行以后仍然保持当前行的位置。'.repeat(2)},{start:60000,text:'下一句歌词'}]}});
 }));
 const line=page.locator('.lyric-line.current');await expect(line).toHaveCount(1);
 const centered=()=>line.evaluate(n=>{const r=n.getBoundingClientRect(),box=document.querySelector('#lyrics').getBoundingClientRect();return Math.abs((r.top+r.bottom)/2-(box.top+box.height*.43));});
 await expect.poll(centered).toBeLessThan(2);
 const before=await(await page.request.get('/api/player')).json();
 await line.evaluate(n=>{window.resizeLyricLine=n;});
 await page.locator('#toggle').focus();
 for(const [width,height] of [[1280,960],[1920,800],[960,540]]){
  await page.setViewportSize({width,height});
  await expect.poll(()=>page.locator('#stage').evaluate(n=>{const r=n.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];})).toEqual([width,height]);
  await expect.poll(centered).toBeLessThan(2);
  await expect(page.locator('#toggle')).toBeFocused();
  expect(await line.evaluate(n=>n===window.resizeLyricLine)).toBe(true);
 }
 const after=await(await page.request.get('/api/player')).json();
 expect(after.state).toBe('paused');expect(after.generation).toBe(before.generation);expect(requests).toBe(1);
});

test('player uses SVG, centers lyrics, supports translation/fullscreen, and restores entry focus',async({page})=>{
 await song(page);
 await expect(page.locator('#toggle')).toBeFocused();
 await expect(page.locator('#lyrics')).toContainText('A plain line');
 await expect(page.locator('#lyrics .translation')).toHaveText('Translated');
 await expect(page.locator('[data-action="translation"]')).toHaveCount(0);
 await page.keyboard.press('Escape');await page.locator('[data-focus="nav-settings"]').click();
 await page.locator('[data-action="translation-setting"]').click();await expect(page.locator('[data-action="translation-setting"]')).toHaveText('歌词翻译：关');
 await page.locator('[data-focus="nav-home"]').click();await page.locator('#open-player').click();await expect(page.locator('#lyrics .translation')).toHaveCount(0);
 await page.locator('[data-action="full-lyrics"]').click();
 await expect(page.locator('.listening')).toHaveClass(/lyrics-only/);
 await page.keyboard.press('Escape');await expect(page.locator('.listening')).not.toHaveClass(/lyrics-only/);
 await page.keyboard.press('Escape');await expect(page.locator('#page-title')).not.toHaveText('正在播放');
 await expect(page.locator('#open-player')).toBeFocused();
 expect(await page.locator('#player-bar svg').count()).toBeGreaterThanOrEqual(6);
});

test('failed song favorite keeps old state and successful write reaches plugin storage',async({page})=>{
 await song(page);await page.request.post('/api/sources/fixture/call/like',{data:{id:'t1',on:false}});
 await page.locator('[data-action="player-more"]').click();
 const like=page.locator('#modal-layer [data-action="track-like"]');await expect(like).toHaveAttribute('aria-pressed','false');
 await page.route('**/call/like',route=>route.fulfill({status:422,json:{error:'登录失效'}}));
 await like.click();await expect(page.locator('#toast')).toHaveText('登录失效');await expect(like).toHaveAttribute('aria-pressed','false');
 await page.unroute('**/call/like');await like.click();await expect(like).toHaveAttribute('aria-pressed','true');
 const saved=await (await page.request.post('/api/sources/fixture/call/isLiked',{data:{ids:['t1']}})).json();expect(saved.t1).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('[data-action="player-more"]')).toBeFocused();
});

test('queue append preserves audio, remove targets duplicate entry, and mode is selected explicitly',async({page})=>{
 await song(page);let before=await(await page.request.get('/api/player')).json();
 await page.locator('[data-action="player-more"]').click();await page.locator('[data-action="queue-append"]').click();
 await expect.poll(async()=>(await page.request.get('/api/player')).json().then(p=>p.queue.length)).toBe(4);
 const after=await(await page.request.get('/api/player')).json();expect(after.generation).toBe(before.generation);expect(after.media).toBe(before.media);
 await page.locator('#queue-button').click();await expect(page.locator('#queue-list .track-row')).toHaveCount(4);
 await page.locator('[data-queue-remove="'+after.entryIds[3]+'"]').click();await expect(page.locator('#queue-list .track-row')).toHaveCount(3);
 await page.locator('#modal-layer [data-action="play-mode"]').click();await page.locator('[data-set-mode="shuffle"]').click();
 await expect.poll(async()=>(await page.request.get('/api/player')).json().then(p=>p.mode)).toBe('shuffle');
 await expect(page.locator('#queue-list')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#queue-button')).toBeFocused();
});

test('comments paginate, keep reading position, expand and recover after failed like',async({page})=>{
 await song(page);const long='这是一段需要展开阅读的长评论。'.repeat(20);
 await page.route('**/call/comments',async route=>{const q=route.request().postDataJSON();await route.fulfill({json:q.offset===0?{comments:[{id:'first',author:'听众 A',text:long,likes:3},{id:'second',author:'听众 B',text:'第二条评论',likes:0}],more:true,total:3}:{comments:[{id:'third',author:'听众 C',text:'最后一条评论',likes:1}],more:false,total:3}});});
 await page.locator('[data-action="player-comments"]').click();await expect(page.locator('.comment-card')).toHaveCount(2);
 await page.locator('[data-comment-expand="0"]').click();await expect(page.locator('#comment-text-0')).toHaveClass(/expanded/);
 await expect(page.locator('#comment-text-0')).toBeFocused();await page.keyboard.press('ArrowDown');expect(await page.locator('#comment-text-0').evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
 const like=page.locator('[data-comment-like="0"]');await page.route('**/call/likeComment',route=>route.fulfill({status:422,json:{error:'请重新登录'}}));
 await like.click();await expect(like).toHaveAttribute('aria-pressed','false');await expect(page.locator('#toast')).toHaveText('请重新登录');
 await page.unroute('**/call/likeComment');await like.click();await expect(like).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-comment-index="1"]').focus();await page.keyboard.press('ArrowDown');await expect(page.locator('.comment-card')).toHaveCount(3);
 await page.keyboard.press('Escape');await expect(page.locator('[data-action="player-comments"]')).toBeFocused();
 const p=await(await page.request.get('/api/player')).json();expect(p.state).toBe('paused');
});

test('album favorite and adding a song to a playlist use their own plugin capabilities',async({page})=>{
 await boot(page);await page.locator('[data-kind="album"]').click();
 const save=page.locator('[data-action="save-entity"]');await save.click();await expect(save).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('Escape');await page.locator('[data-track-more="0"]').click();
 await page.locator('[data-action="add-playlist"]').click();await expect(page.locator('[data-pick-playlist="0"]')).toBeVisible();
 await page.locator('[data-pick-playlist="0"]').click();await expect(page.locator('#toast')).toContainText('已加入');
 const p=await(await page.request.post('/api/sources/fixture/call/playlist',{data:{id:'p1'}})).json();expect(p.tracks.filter(t=>t.id==='t1').length).toBeGreaterThan(1);
});

test('nested comment and playlist dialogs restore one parent without extra Back presses',async({page})=>{
 await song(page);await page.locator('[data-action="player-comments"]').click();
 await expect(page.locator('.comment-card')).toHaveCount(1);
 await page.locator('[data-action="write-comment"]').click();await expect(page.locator('#compose-input')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#comment-list')).toBeVisible();await expect(page.locator('[data-action="write-comment"]')).toBeFocused();
 await page.locator('[data-action="write-comment"]').click();await page.locator('#compose-input').fill('仅在测试插件中发表');
 let posted;await page.route('**/call/postComment',route=>{posted=route.request().postDataJSON();return route.fulfill({json:{id:'test-only',text:posted.text}});});
 await page.locator('[data-action="compose-submit"]').click();await expect(page.locator('#comment-list')).toBeVisible();
 expect(posted).toEqual({trackId:'t1',text:'仅在测试插件中发表'});
 await page.keyboard.press('Escape');await expect(page.locator('#modal-layer')).toBeHidden();
 await page.locator('[data-action="player-more"]').click();await page.locator('[data-action="add-playlist"]').click();
 await page.locator('[data-action="create-for-track"]').click();await page.locator('#compose-input').fill('测试新歌单');
 await page.locator('[data-action="compose-submit"]').click();await expect(page.locator('#playlist-options')).toContainText('测试新歌单');
 await page.keyboard.press('Escape');await expect(page.locator('[data-action="queue-next"]')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#modal-layer')).toBeHidden();await expect(page.locator('[data-action="player-more"]')).toBeFocused();
});

test('lyrics from an earlier song cannot replace current word timing, and seek resets highlights',async({page})=>{
 let release,started=false;const gate=new Promise(resolve=>release=resolve);
 await song(page,()=>page.route('**/lyrics?id=t1',async route=>{started=true;await gate;await route.fulfill({json:{timed:true,lines:[{start:0,text:'STALE LYRIC'}]}});}));
 await expect.poll(()=>started).toBe(true);
 await page.locator('#next').click();await expect(page.locator('.player-heading h2')).toHaveText('Song 2');
 await expect(page.locator('.lyric-word')).toHaveCount(3);
 release();await expect(page.locator('#lyrics')).not.toContainText('STALE LYRIC');
 await expect.poll(async()=>(await page.request.get('/api/player')).json().then(p=>p.state)).toBe('playing');
 await page.locator('#toggle').click();await expect.poll(async()=>(await page.request.get('/api/player')).json().then(p=>p.state)).toBe('paused');
 await seekTo(page,2000);
 await expect(page.locator('.lyric-word.sung')).toHaveCount(2);
 await seekTo(page,0);
 await expect(page.locator('.lyric-word.sung')).toHaveCount(0);
});

test('lyrics retry recovers to untimed text that can be scrolled with a remote',async({page})=>{
 let attempts=0;
 await song(page,()=>page.route('**/lyrics?id=t1',route=>++attempts===1?route.fulfill({status:422,json:{error:'暂时断线'}}):route.fulfill({json:{timed:false,lines:Array.from({length:15},(_,i)=>({text:'没有时间戳的歌词 '+i}))}})));
 await expect(page.locator('#lyrics')).toContainText('暂时断线');
 await page.locator('[data-action="lyrics-retry"]').click();await expect(page.locator('#lyrics')).toHaveClass(/untimed/);
 await page.locator('#lyrics').focus();await page.keyboard.press('ArrowDown');expect(await page.locator('#lyrics').evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
});

for(const [width,height] of [[960,540],[1280,720],[1920,1080]])test('TV controls remain visible with long metadata and mixed input at '+width+'x'+height,async({page},testInfo)=>{
 await page.setViewportSize({width,height});await song(page);
 const p=await(await page.request.get('/api/player')).json();const track={...p.queue[0],name:'这是一首标题很长、需要在电视上完整辨认的音乐作品'.repeat(4),artists:[{name:'艺术家名字'.repeat(8)}],album:{name:'专辑名称'.repeat(10)}};
 await page.request.post('/api/player/play',{data:{queue:[track],index:0}});await expect(page.locator('.player-heading h2')).toHaveText(track.name);
 await expect.poll(async()=>(await page.request.get('/api/player')).json().then(p=>p.state)).toBe('playing');await page.locator('#toggle').click();
 const bounds=await page.locator('.player-tools').evaluate(n=>{const r=n.getBoundingClientRect(),c=document.querySelector('#content').getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,c};});
 expect(bounds.top).toBeGreaterThanOrEqual(bounds.c.top);expect(bounds.bottom).toBeLessThanOrEqual(bounds.c.bottom+1);
 await page.locator('#queue-button').hover();await expect(page.locator('#queue-button')).toBeFocused();
 await page.keyboard.press('Enter');await expect(page.locator('#queue-list')).toBeVisible();await page.keyboard.press('ArrowDown');
 expect(await page.evaluate(()=>document.querySelector('#modal-layer').contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#queue-button')).toBeFocused();
 await page.screenshot({path:testInfo.outputPath('player.png')});
 await page.route('**/api/catalog',route=>route.fulfill({json:{entries:Array.from({length:30},(_,i)=>({repository:'fixture/source-'+i,name:'mygo-music-source-'+i,description:'界面滚动测试'}))}}));
 await page.keyboard.press('Escape');await page.locator('[data-focus="nav-market"]').click();
 const catalog=page.locator('[data-catalog]').first();await catalog.hover();await expect(catalog).toBeFocused();
 await page.mouse.wheel(0,350);await expect.poll(()=>page.locator('#content').evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
 const focus=await page.evaluate(()=>{const a=document.activeElement.getBoundingClientRect(),c=document.querySelector('#content').getBoundingClientRect();return {a,c};});
 expect(focus.a.bottom).toBeGreaterThanOrEqual(focus.c.top);expect(focus.a.top).toBeLessThanOrEqual(focus.c.bottom);
});
