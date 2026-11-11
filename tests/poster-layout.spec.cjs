const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
const albums=Array.from({length:18},(_,i)=>({id:'album-'+i,name:'专辑 '+(i+1),description:'演唱者 '+(i+1),imageUrl:i%2?'/poster-test.svg':''}));

for(const isMobile of [false,true])test((isMobile?'WebView':'desktop')+' poster rows adapt density, stay square and preserve remote focus after resizing',async({browser},info)=>{
 const context=await browser.newContext({viewport:{width:960,height:540},isMobile,deviceScaleFactor:isMobile?2:1});const page=await context.newPage();
 await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});
 await page.route('**/poster-test.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#9ca9c1"/><circle cx="200" cy="200" r="124" fill="#dce2ec"/><circle cx="200" cy="200" r="78" fill="#9ca9c1"/><circle cx="200" cy="200" r="12" fill="#dce2ec"/></svg>'}));
 await page.route('**/call/home',route=>route.fulfill({json:{sections:[{title:'专辑精选',albums}]}}));
 await page.goto('/?token='+token);await expect(page.locator('.album-card')).toHaveCount(18);
 for(const theme of ['light','dark']){
  await page.request.post('/api/preferences',{data:{theme,sidebar:'expanded'}});await page.reload();await expect(page.locator('.album-card')).toHaveCount(18);
  for(const [width,height,columns] of [[960,540,3],[1280,720,4],[1536,864,4],[1920,1080,5],[2560,1440,6],[1920,800,5],[928,696,3]]){
   await page.setViewportSize({width,height});
   await expect.poll(()=>page.locator('.album-card').evaluateAll(nodes=>nodes.filter(n=>n.offsetTop===nodes[0].offsetTop).length)).toBe(columns);
   const bounds=await page.locator('.album-card').evaluateAll(nodes=>nodes.map(n=>{const art=n.querySelector('.album-art'),r=art.getBoundingClientRect();return {delta:Math.abs(r.width-r.height),width:r.width,inside:n.offsetLeft+n.offsetWidth<=n.parentElement.clientWidth+1};}));
   expect(bounds.every(r=>r.delta<1&&r.width>80&&r.inside)).toBe(true);
   const first=page.locator('.album-card').nth(0);await first.focus();await page.keyboard.press('ArrowRight');await expect(page.locator('.album-card').nth(1)).toBeFocused();
   await page.keyboard.press('ArrowDown');await expect(page.locator('.album-card').nth(columns+1)).toBeFocused();
   if(width===960||width===1920&&height===1080){await first.focus();await page.screenshot({path:info.outputPath(theme+'-'+width+'.png')});}
  }
  await page.setViewportSize({width:1920,height:1080});await page.locator('.album-card').nth(12).focus();await page.setViewportSize({width:960,height:540});
  await expect(page.locator('.album-card').nth(12)).toBeFocused();await expect.poll(()=>page.locator('.album-card').nth(12).evaluate(n=>{const a=n.getBoundingClientRect(),b=document.querySelector('#content').getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom;})).toBe(true);
 }
 await context.close();
});

test('Android native window chooses poster density without changing CSS canvas scale',async({browser})=>{
 const context=await browser.newContext({viewport:{width:960,height:540},isMobile:true,deviceScaleFactor:2}),page=await context.newPage();
 await page.addInitScript(()=>{window.hostWidth=1920;window.Android={platform:function(){return 'android-tv';},nativeViewWidth:function(){return window.hostWidth;}};});
 await page.route('**/call/home',route=>route.fulfill({json:{sections:[{title:'专辑精选',albums:albums.map(a=>({...a,imageUrl:''}))}]}}));
 await page.goto('/?token='+token);await expect(page.locator('.album-card')).toHaveCount(18);
 for(const [width,columns] of [[1920,5],[1280,4],[960,3],[2560,6],[0,3]]){
  await page.evaluate(width=>{window.hostWidth=width;window.MyGo.refreshViewport();},width);
  await expect.poll(()=>page.locator('.album-card').evaluateAll(nodes=>nodes.filter(n=>n.offsetTop===nodes[0].offsetTop).length)).toBe(columns);
  const canvas=await page.locator('#stage').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,transform:getComputedStyle(n).transform}));
  expect(canvas.width).toBe(960);expect(canvas.height).toBe(540);expect(canvas.transform).toBe('matrix(0.75, 0, 0, 0.75, 0, 0)');
 }
 await context.close();
});
