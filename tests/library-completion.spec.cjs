const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
async function player(page){return (await page.request.get('/api/player')).json();}
async function boot(page){
 await page.goto('/?token='+token);await expect(page.locator('#app')).toBeVisible();
 await page.request.post('/api/player/queue',{data:{action:'clear'}});
 await page.request.post('/api/player/mode',{data:{mode:'sequence'}});
 await page.request.post('/api/preferences',{data:{theme:'light',language:'zh-CN',quality:'high',source:'fixture',sidebar:'expanded'}});
 await page.reload();await expect(page.locator('[data-track="0"]')).toBeVisible();
}
async function call(page,method,data){return (await page.request.post('/api/sources/fixture/call/'+method,{data})).json();}
async function owned(page){
 const made=await call(page,'createPlaylist',{name:'TV editing '+Date.now()});
 await call(page,'addToPlaylist',{id:made.id,trackIds:['t1','t2','t3']});
 await page.locator('[data-focus="nav-playlists"]').click();
 await page.locator('[data-kind="playlist"]').filter({hasText:made.name}).click();
 await expect(page.locator('[data-track]')).toHaveCount(3);return made;
}
test.beforeEach(async({page})=>boot(page));

test('quality choices persist without interrupting current playback and remain usable in Traditional Chinese',async({page},info)=>{
 await page.locator('[data-track="0"]').click();await expect.poll(async()=>(await player(page)).state).toBe('playing');
 await page.locator('#toggle').click();const before=await player(page);
 await page.locator('[data-focus="nav-settings"]').click();
 const choice=page.locator('[data-quality="lossless"]');await choice.click();await expect(choice).toHaveAttribute('aria-pressed','true');await expect(choice).toBeFocused();
 const unchanged=await player(page);expect(unchanged.generation).toBe(before.generation);expect(unchanged.media).toBe(before.media);expect(unchanged.quality).toBe('high');
 await page.locator('[data-language="zh-TW"]').click();await expect(choice).toHaveText('無損音質');await choice.focus();
 await page.screenshot({path:info.outputPath('quality-light-720.png')});
 await page.reload();await page.locator('[data-focus="nav-settings"]').click();await expect(choice).toHaveAttribute('aria-pressed','true');
 await page.request.post('/api/player/control',{data:{action:'retry'}});await expect.poll(async()=>(await player(page)).quality).toBe('lossless');
 await page.request.post('/api/player/control',{data:{action:'pause'}});
});

test('playlist rename, reorder, removal and delete preserve audio, handle failures and restore focus',async({page},info)=>{
 const made=await owned(page);await page.locator('[data-track="0"]').click();await expect.poll(async()=>(await player(page)).state).toBe('playing');await page.locator('#toggle').click();const before=await player(page);
 await page.locator('[data-track-more="1"]').click();await page.locator('[data-action="playlist-track-up"]').click();
 await expect(page.locator('[data-track="0"] strong')).toHaveText('Song 2');await expect(page.locator('[data-track-more="0"]')).toBeFocused();
 await page.locator('[data-track-more="2"]').click();await page.route('**/call/removeFromPlaylist',r=>r.fulfill({status:422,json:{error:'账号权限不足'}}));
 const remove=page.locator('[data-action="playlist-remove-track"]');await remove.click();await expect(page.locator('#toast')).toHaveText('账号权限不足');await expect(remove).toBeEnabled();
 expect((await call(page,'playlist',{id:made.id})).tracks).toHaveLength(3);
 await page.unroute('**/call/removeFromPlaylist');await remove.click();await expect(page.locator('[data-track]')).toHaveCount(2);await expect(page.locator('[data-track-more="1"]')).toBeFocused();
 await page.locator('[data-action="manage-playlist"]').click();await expect(page.locator('[data-action="rename-playlist"]')).toBeFocused();await page.locator('[data-action="rename-playlist"]').click();
 await page.locator('#compose-input').fill('客厅收藏');await page.route('**/call/renamePlaylist',r=>r.fulfill({status:422,json:{error:'保存失败'}}));await page.locator('[data-action="compose-submit"]').click();await expect(page.locator('#toast')).toHaveText('保存失败');await expect(page.locator('#page-title')).toHaveText(made.name);
 await page.unroute('**/call/renamePlaylist');await page.locator('[data-action="compose-submit"]').click();await expect(page.locator('#page-title')).toHaveText('客厅收藏');await expect(page.locator('[data-action="manage-playlist"]')).toBeFocused();
 const after=await player(page);expect(after.generation).toBe(before.generation);expect(after.media).toBe(before.media);expect(after.queue).toEqual(before.queue);
 await page.screenshot({path:info.outputPath('playlist-edited-720.png')});
 await page.locator('[data-action="manage-playlist"]').click();await page.locator('[data-action="delete-playlist"]').click();await expect(page.locator('[data-action="cancel"]')).toBeFocused();
 await page.route('**/call/deletePlaylist',r=>r.fulfill({status:422,json:{error:'删除失败'}}));await page.locator('[data-action="delete-playlist-confirm"]').click();await expect(page.locator('#toast')).toHaveText('删除失败');expect((await call(page,'playlist',{id:made.id})).id).toBe(made.id);
 await page.unroute('**/call/deletePlaylist');await page.locator('[data-action="delete-playlist-confirm"]').click();await expect(page.locator('#page-title')).toHaveText('我的歌单');await expect(page.locator('[data-kind="playlist"]').filter({hasText:'客厅收藏'})).toHaveCount(0);
 expect((await player(page)).generation).toBe(before.generation);
});

