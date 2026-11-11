const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),vm=require('node:vm'),acorn=require('acorn');
const token='playwright-only-local-session-0123456789';
async function reset(page){await page.goto('/?token='+token);await page.request.post('/api/preferences',{data:{theme:'dark',language:'zh-CN',sidebar:'expanded'}});await page.reload();await expect(page.locator('#app')).toBeVisible();}
async function settings(page){await page.locator('[data-focus="nav-settings"]').click();}
async function choose(page,key,value){const n=page.locator('button[data-'+key+'="'+value+'"]');await n.click();await expect(n).toHaveAttribute('aria-pressed','true');}
test.beforeEach(async({page})=>reset(page));
test.afterEach(async({page})=>{await page.request.post('/api/preferences',{data:{theme:'dark',language:'zh-CN',sidebar:'expanded'}});});

test('separate language catalogs cover UI keys and safely fall back',()=>{
 const ctx={window:{}};vm.createContext(ctx);
 for(const code of ['zh-CN','zh-TW'])vm.runInContext(fs.readFileSync('ui/locales/'+code+'.js','utf8'),ctx);
 const locales=ctx.window.MyGoLocales;expect(Object.keys(locales['zh-TW']).sort()).toEqual(Object.keys(locales['zh-CN']).sort());
 const keys=new Set();function visit(n){if(!n||typeof n!=='object')return;if(n.type==='CallExpression'&&['tr','dialog'].includes(n.callee.name)&&n.arguments[0]?.type==='Literal')keys.add(n.arguments[0].value);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}
 visit(acorn.parse(fs.readFileSync('ui/app.js','utf8'),{ecmaVersion:5}));
 for(const match of fs.readFileSync('ui/index.html','utf8').matchAll(/data-i18n(?:-aria-label|-title|-placeholder)?="([^"]+)"/g))keys.add(match[1]);
 for(const code of ['zh-CN','zh-TW'])for(const key of keys)expect(locales[code][key],code+': '+key).toBeTruthy();
});

test('theme and language apply immediately, retain focus and survive browser refresh',async({page})=>{
 const native=[];await page.exposeFunction('recordAppearance',(theme,language)=>native.push({theme,language}));
 await page.evaluate(()=>{window.Android={applyAppearance:(theme,language)=>window.recordAppearance(theme,language)};});
 await settings(page);await choose(page,'theme','light');await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect(page.locator('button[data-theme="light"]')).toBeFocused();await expect(page.locator('#page-title')).toHaveText('设置');
 await page.keyboard.press('ArrowLeft');await expect(page.locator('button[data-theme="dark"]')).toBeFocused();
 await choose(page,'language','zh-TW');await expect(page.locator('html')).toHaveAttribute('lang','zh-TW');
 await expect(page.locator('#page-title')).toHaveText('設定');await expect(page.locator('[data-language="zh-TW"]')).toBeFocused();
 await expect(page.locator('[data-focus="nav-market"]')).toHaveText('外掛市場');
 expect(native.at(-1)).toEqual({theme:'light',language:'zh-TW'});
 await page.reload();await expect(page.locator('#app')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page.locator('html')).toHaveAttribute('lang','zh-TW');
 await settings(page);await expect(page.locator('button[data-theme="light"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#queue-button')).toHaveAttribute('aria-label','播放佇列');
 await expect(page.locator('[data-language="zh-TW"]')).toHaveText('繁體中文');await expect(page.locator('[data-language="zh-CN"]')).toHaveText('简体中文');
 expect(await page.evaluate(()=>window.MyGoI18n.text('unknown resource'))).toBe('unknown resource');
 await page.evaluate(()=>{delete window.MyGoLocales['zh-TW']['设置'];});
 expect(await page.evaluate(()=>window.MyGoI18n.text('设置'))).toBe('设置');
});

