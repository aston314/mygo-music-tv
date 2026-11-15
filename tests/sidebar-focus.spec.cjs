const {test,expect}=require('@playwright/test');
const token='playwright-only-local-session-0123456789';

for(const sidebar of ['expanded','icons'])test('dark sidebar and settings keep rounded focus in '+sidebar+' mode',async({page},info)=>{
 await page.addInitScript(()=>{window.MyGoHost={platform:'android-tv'};});
 await page.goto('/?token='+token);
 await page.request.post('/api/preferences',{data:{theme:'dark',sidebar}});await page.reload();
 for(const target of ['[data-focus="nav-home"]','#source-switch']){
  const control=page.locator(target);await control.focus();
  const style=await control.evaluate(n=>{const s=getComputedStyle(n);return {outline:s.outlineStyle,radius:parseFloat(s.borderTopLeftRadius),shadow:s.boxShadow};});
  expect(style.outline).toBe('none');expect(style.radius).toBeGreaterThan(0);expect(style.shadow).toContain('rgb(183, 245, 215) 0px 0px 0px 6px');
 }
 await page.locator('[data-focus="nav-settings"]').click();
 for(const target of ['button[data-pref="'+sidebar+'"]','button[data-theme="dark"]','button[data-language="zh-CN"]']){
  const control=page.locator(target);await control.focus();
  const style=await control.evaluate(n=>{const s=getComputedStyle(n);return {outline:s.outlineStyle,radius:parseFloat(s.borderTopLeftRadius),shadow:s.boxShadow};});
  expect(style.outline).toBe('none');expect(style.radius).toBeGreaterThan(0);expect(style.shadow).toContain('rgb(183, 245, 215) 0px 0px 0px 6px');
 }
 await page.screenshot({path:info.outputPath('dark-rounded-settings.png')});
});

test('sidebar arrows keep their route without measuring a large content grid',async({page})=>{
 await page.route('**/call/home',r=>r.fulfill({json:{sections:[{title:'很多歌单',playlists:Array.from({length:500},(_,i)=>({id:'large-'+i,name:'歌单 '+i,trackCount:20}))}]}}));
 await page.goto('/?token='+token);await expect(page.locator('.album-card')).toHaveCount(500);
 for(const sidebar of ['expanded','icons']){
  await page.request.post('/api/preferences',{data:{sidebar}});await page.reload();await expect(page.locator('.album-card')).toHaveCount(500);
  const paths=await page.evaluate(()=>{
   const rects=Element.prototype.getClientRects,bounds=Element.prototype.getBoundingClientRect;let contentReads=0;
   Element.prototype.getClientRects=function(){if(document.querySelector('#content').contains(this))contentReads++;return rects.call(this);};
   Element.prototype.getBoundingClientRect=function(){if(document.querySelector('#content').contains(this))contentReads++;return bounds.call(this);};
   try{
    const entries=Array.from(document.querySelectorAll('#nav [data-focus]'));entries[0].focus();
    const keys=['ArrowUp','ArrowDown','ArrowDown','ArrowUp'],focused=[];
    for(const key of keys){document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));focused.push(document.activeElement.getAttribute('data-focus'));}
    return{focused,contentReads,home:entries[0].getAttribute('data-focus'),second:entries[1].getAttribute('data-focus')};
   }finally{Element.prototype.getClientRects=rects;Element.prototype.getBoundingClientRect=bounds;}
  });
  expect(paths.focused).toEqual(['source-switch',paths.home,paths.second,paths.home]);expect(paths.contentReads).toBe(0);
 }
});
