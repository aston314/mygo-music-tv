const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
async function player(page){return (await page.request.get('/api/player')).json();}
async function bootSong(page){
 await page.goto('/?token='+token);await expect(page.locator('[data-track="0"]')).toBeVisible();
 await page.request.post('/api/preferences',{data:{theme:'light',language:'zh-CN',sidebar:'expanded'}});
 await page.reload();await expect(page.locator('[data-track="0"]')).toBeVisible();
 await page.locator('[data-track="0"]').click();await expect.poll(async()=>(await player(page)).state).toBe('playing');
 await page.locator('#toggle').click();await expect.poll(async()=>(await player(page)).state).toBe('paused');
}

test('footer cover and both credits have reversible directions and skip unavailable metadata',async({page})=>{
 await bootSong(page);await page.locator('#open-player').focus();
 for(const [key,id] of [['ArrowRight','now-artist'],['ArrowDown','now-album'],['ArrowRight','now-like'],['ArrowLeft','now-album'],['ArrowLeft','open-player'],['ArrowRight','now-album'],['ArrowUp','now-artist'],['ArrowRight','now-like'],['ArrowLeft','now-artist']]){
  await page.keyboard.press(key);await expect(page.locator('#'+id)).toBeFocused();
 }
 await page.locator('#now-album').click();await page.keyboard.press('Escape');await expect(page.locator('#now-album')).toBeFocused();
 const p=await player(page),original=p.queue[p.index];
 for(const [artists,album,expected] of [[[],original.album,'now-album'],[original.artists,{},'now-artist'],[[],{},'now-like']]){
  await page.request.post('/api/player/play',{data:{queue:[{...original,artists,album}],index:0}});
  await expect(page.locator('#now-artist')).toBeEnabled({enabled:!!artists.length});
  await expect(page.locator('#now-album')).toBeEnabled({enabled:!!album.id});
  await expect.poll(()=>page.evaluate(()=>document.activeElement.disabled===true)).toBe(false);
  await page.locator('#open-player').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#'+expected)).toBeFocused();
  await page.keyboard.press('ArrowLeft');await expect(page.locator('#open-player')).toBeFocused();
 }
});

for(const tv of [false,true])test((tv?'TV':'desktop')+' settings and market release footer space without stopping playback or trapping focus',async({page},info)=>{
 if(tv)await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});
 await bootSong(page);const before=await player(page);
 for(const mode of ['expanded','icons']){
  await page.locator('[data-focus="nav-settings"]').click();await page.locator('[data-pref="'+mode+'"]').click();
  for(const pageName of ['settings','market']){
   await page.locator('[data-focus="nav-'+pageName+'"]').click();await expect(page.locator('#player-bar')).toBeHidden();
   await expect(page.locator(pageName==='market'?'[data-catalog="0"]':'[data-pref="expanded"]')).toBeVisible();
   const rects=await page.evaluate(()=>({main:document.querySelector('main').getBoundingClientRect().bottom,stage:document.querySelector('#stage').getBoundingClientRect().bottom}));
   expect(rects.main).toBeCloseTo(rects.stage,0);
   const last=page.locator('[data-focus="nav-settings"]');await last.focus();await page.keyboard.press('ArrowDown');await expect(last).toBeFocused();
   await page.keyboard.press('ArrowRight');expect(await page.evaluate(()=>document.querySelector('#content').contains(document.activeElement))).toBe(true);
   await page.keyboard.press('ArrowLeft');expect(await page.evaluate(()=>document.querySelector('#nav').contains(document.activeElement))).toBe(true);
   await page.screenshot({path:info.outputPath(mode+'-'+pageName+'.png')});
  }
  await page.locator('[data-focus="nav-home"]').click();await expect(page.locator('#player-bar')).toBeVisible();
 }
 const after=await player(page);expect(after.generation).toBe(before.generation);expect(after.state).toBe('paused');expect(after.position).toBeGreaterThanOrEqual(before.position);expect(after.position).toBeLessThanOrEqual(after.duration);
 await page.locator('[data-focus="nav-settings"]').click();await page.keyboard.press('Space');
 await expect.poll(async()=>(await player(page)).state).toBe('playing');await expect(page.locator('#player-bar')).toBeHidden();
 await page.keyboard.press('Space');await expect.poll(async()=>(await player(page)).state).toBe('paused');
});

