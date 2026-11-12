const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
const cover='<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#d5a695"/><path d="M0 100L240 10V240H0Z" fill="#695f81"/><circle cx="165" cy="70" r="34" fill="#f8e8c9"/></svg>';
async function player(page){return (await page.request.get('/api/player')).json();}
async function boot(page){
 await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};window.Android={nativePlayer:()=>true};});
 await page.route('**/covers/record.svg',r=>r.fulfill({contentType:'image/svg+xml',body:cover}));
 await page.goto('/?token='+token);await expect(page.locator('[data-track="0"]')).toBeVisible();
 await page.request.post('/api/preferences',{data:{theme:'light',language:'zh-CN',sidebar:'expanded'}});
 await page.reload();await expect(page.locator('[data-track="0"]')).toBeVisible();
 await page.request.post('/api/player/play',{data:{queue:[{id:'t1',source:'fixture',name:'音乐陪着你',artists:[{id:'a1',name:'回声乐团'}],album:{id:'al1',name:'沿途风景',imageUrl:'/covers/record.svg'}}],index:0}});
 await expect.poll(async()=>!!(await player(page)).media).toBe(true);
 await expect(page.locator('#open-player img')).toHaveJSProperty('naturalWidth',240);
 await expect(page.locator('#now-title')).toHaveText('音乐陪着你');
}
async function event(page,state){
 const p=await player(page);
 await page.request.post('/api/player/event',{data:{generation:p.generation,seekRevision:p.seekRevision,state,position:1000,duration:12000,error:state==='failed'?'播放失败':''}});
}
async function angle(image){return image.evaluate(n=>{const m=getComputedStyle(n).transform;if(m==='none')return 0;const v=m.slice(7,-1).split(',').map(Number);return Math.atan2(v[1],v[0])*180/Math.PI;});}
async function frozen(image){await image.page().waitForTimeout(60);const a=await angle(image);await image.page().waitForTimeout(250);expect(await angle(image)).toBeCloseTo(a,2);return a;}

test('only confirmed playback turns the circular cover clockwise, while buffering and pause preserve its angle',async({page})=>{
 await boot(page);const image=page.locator('#open-player img'),button=page.locator('#open-player');
 await expect(button).toHaveAttribute('data-playing','false');await frozen(image);
 await event(page,'playing');await expect(button).toHaveAttribute('data-playing','true');
 const start=await angle(image);await page.waitForTimeout(300);const turned=await angle(image);
 expect(turned-start).toBeGreaterThan(2);expect(turned-start).toBeLessThan(12);
 await expect(button).toHaveCSS('transform','none');
 await event(page,'buffering');await expect(button).toHaveAttribute('data-playing','false');const buffered=await frozen(image);
 await event(page,'playing');await expect(button).toHaveAttribute('data-playing','true');expect(await angle(image)).toBeGreaterThanOrEqual(buffered-.1);
 await page.waitForTimeout(200);expect(await angle(image)).toBeGreaterThan(buffered+1);
 await page.locator('#toggle').click();await expect(button).toHaveAttribute('data-playing','false');const paused=await frozen(image);
 await page.locator('#toggle').click();await event(page,'playing');await expect(button).toHaveAttribute('data-playing','true');expect(await angle(image)).toBeGreaterThanOrEqual(paused-.1);
 await event(page,'failed');await expect(button).toHaveAttribute('data-playing','false');await frozen(image);
 await button.click();await expect(page.locator('.large-cover')).toBeVisible();
 await expect(page.locator('.large-cover img')).toHaveCSS('animation-name','none');await expect(page.locator('.large-cover')).toHaveCSS('border-radius','16px');
});

test('reduced motion keeps a static circular cover and retains lyrics navigation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await boot(page);await event(page,'playing');
 const image=page.locator('#open-player img');await expect(image).toHaveCSS('animation-name','none');await frozen(image);
 await expect(page.locator('#open-player')).toHaveCSS('border-radius','50%');
 await page.locator('#open-player').click();await expect(page.locator('#lyrics')).toBeVisible();
});

for(const theme of ['light','dark'])test(theme+' footer leaves clear space between focused credits, title and player edges at every scale',async({page},info)=>{
 await boot(page);await page.evaluate(theme=>window.MyGoI18n.apply(theme,'zh-CN'),theme);
 for(const [width,height] of [[960,540],[1280,720],[1920,1080],[1280,800]]){
  await page.setViewportSize({width,height});await expect.poll(()=>page.locator('#stage').evaluate(n=>Math.round(n.getBoundingClientRect().width))).toBe(width);
  for(const id of ['now-artist','now-album']){
   await page.locator('#'+id).focus();
   const r=await page.evaluate(()=>{
    const rect=s=>document.querySelector(s).getBoundingClientRect(),scale=document.querySelector('#stage').getBoundingClientRect().width/document.querySelector('#stage').offsetWidth;
    return {title:rect('#now-title'),artist:rect('#now-artist'),album:rect('#now-album'),bar:rect('#player-bar'),main:rect('main'),cover:rect('#open-player'),like:rect('#now-like'),queue:rect('#queue-button'),scale};
   });
   expect((r.artist.top-r.title.bottom)/r.scale).toBeGreaterThanOrEqual(7.9);
   expect((r.album.top-r.artist.bottom)/r.scale).toBeGreaterThanOrEqual(7.9);
   expect((r.title.top-r.bar.top)/r.scale).toBeGreaterThanOrEqual(10);
   expect((r.bar.bottom-r.album.bottom)/r.scale).toBeGreaterThanOrEqual(10);
   expect(r.main.bottom).toBeCloseTo(r.bar.top,1);
   expect(r.cover.width).toBeCloseTo(r.cover.height,1);expect(r.cover.right).toBeLessThan(r.artist.left);
   expect(r.artist.right+6*r.scale).toBeLessThan(r.like.left);expect(r.queue.right).toBeLessThan(r.bar.right);
   if(width!==1280||height===720)await page.screenshot({path:info.outputPath(theme+'-'+width+'-'+id+'.png')});
  }
 }
});
