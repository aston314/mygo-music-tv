const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),vm=require('node:vm');
const token='playwright-only-local-session-0123456789';
async function boot(page){await page.goto('/?token='+token);await expect(page.locator('[data-track="0"]')).toBeVisible();}

test('platform presentation follows the host and TV capabilities rather than resolution or a generic OS',()=>{
 const source=fs.readFileSync('ui/platform.js','utf8');
 const cases=[
  [{Android:{platform:()=> 'android-tv'}},'Mozilla Android 6.0','android-tv',true],
  [{Android:{nativePlayer:()=>true}},'Mozilla Android','android-tv',true],
  [{},'Mozilla/5.0 (Web0S; Linux/SmartTV) Chrome/53.0 WebAppManager','webos',true],
  [{},'Mozilla/5.0 (SMART-TV; Linux; Tizen 8.0) AppleWebKit/537.36','tizen',true],
  [{tizen:{tvinputdevice:{}}},'','tizen',true],
  [{},'Mozilla/5.0 (Linux; Android 12; Mobile) Chrome/120','browser',false],
  [{},'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120','browser',false],
  ...['macos','linux','windows'].map(platform=>[{MyGoHost:{platform}},'SMART-TV',platform,false]),
  [{MyGoHost:{platform:'unknown'}},'','browser',false]
 ];
 for(const [globals,ua,name,tv] of cases){
  const attrs={},window={...globals,navigator:{userAgent:ua},document:{documentElement:{setAttribute:(key,value)=>attrs[key]=value}}};
  vm.runInNewContext(source,{window});
  expect({...window.MyGoPlatform}).toEqual({name,tv});
  expect(attrs['data-form-factor']).toBe(tv?'tv':'desktop');
 }
});

for(const platform of ['android-tv','webos','tizen','browser','macos','linux','windows'])test(platform+' chooses back controls and scrollbars while keeping navigation usable',async({page})=>{
 const tv=['android-tv','webos','tizen'].includes(platform);
 await page.addInitScript(platform=>{window.MyGoHost={platform};},platform);
 await boot(page);await expect(page.locator('html')).toHaveAttribute('data-form-factor',tv?'tv':'desktop');
 const scrollbar=()=>page.locator('#content').evaluate(n=>{const s=getComputedStyle(n,'::-webkit-scrollbar');return {display:s.display,width:s.width};});
 expect(await scrollbar()).toEqual(tv?{display:'none',width:'0px'}:{display:'inline',width:'4px'});
 await page.locator('[data-kind="album"]').click();
 const back=page.locator('[data-action="detail-back"]');if(tv)await expect(back).toBeHidden();else await expect(back).toBeVisible();
 if(platform==='webos'||platform==='tizen')await page.evaluate(code=>document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:code,bubbles:true})),platform==='webos'?461:10009);
 else await page.keyboard.press('Escape');
 await expect(page.locator('[data-kind="album"]')).toBeFocused();
 await page.locator('#source-switch').click();
 if(tv)await expect(page.locator('[data-navigation-back]')).toBeHidden();else await expect(page.locator('[data-navigation-back]')).toBeVisible();
 await expect(page.locator('[data-source="fixture"]')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#source-switch')).toBeFocused();
 await page.locator('[data-focus="nav-settings"]').click();
 await expect(page.locator('[data-action="exit-confirm"]')).toHaveCount(0);
 const action=page.locator('[data-focus="save-0"]');await action.focus();
 await page.evaluate(()=>document.querySelector('#content').scrollTop=document.querySelector('#content').scrollHeight);
 expect(await page.locator('#content').evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
 await page.keyboard.press('ArrowUp');expect(await page.evaluate(()=>document.querySelector('#content').contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('[data-focus="nav-home"]')).toHaveClass('active');
 await page.keyboard.press('Escape');await expect(page.locator('[data-action="cancel"]')).toBeVisible();await expect(page.locator('[data-action="cancel"]')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#modal-layer')).toBeHidden();
});

test('a TV information dialog without actions has a focusable reading region and remote return',async({page})=>{
 await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});
 await page.route('**/call/account',r=>r.fulfill({json:{name:'音乐听众'}}));
 await page.route('**/api/sources',async r=>{const response=await r.fetch(),sources=await response.json();sources[0].capabilities.signOut=false;await r.fulfill({json:sources});});
 await boot(page);await page.locator('#account-button').click();
 await expect(page.locator('[data-focus="modal-content"]')).toBeFocused();
 await expect(page.locator('[data-navigation-back]')).toBeHidden();
 await page.keyboard.press('Escape');await expect(page.locator('#account-button')).toBeFocused();
});

