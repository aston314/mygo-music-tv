const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
const lyrics={timed:true,lines:[
 {start:1000,end:4000,text:'音乐陪着你',translation:'Music stays with you',words:[
  {start:1000,end:3000,text:'音'},{start:3000,end:3250,text:'乐'},
  {start:3250,end:3500,text:'陪'},{start:3500,end:3750,text:'着'},{start:3750,end:4000,text:'你'}]},
 {start:4000,end:5000,text:'普通歌词继续整行同步'}
]};
async function player(page){return (await page.request.get('/api/player')).json();}
async function openSong(page,data=lyrics){
 await page.route('**/lyrics?id=t1',r=>r.fulfill({json:data}));
 await page.goto('/?token='+token);await expect(page.locator('[data-track="0"]')).toBeVisible();
 await page.locator('[data-track="0"]').click();await expect.poll(async()=>(await player(page)).state).toBe('playing');
 await page.locator('#toggle').click();await expect.poll(async()=>(await player(page)).state).toBe('paused');
 await page.locator('#open-player').click();await expect(page.locator('.lyric-line')).toHaveCount(data.lines.length);
}
async function seek(page,position){
 const response=await page.request.post('/api/player/control',{data:{action:'seek',position}});expect(response.ok()).toBe(true);
 await expect(page.locator('#seek')).toHaveAttribute('aria-valuenow',String(position));
}
async function paint(word){return word.evaluate(n=>({color:n.style.color,transform:n.firstChild.style.transform}));}

for(const theme of ['light','dark'])test(theme+' word effects follow singing duration, freeze while paused and restore on seek/fullscreen',async({page},info)=>{
 await openSong(page);await page.evaluate(theme=>window.MyGoI18n.apply(theme,'zh-CN'),theme);
 await seek(page,2000);const line=page.locator('[data-line="0"]'),word=line.locator('.lyric-word').first();
 await expect(line).toHaveClass('lyric-line current word-effects');
 await expect(word).toHaveCSS('color',theme==='light'?'rgb(86, 86, 93)':'rgb(182, 216, 178)');
 await expect(word.locator('.lyric-ink')).toHaveCSS('transform','matrix(1.045, 0, 0, 1.045, 0, -1.8)');
 const halfway=await paint(word);await word.evaluate(n=>{window.lyricMutations=0;window.lyricObserver=new MutationObserver(changes=>{window.lyricMutations+=changes.length;});window.lyricObserver.observe(n,{attributes:true,subtree:true});});
 await page.waitForTimeout(300);expect(await paint(word)).toEqual(halfway);expect(await page.evaluate(()=>window.lyricMutations)).toBe(0);await page.evaluate(()=>window.lyricObserver.disconnect());
 const second=line.locator('.lyric-word').nth(1),width=await second.evaluate(n=>n.offsetLeft);await seek(page,1500);
 await expect(word).toHaveCSS('color',theme==='light'?'rgb(114, 114, 123)':'rgb(168, 201, 164)');
 expect(await second.evaluate(n=>n.offsetLeft)).toBe(width);
 await seek(page,3000);await expect(word).toHaveCSS('color',theme==='light'?'rgb(29, 29, 31)':'rgb(210, 245, 205)');
 expect((await paint(word)).transform).toBe('');
 await seek(page,0);await expect(line).not.toHaveClass(/current/);await expect(page.locator('.lyric-word.sung')).toHaveCount(0);expect(await paint(word)).toEqual({color:'',transform:''});
 await seek(page,2000);await page.locator('#lyrics-button').click();await expect(page.locator('.lyrics-only')).toBeVisible();
 await expect(page.locator('[data-line="0"] .lyric-word').first()).toHaveCSS('color',halfway.color);await expect(page.locator('#lyrics-button')).toBeFocused();
 for(const [width,height] of [[960,540],[1280,720],[1920,1080]]){
  await page.setViewportSize({width,height});
  await expect.poll(()=>page.locator('#stage').evaluate(n=>Math.round(n.getBoundingClientRect().width))).toBe(width);
  const box=await page.locator('.lyric-line.current').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
 }
 await page.setViewportSize({width:1280,height:720});await page.keyboard.press('Escape');await expect(page.locator('.record-column')).toBeVisible();
 await expect.poll(()=>page.locator('.lyric-line.current').evaluate(n=>{const r=n.getBoundingClientRect(),box=document.querySelector('#lyrics').getBoundingClientRect();return Math.abs((r.top+r.bottom)/2-(box.top+box.height*.43));})).toBeLessThan(2);
 await page.screenshot({path:info.outputPath(theme+'-word-effects.png')});
 await seek(page,4500);await expect(page.locator('[data-line="1"]')).toHaveClass('lyric-line current');await expect(page.locator('[data-line="1"] .lyric-word')).toHaveCount(0);
});