test('a successful playlist write with failed refresh blocks stale index edits and offers retry',async({page})=>{
 await owned(page);await page.locator('[data-track-more="1"]').click();
 await page.route('**/call/playlist',r=>r.fulfill({status:503,json:{error:'暂时无法刷新'}}));
 await page.locator('[data-action="playlist-track-up"]').click();await expect(page.locator('[data-action="refresh-detail"]')).toBeFocused();
 await expect(page.locator('[data-track="0"] strong')).toHaveText('Song 1');await expect(page.locator('[data-action="manage-playlist"]')).toHaveCount(0);
 await page.locator('[data-track-more="0"]').click();await expect(page.locator('[data-action="playlist-track-down"]')).toHaveCount(0);await page.keyboard.press('Escape');
 await page.unroute('**/call/playlist');await page.locator('[data-action="refresh-detail"]').click();await expect(page.locator('[data-track="0"] strong')).toHaveText('Song 2');
});

test('fixed and other users playlists expose no owner editing actions',async({page})=>{
 const tracks=(await call(page,'playlist',{id:'p1'})).tracks;
 for(const meta of [{mine:false},{mine:true,fixed:true}]){
  await page.route('**/call/playlist',r=>r.fulfill({json:{id:'p1',name:'Protected',tracks,...meta}}));
  await page.locator('[data-focus="nav-playlists"]').click();await page.locator('[data-kind="playlist"]').filter({hasText:'Favourites'}).click();
  await expect(page.locator('[data-track]')).toHaveCount(tracks.length);await expect(page.locator('[data-action="manage-playlist"]')).toHaveCount(0);
  await page.locator('[data-track-more="1"]').click();await expect(page.locator('[data-action="playlist-remove-track"]')).toHaveCount(0);await expect(page.locator('[data-action="playlist-track-up"]')).toHaveCount(0);await page.keyboard.press('Escape');await page.unroute('**/call/playlist');
 }
});

test('podcast pages load lazily, retain DOM and focus, retry at the same offset and remove duplicates',async({page},info)=>{
 const requests=[];let failed=false;const episodes=Array.from({length:10},(_,i)=>({id:'ep'+i,source:'fixture',name:'Episode '+i,album:{},artists:[],showId:'s1',duration:12000}));
 await page.route('**/call/show',async r=>{const {offset}=r.request().postDataJSON();requests.push(offset);if(offset===10&&!failed){failed=true;await r.fulfill({status:503,json:{error:'分页连接失败'}});return;}await r.fulfill({json:{show:{id:'s1',name:'The Show'},episodes:offset===0?episodes:[episodes[9],{...episodes[0],id:'ep10',name:'Episode 10'}],more:offset===0}});});
 await page.locator('[data-kind="show"]').click();await expect(page.locator('[data-track]')).toHaveCount(10);expect(requests).toEqual([0]);
 const first=await page.locator('[data-track="0"]').elementHandle();await page.locator('[data-track="8"]').focus();await page.locator('#content').evaluate(n=>n.scrollTop=n.scrollHeight);
 await expect(page.locator('#episode-pagination')).toContainText('分页连接失败');await expect(page.locator('[data-track]')).toHaveCount(10);await expect(page.locator('[data-track="8"]')).toBeFocused();
 await page.locator('[data-action="episodes-more"]').click();await expect(page.locator('[data-track]')).toHaveCount(11);await expect(page.locator('[data-track="10"]')).toBeFocused();expect(requests).toEqual([0,10,10]);
 expect(await first.evaluate(n=>n.isConnected)).toBe(true);await expect(page.locator('[data-action="episodes-more"]')).toHaveCount(0);
 await page.screenshot({path:info.outputPath('podcast-lazy-720.png')});
});

test('late podcast page cannot replace another screen and empty pages terminate loading',async({page})=>{
 let release,started;const pending=new Promise(r=>started=r);
 await page.route('**/call/show',async r=>{const q=r.request().postDataJSON();if(q.offset){started();await new Promise(r=>release=r);try{await r.fulfill({json:{episodes:[],more:true}});}catch{}return;}await r.fulfill({json:{show:{id:'s1',name:'The Show'},episodes:[{id:'ep',name:'Episode',album:{},source:'fixture'}],more:true}});});
 await page.locator('[data-kind="show"]').click();await page.locator('[data-action="episodes-more"]').click();await pending;
 await page.locator('[data-focus="nav-home"]').click();release();await expect(page.locator('[data-track="0"] strong')).toHaveText('Song 1');
 await page.unroute('**/call/show');await page.route('**/call/show',r=>r.fulfill({json:r.request().postDataJSON().offset?{episodes:[],more:true}:{show:{id:'s1',name:'The Show'},episodes:[{id:'ep',name:'Episode',album:{},source:'fixture'}],more:true}}));
 await page.locator('[data-kind="show"]').click();await page.locator('[data-action="episodes-more"]').click();await expect(page.locator('[data-action="episodes-more"]')).toHaveCount(0);await expect(page.locator('[data-track]')).toHaveCount(1);
});