async function centeredButtons(page,selectors){
 const errors=await page.locator(selectors).evaluateAll(nodes=>{
  const scale=Math.min(document.documentElement.clientWidth/1280,document.documentElement.clientHeight/720),errors=[];
  for(const n of nodes){
   if(!n.getClientRects().length)continue;
   const r=n.getBoundingClientRect(),parts=n.querySelectorAll('.button-content .icon,.button-content>.button-label,#account-name,.nav-text,.appearance-copy');
   for(const part of parts){
    if(!part.getClientRects().length)continue;
    const c=part.getBoundingClientRect(),dy=Math.abs((c.top+c.bottom-r.top-r.bottom)/2/scale),dx=Math.abs((c.left+c.right-r.left-r.right)/2/scale);
    if(dy>.75||n.classList.contains('icon-button')&&dx>.75)errors.push({button:n.getAttribute('data-focus'),part:part.className.baseVal||part.className,dy,dx});
   }
  }
  return errors;
 });
 expect(errors).toEqual([]);
}

for(const [theme,tv] of [['light',false],['dark',false],['light',true]])test(theme+(tv?' TV':' desktop')+' buttons center SVG and text in home, settings, player and dialogs',async({page},info)=>{
 if(tv)await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});
 await page.route('**/call/account',r=>r.fulfill({json:{name:'音乐听众'}}));
 await boot(page);await page.request.post('/api/preferences',{data:{theme,language:'zh-CN',sidebar:'expanded'}});await page.reload();await expect(page.locator('#account-name')).toHaveText('音乐听众');
 for(const [width,height] of [[960,540],[1280,800],[1920,1080]]){
  await page.setViewportSize({width,height});
  await centeredButtons(page,'#account-button,nav button,.source-switch,.icon-button,.icon-label');
  await expect(page.locator('.source-icon')).toBeHidden();
 }
 await page.screenshot({path:info.outputPath(theme+'-home-buttons.png')});
 await page.locator('[data-focus="nav-settings"]').click();await centeredButtons(page,'.icon-label,.appearance-choice');
 await page.locator('button[data-theme="'+theme+'"]').focus();await page.screenshot({path:info.outputPath(theme+'-settings-buttons.png')});
 await page.locator('[data-focus="nav-home"]').click();await page.locator('[data-track="0"]').click();
 await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).state).toBe('playing');
 await page.locator('#toggle').click();await expect(page.locator('#toggle')).toHaveAttribute('aria-label','播放');
 await page.locator('#open-player').click();await expect(page.locator('.player-heading')).toBeVisible();
 if(tv)await expect(page.locator('[data-action="player-back"]')).toBeHidden();else await expect(page.locator('[data-action="player-back"]')).toBeVisible();
 await expect(page.locator('#page-title')).toBeHidden();await expect(page.locator('[data-action="translation"]')).toHaveCount(0);
 await page.locator('#toggle').focus();
 const gaps=await page.evaluate(()=>{
  const scale=Math.min(document.documentElement.clientWidth/1280,document.documentElement.clientHeight/720),button=document.querySelector('#toggle').getBoundingClientRect(),status=document.querySelector('#playback-status').getBoundingClientRect(),progress=document.querySelector('.timeline-controls').getBoundingClientRect(),heading=document.querySelector('.player-heading').getBoundingClientRect(),tools=document.querySelector('.player-tools').getBoundingClientRect();
  return {above:(status.top-button.bottom)/scale-7,below:(progress.top-status.bottom)/scale,metadata:(tools.top-heading.bottom)/scale};
 });
 expect(gaps.above).toBeGreaterThanOrEqual(7);expect(gaps.below).toBeGreaterThanOrEqual(9);expect(gaps.metadata).toBeGreaterThanOrEqual(0);
 await centeredButtons(page,'.icon-button,.icon-label');await page.screenshot({path:info.outputPath(theme+'-player-buttons.png')});
 await page.locator('[data-action="player-more"]').click();await centeredButtons(page,'.menu-option');await page.keyboard.press('Escape');
 await page.locator('#queue-button').click();await centeredButtons(page,'.icon-button,.icon-label');await page.keyboard.press('Escape');
 await page.locator('[data-action="player-comments"]').click();await expect(page.locator('[data-comment-like]')).toBeVisible();await centeredButtons(page,'.comment-actions button,.icon-button,.icon-label');
 await page.screenshot({path:info.outputPath(theme+'-comment-buttons.png')});
});

