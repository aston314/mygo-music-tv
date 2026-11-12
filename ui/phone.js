(function () {
 'use strict';
 var token=location.hash.slice(1),tr=window.MyGoI18n.text,context=null,timer,submitted=false,busy=false,deadline=0;
 function $(id){return document.getElementById(id);}
 function status(text){$('status').textContent=tr(text);}
 function request(method,body,done){var xhr=new XMLHttpRequest();xhr.open(method,'/input/session');xhr.timeout=10000;xhr.setRequestHeader('Authorization','Bearer '+token);xhr.setRequestHeader('Content-Type','application/json');xhr.onload=function(){var d;try{d=JSON.parse(xhr.responseText);}catch(_){d={};}done(xhr.status>=200&&xhr.status<300?null:d.code||'connection',d);};xhr.onerror=xhr.ontimeout=function(){done('connection');};xhr.send(body?JSON.stringify(body):null);}
 function ended(message){clearTimeout(timer);$('phone-form').hidden=true;$('retry').hidden=true;status(message);}
 function showError(code){if(code==='expired'||code==='unauthorized'){ended('扫码连接已失效，请重新扫码');return;}if(code==='submitted'){sent();return;}status(code==='invalid'?'请输入有效关键词，最多 200 个字':'连接中断，请重试');$('retry').hidden=false;}
 function sent(){submitted=true;ended('已发送到电视，请在电视上查看搜索结果');}
 function connect(){
  if(submitted||busy)return;if(deadline&&Date.now()>=deadline){ended('扫码连接已失效，请重新扫码');return;}clearTimeout(timer);$('retry').hidden=true;
  request('GET',null,function(err,d){
   if(err){showError(err);return;}
   deadline=Date.now()+Math.max(0,d.expiresAt-d.serverNow);if(!context){context=d;window.MyGoI18n.apply(d.theme,d.language);window.MyGoI18n.localize(document);$('target').textContent=tr(d.target==='plugins'?'搜索插件':'搜索音乐');$('context').textContent=d.context;$('query').value=d.initial||'';$('pairing').textContent=tr('连接标识')+' · '+d.pairCode;$('pairing').hidden=false;}
   if(d.state==='submitted'){sent();return;}
   $('phone-form').hidden=false;status('已连接电视，输入后点击搜索');timer=setTimeout(connect,3000);
  });
 }
 $('phone-form').onsubmit=function(e){e.preventDefault();if(busy||submitted||!context)return;var value=$('query').value.replace(/^\s+|\s+$/g,'');if(!value){status('请输入搜索内容');$('query').focus();return;}busy=true;clearTimeout(timer);$('submit').disabled=true;status('正在发送…');request('POST',{target:context.target,value:value},function(err){busy=false;$('submit').disabled=false;if(err){showError(err);return;}sent();});};
 $('retry').onclick=connect;
 if(!/^[a-f0-9]{48}$/.test(token)){ended('扫码连接已失效，请重新扫码');return;}connect();
}());
