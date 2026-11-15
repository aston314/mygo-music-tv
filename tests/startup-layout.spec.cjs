const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';

for(const isMobile of [false,true])test((isMobile?'WebView':'desktop')+' startup keeps three centered rows while only the plus rotates',async({browser},info)=>{
 const context=await browser.newContext({viewport:{width:960,height:540},isMobile,deviceScaleFactor:isMobile?2:1}),page=await context.newPage();
 let showVersion,showApp;const versionGate=new Promise(resolve=>{showVersion=resolve;}),appGate=new Promise(resolve=>{showApp=resolve;});
 await page.route('**/api/config',async route=>{await versionGate;await route.continue();});
 await page.route('**/api/preferences',async route=>{await appGate;await route.continue();});
 await page.goto('/?token='+token);await expect(page.locator('#startup')).toBeVisible();await expect(page.locator('#startup-version')).toBeEmpty();
 const before=await page.locator('.startup-logo').boundingBox();showVersion();await expect(page.locator('#startup-version')).not.toBeEmpty();
 expect((await page.locator('.startup-logo').boundingBox()).y).toBeCloseTo(before.y,1);
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>window.MyGoI18n.apply(theme,'zh-CN'),theme);
  for(const [width,height] of [[960,540],[1280,720],[1920,1080],[928,696]]){
   await page.setViewportSize({width,height});await expect.poll(()=>page.locator('#stage').evaluate(n=>Math.round(n.getBoundingClientRect().width))).toBe(width);
   const b=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,cx:(r.left+r.right)/2,cy:(r.top+r.bottom)/2};};return {logo:rect('.startup-logo'),icon:rect('.startup-logo .icon'),status:rect('#startup-status'),version:rect('#startup-version')};});
   for(const row of [b.logo,b.status,b.version])expect(row.cx).toBeCloseTo(width/2,0);
   expect(b.logo.bottom).toBeLessThan(b.status.top);expect(b.status.bottom).toBeLessThan(b.version.top);
   expect(b.icon.cx).toBeCloseTo(b.logo.cx,0);expect(b.icon.cy).toBeCloseTo(b.logo.cy,0);
   await expect(page.locator('.startup-logo .ring')).toHaveCount(0);
   await expect(page.locator('.startup-logo svg>circle')).toHaveCSS('fill','rgb(229, 50, 75)');
   await expect(page.locator('.startup-note circle')).toHaveCSS('fill','rgb(255, 255, 255)');
   const frames=await page.evaluate(()=>{
    const plus=document.querySelector('.startup-plus'),animation=plus.getAnimations()[0];
    const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {cx:(r.left+r.right)/2,cy:(r.top+r.bottom)/2,width:r.width,height:r.height};};
    animation.pause();
    return [0,375,750,1500,2250].map(time=>{
     animation.currentTime=time;
     return {plus:rect('.startup-plus'),note:rect('.startup-note'),background:rect('.startup-logo svg>circle'),transform:getComputedStyle(plus).transform,duration:animation.effect.getTiming().duration};
    });
   });
   for(const f of frames){
    expect(f.duration).toBe(3000);
    expect(f.note).toEqual(frames[0].note);expect(f.background).toEqual(frames[0].background);
    expect(f.plus.cx).toBeCloseTo(frames[0].plus.cx,2);expect(f.plus.cy).toBeCloseTo(frames[0].plus.cy,2);
    expect(f.plus.cx).toBeGreaterThan(f.background.cx);expect(f.plus.cy).toBeLessThan(f.background.cy);
    // Keep the rotating plus inside the circular background at every sampled angle.
    for(const dx of [-1,1])for(const dy of [-1,1])expect(Math.hypot(f.plus.cx+dx*f.plus.width/2-f.background.cx,f.plus.cy+dy*f.plus.height/2-f.background.cy)).toBeLessThan(f.background.width/2);
   }
   const clockwise=frames[1].transform.slice(7,-1).split(',').map(Number);
   expect(clockwise[0]).toBeCloseTo(Math.SQRT1_2,4);expect(clockwise[1]).toBeCloseTo(Math.SQRT1_2,4);
   await page.locator('.startup-plus').evaluate(n=>{n.getAnimations()[0].currentTime=375;});
   await page.screenshot({path:info.outputPath(theme+'-'+width+'-startup.png')});
  }
 }
 showApp();await expect(page.locator('#startup')).toBeHidden();await expect(page.locator('#app')).toBeVisible();
 await expect(page.locator('.startup-plus')).toHaveCSS('animation-name','none');
 await context.close();
});

for(const endpoint of ['/health','/api/config','/api/preferences','/api/sources'])test('startup failure at '+endpoint+' stops the plus and remote retry resumes loading',async({page},info)=>{
 await page.addInitScript(()=>{
  window.startupCalls=[];
  window.Android={platform:()=> 'android-tv',startupFailed:()=>window.startupCalls.push('failed'),uiReady:()=>window.startupCalls.push('ready')};
 });
 let attempts=0,resume;
 const retryGate=new Promise(resolve=>{resume=resolve;});
 await page.route('**'+endpoint,async route=>{
  if(++attempts===1)await route.fulfill({status:503,json:{error:'启动测试失败'}});
  else{await retryGate;await route.continue();}
 });
 await page.goto('/?token='+token);
 await expect(page.locator('#startup')).toBeVisible();await expect(page.locator('#app')).toBeHidden();
 await expect(page.locator('#startup')).toHaveAttribute('data-loading','false');
 await expect(page.locator('.startup-plus')).toHaveCSS('animation-name','none');
 await expect(page.locator('.startup-plus')).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
 await expect(page.locator('#startup-retry')).toBeFocused();
 expect(await page.evaluate(()=>window.startupCalls)).toEqual(['failed']);
 await page.screenshot({path:info.outputPath('startup-failed.png')});
 await page.keyboard.press('Enter');
 await expect(page.locator('#startup')).toHaveAttribute('data-loading','true');
 await expect(page.locator('#startup-status')).toHaveText(await page.evaluate(()=>window.MyGoI18n.text('正在启动 My Music+…')));
 await expect(page.locator('#startup-retry')).toBeHidden();
 await expect(page.locator('.startup-plus')).toHaveCSS('animation-duration','3s');
 await expect(page.locator('.startup-plus')).toHaveCSS('animation-play-state','running');
 resume();await expect(page.locator('#app')).toBeVisible();await expect(page.locator('#startup')).toBeHidden();
 expect(await page.evaluate(()=>window.startupCalls)).toEqual(['failed','ready']);
 await expect(page.locator('.startup-plus')).toHaveCSS('animation-name','none');
});