test('a delayed page response preserves focus deliberately moved to the playback bar',async({page})=>{
 let release,entered;const pending=new Promise(r=>entered=r);
 await page.route('**/call/home',async r=>{entered();await new Promise(r=>release=r);await r.fulfill({json:{sections:[{title:'Home',tracks:[{id:'t1',source:'fixture',name:'Song 1',album:{}}]}]}});});
 await page.locator('[data-focus="nav-home"]').click();await pending;await page.locator('#queue-button').focus();release();
 await expect(page.locator('[data-track="0"]')).toBeVisible();await expect(page.locator('#queue-button')).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect(page.locator('#queue-button')).toBeFocused();
});

test('radio keeps replenishing, marks the mode and can leave without restarting the current song',async({page},info)=>{
 await page.locator('[data-kind="station"]').click();await expect(page.locator('[data-track]')).toHaveCount(3);await page.locator('[data-track="0"]').click();
 await expect.poll(async()=>(await player(page)).queue.length).toBe(6);await expect.poll(async()=>(await player(page)).state).toBe('playing');await page.locator('#toggle').click();
 await expect(page.locator('#mode-button')).toHaveAttribute('aria-label','电台连续播放');
 await page.locator('#queue-button').click();await expect(page.locator('#station-controls')).toContainText('自动继续播放电台推荐');await expect(page.locator('[data-queue-jump]').first()).toBeFocused();
 await expect(page.locator('#modal-layer [data-action="play-mode"]')).toBeHidden();
 await page.screenshot({path:info.outputPath('radio-queue-720.png')});const before=await player(page);
 await page.locator('[data-action="leave-station"]').click();await expect(page.locator('#station-controls')).toBeEmpty();const after=await player(page);expect(after.station).toBeUndefined();expect(after.generation).toBe(before.generation);expect(after.media).toBe(before.media);expect(after.wantPlay).toBe(false);
 await expect(page.locator('#mode-button')).toHaveAttribute('aria-label','顺序播放');await expect(page.locator('#modal-layer [data-action="play-mode"]')).toBeVisible();await expect(page.locator('#modal-layer [data-action="play-mode"]')).toBeFocused();
});

test('restarting the core restores a paused queue and position without fetching audio until resume',async({page})=>{
 test.setTimeout(60000);
 const {spawn,execFileSync}=require('node:child_process'),{mkdtempSync,rmSync}=require('node:fs'),{tmpdir}=require('node:os'),{join}=require('node:path');
 const dir=mkdtempSync(join(tmpdir(),'mygo-session-browser-')),binary=join(dir,'core');let child;
 async function start(){
  child=spawn(binary,['-mode','fixture','-data-dir',dir,'-port','0'],{env:{...process.env,MYGO_INSTANCE_TOKEN:token},stdio:['ignore','pipe','pipe']});
  return new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Core startup timed out')),10000);child.stdout.on('data',b=>{output+=b;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);if(!output.includes('http://'))reject(Error('Core exited: '+code));});});
 }
 async function stop(){if(!child||child.exitCode!==null)return;const closed=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await closed;}
 try{
  execFileSync('go',['build','-mod=vendor','-o',binary,'./core/cmd/music-tv']);
  let base=await start();await page.goto(base+'/?token='+token);await expect(page.locator('[data-track="0"]')).toBeVisible();
  await page.locator('[data-track="0"]').click();const state=async()=>(await page.request.get(base+'/api/player')).json();
  await expect.poll(async()=>(await state()).state).toBe('playing');await page.locator('#toggle').click();await expect.poll(async()=>(await state()).state).toBe('paused');
  await page.request.post(base+'/api/player/control',{data:{action:'seek',position:2000}});const before=await state();await stop();
  base=await start();let mediaRequests=0;const observe=r=>{if(r.url().startsWith(base+'/media/'))mediaRequests++;};page.on('request',observe);
  await page.goto(base+'/?token='+token);await expect(page.locator('#playback-status')).toHaveText('已恢复上次播放，按播放继续');
  const restored=await state();expect(restored.queue).toEqual(before.queue);expect(restored.entryIds).toEqual(before.entryIds);expect(restored.position).toBe(2000);expect(restored.wantPlay).toBe(false);expect(restored.media).toBeUndefined();expect(mediaRequests).toBe(0);await expect(page.locator('#position')).toHaveText('0:02');
  await page.locator('#toggle').click();await expect.poll(async()=>(await state()).state).toBe('playing');expect(mediaRequests).toBeGreaterThan(0);expect((await state()).position).toBeGreaterThanOrEqual(1900);
  page.off('request',observe);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});