for(const theme of ['light','dark'])test(theme+' player distinguishes song and album and keeps credit focus rings visible with long names',async({page},info)=>{
 await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});
 await boot(page);await page.request.post('/api/preferences',{data:{theme,language:'zh-CN'}});await page.reload();await expect(page.locator('[data-track="0"]')).toBeVisible();
 await page.locator('[data-track="0"]').click();await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).state).toBe('playing');
 await page.locator('#toggle').click();await page.locator('#open-player').click();
 const p=await(await page.request.get('/api/player')).json(),name='歌曲与专辑同名的音乐作品'.repeat(7),t={...p.queue[p.index],name,artists:[{id:'a1',name:'歌手的名字'.repeat(12)}],album:{id:'al1',name}};
 await page.request.post('/api/player/play',{data:{queue:[t],index:0}});await expect(page.locator('.player-heading h2')).toHaveText(name);
 await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).state).toBe('playing');await page.locator('#toggle').click();
 await expect(page.locator('[data-focus="player-album"]')).toHaveText('专辑 · '+name);
 const style=n=>{const s=getComputedStyle(n);return {outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,outlineColor:s.outlineStyle==='none'?'none':s.outlineColor,offset:s.outlineOffset,shadow:s.boxShadow,background:s.backgroundColor};};
 await page.locator('#queue-button').focus();const common=await page.locator('#queue-button').evaluate(style);
 for(const [width,height] of [[960,540],[1280,800],[1920,1080]]){
  await page.setViewportSize({width,height});await expect.poll(async()=>Math.round((await page.locator('#stage').boundingBox()).width)).toBe(width);
  for(const id of ['player-artist','player-album']){
   const credit=page.locator('[data-focus="'+id+'"]');await credit.focus();await expect(credit).toBeFocused();expect(await credit.evaluate(style)).toEqual(common);
   const issues=await credit.evaluate(n=>{
    const scale=Math.min(document.documentElement.clientWidth/1280,document.documentElement.clientHeight/720),r=n.getBoundingClientRect(),ring=6*scale,issues=[];
    for(let p=n.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),c=p.getBoundingClientRect();if(['hidden','clip','auto','scroll'].includes(s.overflowX)&&(r.left-ring<c.left-.5||r.right+ring>c.right+.5))issues.push(p.className+' horizontal');if(['hidden','clip','auto','scroll'].includes(s.overflowY)&&(r.top-ring<c.top-.5||r.bottom+ring>c.bottom+.5))issues.push(p.className+' vertical');}
    const rect=s=>document.querySelector(s).getBoundingClientRect(),heading=rect('.player-heading'),tools=rect('.player-tools'),transport=rect('.transport'),artist=rect('[data-focus="player-artist"]'),album=rect('[data-focus="player-album"]');
    if(album.top-artist.bottom<12*scale-.5)issues.push('credit rows overlap focus');
    if(tools.top-heading.bottom<-.5)issues.push('metadata overlaps tools');
    if(transport.top-tools.bottom<6*scale-.5)issues.push('tools overlap transport focus');
    if(getComputedStyle(n).textDecorationLine!=='none')issues.push('underlined');return issues;
   });expect(issues).toEqual([]);
  }
 }
 await page.screenshot({path:info.outputPath(theme+'-album-focus.png')});
 await page.locator('[data-focus="player-artist"]').focus();await page.keyboard.press('ArrowDown');await expect(page.locator('[data-focus="player-album"]')).toBeFocused();
 await page.keyboard.press('ArrowUp');await expect(page.locator('[data-focus="player-artist"]')).toBeFocused();
 await page.locator('[data-focus="player-album"]').click();await expect(page.locator('#page-title')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('[data-focus="player-album"]')).toBeFocused();
});