for(const theme of ['light','dark'])test(theme+' lyrics credit focus fits short text, caps long text and preserves the shared focus ring',async({page},info)=>{
 await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});await bootSong(page);
 await page.request.post('/api/preferences',{data:{theme}});await page.reload();await expect(page.locator('#open-player')).toBeVisible();
 const p=await player(page),t=p.queue[p.index];
 await page.locator('#open-player').click();
 for(const long of [false,true]){
  const name=long?'长歌手名称'.repeat(16):'Echo',albumName=long?'很长的专辑名称'.repeat(16):'One';
  await page.request.post('/api/player/play',{data:{queue:[{...t,artists:[{id:'a1',name}],album:{id:'al1',name:albumName}}],index:0}});
  await expect(page.locator('[data-focus="player-artist"]')).toHaveText(name);
  for(const [width,height] of [[960,540],[1920,1080]]){
   await page.setViewportSize({width,height});await expect.poll(()=>page.locator('#stage').evaluate(n=>Math.round(n.getBoundingClientRect().width))).toBe(width);
   await page.locator('#queue-button').focus();const common=await page.locator('#queue-button').evaluate(n=>{const s=getComputedStyle(n);return [s.outlineStyle,s.outlineWidth,s.boxShadow];});
   for(const id of ['player-artist','player-album']){
    const credit=page.locator('[data-focus="'+id+'"]');await credit.focus();
    const sizes=await credit.evaluate(n=>{
     const r=document.createRange();r.selectNodeContents(n);const scale=Math.min(document.documentElement.clientWidth/1280,document.documentElement.clientHeight/720),s=getComputedStyle(n);
     return {width:n.offsetWidth,parent:n.parentElement.clientWidth,text:r.getBoundingClientRect().width/scale,padding:parseFloat(s.paddingLeft)+parseFloat(s.paddingRight)+parseFloat(s.borderLeftWidth)+parseFloat(s.borderRightWidth),focus:[s.outlineStyle,s.outlineWidth,s.boxShadow]};
    });
    expect(sizes.focus).toEqual(common);expect(sizes.width).toBeLessThanOrEqual(sizes.parent);
    if(long)expect(sizes.width).toBeCloseTo(sizes.parent,0);else {expect(Math.abs(sizes.width-sizes.text-sizes.padding)).toBeLessThan(2);expect(sizes.width).toBeLessThan(sizes.parent*.7);}
   }
   await page.screenshot({path:info.outputPath((long?'long':'short')+'-'+width+'.png')});
  }
 }
});

test('a long source error stays within the lyrics controls and leaves the seek thumb reachable',async({page})=>{
 await bootSong(page);await page.locator('#open-player').click();
 await page.route('**/api/player',async route=>{const response=await route.fetch(),p=await response.json();await route.fulfill({json:{...p,error:'音乐源暂时拒绝播放请求，请稍后再试。'.repeat(10)}});});
 await expect(page.locator('#playback-status')).toContainText('音乐源暂时拒绝');
 const boxes=await page.evaluate(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect();return {bar:rect('#player-bar'),status:rect('#playback-status'),seek:rect('#seek'),lyrics:rect('.lyric-column')};});
 expect(boxes.status.left).toBeGreaterThanOrEqual(boxes.bar.left);expect(boxes.status.right).toBeLessThanOrEqual(boxes.bar.right);
 expect(boxes.seek.left).toBeGreaterThanOrEqual(boxes.bar.left);expect(boxes.seek.right).toBeLessThan(boxes.lyrics.left);
 await page.locator('#toggle').focus();await page.keyboard.press('ArrowDown');await expect(page.locator('#seek')).toBeFocused();
});
