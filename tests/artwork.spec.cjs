const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6n00AAAAASUVORK5CYII=','base64');
async function song(page){
 await page.goto('/?token='+token);await expect(page.locator('[data-track="0"]')).toBeVisible();await page.locator('[data-track="0"]').click();
 await expect.poll(async()=>(await(await page.request.get('/api/player')).json()).state).toBe('playing');await page.locator('#toggle').click();await page.locator('#open-player').click();
}
async function setCover(page,path){const p=await(await page.request.get('/api/player')).json(),track={...p.queue[p.index],album:{...p.queue[p.index].album,imageUrl:path}};await page.request.post('/api/player/play',{data:{queue:[track],index:0}});await expect(page.locator('.large-cover img')).toHaveAttribute('src',path);}
async function loaded(locator){await expect.poll(()=>locator.evaluate(n=>n.complete&&n.naturalWidth>0&&!n.hidden)).toBe(true);}

test('playing artwork recovers from transient image errors without restarting the song or stealing focus',async({page},info)=>{
 let attempts=0;await page.route('**/covers/transient.png',r=>++attempts<=2?r.fulfill({status:502,body:'temporary failure'}):r.fulfill({contentType:'image/png',body:png}));
 await song(page);await setCover(page,'/covers/transient.png');await page.locator('[data-focus="player-album"]').focus();
 const before=await(await page.request.get('/api/player')).json();await loaded(page.locator('.large-cover img'));await loaded(page.locator('#open-player img'));
 await expect(page.locator('[data-focus="player-album"]')).toBeFocused();const after=await(await page.request.get('/api/player')).json();expect(after.generation).toBe(before.generation);expect(after.media).toBe(before.media);expect(attempts).toBeGreaterThan(2);
 await page.screenshot({path:info.outputPath('loaded-cover.png')});
});

test('a permanently failed cover shows its SVG placeholder with bounded retries and a new track gets its own image',async({page},info)=>{
 let attempts=0;await page.route('**/covers/missing.png',r=>{attempts++;return r.fulfill({status:404,body:'missing'});});await page.route('**/covers/valid.png',r=>r.fulfill({contentType:'image/png',body:png}));
 await song(page);await setCover(page,'/covers/missing.png');await expect(page.locator('.large-cover img')).toBeHidden();await expect(page.locator('.large-cover svg')).toBeVisible();
 const size=await page.locator('.large-cover').boundingBox();await expect.poll(()=>attempts).toBeGreaterThanOrEqual(3);const settled=attempts;await page.waitForTimeout(1200);expect(attempts).toBe(settled);expect(attempts).toBeLessThanOrEqual(6);
 await page.screenshot({path:info.outputPath('failed-cover-placeholder.png')});await setCover(page,'/covers/valid.png');await loaded(page.locator('.large-cover img'));const after=await page.locator('.large-cover').boundingBox();expect(after).toEqual(size);
});

test('late image retries cannot overwrite a newer song or request a detached cover',async({page})=>{
 let stale=0;await page.route('**/covers/old.png',r=>{stale++;return r.fulfill({status:502,body:'failed'});});await page.route('**/covers/new.png',r=>r.fulfill({contentType:'image/png',body:png}));
 await song(page);await setCover(page,'/covers/old.png');await expect(page.locator('.large-cover img')).toBeHidden();const before=stale;
 await setCover(page,'/covers/new.png');await loaded(page.locator('.large-cover img'));await page.waitForTimeout(1000);expect(stale).toBe(before);await expect(page.locator('.large-cover img')).toHaveAttribute('src','/covers/new.png');
});
