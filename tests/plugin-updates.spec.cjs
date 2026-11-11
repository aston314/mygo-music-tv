const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
const repository='community/music',id='online-music';
test.afterEach(async({page})=>{await page.request.post('/api/preferences',{data:{theme:'dark',language:'zh-CN'}});});
async function setup(page){
 const model={version:'1.0.0',revision:'v1.0.0',update:{instanceId:id,currentVersion:'1.0.0',revision:'v1.0.0',latestVersion:'v2.0.0',available:true,state:'available'},job:null,checks:[],updates:[],confirmations:[]};
 await page.route('**/api/sources',async route=>{const response=await route.fetch();const list=await response.json();list.push({instanceId:id,repository,revision:model.revision,manifest:{id:'music',name:'在线音乐',version:model.version},capabilities:{},process:[]});await route.fulfill({json:list});});
 await page.route('**/api/catalog*',route=>route.fulfill({json:{entries:[{repository,name:'在线音乐',description:'已安装的社区音乐源。'},{repository:'other/music',name:'另一音乐源',description:'未安装。'}]}}));
 await page.route('**/api/plugins/updates',route=>route.fulfill({json:[model.update]}));
 await page.route('**/api/plugins/check-updates',route=>{model.checks.push(route.request().postDataJSON());model.update={...model.update,state:'checking'};return route.fulfill({json:[model.update]});});
 await page.route('**/api/plugins/update',route=>{model.updates.push(route.request().postDataJSON());model.job={id:'update-job',instanceId:id,repository,operation:'update',version:'v2.0.0',state:'downloading'};model.update={...model.update,state:'downloading',jobId:'update-job'};return route.fulfill({json:model.job});});
 await page.route('**/api/jobs/update-job',route=>route.fulfill({json:model.job}));
 await page.route('**/api/jobs/update-job/confirm',route=>{const data=route.request().postDataJSON();model.confirmations.push(data);model.job={...model.job,state:data.allow?'complete':'cancelled'};model.update={...model.update,state:data.allow?'current':'available',available:!data.allow,jobId:''};if(data.allow){model.version='2.0.0';model.revision='v2.0.0';}return route.fulfill({json:model.job});});
 await page.goto('/?token='+token);await expect(page.locator('#app')).toBeVisible();
 await page.request.post('/api/preferences',{data:{theme:'light',language:'zh-CN'}});await page.reload();await expect(page.locator('#app')).toBeVisible();
 return model;
}
async function market(page){await page.locator('[data-focus="nav-market"]').click();await expect(page.locator('[data-catalog="0"]')).toBeVisible();}
function finish(model){model.version='2.0.0';model.revision='v2.0.0';model.job={...model.job,state:'complete'};model.update={...model.update,currentVersion:'2.0.0',revision:'v2.0.0',state:'current',available:false,jobId:''};}

test('update badges, pinned installation and playback keep their source and focus',async({page},info)=>{
 const model=await setup(page);
 await page.locator('[data-focus="nav-search"]').click();await page.locator('#search-input').fill('song');await page.locator('[data-focus="search-submit"]').click();await page.locator('[data-track="0"]').click();
 await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).state).toBe('playing');
 const before=await(await page.request.get('/api/player')).json();
 await market(page);const card=page.locator('[data-catalog="0"]');
 await expect(card.locator('.install-badge')).toHaveText('有更新');await expect(card.locator('.plugin-version')).toHaveText('1.0.0 → v2.0.0');
 await page.screenshot({path:info.outputPath('light-plugin-updates.png')});
 await card.click();await expect(page.locator('#catalog-version')).toHaveText('当前版本：1.0.0 → v2.0.0');
 await page.locator('[data-action="update-plugin"]').click();await expect.poll(()=>model.updates).toEqual([{instanceId:id,version:'v2.0.0'}]);
 await expect(page.locator('[data-action="cancel"]')).toBeFocused();finish(model);
 await expect(page.locator('#catalog-update-status')).toHaveText('已是最新版本');await expect(page.locator('[data-action="cancel"]')).toBeFocused();
 await page.keyboard.press('Escape');await expect(card).toBeFocused();await expect(card.locator('.install-badge')).toHaveText('已安装');
 const after=await(await page.request.get('/api/player')).json();expect(after.generation).toBe(before.generation);expect(after.media).toBe(before.media);expect(after.queue).toEqual(before.queue);expect(after.state).toBe('playing');
 await expect(page.locator('#source-switch')).not.toContainText('在线音乐');
});

