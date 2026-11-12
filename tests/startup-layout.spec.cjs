const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';

for(const isMobile of [false,true])test((isMobile?'WebView':'desktop')+' startup keeps three centered rows and a clear gap around the rotating logo',async({browser},info)=>{
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
   const b=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,cx:(r.left+r.right)/2,cy:(r.top+r.bottom)/2};};return {logo:rect('.startup-logo'),ring:rect('.startup-logo .ring'),icon:rect('.startup-logo .icon'),status:rect('#startup-status'),version:rect('#startup-version')};});
   for(const row of [b.logo,b.status,b.version])expect(row.cx).toBeCloseTo(width/2,0);
   expect(b.logo.bottom).toBeLessThan(b.status.top);expect(b.status.bottom).toBeLessThan(b.version.top);
   expect(b.icon.cx).toBeCloseTo(b.logo.cx,0);expect(b.icon.cy).toBeCloseTo(b.logo.cy,0);
   const gap=b.logo.width/2-Math.hypot(b.icon.width,b.icon.height)/2;
   expect(gap).toBeGreaterThan(b.logo.width*.14);
   await expect(page.locator('.ring')).toHaveCSS('animation-name','spin');
   await page.screenshot({path:info.outputPath(theme+'-'+width+'-startup.png')});
  }
 }
 showApp();await expect(page.locator('#startup')).toBeHidden();await expect(page.locator('#app')).toBeVisible();
 await context.close();
});