for(const fallback of ['no animation API','reduced motion'])test(fallback+' keeps the existing line and word highlighting usable',async({page})=>{
 if(fallback==='no animation API')await page.addInitScript(()=>{window.requestAnimationFrame=undefined;window.cancelAnimationFrame=undefined;});
 else await page.emulateMedia({reducedMotion:'reduce'});
 await openSong(page);await seek(page,2000);
 const line=page.locator('[data-line="0"]');await expect(line).toHaveClass('lyric-line current');await expect(line).toHaveCSS('font-size','40px');
 await expect(page.locator('.lyric-word.sung')).toHaveCount(1);expect(await paint(line.locator('.lyric-word').first())).toEqual({color:'',transform:''});
 if(fallback==='reduced motion'){
  await page.emulateMedia({reducedMotion:'no-preference'});await expect(line).toHaveClass(/word-effects/);
  await page.emulateMedia({reducedMotion:'reduce'});await expect(line).not.toHaveClass(/word-effects/);
  expect(await paint(line.locator('.lyric-word').first())).toEqual({color:'',transform:''});
 }
 await seek(page,4500);await expect(page.locator('[data-line="1"]')).toHaveClass('lyric-line current');
});

test('plain LRC and malformed or mismatched word timing fall back per line without losing text',async({page})=>{
 await openSong(page,{timed:true,lines:[
  {start:0,text:'只有整行时间'},
  {start:1000,text:'缺少结束时间',words:[{start:1000,text:'缺少结束时间'}]},
  {start:2000,text:'时间倒序',words:[{start:2000,end:1999,text:'时间倒序'}]},
  {start:3000,text:'保留完整歌词',words:[{start:3000,end:4000,text:'残缺'}]},
  {start:4000,text:'正常',words:[{start:4000,end:5000,text:'正'},{start:5000,end:6000,text:'常'}]}
 ]});
 for(const [index,text] of ['只有整行时间','缺少结束时间','时间倒序','保留完整歌词'].entries()){
  await seek(page,index*1000+100);const line=page.locator('[data-line="'+index+'"]');
  await expect(line).toHaveClass('lyric-line current');await expect(line).toHaveText(text);await expect(line.locator('.lyric-word')).toHaveCount(0);
 }
 await seek(page,4500);await expect(page.locator('[data-line="4"]')).toHaveClass(/word-effects/);
});

test('native playback clock animates only while playing and releases frames on page exit',async({page})=>{
 await page.addInitScript(()=>{
  window.MyGoHost={platform:'android-tv'};window.Android={nativePlayer:()=>true};window.lyricFrames=0;
  const request=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=callback=>request(now=>{window.lyricFrames++;callback(now);});
 });
 // Native events are supplied by this test instead of an Android device.
 await page.goto('/?token='+token);await expect(page.locator('[data-track="0"]')).toBeVisible();
 const fixture=(await(await page.request.post('/api/player/play',{data:{queue:[{id:'t1',source:'fixture',name:'Song 1'}],index:0}})).json());
 await expect.poll(async()=>!!(await player(page)).media).toBe(true);
 await page.request.post('/api/player/event',{data:{generation:fixture.generation,state:'playing',seekRevision:fixture.seekRevision,position:1500,duration:12000}});
 await page.route('**/lyrics?id=t1',r=>r.fulfill({json:lyrics}));
 await expect(page.locator('#toggle')).toHaveAttribute('aria-label','暂停');await page.locator('#open-player').click();
 await expect(page.locator('.word-effects')).toHaveCount(1);await expect.poll(()=>page.evaluate(()=>window.lyricFrames)).toBeGreaterThan(3);
 const current=await player(page);
 await page.request.post('/api/player/event',{data:{generation:current.generation,state:'buffering',seekRevision:current.seekRevision,position:2000,duration:12000}});
 await expect(page.locator('#playback-status')).toHaveText('缓冲中');await page.waitForTimeout(100);
 const buffering=await paint(page.locator('.lyric-word').first()),bufferFrames=await page.evaluate(()=>window.lyricFrames);
 await page.waitForTimeout(200);expect(await paint(page.locator('.lyric-word').first())).toEqual(buffering);expect(await page.evaluate(()=>window.lyricFrames)).toBe(bufferFrames);
 await page.request.post('/api/player/event',{data:{generation:current.generation,state:'playing',seekRevision:current.seekRevision,position:2000,duration:12000}});
 await expect.poll(()=>page.evaluate(()=>window.lyricFrames)).toBeGreaterThan(bufferFrames+2);
 await page.locator('#toggle').click();await expect.poll(async()=>(await player(page)).state).toBe('paused');
 const word=page.locator('.lyric-word').first();await expect.poll(()=>page.evaluate(()=>window.lyricFrames)).toBeGreaterThan(0);
 await page.waitForTimeout(100);const frozen=await paint(word),frames=await page.evaluate(()=>window.lyricFrames);
 await page.waitForTimeout(200);expect(await paint(word)).toEqual(frozen);expect(await page.evaluate(()=>window.lyricFrames)).toBe(frames);
 await page.locator('#toggle').click();
 await expect.poll(async()=>(await player(page)).wantPlay).toBe(true);
 await page.request.post('/api/player/event',{data:{generation:current.generation,state:'playing',seekRevision:current.seekRevision,position:2200,duration:12000}});
 await expect.poll(()=>page.evaluate(()=>window.lyricFrames)).toBeGreaterThan(frames+2);
 await page.keyboard.press('Escape');await expect(page.locator('#lyrics')).toHaveCount(0);
 await page.waitForTimeout(100);const exited=await page.evaluate(()=>window.lyricFrames);await page.waitForTimeout(200);expect(await page.evaluate(()=>window.lyricFrames)).toBe(exited);
});
