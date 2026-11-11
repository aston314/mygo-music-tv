const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
const session='a'.repeat(48),requestId='b'.repeat(48);
async function boot(page){await page.goto('/?token='+token);await expect(page.locator('[data-track="0"]')).toBeVisible();await page.request.post('/api/preferences',{data:{theme:'light',language:'zh-CN'}});await page.reload();}
async function open(page){await page.route('**/call/account',r=>r.fulfill({json:null}));await page.locator('#account-button').click();await expect(page.locator('#login-status')).toBeVisible();}
test('web cookie login exposes only a native request handle and restores account focus after completion',async({page},info)=>{
 const launched=[];await page.addInitScript(()=>{window.nativeLogins=[];window.Android={openLogin:(id,requestId)=>window.nativeLogins.push({id,requestId})};});
 let complete=false;await page.route('**/api/login/fixture',r=>r.fulfill({json:{id:session}}));
 await page.route('**/api/login',r=>r.request().method()==='GET'?r.fulfill({json:{id:session,source:'fixture',state:complete?'complete':'waiting',web:complete?undefined:{id:requestId,kind:'cookies',url:'https://accounts.example.com/auth'}}}):r.fulfill({json:{ok:true}}));
 await boot(page);await open(page);const button=page.locator('[data-action="login-open-web"]');await expect(button).toBeVisible();await button.click();
 expect(await page.evaluate(()=>window.nativeLogins)).toEqual([{id:session,requestId}]);await expect(button).toBeFocused();await page.screenshot({path:info.outputPath('login-web-720.png')});
 complete=true;await expect(page.locator('#modal-layer')).toBeHidden();await expect(page.locator('#toast')).toHaveText('登录成功');
});
test('browser preview gives a clear cookie-login limit while OAuth opens through an explicit action',async({page})=>{
 let kind='cookies';await page.route('**/api/login/fixture',r=>r.fulfill({json:{id:session}}));await page.route('**/api/login',r=>r.request().method()==='GET'?r.fulfill({json:{id:session,state:'waiting',web:{id:requestId,kind,url:'https://example.com/authorize'}}}):r.fulfill({json:{ok:true}}));
 await page.addInitScript(()=>{window.opened=[];window.open=(...args)=>window.opened.push(args)});
 await boot(page);await open(page);await expect(page.locator('#login-web-actions')).toContainText('网页 Cookie 登录请在电视应用中完成');await page.keyboard.press('Escape');kind='oauth';
 await open(page);await page.locator('[data-action="login-open-web"]').click();expect(await page.evaluate(()=>window.opened[0])).toEqual(['https://example.com/authorize','_blank','noopener,noreferrer']);
});
test('transient login polling failure retains instructions and can retry without opening a new session',async({page})=>{
 let failed=true,starts=0;await page.route('**/api/login/fixture',r=>{starts++;return r.fulfill({json:{id:session}})});
 await page.route('**/api/login',r=>r.request().method()!=='GET'?r.fulfill({json:{ok:true}}):failed?r.fulfill({status:503,json:{error:'offline'}}):r.fulfill({json:{id:session,state:'waiting',prompt:{text:'继续扫码',qr:'https://example.com/qr'}}}));
 await boot(page);await open(page);await expect(page.locator('[data-action="login-poll-retry"]')).toBeVisible();failed=false;await page.locator('[data-action="login-poll-retry"]').click();await expect(page.locator('#login-status')).toContainText('继续扫码');expect(starts).toBe(1);
});
test('closing a login cancels only its session and a late start response cannot leave an orphan',async({page})=>{
 const deleted=[];let release,started;const pending=new Promise(r=>started=r);
 await page.route('**/api/login/fixture',async r=>{started();await new Promise(r=>release=r);await r.fulfill({json:{id:session}})});
 await page.route('**/api/login?*',r=>{deleted.push(new URL(r.request().url()).searchParams.get('id'));return r.fulfill({json:{ok:true}})});
 await boot(page);await page.route('**/call/account',r=>r.fulfill({json:null}));await page.locator('#account-button').click();await pending;await page.locator('[data-focus="nav-settings"]').click();release();await expect.poll(()=>deleted).toEqual([session]);await expect(page.locator('#modal-layer')).toBeHidden();
});
test('plugin details distinguish guest API checks, playback and a different installed revision',async({page},info)=>{
 await page.route('**/api/catalog*',r=>r.fulfill({json:{entries:[{repository:'fixture/demo',name:'Demo',description:'Online source'}]}}));
 await page.route('**/api/plugins/compatibility',r=>r.fulfill({json:{observedAt:'2026-11-11T00:00:00Z',entries:[{repository:'fixture/demo',revision:'other-version',version:'1.0',process:['ffmpeg'],stages:{install:{state:'passed'},search:{state:'passed'},streamResolve:{state:'passed'},devicePlayback:{state:'not-tested'}}}]}}));
 await boot(page);await page.locator('[data-focus="nav-market"]').click();await page.locator('[data-catalog="0"]').click();const box=page.locator('#catalog-compatibility');await expect(box).toContainText('此记录对应其他版本');await expect(box).toContainText('已取得音频地址，待播放验证');await expect(box).toContainText('部分功能需要适配');
 await page.locator('#modal-layer [data-action="cancel"]').focus();await page.keyboard.press('ArrowUp');await expect(page.locator('[data-focus="compatibility-record"]')).toBeFocused();await page.screenshot({path:info.outputPath('compatibility-720.png')});
});

test('returning from the native window resumes a failed status poll without duplicating requests',async({page})=>{
 let fail=true,calls=0;await page.route('**/api/login/fixture',r=>r.fulfill({json:{id:session}}));
 await page.route('**/api/login',async r=>{if(r.request().method()!=='GET'){await r.fulfill({json:{ok:true}});return;}calls++;await r.fulfill(fail?{status:503,json:{error:'temporarily offline'}}:{json:{id:session,state:'complete'}})});
 await boot(page);await open(page);await expect(page.locator('[data-action="login-poll-retry"]')).toBeVisible();fail=false;
 await page.evaluate(()=>{window.MyGo.resumeLogin();window.MyGo.resumeLogin();});await expect(page.locator('#modal-layer')).toBeHidden();expect(calls).toBe(2);
});
