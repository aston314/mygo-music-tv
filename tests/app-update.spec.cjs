const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
async function open(page){await page.goto('/?token='+token);await expect(page.locator('#app')).toBeVisible();await page.locator('[data-focus="nav-settings"]').click();}
test('browser explains Android updates without an unusable download action',async({page})=>{
 await open(page);await expect(page.locator('#app-update-status')).toHaveText('请在 Android 正式版中检查更新');
 await expect(page.locator('[data-action="app-check-update"]')).toBeDisabled();
 await page.locator('[data-language="zh-TW"]').click();await expect(page.locator('#app-update-status')).toHaveText('請在 Android 正式版中檢查更新');
 await page.request.post('/api/preferences',{data:{language:'zh-CN'}});
});
test('native update states preserve settings, show activity and recover after failed checks',async({page},info)=>{
 await page.addInitScript(()=>{
  window.updates={supported:true,state:'idle',message:'尚未检查更新'};window.updateCalls=[];
  window.MyGoAppUpdates={getStatus:()=>JSON.stringify(window.updates),setPromptAllowed:allowed=>{window.promptAllowed=allowed;},
   check:()=>{window.updateCalls.push('check');window.updates.state='checking';window.updates.message='正在检查更新…';},
   install:()=>{window.updateCalls.push('install');}};
 });
 await open(page);const action=page.locator('[data-action="app-check-update"]');
 await action.click();await expect(action).toBeDisabled();await expect(action).toHaveAttribute('aria-busy','true');
 await expect(action.locator('.icon')).toHaveCSS('animation-name','spin');
 await page.evaluate(()=>Object.assign(window.updates,{state:'error',message:'检查失败：连接超时'}));
 await expect(action).toBeEnabled();await expect(page.locator('#app-update-status')).toHaveText('检查失败：连接超时');await expect(action).toBeFocused();
 await action.click();expect(await page.evaluate(()=>window.updateCalls)).toEqual(['check','check']);
 await page.evaluate(()=>Object.assign(window.updates,{state:'available',message:'发现新版本',latest_version:'0.1.4'}));
 await expect(action).toHaveText('查看更新');await expect(action).toHaveAttribute('aria-busy','false');
 await page.evaluate(()=>Object.assign(window.updates,{state:'downloading',downloaded:50,size:100}));
 await expect(page.locator('#app-update-status')).toHaveText('正在下载… 50%');
 await page.evaluate(()=>Object.assign(window.updates,{state:'ready',message:'更新包已验证，可继续安装'}));
 await expect(action).toBeEnabled();await expect(action).toHaveText('继续安装');await action.click();
 expect(await page.evaluate(()=>window.updateCalls.at(-1))).toBe('install');
 for(const theme of ['light','dark']){
   await page.locator('button[data-theme="'+theme+'"]').click();
  for(const [width,height]of [[960,540],[1920,1080]]){
   await page.setViewportSize({width,height});await action.focus();await expect(action).toBeInViewport();
   await page.screenshot({path:info.outputPath(theme+'-'+width+'-updates.png')});
  }
 }
});
test('automatic prompts wait during playback, dialogs, lyrics and editing; manual checks stay explicit',async({page})=>{
 await page.goto('/?token='+token);await expect(page.locator('#app')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.MyGo.canShowAppUpdate(false))).toBe(true);
 await page.locator('[data-focus="track-0"]').click();
 await expect.poll(()=>page.evaluate(()=>window.MyGo.canShowAppUpdate(false))).toBe(false);
 expect(await page.evaluate(()=>window.MyGo.canShowAppUpdate(true))).toBe(true);
 await page.locator('#open-player').click();expect(await page.evaluate(()=>window.MyGo.canShowAppUpdate(true))).toBe(false);
 await page.keyboard.press('Escape');await page.locator('#queue-button').click();expect(await page.evaluate(()=>window.MyGo.canShowAppUpdate(true))).toBe(false);
 await page.keyboard.press('Escape');await page.locator('[data-focus="nav-search"]').click();await page.locator('#search-input').focus();
 expect(await page.evaluate(()=>window.MyGo.canShowAppUpdate(true))).toBe(false);
});
