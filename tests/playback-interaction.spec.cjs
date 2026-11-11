const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
async function snapshot(page){return (await page.request.get('/api/player')).json();}
async function boot(page){
 await page.goto('/?token='+token);await expect(page.locator('[data-track="0"]')).toBeVisible();
 await page.request.post('/api/player/queue',{data:{action:'clear'}});
 await page.request.post('/api/player/mode',{data:{mode:'sequence'}});
 await page.locator('[data-track="0"]').click();
 await expect.poll(async()=>(await snapshot(page)).state).toBe('playing');
 await page.locator('#toggle').click();await expect.poll(async()=>(await snapshot(page)).state).toBe('paused');
 await expect(page.locator('#seek')).toHaveAttribute('aria-valuemax',String((await snapshot(page)).duration));
}

test('current song follows playback in place and duplicate queue entries mark only the selected entry',async({page})=>{
 await boot(page);const row=page.locator('[data-track="0"]');await expect(row).toHaveAttribute('aria-current','true');
 await expect(row.locator('.track-no svg')).toBeVisible();await row.focus();
 const focus=await row.elementHandle();await page.request.post('/api/player/control',{data:{action:'next'}});
 await expect(page.locator('[data-track="1"]')).toHaveAttribute('aria-current','true');await expect(row).not.toHaveAttribute('aria-current','true');
 expect(await focus.evaluate(n=>n===document.activeElement&&n.isConnected)).toBe(true);
 await page.locator('#toggle').click();await expect.poll(async()=>(await snapshot(page)).state).toBe('paused');
 await page.locator('[data-kind="album"]').click();await expect(page.locator('[data-track="1"]')).toHaveAttribute('aria-current','true');
 const p=await snapshot(page);await page.request.post('/api/player/queue',{data:{action:'append',tracks:[p.queue[p.index]]}});
 await page.locator('#queue-button').click();await expect(page.locator('#queue-list .track-row')).toHaveCount(4);
 await expect(page.locator('#queue-list .current')).toHaveCount(1);await expect(page.locator('#queue-list [aria-current="true"]')).toHaveAttribute('data-queue-jump',p.entryIds[p.index]);
 const appended=(await snapshot(page)).entryIds[3];await page.locator('[data-queue-jump="'+appended+'"]').click();
 await expect(page.locator('#queue-list [aria-current="true"]')).toHaveAttribute('data-queue-jump',appended);
 await expect(page.locator('#queue-list .current')).toHaveCount(1);await expect(page.locator('[data-queue-jump="'+appended+'"]')).toBeFocused();
});

test('same song ID from a different source is not highlighted',async({page})=>{
 await page.route('**/api/sources',async route=>{const response=await route.fetch(),[s]=await response.json();await route.fulfill({json:[s,{...s,instanceId:'second',repository:'fixture/second',manifest:{...s.manifest,name:'第二音乐源'}}]});});
 await page.route('**/sources/second/call/account',r=>r.fulfill({json:null}));
 await page.route('**/sources/second/call/home',r=>r.fulfill({json:{sections:[{title:'歌曲',tracks:[{id:'t1',source:'second',name:'另一来源的同 ID 歌曲',duration:12000}]}]}}));
 await boot(page);await page.locator('#source-switch').click();await page.locator('[data-source="second"]').click();
 await expect(page.locator('[data-track="0"]')).toContainText('另一来源');await expect(page.locator('#content .current')).toHaveCount(0);
 await page.locator('#source-switch').click();await page.locator('[data-source="fixture"]').click();await expect(page.locator('[data-track="0"]')).toHaveAttribute('aria-current','true');
});

for(const [width,height] of [[960,540],[1280,720],[1920,1080]])test('progress clicks and dragging seek once on release at '+width+'x'+height,async({page})=>{
 await page.setViewportSize({width,height});await boot(page);const requests=[];
 page.on('request',r=>{if(r.url().endsWith('/api/player/control')&&r.postDataJSON()?.action==='seek')requests.push(r.postDataJSON());});
 const duration=(await snapshot(page)).duration,bar=await page.locator('#seek .progress-track').boundingBox(),y=bar.y+bar.height/2;
 await page.mouse.click(bar.x+bar.width*.25,y);
 await expect.poll(async()=>(await snapshot(page)).position).toBeGreaterThanOrEqual(duration*.25-10);
 await expect.poll(()=>requests.length).toBe(1);
 await page.mouse.move(bar.x+bar.width*.25,y);await page.mouse.down();await page.mouse.move(bar.x+bar.width*.75,y-40,{steps:8});
 expect(Math.abs(+(await page.locator('#seek').getAttribute('aria-valuenow'))-duration*.75)).toBeLessThan(duration/bar.width+5);expect(requests.length).toBe(1);
 await expect(page.locator('#seek')).toBeFocused();await page.mouse.up();
 await expect.poll(()=>requests.length).toBe(2);await expect.poll(async()=>(await snapshot(page)).position).toBeGreaterThanOrEqual(duration*.75-duration/bar.width-5);
 await expect(page.locator('#modal-layer')).toBeHidden();await expect(page.locator('#seek')).toBeFocused();
 await expect.poll(async()=>(await snapshot(page)).state).toBe('paused');
 await page.mouse.move(bar.x+bar.width*.5,y);await page.mouse.down();await page.mouse.move(bar.x-30,y);await page.mouse.up();
 await expect.poll(async()=>(await snapshot(page)).position).toBe(0);await expect.poll(()=>requests.length).toBe(3);
});

test('held remote seeks accumulate and changing songs cancels an unfinished drag',async({page})=>{
 await boot(page);const duration=(await snapshot(page)).duration;await page.locator('#seek').focus();
 await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');await page.keyboard.up('ArrowRight');
 await expect.poll(async()=>(await snapshot(page)).position).toBe(duration);
 await page.keyboard.press('ArrowLeft');await expect.poll(async()=>(await snapshot(page)).position).toBe(Math.max(0,duration-10000));
 const bar=await page.locator('#seek .progress-track').boundingBox();await page.mouse.move(bar.x+bar.width*.5,bar.y);await page.mouse.down();
 const before=await snapshot(page);await page.request.post('/api/player/control',{data:{action:'next'}});await expect(page.locator('#now-title')).toHaveText('Song 2');
 await page.mouse.up();const after=await snapshot(page);expect(after.generation).toBeGreaterThan(before.generation);expect(after.seekRevision).toBe(0);
 await page.request.post('/api/player/queue',{data:{action:'clear'}});await expect(page.locator('#seek')).toBeDisabled();
 await page.locator('#next').focus();await page.keyboard.press('ArrowDown');await expect(page.locator('#mode-button')).toBeFocused();
 await page.keyboard.press('ArrowUp');expect(await page.evaluate(()=>document.querySelector('#content').contains(document.activeElement))).toBe(true);
});
