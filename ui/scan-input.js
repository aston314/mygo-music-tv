// One scoped phone-input lifecycle shared by both search screens.
(function (root) {
 'use strict';
 root.MyGoScanInput={create:function(env){
  var current=null,tr=root.MyGoI18n.text;
  function $(id){return document.getElementById(id);}
  function remove(id){if(id)env.request('DELETE','/api/input-session?id='+encodeURIComponent(id),null,function(){});}
  function cancel(){var ctx=current;current=null;if(!ctx)return;clearTimeout(ctx.timer);clearInterval(ctx.clock);remove(ctx.id);}
  function valid(ctx){return current===ctx&&ctx.valid();}
  function remaining(ctx){var seconds=Math.max(0,Math.ceil((ctx.deadline-Date.now())/1000));$('scan-expiry').textContent=tr('二维码有效期')+' · '+Math.floor(seconds/60)+':'+('0'+seconds%60).slice(-2);if(!seconds)expired(ctx);return seconds>0;}
  function expired(ctx){if(!valid(ctx))return;clearTimeout(ctx.timer);clearInterval(ctx.clock);$('scan-qr').hidden=true;$('scan-status').textContent=tr('扫码连接已失效，请重新扫码');$('scan-expiry').textContent='';}
  function failed(ctx,message){if(!valid(ctx))return;clearTimeout(ctx.timer);$('scan-status').textContent=message;}
  function poll(ctx,serial){
   if(!valid(ctx)||serial!==ctx.serial)return;
   env.request('GET','/api/input-session?id='+encodeURIComponent(ctx.id),null,function(err,d){
    if(!valid(ctx)||serial!==ctx.serial)return;
    if(err){failed(ctx,err);return;}if(d.target!==ctx.target){failed(ctx,tr('扫码输入请求无效'));return;}
    if(d.state==='expired'){expired(ctx);return;}
    if(d.state==='submitted'){
     // Detach before closing the modal: its normal cleanup must not cancel or
     // reapply this result. The phone's Search button is the apply confirmation.
     current=null;clearTimeout(ctx.timer);clearInterval(ctx.clock);remove(ctx.id);env.close();ctx.apply(d.value);return;
    }
    $('scan-status').textContent=tr(d.state==='connected'?'手机已连接，请在手机上输入':'等待手机扫码…');ctx.deadline=Date.now()+Math.max(0,d.expiresAt-d.serverNow);if(!remaining(ctx))return;ctx.timer=setTimeout(function(){poll(ctx,serial);},900);
   });
  }
  function start(ctx){
   if(!valid(ctx))return;var serial=ctx.serial=(ctx.serial||0)+1;clearTimeout(ctx.timer);clearInterval(ctx.clock);remove(ctx.id);ctx.id='';$('scan-qr').hidden=true;$('scan-pairing').textContent='';$('scan-expiry').textContent='';$('scan-status').textContent=tr('正在准备二维码…');var refresh=$('modal-layer').querySelector('[data-action="scan-refresh"]');refresh.setAttribute('aria-disabled','true');
   var address='';try{if(root.Android&&root.Android.lanAddress)address=root.Android.lanAddress();}catch(_){}
   env.request('POST','/api/input-session',{target:ctx.target,context:ctx.context,initial:ctx.initial,language:root.MyGoI18n.language,theme:root.MyGoI18n.theme,address:address},function(err,d){
    if(!valid(ctx)||serial!==ctx.serial){if(d&&d.id)remove(d.id);return;}refresh.setAttribute('aria-disabled','false');
    if(err){failed(ctx,err);return;}ctx.id=d.id;ctx.deadline=Date.now()+Math.max(0,d.expiresAt-d.serverNow);$('scan-qr').src='/api/input-session/qr?id='+encodeURIComponent(d.id);$('scan-qr').hidden=false;$('scan-pairing').textContent=tr('连接标识')+' · '+d.pairCode;$('scan-status').textContent=tr('等待手机扫码…');if(!remaining(ctx))return;ctx.clock=setInterval(function(){if(valid(ctx))remaining(ctx);},1000);poll(ctx,serial);
   });
  }
  function open(options){cancel();options.opened=Date.now();current=options;env.open('<p class="scan-context">'+env.escape(options.context)+'</p><img id="scan-qr" class="qr" alt="'+tr('使用手机扫码搜索')+'" hidden><p class="scan-instruction">'+tr('手机与电视需在同一局域网')+'</p><p id="scan-status" role="status"></p><p id="scan-pairing" class="hint"></p><p id="scan-expiry" class="hint"></p>',env.button('cancel',tr('取消'))+env.button('scan-refresh',tr('刷新二维码'),'secondary','refresh'));start(options);}
  return {open:open,cancel:cancel,startedBefore:function(before){return !current||current.opened<=before;},refresh:function(){if(current)start(current);}};
 }};
}(window));