test('all and individual checks recover after failure without replacing market cards',async({page})=>{
 const model=await setup(page);await market(page);await page.locator('[data-action="check-all-updates"]').click();await expect.poll(()=>model.checks).toEqual([{}]);
 const card=page.locator('[data-catalog="0"]');await card.focus();
 model.update={...model.update,state:'checkFailed',message:'offline'};
 await expect(page.locator('#market-update-status')).not.toHaveText('正在检查更新…');await expect(card).toBeFocused();await expect(card.locator('.install-badge')).toHaveText('有更新');
 await card.click();await expect(page.locator('#catalog-update-status')).toHaveText('检查失败，请重试');
 await page.locator('[data-action="check-update"]').click();await expect.poll(()=>model.checks).toEqual([{}, {instanceId:id}]);
 model.update={...model.update,state:'current',available:false,latestVersion:'v1.0.0'};
 await expect(page.locator('#catalog-update-status')).toHaveText('已是最新版本');await expect(page.locator('[data-action="update-plugin"]')).toBeHidden();
 await page.keyboard.press('Escape');await expect(card).toBeFocused();
});

test('added permissions require confirmation and Back cancels the downloaded update',async({page},info)=>{
 const model=await setup(page);await market(page);await page.locator('[data-catalog="0"]').click();await page.locator('[data-action="update-plugin"]').click();
 await expect.poll(()=>!!model.job).toBe(true);model.job={...model.job,state:'awaiting-confirmation',permissions:{network:['new.music.example.com'],process:['helper']}};model.update={...model.update,state:'awaiting-confirmation'};
 await expect(page.locator('[data-focus="permission-0"]')).toBeFocused();await expect(page.locator('[data-action="confirm-update"]')).toBeVisible();
 for(const [width,height] of [[960,540],[1280,720],[1920,1080]]){
  await page.setViewportSize({width,height});
  for(const action of ['cancel','confirm-update']){
   const bounds=await page.locator('[data-action="'+action+'"]').evaluate(n=>{const r=n.getBoundingClientRect(),box=n.closest('.modal').getBoundingClientRect();return {inside:r.top>=box.top&&r.bottom<=box.bottom&&r.left>=box.left&&r.right<=box.right};});expect(bounds.inside).toBe(true);
  }
 }
 await page.setViewportSize({width:1280,height:720});await page.screenshot({path:info.outputPath('plugin-permission-confirmation.png')});
 await page.keyboard.press('ArrowDown');await expect(page.locator('[data-focus="permission-1"]')).toBeFocused();
 await page.keyboard.press('Escape');await expect.poll(()=>model.confirmations).toEqual([{allow:false}]);expect(model.version).toBe('1.0.0');
 await page.locator('[data-catalog="0"]').click();await page.locator('[data-action="update-plugin"]').click();
 await expect.poll(()=>model.job.state).toBe('downloading');model.job={...model.job,state:'awaiting-confirmation',permissions:{network:['new.music.example.com']}};model.update={...model.update,state:'awaiting-confirmation'};
 await expect(page.locator('[data-focus="permission-0"]')).toBeFocused();await page.locator('[data-action="confirm-update"]').click();
 await expect.poll(()=>model.confirmations).toEqual([{allow:false},{allow:true}]);await expect(page.locator('#catalog-update-status')).toHaveText('已是最新版本');
});

test('job polling can retry and a late permission request cannot reopen a closed dialog',async({page})=>{
 const model=await setup(page);let fail=true;
 await page.route('**/api/jobs/update-job',route=>fail?route.abort():route.fulfill({json:model.job}));
 await market(page);await page.locator('[data-catalog="0"]').click();await page.locator('[data-action="update-plugin"]').click();
 await expect(page.locator('#catalog-update-status')).toHaveText('任务状态读取失败，请重试');await expect(page.locator('[data-action="retry-job"]')).toBeVisible();
 fail=false;await page.locator('[data-action="retry-job"]').click();await expect(page.locator('#catalog-update-status')).toHaveText('正在下载…');
 await page.keyboard.press('Escape');model.job={...model.job,state:'awaiting-confirmation',permissions:{network:['new.example.com']}};
 await expect.poll(()=>model.confirmations).toEqual([{allow:false}]);await expect(page.locator('#modal-layer')).toBeHidden();await expect(page.locator('[data-catalog="0"]')).toBeFocused();
});


test('reopening an active update can retry its first failed job status request',async({page})=>{
 const model=await setup(page);model.job={id:'update-job',instanceId:id,repository,operation:'update',state:'downloading'};model.update={...model.update,state:'downloading',jobId:'update-job'};
 let fail=true;await page.route('**/api/jobs/update-job',route=>fail?route.abort():route.fulfill({json:model.job}));
 await market(page);await page.locator('[data-catalog="0"]').click();await expect(page.locator('[data-action="retry-job"]')).toBeVisible();
 fail=false;finish(model);await page.locator('[data-action="retry-job"]').click();await expect(page.locator('#catalog-update-status')).toHaveText('已是最新版本');
});