test('failed saves retain the active appearance and rapid choices persist in order without stealing focus',async({page})=>{
 await settings(page);
 await page.route('**/api/preferences',route=>route.request().method()==='POST'?route.fulfill({status:500,json:{error:'保存失败'}}):route.continue());
 await page.locator('button[data-theme="light"]').click();await expect(page.locator('#toast')).toHaveText('保存失败');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('button[data-theme="dark"]')).toHaveAttribute('aria-pressed','true');
 await page.unroute('**/api/preferences');let release;const gate=new Promise(resolve=>release=resolve);let count=0;
 await page.route('**/api/preferences',async route=>{if(route.request().method()==='POST'&&++count===1)await gate;await route.continue();});
 await page.locator('button[data-theme="light"]').click();await page.locator('button[data-theme="dark"]').click();await page.locator('#open-player').focus();release();
 await expect.poll(()=>count).toBe(2);await expect.poll(async()=>(await(await page.request.get('/api/preferences')).json()).theme).toBe('dark');
 await expect(page.locator('#open-player')).toBeFocused();await expect(page.locator('#page-title')).toHaveText('设置');
});

for(const theme of ['dark','light'])for(const language of ['zh-CN','zh-TW'])test(theme+' / '+language+' keeps TV layout and source content intact',async({page},info)=>{
 const traditional=language==='zh-TW';await settings(page);await choose(page,'theme',theme);await choose(page,'language',language);
 for(const [width,height]of [[960,540],[1280,720],[1920,1080]]){
  await page.setViewportSize({width,height});await page.locator('button[data-theme="'+theme+'"]').focus();
  const result=await page.locator('button[data-theme="'+theme+'"]').evaluate(n=>{const r=n.getBoundingClientRect(),parent=n.closest('#content').getBoundingClientRect(),s=getComputedStyle(n);return{inside:r.left>=parent.left&&r.right<=parent.right&&r.top>=parent.top&&r.bottom<=parent.bottom,outline:s.outlineStyle,width:s.outlineWidth,shadow:s.boxShadow,clipped:n.scrollWidth>n.clientWidth};});
  expect(result.inside).toBe(true);expect(result.clipped).toBe(false);
  if(theme==='light'){expect(result.outline).toBe('none');expect(result.shadow).toBe('rgb(229, 50, 75) 0px 0px 0px 4px');}
  else{expect(result.outline).toBe('solid');expect(parseInt(result.width)).toBeGreaterThanOrEqual(3);}
  await page.keyboard.press('ArrowDown');expect(await page.evaluate(()=>!!document.activeElement.getAttribute('data-focus'))).toBe(true);
 }
 await page.setViewportSize({width:1280,height:720});await page.locator('[data-language="'+language+'"]').focus();
 await page.screenshot({path:info.outputPath(theme+'-'+language+'-settings.png')});
 await page.route('**/api/catalog*',route=>route.fulfill({json:{entries:[{repository:'fixture/demo',name:'发现音乐',description:'测试音乐源介绍，不转换。'},{repository:'new/source',name:'新音乐源',description:'尚未安装'}]}}));
 await page.locator('[data-focus="nav-market"]').click();await expect(page.locator('[data-catalog="0"] .card-name')).toHaveText('发现音乐');
 await expect(page.locator('[data-catalog="0"] .install-badge')).toHaveText(traditional?'已安裝':'已安装');
 await page.locator('[data-catalog="0"]').click();await expect(page.locator('.modal h2')).toHaveText('发现音乐');
 await expect(page.locator('[data-action="check-update"]')).toHaveText(traditional?'檢查更新':'检查更新');
 await page.keyboard.press('Escape');await page.locator('[data-focus="nav-search"]').click();await expect(page.locator('#search-input')).toHaveAttribute('placeholder',traditional?'歌曲、歌手、專輯':'歌曲、歌手、专辑');
 await page.locator('#source-switch').click();await expect(page.locator('.modal h2')).toHaveText(traditional?'選擇音樂源':'选择音乐源');await expect(page.locator('[data-source="fixture"]')).toBeFocused();
 await page.screenshot({path:info.outputPath(theme+'-'+language+'-modal.png')});
});

