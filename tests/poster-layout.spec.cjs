const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
const albums=Array.from({length:18},(_,i)=>({id:'album-'+i,name:'专辑 '+(i+1),description:'演唱者 '+(i+1),imageUrl:i%2?'/poster-test.svg':''}));
const longTitle='那些陪伴我们走过漫长岁月的旋律与故事 · ALongUnbrokenMusicCollectionTitleForWrapping';
const longSubtitle='副标题保持单行，超过卡片宽度的部分应该省略显示。'.repeat(4);

test.afterEach(async({request})=>{const saved=await request.post('/api/preferences',{headers:{Authorization:'Bearer '+token},data:{theme:'light',language:'zh-CN'}});expect(saved.ok()).toBe(true);});

for(const isMobile of [false,true])test((isMobile?'WebView':'desktop')+' cards wrap complete titles, ellipsize subtitles and show only real playlist counts',async({browser},info)=>{
 const context=await browser.newContext({viewport:{width:960,height:540},isMobile,deviceScaleFactor:isMobile?2:1}),page=await context.newPage();
 const playlists=[{id:'counted',name:longTitle,trackCount:43,owner:'不显示的创建者',description:'不显示的歌单描述'},{id:'unknown',name:longTitle,owner:'不显示的创建者'},{id:'empty',name:'空歌单',trackCount:0},{id:'invalid',name:longTitle,trackCount:-1}];
 const sections=[{title:'歌单',playlists}];
 for(const key of ['albums','artists','shows','stations','links'])sections.push({title:key,[key]:Array.from({length:8},(_,i)=>({id:key+i,name:longTitle,description:longSubtitle}))});
 await page.route('**/call/home',r=>r.fulfill({json:{sections}}));
 await page.route('**/call/playlists',r=>r.fulfill({json:playlists}));
 await page.route('**/call/search',r=>r.fulfill({json:{playlists,more:false}}));
 await page.route('**/api/catalog*',r=>r.fulfill({json:{entries:[{repository:'very-long-community-author-name-for-music-plugin/online',name:longTitle,description:longSubtitle}]}}));
 await page.goto('/?token='+token);
 for(const theme of ['light','dark']){
  await page.request.post('/api/preferences',{data:{theme,language:'zh-CN'}});await page.reload();
  await expect(page.locator('.album-card')).toHaveCount(44);
  const cards=page.locator('[data-kind="playlist"]');await expect(cards.nth(0).locator('small')).toHaveText('43 首');await expect(cards.nth(1).locator('small')).toHaveCount(0);await expect(cards.nth(2).locator('small')).toHaveText('0 首');await expect(cards.nth(3).locator('small')).toHaveCount(0);
  await expect(page.locator('#content')).not.toContainText('不显示的创建者');await expect(page.locator('#content')).not.toContainText('打开聆听');
  for(const [width,height,columns] of [[960,540,3],[1280,720,4],[1920,1080,5]]){
   await page.setViewportSize({width,height});
   await expect.poll(()=>page.locator('.album-grid').nth(1).locator('.album-card').evaluateAll(nodes=>nodes.filter(n=>n.offsetTop===nodes[0].offsetTop).length)).toBe(columns);
   const titles=await page.locator('.album-card strong').evaluateAll(nodes=>nodes.filter(n=>n.textContent!=='空歌单').map(n=>{const s=getComputedStyle(n);return {lines:n.clientHeight/parseFloat(s.lineHeight),wrap:s.whiteSpace,overflow:n.scrollWidth<=n.clientWidth+1&&n.scrollHeight<=n.clientHeight+1};}));
   expect(titles.every(t=>t.lines>=2&&t.wrap==='normal'&&t.overflow)).toBe(true);
   const subtitles=await page.locator('.album-card:not([data-kind="playlist"]) small').evaluateAll(nodes=>nodes.map(n=>({style:getComputedStyle(n).textOverflow,nowrap:getComputedStyle(n).whiteSpace,overflow:n.scrollWidth>n.clientWidth,height:n.clientHeight,line:parseFloat(getComputedStyle(n).lineHeight)})));
   expect(subtitles.every(s=>s.style==='ellipsis'&&s.nowrap==='nowrap'&&s.overflow&&s.height<=s.line+1)).toBe(true);
   const grid=page.locator('.album-grid').nth(1),first=grid.locator('.album-card').first();await first.focus();await page.keyboard.press('ArrowRight');await expect(grid.locator('.album-card').nth(1)).toBeFocused();await page.keyboard.press('ArrowDown');await expect(grid.locator('.album-card').nth(columns+1)).toBeFocused();
   await first.focus();await expect(first).toHaveCSS('box-shadow','none');await expect(first).toHaveCSS('outline-style','none');await expect(first).toHaveCSS('transform','none');const ring=await first.locator('.album-art').evaluate(n=>{const s=getComputedStyle(n,'::after');return {border:s.borderTopWidth,color:s.borderTopColor,edges:[s.top,s.right,s.bottom,s.left],layer:s.zIndex,radius:s.borderRadius,artRadius:getComputedStyle(n).borderRadius};});expect(ring.border).toBe('4px');expect(ring.color).toBe(theme==='light'?'rgb(229, 50, 75)':'rgb(183, 245, 215)');expect(ring.edges).toEqual(['-10px','-10px','-10px','-10px']);expect(ring.layer).toBe('1');expect(ring.radius).toBe(theme==='light'?'22px':'19px');
   const square=await first.locator('.album-art').evaluate(n=>{const r=n.getBoundingClientRect();return Math.abs(r.width-r.height)<1;});expect(square).toBe(true);
   await cards.first().focus();if(width===960||width===1920)await page.screenshot({path:info.outputPath('card-text-'+theme+'-'+width+'.png')});
  }
  await page.locator('[data-focus="nav-market"]').click();await expect(page.locator('.plugin-card')).toHaveCount(1);
  await expect(page.locator('.card-name')).toHaveText(longTitle);await expect(page.locator('.card-name')).toHaveCSS('white-space','normal');
  const plugin=await page.locator('.plugin-card').evaluate(n=>{const title=n.querySelector('.card-name'),description=n.querySelector('.card-description');return {titleLines:title.clientHeight/parseFloat(getComputedStyle(title).lineHeight),inside:title.scrollWidth<=title.clientWidth+1,subtitle:getComputedStyle(description).textOverflow,descriptionHeight:description.clientHeight,line:parseFloat(getComputedStyle(description).lineHeight)};});
  expect(plugin.titleLines).toBeGreaterThan(1);expect(plugin.inside).toBe(true);expect(plugin.subtitle).toBe('ellipsis');expect(plugin.descriptionHeight).toBeLessThanOrEqual(plugin.line+1);
  await page.locator('[data-focus="nav-home"]').click();
 }
 await page.locator('[data-focus="nav-playlists"]').click();await expect(page.locator('[data-kind="playlist"]').first().locator('small')).toHaveText('43 首');
 await page.locator('[data-focus="nav-search"]').click();await page.locator('#search-input').fill('音乐');await page.locator('[data-search-kind="playlists"]').click();await page.locator('[data-focus="search-submit"]').click();await expect(page.locator('[data-kind="playlist"]').first().locator('small')).toHaveText('43 首');
 await page.request.post('/api/preferences',{data:{language:'zh-TW'}});await page.reload();await page.locator('[data-focus="nav-playlists"]').click();await expect(page.locator('[data-kind="playlist"]').first().locator('small')).toHaveText('43 首');await expect(page.locator('#content')).not.toContainText('不显示的创建者');
 await context.close();
});

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