test('Traditional lyrics, nested queue and comments retain original music text and playback',async({page})=>{
 await page.route('**/call/comments',r=>r.fulfill({json:{comments:[{id:'c1',author:'音乐听众',text:'发现音乐，歌词和评论不转换。',time:1767225600000}],more:false,total:1}}));
 await page.route('**/sources/*/lyrics?*',r=>r.fulfill({json:{timed:true,lines:[{start:0,end:6000,text:'音乐，歌词保持原样'}]}}));
 await page.locator('[data-focus="nav-home"]').click();await page.locator('[data-track="0"]').click();
 await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).state).toBe('playing');
 const before=await(await page.request.get('/api/player')).json();await page.locator('#toggle').click();
 await settings(page);await choose(page,'theme','light');await choose(page,'language','zh-TW');
 const after=await(await page.request.get('/api/player')).json();expect(after.generation).toBe(before.generation);expect(after.media).toBe(before.media);
 await page.locator('#open-player').click();await expect(page.locator('.lyric-line')).toHaveText('音乐，歌词保持原样');
 await expect(page.locator('[data-action="translation"]')).toHaveText('翻譯：開');
 await page.locator('#queue-button').click();await expect(page.locator('.modal h2')).toHaveText('播放佇列');await expect(page.locator('[data-queue-jump]').first()).toBeFocused();
 await page.locator('#modal-layer [data-action="play-mode"]').click();await expect(page.locator('.modal h2')).toHaveText('播放順序');
 await page.keyboard.press('Escape');await expect(page.locator('.modal h2')).toHaveText('播放佇列');await page.keyboard.press('Escape');
 await page.locator('[data-action="player-comments"]').click();await expect(page.locator('.modal h2')).toHaveText('歌曲評論');
 await expect(page.locator('[data-comment-index="0"]')).toBeFocused();await expect(page.locator('.comment-text')).toHaveText('发现音乐，歌词和评论不转换。');
 await expect(page.locator('.comment-author')).toHaveText('音乐听众');await page.keyboard.press('Escape');
 await page.locator('#lyrics-button').click();await expect(page.locator('#lyrics-button')).toHaveAttribute('aria-label','退出全螢幕歌詞');
 await page.keyboard.press('Escape');await expect(page.locator('#lyrics-button')).toHaveAttribute('aria-label','全螢幕歌詞');
});

test('light home showcases real artwork and keeps its play action in the remote focus graph',async({page})=>{
 await page.route('**/cover.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#ce8693"/></svg>'}));
 await page.route('**/call/home',async r=>{const res=await r.fetch(),data=await res.json();const track=data.sections.flatMap(s=>s.tracks||[])[0];track.album={...track.album,imageUrl:'/cover.svg'};track.name='电视上的音乐时刻';await r.fulfill({json:data});});
 await settings(page);await choose(page,'theme','light');await page.locator('[data-focus="nav-home"]').click();
 await expect(page.locator('[data-action="feature-play"]')).toBeFocused();await expect(page.locator('.feature-copy h2')).toHaveText('电视上的音乐时刻');
 await expect(page.locator('.feature-art')).toHaveAttribute('src','/cover.svg');
 for(const [width,height]of [[960,540],[1280,720],[1920,1080]]){await page.setViewportSize({width,height});await expect.poll(async()=>Math.round((await page.locator('#stage').boundingBox()).width)).toBe(width);await page.locator('[data-action="feature-play"]').focus();const box=await page.locator('.music-feature').boundingBox();expect(box.x).toBeGreaterThan(0);expect(box.x+box.width).toBeLessThanOrEqual(width);await page.keyboard.press('ArrowDown');await expect(page.locator('[data-track="0"]')).toBeFocused();}
 await page.setViewportSize({width:1280,height:720});await page.locator('[data-action="feature-play"]').click();
 await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).state).toBe('playing');
 const p=await(await page.request.get('/api/player')).json();expect(p.queue[p.index].name).toBe('电视上的音乐时刻');
});
