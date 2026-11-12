(function () {
  'use strict';
  var paths = {
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon:'<path d="M20.5 14A9 9 0 0 1 10 3a9 9 0 1 0 10.5 11Z"/>',
    music:'<path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="18" cy="16" rx="3" ry="2.5"/>',
    home:'<path d="m3 10 9-7 9 7v11H3zM9 21v-8h6v8"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    play:'<path d="m7 4 12 8-12 8z" fill="currentColor" stroke="none"/>',
    pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',
    previous:'<path d="M5 5v14m14-14L7 12l12 7z"/>',
    next:'<path d="M19 5v14M5 5l12 7-12 7z"/>',
    queue:'<path d="M4 5h16M4 11h12M4 17h8m5-3 5 4-5 4z"/>',
    sequence:'<path d="M4 5h13M4 11h13M4 17h7m5-2 5 4-5 4"/>',
    loop:'<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>',
    single:'<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3m8-8 2-1v6"/>',
    shuffle:'<path d="M3 5h3l12 14h3m-4-4 4 4-4 4M3 19h3l12-14h3m-4-4 4 4-4 4"/>',
    playlist:'<path d="M4 4h16v16H4zM8 8h8m-8 4h8m-8 4h4"/>',
    album:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    artist:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/>',
    radio:'<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4m8.4-8.4a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2m14.2-14.2a10 10 0 0 1 0 14.2"/>',
    podcast:'<rect x="8" y="2" width="8" height="13" rx="4"/><path d="M4 10v2a8 8 0 0 0 16 0v-2M12 20v3m-4 0h8"/>',
    market:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    settings:'<path d="m9.5 2.5-.6 2.2-2 .9-2-.6-2.4 4.2L4 10.8v2.4l-1.5 1.6L4.9 19l2-.6 2 .9.6 2.2h5l.6-2.2 2-.9 2 .6 2.4-4.2-1.5-1.6v-2.4l1.5-1.6L19.1 5l-2 .6-2-.9-.6-2.2z"/><circle cx="12" cy="12" r="3.3"/>',
    sources:'<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    chevronDown:'<path d="m5 9 7 7 7-7"/>',
    arrow:'<path d="M5 19 19 5M5 5h14v14"/>',
    back:'<path d="m10 4-8 8 8 8M3 12h19"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    close:'<path d="m5 5 14 14M5 19 19 5"/>',
    check:'<path d="m4 12 5 5L21 5"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    comment:'<path d="M3 3h18v14H9l-6 4zM7 8h10m-10 4h7"/>',
    like:'<path d="M8 21H3V10h5m0 11h10a2 2 0 0 0 2-2l2-7a2 2 0 0 0-2-2h-6l1-5c.5-3-3-4-4-1l-3 6z"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    lyrics:'<path d="M3 4h18v16H3zM7 9h10M7 14h7"/>',
    fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    fullscreenExit:'<path d="M8 3v5H3m13-5v5h5M3 16h5v5m8 0v-5h5"/>',
    refresh:'<path d="M20 7a9 9 0 1 0 1 9M20 2v6h-6"/>',
    catalog:'<path d="M4 4h16v16H4zM8 8h8M8 12h5M8 16h8"/>',
    edit:'<path d="m15 4 5 5M4 20l4-1L21 6l-5-5L3 14z"/>',
    up:'<path d="M12 21V3m-7 7 7-7 7 7"/>',
    down:'<path d="M12 3v18m-7-7 7 7 7-7"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
  };
  function icon(name) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || paths.music) + '</svg>'; }
  var tr = window.MyGoI18n.text;
  var $ = function (id) { return document.getElementById(id); };
  var state = {page:'home',source:null,sources:[],catalog:[],shown:[],items:[],pageGen:0,modal:null,modalGen:0,modalSerial:0,modalStack:[],returnFocus:'',installed:{},updates:{},jobPolls:{},accounts:{},player:null,mode:'real',pref:'expanded',quality:'high',translation:true,theme:window.MyGoI18n.theme,language:window.MyGoI18n.language,stack:[],detail:null,search:'',searchKind:'tracks',jobs:{},likes:{},lyrics:[],lyricKey:'',lyricState:'idle',lyricTimed:true,lyricActive:-2,lyricFull:false,queueRevision:-1,marketCheckBusy:false,marketRefreshBusy:false};
  var audio = $('audio'), audioGen = -1, mediaPath = '', audioSeek = -1, lastEvent = 0, nativePlayer = !!(window.Android && window.Android.nativePlayer);
  var modeLabels = {sequence:'顺序播放',loop:'列表循环',single:'单曲循环',shuffle:'随机播放'};
  Array.prototype.forEach.call(document.querySelectorAll('[data-icon]'), function (n) { n.innerHTML = icon(n.getAttribute('data-icon')); });
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function request(method, path, body, done) {
    var xhr = new XMLHttpRequest(); xhr.open(method,path); xhr.timeout=45000; xhr.setRequestHeader('Content-Type','application/json');
    xhr.onload=function(){var value;try{value=JSON.parse(xhr.responseText);}catch(_){value={error:tr("响应格式错误")};}done(xhr.status>=200&&xhr.status<300?null:(tr(value.error)||tr("请求失败")),value);};
    xhr.onerror=function(){done(tr("连接中断，请重试"));};xhr.ontimeout=function(){done(tr("请求超时，请重试"));};xhr.send(body==null?null:JSON.stringify(body));return xhr;
  }
  function api(path,done){return request('GET',path,null,done);}
  function post(path,value,done){return request('POST',path,value,done||function(e){if(e)toast(e);});}
  function callFor(id,method,params,done){if(!id){done(tr("请先选择音乐源"));return;}return post('/api/sources/'+encodeURIComponent(id)+'/call/'+method,params||{},done);}
  function sourceCall(method,params,done){return callFor(state.source&&state.source.instanceId,method,params,done);}
  function sourceInfo(id){for(var i=0;i<state.sources.length;i++)if(state.sources[i].instanceId===id)return state.sources[i];return null;}
  function can(id,method){var s=sourceInfo(id);return !!(s&&s.capabilities[method]);}
  function trackKey(t){return t.source+':'+t.id;}
  function currentTrack(){return state.player&&state.player.queue[state.player.index];}
  function isCurrentTrack(t){var current=currentTrack();return !!(t&&current&&trackKey(t)===trackKey(current));}
  function currentSymbol(){return icon(state.player&&state.player.wantPlay?'play':'pause');}
  function paintCurrentTracks(){Array.prototype.forEach.call(document.querySelectorAll('#content [data-track],#queue-list [data-queue-jump]'),function(n){var entry=n.getAttribute('data-queue-jump'),i=entry===null?+n.getAttribute('data-track'):state.player.entryIds.indexOf(entry),current=entry===null?isCurrentTrack(state.shown[i]):i===state.player.index,wrap=closest(n,'.track-wrap'),mark=n.querySelector('.track-no'),symbol=current?(state.player.wantPlay?'play':'pause'):String(i+1);wrap.classList.toggle('current',current);if(current)n.setAttribute('aria-current','true');else n.removeAttribute('aria-current');if(mark.getAttribute('data-symbol')!==symbol){mark.setAttribute('data-symbol',symbol);mark.innerHTML=current?currentSymbol():entry===null?('0'+(i+1)).slice(-2):i+1;}});}
  function playbackArtwork(url,ico,alt){return icon(ico)+(url?'<img data-playback-art src="'+esc(url)+'" alt="'+esc(alt||'')+'">':'');}
  function artists(t){return(t.artists||[]).map(function(a){return a.name;}).join(' / ');}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(state.toastTimer);state.toastTimer=setTimeout(function(){$('toast').hidden=true;},4000);}
  function time(ms){var sec=Math.floor(Math.max(0,ms||0)/1000);return Math.floor(sec/60)+':'+('0'+sec%60).slice(-2);}
  function buttonContent(label,ico){return '<span class="button-content">'+(ico?icon(ico):'')+(label!=null?'<span class="button-label">'+esc(label)+'</span>':'')+'</span>';}
  function button(id,label,cls,ico,returnOnly){return '<button data-focus="'+esc(id)+'" data-action="'+esc(id)+'"'+(returnOnly?' data-navigation-back="true"':'')+' class="'+(cls||'secondary')+(ico?' icon-label':'')+'">'+buttonContent(label,ico)+'</button>';}
  function backButton(id,cls,ico){return button(id,tr("返回"),cls,ico,true);}
  function tool(id,label,ico){return '<button class="icon-button" data-focus="'+esc(id)+'" data-action="'+esc(id)+'" aria-label="'+esc(label)+'" title="'+esc(label)+'">'+buttonContent(null,ico)+'</button>';}
  function canvasScale(){var root=document.documentElement;return Math.min((root.clientWidth||innerWidth)/1280,(root.clientHeight||innerHeight)/720);}
  function scale(){var root=document.documentElement,w=root.clientWidth||innerWidth,h=root.clientHeight||innerHeight,s=canvasScale(),stage=$('stage');if(!(s>0))return;stage.style.width=(w/s)+'px';stage.style.height=(h/s)+'px';stage.style.transform='scale('+s+')';stage.style.left='0px';stage.style.top='0px';var posterWidth=w;try{if(window.MyGoPlatform.tv&&window.Android&&window.Android.nativeViewWidth){var nativeWidth=+window.Android.nativeViewWidth();if(nativeWidth>0&&nativeWidth<=16384)posterWidth=nativeWidth;}}catch(_){}root.setAttribute('data-poster-columns',posterWidth>=2400?'6':posterWidth>=1600?'5':posterWidth>=1200?'4':'3');}
  var viewportTimer;
  function refreshViewport(){scale();clearTimeout(viewportTimer);viewportTimer=setTimeout(function(){var active=document.activeElement;if(active&&active.hasAttribute('data-focus')&&!active.disabled&&active.getClientRects().length&&(!state.modal||$('modal-layer').contains(active)))visible(active);centerLyrics();},100);}
  window.addEventListener('resize',refreshViewport);window.addEventListener('pageshow',refreshViewport);document.addEventListener('visibilitychange',function(){if(!document.hidden)refreshViewport();});scale();
  function closest(n,selector){while(n&&n!==document){if(n.matches&&n.matches(selector))return n;n=n.parentNode;}return null;}
  function focusables(){var root=state.modal?$('modal-layer'):$('app');return Array.prototype.filter.call(root.querySelectorAll('[data-focus]'),function(n){return !n.disabled&&n.getClientRects().length>0;});}
  function activeID(){return document.activeElement&&document.activeElement.getAttribute('data-focus');}
  function focusNode(n,noScroll){if(!n||n.disabled||state.modal&&!$('modal-layer').contains(n))return;var box=closest(n,'.panel-scroll,.scroll,nav,.modal,.lyric-window'),top=box?box.scrollTop:0;n.focus();if(noScroll&&box)box.scrollTop=top;else visible(n);}
  function focusId(id,noScroll){var nodes=focusables();for(var i=0;i<nodes.length;i++)if(nodes[i].getAttribute('data-focus')===id){focusNode(nodes[i],noScroll);return true;}return false;}
  function visible(n){var box=closest(n,'.panel-scroll,.scroll,nav,.modal');if(!box)return;var r=n.getBoundingClientRect(),c=box.getBoundingClientRect(),s=canvasScale();if(r.height>c.height-18*s){box.scrollTop+=(r.top-c.top-9*s)/s;return;}if(r.bottom>c.bottom-9*s)box.scrollTop+=(r.bottom-c.bottom+15*s)/s;else if(r.top<c.top+9*s)box.scrollTop-=(c.top-r.top+15*s)/s;}
  function showActiveNav(){var active=$('nav').querySelector('.active');if(active&&active.getClientRects().length)visible(active);}
  function focusContent(){if(state.modal)return;if(state.restoreFocus){var id=state.restoreFocus;state.restoreFocus=null;if(focusId(id))return;}if(state.page==='player'){focusId('toggle');return;}var first=(state.theme==='light'&&$('content').querySelector('[data-action="feature-play"]'))||$('content').querySelector('[data-track],[data-item]')||$('content').querySelector('[data-focus]');if(first)focusNode(first);else focusId('nav-'+state.page);}
  function inRoot(root){return focusables().filter(function(n){return root.contains(n);});}
  function directionTarget(nodes,active,dir){var r=active.getBoundingClientRect(),cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2,best=null,score=Infinity,s=canvasScale(),horizontal=dir==='ArrowLeft'||dir==='ArrowRight';
    nodes.forEach(function(n){if(n===active||n.contains(active)||active.contains(n))return;var t=n.getBoundingClientRect(),dx=(t.left+t.right)/2-cx,dy=(t.top+t.bottom)/2-cy,forward=dir==='ArrowRight'?dx:dir==='ArrowLeft'?-dx:dir==='ArrowDown'?dy:-dy;if(forward<3*s)return;if(horizontal&&(dir==='ArrowLeft'?t.right>r.left+4*s:t.left<r.right-4*s))return;var across=horizontal?Math.abs(dy):Math.abs(dx),val=forward+across*4;if(val<score){score=val;best=n;}});return best;
  }
  function focusSidebar(){state.sidebarFooterReturn=null;if(focusId('nav-'+state.page))return;if(focusId(state.navFocus))return;if(focusId('nav-home'))return;focusId('source-switch');}
  function focusSidebarNear(active){var nav=$('nav'),box=nav.getBoundingClientRect(),r=active.getBoundingClientRect(),center=(r.top+r.bottom)/2,best=null,distance=Infinity;inRoot(nav).forEach(function(n){var t=n.getBoundingClientRect();if(t.bottom<=box.top||t.top>=box.bottom)return;var d=Math.abs((t.top+t.bottom)/2-center);if(d<distance){best=n;distance=d;}});if(best){state.sidebarFooterReturn={id:best.getAttribute('data-focus'),gen:state.pageGen};focusNode(best);}else focusSidebar();}
  function enterContent(){if(state.contentFocus&&state.contentFocus.gen===state.pageGen&&focusId(state.contentFocus.id))return;focusContent();}
  function hasPlayerBar(){return state.page!=='market'&&state.page!=='settings';}
  function enterFooter(active,target){if(!hasPlayerBar())return;state.footerReturn={id:active.getAttribute('data-focus'),gen:state.pageGen};focusId(target||'now');}
  function footerCredits(){return inRoot($('player-bar')).filter(function(n){return n.id==='now-artist'||n.id==='now-album';});}
  function footerCredit(){var credits=footerCredits();for(var i=0;i<credits.length;i++)if(credits[i].id===state.footerCredit)return credits[i];return credits[0];}
  function movePlayerControls(active,dir){
    var rows=[['previous','toggle','next'],canSeek()?['seek']:[],['mode','queue','full-lyrics']].filter(function(ids){return ids.length;}),id=active.getAttribute('data-focus'),row=-1,col=-1;
    rows.forEach(function(ids,i){var at=ids.indexOf(id);if(at>=0){row=i;col=at;}});if(row<0)return;
    if(dir==='ArrowLeft'||dir==='ArrowRight'){var next=rows[row][col+(dir==='ArrowRight'?1:-1)];if(next)focusId(next);else if(dir==='ArrowRight'){if(!focusId('lyrics')&&!focusId('lyrics-retry'))focusId('player-back');}return;}
    var target=rows[row+(dir==='ArrowDown'?1:-1)];if(target){focusId(target[target.length===1?0:row===1?1:Math.min(col,target.length-1)]);return;}
    if(dir==='ArrowUp'){var node=directionTarget(inRoot($('content')),active,dir);if(node)focusNode(node);else focusId('player-back');}
  }
  function moveFooter(active,dir){
    if(state.page==='player'&&!state.lyricFull&&currentTrack()){movePlayerControls(active,dir);return;}
    if(dir==='ArrowLeft'&&active.id==='open-player'&&state.page!=='player'){focusSidebarNear(active);return;}
    if(dir==='ArrowUp'&&active.id==='seek'){focusId('toggle');return;}
    if(dir==='ArrowDown'&&active.id==='seek'){focusId('mode');return;}
    if(dir==='ArrowUp'&&active.id==='mode'&&focusId('seek'))return;
    if(dir==='ArrowDown'&&['previous','toggle','next'].indexOf(active.id)>=0){if(!focusId('seek'))focusId('mode');return;}
    if(dir==='ArrowUp'){if(active.id==='now-album'&&focusId('now-artist'))return;if(state.footerReturn&&state.footerReturn.gen===state.pageGen&&focusId(state.footerReturn.id))return;var candidates=inRoot($('content')),target=directionTarget(candidates,active,dir);if(target)focusNode(target);else if(state.page!=='player')focusSidebar();else focusNode(inRoot(document.querySelector('header'))[0]);return;}
    if(dir==='ArrowDown'){if(active.id==='now-artist')focusId('now-album');return;}
    var credit=footerCredit(),ids=['now',credit?credit.id:'','now-like','previous','toggle','next','seek','mode','queue','full-lyrics'],nodes=focusables(),row=ids.map(function(id){for(var i=0;i<nodes.length;i++)if(nodes[i].getAttribute('data-focus')===id)return nodes[i];return null;}).filter(function(n){return !!n;});
    var at=row.indexOf(active);if(active.id==='now-album'||active.id==='now-artist')at=row.indexOf(credit);if(at<0)return;var next=row[at+(dir==='ArrowRight'?1:-1)];if(next)focusNode(next);
  }
  function move(dir){
    var active=document.activeElement,nav=$('nav'),content=$('content'),nodes=focusables();
    if(!active||nodes.indexOf(active)<0){focusNode(nodes[0]);return;}
    if(state.modal&&moveComments(active,dir))return;
    if(state.modal&&active.getAttribute('data-focus')==='modal-content'&&(dir==='ArrowUp'||dir==='ArrowDown')){active.scrollTop+=dir==='ArrowUp'?-90:90;return;}
    if(state.modal&&active.id==='login-status'&&(dir==='ArrowUp'||dir==='ArrowDown')){var step=dir==='ArrowUp'?-90:90;if(step<0&&active.scrollTop>0||step>0&&active.scrollTop<active.scrollHeight-active.clientHeight-1){active.scrollTop+=step;return;}}
    if(!state.modal&&nav.contains(active)){
      var entries=Array.prototype.slice.call(nav.querySelectorAll('[data-focus]')),at=entries.indexOf(active);
      if(dir==='ArrowUp'||dir==='ArrowDown'){var next=entries[at+(dir==='ArrowDown'?1:-1)];if(next)focusNode(next);else if(dir==='ArrowUp')focusId('source-switch');else enterFooter(active);return;}
      if(dir==='ArrowRight'){if(hasPlayerBar()&&(state.sidebarFooterReturn&&state.sidebarFooterReturn.gen===state.pageGen&&state.sidebarFooterReturn.id===activeID()||active.getBoundingClientRect().top>=$('player-bar').getBoundingClientRect().top))enterFooter(active);else enterContent();return;}if(dir==='ArrowLeft')return;
    }
    if(!state.modal&&active.id==='source-switch'){if(dir==='ArrowDown')focusNode(nav.querySelector('[data-focus]'));else if(dir==='ArrowRight')enterContent();return;}
    if(!state.modal&&$('player-bar').contains(active)){moveFooter(active,dir);return;}
    if(!state.modal&&active.id==='lyrics'&&state.lyricTimed===false&&(dir==='ArrowUp'||dir==='ArrowDown')){var delta=dir==='ArrowUp'?-90:90;if(delta<0&&active.scrollTop>0||delta>0&&active.scrollTop<active.scrollHeight-active.clientHeight-1){active.scrollTop+=delta;return;}}
    if(!state.modal&&state.theme==='light'&&content.contains(active)){
      var featured=content.querySelector('[data-action="feature-play"]'),firstTrack=content.querySelector('[data-track]');
      if(featured&&dir==='ArrowDown'&&active===featured&&firstTrack){focusNode(firstTrack);return;}
      if(featured&&dir==='ArrowUp'&&active===firstTrack){focusNode(featured);return;}
    }
    var root=state.modal?$('modal-layer'):content.contains(active)?content:document.querySelector('header'),target=directionTarget(inRoot(root),active,dir);
    if(target){focusNode(target);return;}
    if(!state.modal&&content.contains(active)){
      if(dir==='ArrowLeft'&&state.page!=='player')focusSidebar();
      else if(dir==='ArrowDown')enterFooter(active,state.page==='player'?'toggle':'now');
      else if(dir==='ArrowUp'){target=directionTarget(inRoot(document.querySelector('header')),active,dir);if(target)focusNode(target);else if(state.page!=='player')focusId('source-switch');}
    }else if(!state.modal&&root.tagName==='HEADER'){
      if(dir==='ArrowDown'){if(inRoot(content).length)focusNode(inRoot(content)[0]);else enterFooter(active);}
      else if(dir==='ArrowLeft'&&state.page!=='player')focusSidebar();
    }
  }
  function actionable(n){return closest(n,'[data-focus]');}
  function followPointer(e){if(state.scrub&&state.scrub.drag)return;if(state.pointerX===e.clientX&&state.pointerY===e.clientY)return;state.pointerX=e.clientX;state.pointerY=e.clientY;var n=actionable(e.target);if(n&&!n.disabled&&(!state.modal||$('modal-layer').contains(n))&&!isEditor(n)&&document.activeElement!==n){if(state.modal)state.modalEntry=null;focusNode(n,true);}}
  document.addEventListener('mouseover',followPointer);document.addEventListener('mousemove',followPointer);
  document.addEventListener('wheel',function(e){var target=actionable(e.target);if(target&&!isEditor(target)&&(!state.modal||$('modal-layer').contains(target)))focusNode(target,true);clearTimeout(state.wheelTimer);state.wheelTimer=setTimeout(function(){var active=document.activeElement,box=closest(active,'.panel-scroll,.scroll,nav,.modal');if(!box)return;var a=active.getBoundingClientRect(),b=box.getBoundingClientRect();if(a.bottom>=b.top&&a.top<=b.bottom)return;var valid=Array.prototype.filter.call(box.querySelectorAll('[data-focus]'),function(n){var r=n.getBoundingClientRect();return !n.disabled&&r.top>=b.top+6&&r.bottom<=b.bottom-6;});var cards=valid.filter(function(n){return n.hasAttribute('data-comment-index');});if(cards.length)valid=cards;if(valid.length)focusNode(valid[a.top<b.top?0:valid.length-1],true);},100);},false);
  function isEditor(n){return n&&(n.tagName==='TEXTAREA'||n.tagName==='INPUT'&&n.type!=='range');}
  function finishEditing(){if(window.Android&&window.Android.finishSearchEditing)window.Android.finishSearchEditing();}
  document.addEventListener('focusin',function(e){var pending=state.pendingContentFocus;if(pending&&pending.waiting&&pending.gen===state.pageGen&&e.target.hasAttribute('data-focus')&&activeID()!==pending.focus)pending.moved=true;if(!state.modal){if($('nav').contains(e.target))state.navFocus=activeID();if($('content').contains(e.target))state.contentFocus={id:activeID(),gen:state.pageGen};if(e.target.id==='now-artist'||e.target.id==='now-album')state.footerCredit=e.target.id;}if(isEditor(e.target)&&window.Android&&window.Android.startSearchEditing)window.Android.startSearchEditing();});
  document.addEventListener('focusout',function(e){if(isEditor(e.target))finishEditing();if(e.target.id==='seek'&&state.scrub&&!state.scrub.drag)commitSeek();});
  document.addEventListener('keydown',function(e){
    var key=(e.key&&e.key!=='Unidentified'?e.key:'')||{8:'Backspace',9:'Tab',13:'Enter',27:'Escape',32:' ',37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown'}[e.keyCode]||'',editing=isEditor(document.activeElement);
    if(window.MyGoPlatform.tv&&(e.keyCode===461||e.keyCode===10009))key='BrowserBack';
    if(state.modal)state.modalEntry=null;
    if(!state.modal&&document.activeElement.id==='seek'&&(key==='ArrowLeft'||key==='ArrowRight'||key==='Enter')){e.preventDefault();if(key==='Enter')commitSeek();else stepSeek(key==='ArrowLeft'?-10000:10000);return;}
    if(key==='Enter'&&document.activeElement.hasAttribute('data-comment-index')){e.preventDefault();var action=document.activeElement.querySelector('[data-comment-expand]')||document.activeElement.querySelector('[data-focus]');if(action){if(action.hasAttribute('data-comment-expand'))action.click();else focusNode(action);}return;}
    if(key==='Escape'||key==='BrowserBack'){e.preventDefault();back();return;}
    if(key==='Tab'&&state.modal){e.preventDefault();var a=focusables(),at=a.indexOf(document.activeElement);if(a.length)focusNode(a[(at+(e.shiftKey?a.length-1:1))%a.length]);return;}
    if(key.indexOf('Arrow')===0){if(editing&&(key==='ArrowLeft'||key==='ArrowRight'))return;if(document.activeElement.type==='range'&&(key==='ArrowLeft'||key==='ArrowRight'))return;e.preventDefault();move(key);}
    if(key===' '&&!editing){e.preventDefault();toggle();}
    if(key==='MediaPlayPause'){e.preventDefault();toggle();}if(key==='MediaTrackNext'){e.preventDefault();control('next');}if(key==='MediaTrackPrevious'){e.preventDefault();control('previous');}
  });
  document.addEventListener('keyup',function(e){if((e.key==='ArrowLeft'||e.key==='ArrowRight'||e.keyCode===37||e.keyCode===39)&&state.scrub&&!state.scrub.drag)commitSeek();});
  function dialog(key,html,actions,options){options=options||{};options.label=tr(key);return modal(key,html,actions,options);}
  function modal(title,html,actions,options){
    options=options||{};if(state.modal&&options.nest)state.modalStack.push({title:state.modal,gen:state.modalGen,node:$('modal-layer').firstChild,focus:activeID()});if(!state.modal){state.returnFocus=activeID();state.modalStack=[];}state.modal=title;state.modalGen=++state.modalSerial;finishEditing();
    $('modal-layer').innerHTML='<section class="modal '+(options.drawer?'drawer':'')+(options.centered?' centered-modal':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(options.label||title)+'">'+(options.drawer?'<div class="drawer-head"><h2>'+esc(options.label||title)+'</h2>'+tool('cancel',tr("关闭"),'close')+'</div>':'<h2>'+esc(options.label||title)+'</h2>')+html+(actions?'<div class="actions">'+actions+'</div>':'')+'</section>';
    $('modal-layer').hidden=false;if(!focusables().length){var region=$('modal-layer').firstChild;region.setAttribute('data-focus','modal-content');region.setAttribute('tabindex','0');}var first=modalListEntry();if(!focusId(options.entry)){if(first)focusNode(first);else if(!focusId('cancel'))focusNode(focusables()[0]);}state.modalEntry=first?null:{gen:state.modalGen,focus:activeID()};return state.modalGen;
  }
  function modalListEntry(){return $('modal-layer').querySelector('.source-option:not(:disabled),.menu-option:not(:disabled),[data-queue-jump],[data-comment-index]');}
  function focusLoadedList(){var pending=state.modalEntry;if(!pending||pending.gen!==state.modalGen)return;state.modalEntry=null;var first=modalListEntry();if(first&&activeID()===pending.focus)focusNode(first);}
  function closeModal(all){
    if(!all&&state.modalStack.length){var parent=state.modalStack.pop();state.modal=parent.title;state.modalGen=parent.gen;$('modal-layer').innerHTML='';$('modal-layer').appendChild(parent.node);finishEditing();updateLikeButtons();if(state.modal==='播放队列')paintQueue();if(state.modal==='加入歌单'&&state.pickContext&&(state.pickContext.busy||state.pickContext.dirty))loadPlaylists(state.pickContext);if(!focusId(parent.focus))focusId('cancel');if(state.modal==='歌曲评论'&&state.comments&&state.comments.busy){state.comments.busy=false;state.comments.request=(state.comments.request||0)+1;loadComments();}return;}
    var ctx=state.catalogView;if(catalogOpen(ctx)&&ctx.permissionJob){post('/api/jobs/'+ctx.permissionJob+'/confirm',{allow:false},function(){refreshUpdates();});ctx.permissionJob='';}var login=state.modal==='登录音乐源';state.modal=null;state.modalGen=++state.modalSerial;state.modalStack=[];$('modal-layer').hidden=true;clearTimeout(state.loginTimer);finishEditing();if(login){var loginID=state.loginID;state.loginID=null;request('DELETE','/api/login'+(loginID?'?id='+encodeURIComponent(loginID):''),null,function(){});}if(!focusId(state.returnFocus))focusContent();if(state.localeDirty){state.localeDirty=false;refreshLanguage();}
  }

  function rememberPage(focus){state.stack.push({page:state.page,detail:state.detail,focus:focus||activeID(),scroll:$('content').scrollTop,search:state.search});}
  function back(){
    if(isEditor(document.activeElement)){document.activeElement.blur();finishEditing();if(state.modal)focusId('cancel');else focusId('search-submit');return true;}
    if(state.modal){closeModal();return true;}
    if(state.page==='player'&&state.lyricFull){state.lyricFull=false;renderPlayerPage();focusId('full-lyrics');return true;}
    if(state.stack.length){var target=state.stack.pop();state.detail=target.detail;state.search=target.search;state.restoreFocus=target.focus;state.restoreScroll=target.scroll;navigate(target.page);return true;}
    if(state.page!=='home'&&state.page!=='market'){state.detail=null;navigate('home');return true;}
    exitConfirm();return true;
  }
  function canShowAppUpdate(manual){return !$('app').hidden&&!document.hidden&&!state.modal&&state.page!=='player'&&!isEditor(document.activeElement)&&(manual||!state.player||!state.player.wantPlay);}
  window.MyGo={back:back,nativeBack:back,refreshViewport:refreshViewport,canShowAppUpdate:canShowAppUpdate};
  function exitConfirm(){if(window.Android&&window.Android.confirmExit)window.Android.confirmExit();else dialog('退出 My Music+？',("<p>"+tr("退出后停止播放音乐。")+"</p>"),button('cancel',tr("取消"))+button('exit',tr("退出"),'primary'));}
  function appClass(){ $('app').className=[state.pref==='icons'?'icons':'',state.page==='player'?'player-view':'',state.page==='player'&&state.lyricFull?'lyrics-full':'',hasPlayerBar()?'':'without-player'].filter(function(x){return x;}).join(' ');$('player-bar').hidden=!hasPlayerBar();renderLyricButton();renderNowLikeVisibility(); }
  function renderLyricButton(){var n=$('lyrics-button'),full=state.page==='player'&&state.lyricFull,label=full?tr("退出全屏歌词"):tr("全屏歌词");n.hidden=state.page!=='player';n.disabled=!currentTrack();n.innerHTML=buttonContent(null,full?'fullscreenExit':'fullscreen');n.setAttribute('aria-pressed',String(full));n.setAttribute('aria-label',label);n.title=label;}
  function renderNowLikeVisibility(){var t=currentTrack();$('now-like').hidden=state.page==='player'||!t||!can(t.source,t.showId?'likeEpisode':'like');}
  function renderNav(){
    var items=[{id:'home',title:tr("发现音乐"),icon:'home'},{id:'search',title:tr("搜索"),icon:'search'}],added={home:true,search:true};
    function add(id,label,ico,method){if(!added[id]&&state.source&&state.source.capabilities[method||id]){items.push({id:id,title:label,icon:ico});added[id]=true;}}
    if(state.source){add('liked',tr("我喜欢"),'heart');add('playlists',tr("我的歌单"),'playlist');add('savedAlbums',tr("收藏专辑"),'album');add('recent',tr("最近播放"),'clock');(state.source.manifest.navigation||[]).forEach(function(n){if(n.page&&!added['browse:'+n.page]){items.push({id:'browse:'+n.page,title:n.title||tr("音乐精选"),icon:'compass'});added['browse:'+n.page]=true;}if(n.builtin==='stations')add('stations',n.title||tr("电台"),'radio');if(n.builtin==='shows')add('shows',n.title||tr("播客"),'podcast');});}
    items.push({id:'market',title:tr("插件市场"),icon:'market'},{id:'settings',title:tr("设置"),icon:'settings'});
    $('nav').innerHTML=items.map(function(n){return '<button data-focus="nav-'+esc(n.id)+'" data-nav="'+esc(n.id)+'" aria-label="'+esc(n.title)+'" class="'+(state.page===n.id?'active':'')+'"><span class="button-content"><span class="nav-icon">'+icon(n.icon)+'</span><span class="nav-text">'+esc(n.title)+'</span></span></button>';}).join('');
    showActiveNav();
    $('source-name').textContent=state.source?state.source.manifest.name:tr("选择音乐源");
    $('source-switch').title=state.source?state.source.manifest.name:tr("选择音乐源");$('source-switch').setAttribute('aria-label',tr("切换音乐源")+(state.source?'：'+state.source.manifest.name:''));
  }
  function accountSource(){var t=currentTrack();return state.page==='detail'&&state.detail?state.detail.source:state.page==='player'&&t?t.source:state.source&&state.source.instanceId;}
  function renderAccount(){var id=accountSource(),n=$('account-button'),ctx=id&&state.accounts[id];n.hidden=['player','market','settings'].indexOf(state.page)>=0||!id||!can(id,'account')&&!can(id,'signIn');if(n.hidden)return;n.setAttribute('data-account-source',id);var name=ctx&&ctx.account&&ctx.account.name,label=name||(ctx&&ctx.status==='failed'?tr("账号暂不可用"):ctx&&ctx.status==='ready'?tr("未登录"):tr("读取账号…"));$('account-name').textContent=label;n.setAttribute('aria-label',name?tr("当前账号：")+name:label);var src=sourceInfo(id);n.title=(src?src.manifest.name+' · ':'')+label+(ctx&&ctx.status==='failed'?tr(" · 读取失败，点击重试"):'');n.className=ctx&&ctx.status==='failed'?'account-stale':'';if(!ctx)refreshAccount(id);}
  function refreshAccount(id,done){if(!id)return;var ctx=state.accounts[id]||(state.accounts[id]={account:null,status:'idle',request:0}),req=++ctx.request;ctx.status='loading';renderAccount();if(!can(id,'account')){ctx.status='ready';ctx.updatedAt=Date.now();renderAccount();if(done)done(null,null);return;}
    callFor(id,'account',{},function(e,account){if(state.accounts[id]!==ctx||req!==ctx.request)return;ctx.status=e?'failed':'ready';ctx.updatedAt=Date.now();if(!e)ctx.account=account||null;renderAccount();if(done)done(e,ctx.account);});
  }
  function refreshVisibleAccount(){var id=accountSource(),ctx=id&&state.accounts[id];if(id&&(!ctx||Date.now()-(ctx.updatedAt||0)>30000)&&(!ctx||ctx.status!=='loading'))refreshAccount(id);}
  window.addEventListener('focus',refreshVisibleAccount);document.addEventListener('visibilitychange',function(){if(!document.hidden)refreshVisibleAccount();});
  function invalidateLikes(id){state.likeVersions=state.likeVersions||{};Object.keys(state.likes).forEach(function(key){if(key.indexOf(id+':')===0){delete state.likes[key];state.likeVersions[key]=(state.likeVersions[key]||0)+1;}});paintNowTrack(currentTrack());refreshLikes(state.shown);}
  function loadSources(done){api('/api/sources',function(e,list){if(e){toast(e);if(done)done(e);return;}state.sources=list||[];state.installed={};state.sources.forEach(function(s){state.installed[s.repository.toLowerCase()]=s;});if(state.source)state.source=sourceInfo(state.source.instanceId);if(!state.source&&state.sources.length)state.source=sourceInfo(state.preferredSource)||state.sources[0];renderNav();if(done)done();});}
  function setSource(id){var source=sourceInfo(id);if(!source)return;state.source=source;saveAppearance('source',id);state.stack=[];state.detail=null;if(state.modal)closeModal();navigate('home');}
  function sourceMenu(){dialog('选择音乐源',state.sources.length?state.sources.map(function(s){var selected=!!(state.source&&state.source.instanceId===s.instanceId);return '<button class="source-option" data-focus="source-'+esc(s.instanceId)+'" data-source="'+esc(s.instanceId)+'" aria-pressed="'+selected+'">'+esc(s.manifest.name)+(selected?tr(" · 当前"):'')+'<div class="hint">'+esc(s.repository)+'</div></button>';}).join(''):("<p>"+tr("从插件市场安装在线音乐源。")+"</p>"),backButton('cancel')+button('go-market',tr("插件市场"),'primary'),{entry:state.source?'source-'+state.source.instanceId:null});}
  function title(t,eye){$('page-title').textContent=t;$('page-title').title=t;$('eyebrow').textContent=eye||'My Music+';}
  function loading(){ $('content').innerHTML='<div class="state"><div class="state-symbol">'+icon('music')+("</div><h2>"+tr("正在加载")+"</h2><p>"+tr("好音乐，稍等片刻")+"</p></div>");if(state.pendingContentFocus)state.pendingContentFocus.waiting=true; }
  function empty(t,detail,action){$('content').innerHTML='<div class="state"><div class="state-symbol">'+icon('music')+'</div><h2>'+esc(t)+'</h2><p>'+esc(detail||'')+'</p><div>'+(action||'')+'</div></div>';}
  function error(message){empty(tr("暂时无法加载"),message,button('retry',tr("重试"),'primary','refresh'));state.restoreFocus='retry';afterContent();}
  function afterContent(){var pending=state.pendingContentFocus;state.pendingContentFocus=null;if(state.restoreScroll!=null){$('content').scrollTop=state.restoreScroll;state.restoreScroll=null;}if(pending&&pending.gen===state.pageGen&&pending.moved){state.restoreFocus=null;return;}focusContent();}
  function navigate(page){
    stopLyricFrame();state.lyricNodes=null;state.lyricWordNodes=null;
    if(state.episodeXHR){state.episodeXHR.abort();state.episodeXHR=null;if(state.episodeContext)state.episodeContext.busy=false;}if(state.modal)closeModal(true);finishEditing();state.page=page;var gen=++state.pageGen;state.pendingContentFocus={gen:gen,focus:activeID(),moved:false};state.shown=[];state.items=[];state.list=null;$('content').scrollTop=0;$('header-actions').innerHTML='';appClass();renderNav();renderAccount();refreshVisibleAccount();
    if(page==='market'){renderMarket(gen,false);return;}if(page==='settings'){renderSettings();return;}if(page==='player'){renderPlayerPage();afterContent();return;}
    if(page==='detail'){renderDetail(gen);return;}if(page==='search'){renderSearch();return;}
    if(!state.source){title(tr("发现音乐"));empty(tr("把喜欢的音乐，带到客厅"),tr("从官方插件市场安装在线音乐源。"),button('go-market',tr("探索插件市场"),'primary','market'));afterContent();return;}
    var method=page,params={},label={home:tr("发现音乐"),liked:tr("我喜欢的音乐"),playlists:tr("我的歌单"),savedAlbums:tr("收藏专辑"),recent:tr("最近播放"),stations:tr("电台"),shows:tr("播客")}[page]||tr("音乐精选");
    if(page.indexOf('browse:')===0){method='browse';params.page=page.slice(7);}title(label,state.source.manifest.name);
    $('header-actions').innerHTML=page==='playlists'&&can(state.source.instanceId,'createPlaylist')?button('create-playlist',tr("新建歌单"),'','plus'):'';loading();
    if(!can(state.source.instanceId,method)){empty(tr("此音乐源没有提供此页面"),tr("可以搜索音乐，或选择其他音乐源。"),button('go-search',tr("搜索音乐"),'primary','search'));afterContent();return;}
    if(method==='liked'||method==='savedAlbums'){loadList(method,params,method==='liked'?'tracks':'albums',gen);return;}
    sourceCall(method,params,function(e,data){if(gen!==state.pageGen)return;if(e){error(e);return;}data=data||{};if(method==='home'||method==='browse')renderBrowse(data);else if(method==='playlists')renderItems(Array.isArray(data)?data:[],'playlist');else if(method==='stations')renderItems(Array.isArray(data)?data:[],'station');else if(method==='shows')renderItems(Array.isArray(data)?data:[],'show');else if(method==='recent')renderTracks(Array.isArray(data)?data:[]);afterContent();});
  }
  function loadList(method,params,kind,gen){state.list={method:method,params:params,kind:kind,offset:0,more:false,busy:false,items:[],source:state.source.instanceId};fetchList(false,gen);}
  function fetchList(append,gen){var list=state.list;if(!list||list.busy)return;list.busy=true;var params={},k;for(k in list.params)if(Object.prototype.hasOwnProperty.call(list.params,k))params[k]=list.params[k];params.offset=list.offset;
    callFor(list.source,list.method,params,function(e,d){if(gen!==state.pageGen||state.list!==list)return;list.busy=false;if(e){if(!append){error(e);return;}toast(e);var retry=$('load-more');if(retry){retry.disabled=false;retry.textContent=tr("重试加载");}return;}var batch=(d||{})[list.kind]||[];list.offset+=batch.length;list.more=!!(d&&d.more&&batch.length);var existing={};list.items.forEach(function(x){existing[x.id]=true;});batch.forEach(function(x){if(!existing[x.id]){list.items.push(x);existing[x.id]=true;}});
      if(!append){$('content').innerHTML='<div id="list-results"></div><div class="pagination" id="list-pagination"></div>';}
      if(list.kind==='tracks'){state.shown=list.items;var target=$('search-results')||$('list-results');target.innerHTML=list.items.length?list.items.map(trackHTML).join(''):("<div class=\"state\"><p>"+tr("这里还没有音乐")+"</p></div>");refreshLikes(list.items);}
      else{state.items=list.items;var result=$('search-results')||$('list-results');result.innerHTML=list.items.length?'<div class="grid album-grid">'+list.items.map(function(x,i){return itemHTML(x,{albums:'album',artists:'artist',playlists:'playlist',shows:'show'}[list.kind],i);}).join('')+'</div>':("<div class=\"state\"><p>"+tr("没有找到相关内容")+"</p></div>");}
      var pager=$('list-pagination');if(pager)pager.innerHTML=list.more?("<button id=\"load-more\" class=\"secondary\" data-focus=\"load-more\" data-action=\"load-more\">"+tr("加载更多")+"</button>"):'';
      if(append){if(!focusId(list.kind==='tracks'?'track-'+Math.max(0,list.items.length-batch.length):'load-more'))afterContent();}else afterContent();
    });
  }
  function renderSearch(){title(tr("搜索"),state.source?state.source.manifest.name:tr("在线音乐"));$('content').innerHTML=("<form id=\"search-form\" class=\"search-row\"><input id=\"search-input\" type=\"text\" data-focus=\"search-input\" placeholder=\""+tr("歌曲、歌手、专辑")+"\" value=\"")+esc(state.search)+("\"><button data-focus=\"search-submit\" class=\"primary\" type=\"submit\">"+tr("搜索")+"</button></form><div class=\"list-actions\">")+[['tracks',tr("歌曲")],['albums',tr("专辑")],['artists',tr("歌手")],['playlists',tr("歌单")],['shows',tr("播客")]].map(function(x){return '<button class="secondary" data-focus="search-kind-'+x[0]+'" data-search-kind="'+x[0]+'" aria-pressed="'+(state.searchKind===x[0])+'">'+x[1]+'</button>';}).join('')+'</div><div id="search-results"></div><div id="list-pagination" class="pagination"></div>';if(state.restoreFocus&&state.search){search();}else{if(state.restoreFocus)afterContent();else focusId('search-input');}}
  function search(){var input=$('search-input');if(!input)return;state.search=input.value;finishEditing();if(!state.search.replace(/\s/g,'')){toast(tr("请输入搜索内容"));focusId('search-input');return;}var gen=++state.pageGen;$('search-results').innerHTML=("<div class=\"panel-status\">"+tr("正在搜索…")+"</div>");state.list={method:'search',params:{query:state.search,kind:state.searchKind},kind:state.searchKind,offset:0,more:false,busy:false,items:[],source:state.source&&state.source.instanceId};fetchList(true,gen);}
  function trackHTML(t,i){var current=isCurrentTrack(t),art=t.album&&t.album.imageUrl?'<img class="track-art" src="'+esc(t.album.imageUrl)+'" alt="">':'<span class="track-art">'+icon('music')+'</span>';return '<div class="track-wrap'+(current?' current':'')+'"><button class="track-row"'+(current?' aria-current="true"':'')+' data-focus="track-'+i+'" data-track="'+i+'"><span class="track-no">'+(current?currentSymbol():('0'+(i+1)).slice(-2))+'</span>'+art+'<span class="track-meta"><strong>'+esc(t.name)+'</strong><small>'+esc(artists(t))+(t.unavailable?tr(" · 暂不可播放"):'')+'</small></span><span class="track-time">'+time(t.duration)+'</span></button><button class="track-more icon-button" data-focus="track-more-'+i+'" data-track-more="'+i+'" aria-label="'+esc(t.name)+(tr("，更多操作")+"\">")+buttonContent(null,'more')+'</button></div>';}
  function renderTracks(list){state.shown=list;$('content').innerHTML=list.length?'<div class="list-actions">'+button('play-all',tr("播放全部"),'primary','play')+'</div>'+list.map(trackHTML).join(''):("<div class=\"state\"><h2>"+tr("这里还没有音乐")+"</h2><p>"+tr("尝试搜索或其他音乐源")+"</p></div>");refreshLikes(list);}
  function itemHTML(x,type,i){var art=x.imageUrl?'<span class="album-art"><img src="'+esc(x.imageUrl)+'" alt=""></span>':'<span class="album-art">'+icon(type==='artist'?'artist':type==='playlist'?'playlist':'album')+'</span>';return '<button class="album-card" data-focus="item-'+type+'-'+i+'" data-item="'+i+'" data-kind="'+type+'">'+art+'<strong>'+esc(x.name||x.title)+'</strong><small>'+esc(x.owner||x.description||tr("打开聆听"))+'</small></button>';}
  function renderItems(list,type){state.items=list;$('content').innerHTML=list.length?'<div class="grid album-grid">'+list.map(function(x,i){return itemHTML(x,type,i);}).join('')+'</div>':("<div class=\"state\"><h2>"+tr("暂时没有内容")+"</h2></div>");}
  function renderBrowse(data){var h='';state.shown=[];state.items=[];var sections=data.sections||[];if(data.title)title(data.title,state.source.manifest.name);if(data.subtitle||data.description)h+='<div class="hero"><h2>'+esc(data.subtitle||tr("今天，听点什么？"))+'</h2><p>'+esc(data.description||tr("与你喜欢的音乐相遇"))+'</p></div>';
    sections.forEach(function(section){h+='<div class="section-head"><h2>'+esc(section.title||tr("音乐精选"))+'</h2>'+(section.morePage?'<button class="secondary" data-focus="more-page-'+esc(section.morePage)+'" data-browse="'+esc(section.morePage)+("\">"+tr("查看全部")+"</button>"):'')+'</div>';(section.tracks||[]).forEach(function(t){var i=state.shown.length;state.shown.push(t);h+=trackHTML(t,i);});['albums','artists','playlists','shows','stations','links'].forEach(function(key){if(!(section[key]||[]).length)return;h+='<div class="grid album-grid">';section[key].forEach(function(item){var i=state.items.length;state.items.push(item);h+=itemHTML(item,{albums:'album',artists:'artist',playlists:'playlist',shows:'show',stations:'station',links:'browse'}[key],i);});h+='</div>';});if(section.empty&&!(section.tracks||[]).length)h+='<p class="muted">'+esc(section.empty)+'</p>';});
    if(!sections.length){empty(tr("暂时没有内容"),tr("可以搜索音乐，或登录后查看歌单。"),button('go-search',tr("搜索音乐"),'primary','search'));return;}$('content').innerHTML=musicFeature()+h;refreshLikes(state.shown);
  }
  function musicFeature(){
    state.featureTrack=-1;
    for(var i=0;i<state.shown.length;i++){var t=state.shown[i];if(!t.unavailable&&t.album&&t.album.imageUrl){state.featureTrack=i;return '<section class="music-feature"><div class="feature-copy"><span class="feature-kicker">'+esc(tr('为你精选'))+'</span><h2>'+esc(t.name)+'</h2><p>'+esc(artists(t))+'</p>'+button('feature-play',tr('播放'),'primary','play')+'</div><img class="feature-art" src="'+esc(t.album.imageUrl)+'" alt="'+esc(tr('专辑封面'))+'"></section>';}}
    return '';
  }
  function openItem(i,type){var item=state.items[i];if(!item)return;if(type==='browse'){rememberPage();state.detail=null;navigate('browse:'+item.page);return;}openEntity(item,type,state.page==='detail'&&state.detail?state.detail.source:state.source.instanceId);}
  function openEntity(item,type,source){if(!item||!item.id||!can(source,type==='station'?'stationNext':type)){toast(tr("此音乐源没有提供这项详情"));return;}rememberPage();state.detail={item:item,type:type,source:source,section:'tracks'};navigate('detail');}
  function openTrackArtist(){var t=currentTrack();if(!t)return;var list=(t.artists||[]).filter(function(a){return !!a.id;});if(!can(t.source,'artist')||!list.length)return;if(list.length===1){openEntity(list[0],'artist',t.source);return;}state.creditTrack=t;state.creditArtists=list;dialog('选择歌手',list.map(function(a,i){return '<button class="source-option" data-focus="credit-artist-'+i+'" data-credit-artist="'+i+'">'+esc(a.name)+'</button>';}).join(''),backButton('cancel'));}
  function renderDetail(gen){var detail=state.detail;if(!detail){navigate('home');return;}var method=detail.type==='station'?'stationNext':detail.type,src=sourceInfo(detail.source);title(detail.item.name||detail.item.title||tr("音乐详情"),src?src.manifest.name:'');$('header-actions').innerHTML=backButton('detail-back','','back');if(detail.data){paintDetail(detail);return;}loading();
    callFor(detail.source,method,{id:detail.item.id,offset:0},function(e,d){if(gen!==state.pageGen||state.detail!==detail)return;if(e){error(e);return;}detail.data=d||{};detail.entity=detail.data[detail.type]||(detail.type==='playlist'&&detail.data.id?detail.data:detail.item);if(detail.type==='show')detail.paging={offset:(detail.data.episodes||[]).length,more:!!(detail.data.more&&(detail.data.episodes||[]).length),busy:false};paintDetail(detail);});
  }
  function paintDetail(detail){var d=detail.data,tracks=d.tracks||d.episodes||(Array.isArray(d)?d:[]),albums=d.albums||[];state.items=[];state.shown=[];if(detail.type==='artist'&&detail.section==='albums')renderItems(albums,'album');else renderTracks(tracks);
    var src=sourceInfo(detail.source);title(detail.entity.name||detail.entity.title||detail.item.name||detail.item.title||tr("音乐详情"),src?src.manifest.name:'');var top='',mut={album:['saveAlbum',tr("收藏专辑"),'saved'],artist:['followArtist',tr("关注歌手"),'following'],playlist:['savePlaylist',tr("收藏歌单"),'saved'],show:['subscribeShow',tr("订阅播客"),'subscribed']}[detail.type];
    if(mut&&can(detail.source,mut[0])&&!(detail.type==='playlist'&&detail.entity.mine))top+='<div class="detail-actions"><button class="secondary icon-label" data-focus="save-entity" data-action="save-entity" aria-pressed="'+!!detail.entity[mut[2]]+'">'+buttonContent(detail.entity[mut[2]]?tr("取消")+mut[1].slice(0,2):mut[1],'heart')+'</button></div>';
    if(editablePlaylist(detail)&&(can(detail.source,'renamePlaylist')||can(detail.source,'deletePlaylist'))&&!detail.stale){var actions=$('content').querySelector('.list-actions'),manage=button('manage-playlist',tr("管理歌单"),'secondary','edit');if(actions)actions.insertAdjacentHTML('beforeend',manage);else top+='<div class="detail-actions">'+manage+'</div>';}if(detail.stale)top+='<div class="detail-actions">'+button('refresh-detail',tr("重新加载歌单"),'secondary','refresh')+'</div>';
    if(detail.type==='artist')top+='<div class="detail-tabs">'+['tracks','albums'].map(function(kind){return '<button class="secondary" data-focus="detail-'+kind+'" data-detail-section="'+kind+'" aria-pressed="'+(detail.section===kind)+'">'+(kind==='tracks'?tr("歌曲 · ")+tracks.length:tr("专辑 · ")+albums.length)+'</button>';}).join('')+'</div>';$('content').insertAdjacentHTML('afterbegin',top);if(detail.type==='show'){$('content').insertAdjacentHTML('beforeend','<div class="pagination" id="episode-pagination"></div>');paintEpisodePager(detail);}afterContent();
  }
  function paintEpisodePager(detail){
    var box=$('episode-pagination'),p=detail.paging;if(!box||!p)return;
    var message=box.querySelector('p'),n=box.querySelector('button');
    if(p.error){if(!message){message=document.createElement('p');message.className='hint';message.setAttribute('role','status');box.insertBefore(message,box.firstChild);}message.textContent=p.error;}else if(message)box.removeChild(message);
    if(p.more){if(!n){box.insertAdjacentHTML('beforeend',button('episodes-more',tr("加载更多"),'secondary','refresh'));n=box.querySelector('button');}n.textContent=p.busy?tr("正在加载…"):p.error?tr("重试加载"):tr("加载更多");n.setAttribute('aria-disabled',String(!!p.busy));}else if(n)box.removeChild(n);
  }
  function loadEpisodes(explicit){
    var detail=state.detail,p=detail&&detail.paging;if(state.page!=='detail'||!detail||detail.type!=='show'||!p||p.busy||!p.more)return;
    var gen=state.pageGen,offset=p.offset;p.busy=true;p.error='';paintEpisodePager(detail);state.episodeContext=p;
    state.episodeXHR=callFor(detail.source,'show',{id:detail.item.id,offset:offset},function(e,data){
      if(gen!==state.pageGen||state.detail!==detail||detail.paging!==p)return;
      state.episodeXHR=null;p.busy=false;
      if(e){p.error=e;paintEpisodePager(detail);if(explicit)focusId('episodes-more');return;}
      var batch=(data||{}).episodes||[],known={},fresh=[],old=detail.data.episodes||[],start=old.length;
      old.forEach(function(t){known[trackKey(t)]=true;});batch.forEach(function(t){var key=trackKey(t);if(!known[key]){known[key]=true;fresh.push(t);}});
      p.offset+=batch.length;p.more=!!(data&&data.more&&batch.length&&fresh.length);
      if(fresh.length){
        if(!old.length){var empty=$('content').querySelector('.state');if(empty)empty.parentNode.removeChild(empty);$('episode-pagination').insertAdjacentHTML('beforebegin','<div class="list-actions">'+button('play-all',tr("播放全部"),'primary','play')+'</div>');}
        detail.data.episodes=old.concat(fresh);state.shown=detail.data.episodes;
        $('episode-pagination').insertAdjacentHTML('beforebegin',fresh.map(function(t,i){return trackHTML(t,start+i);}).join(''));refreshLikes(fresh);
      }
      var pagerFocused=activeID()==='episodes-more';paintEpisodePager(detail);
      if(explicit||pagerFocused){if(fresh.length)focusId('track-'+start);else if(old.length)focusId('track-'+(old.length-1));else focusId('save-entity')||focusId('detail-back');}
    });
  }
  document.addEventListener('scroll',function(e){var d=state.detail,n=e.target;if(n.id==='content'&&state.page==='detail'&&d&&d.type==='show'&&d.paging&&!d.paging.error&&!state.modal&&n.scrollHeight-n.scrollTop-n.clientHeight<160)loadEpisodes(false);},true);

  function editablePlaylist(detail){if(!detail||detail.type!=='playlist'||!detail.entity)return false;var e=detail.entity,item=detail.item;return !!((e.mine===true||e.mine==null&&item.mine===true)&&!e.fixed&&!item.fixed);}
  function playlistOption(action,label,ico){return '<button class="menu-option" data-focus="'+action+'" data-action="'+action+'">'+buttonContent(label,ico)+'</button>';}
  function managePlaylist(){
    var d=state.detail;if(!editablePlaylist(d)||d.stale)return;state.managedPlaylist=d;var h='';
    if(can(d.source,'renamePlaylist'))h+=playlistOption('rename-playlist',tr("重命名歌单"),'edit');
    if(can(d.source,'deletePlaylist'))h+=playlistOption('delete-playlist',tr("删除歌单"),'trash');
    if(!h)return;dialog('管理歌单','<p>'+esc(d.entity.name)+'</p>'+h,backButton('cancel'));
  }
  function renamePlaylist(){
    var d=state.managedPlaylist;if(!editablePlaylist(d))return;state.compose={kind:'rename',source:d.source,detail:d};
    dialog('重命名歌单','<form id="compose-form"><input id="compose-input" data-focus="compose-input" type="text" maxlength="80" value="'+esc(d.entity.name)+'" aria-label="'+tr("歌单名称")+'"></form>',button('cancel',tr("取消"))+button('compose-submit',tr("保存"),'primary'),{nest:true});
  }
  function submitPlaylistRename(ctx,text,n,gen){
    var d=ctx.detail;callFor(ctx.source,'renamePlaylist',{id:d.item.id,name:text},function(e){
      n.disabled=false;if(e){toast(e);return;}d.entity.name=text;d.item.name=text;if(d.data.id)d.data.name=text;
      if(gen===state.modalGen&&state.detail===d&&state.page==='detail'){closeModal(true);state.restoreFocus='manage-playlist';state.restoreScroll=$('content').scrollTop;paintDetail(d);}
      toast(tr("歌单已重命名"));
    });
  }
  function confirmPlaylistDelete(){
    var d=state.managedPlaylist;if(!editablePlaylist(d))return;
    dialog('删除歌单？','<p>'+esc(d.entity.name)+'</p><p class="hint">'+tr("将从音乐源账号中删除此歌单。")+'</p>',button('cancel',tr("取消"))+button('delete-playlist-confirm',tr("删除歌单"),'primary'),{nest:true});
  }
  function deletePlaylist(n){
    var d=state.managedPlaylist,gen=state.modalGen;if(!editablePlaylist(d)||n.disabled)return;n.disabled=true;
    callFor(d.source,'deletePlaylist',{id:d.item.id},function(e){n.disabled=false;if(e){toast(e);return;}if(gen===state.modalGen&&state.detail===d){closeModal(true);state.source=sourceInfo(d.source)||state.source;state.detail=null;state.stack=[];navigate('playlists');}toast(tr("歌单已删除"));});
  }
  function playlistTrackActions(ctx){
    if(!ctx||ctx.detail.stale)return '';var d=ctx.detail,h='';
    if(can(d.source,'removeFromPlaylist'))h+=playlistOption('playlist-remove-track',tr("从歌单移除"),'trash');
    if(can(d.source,'movePlaylistTrack')){
      if(ctx.index>0)h+=playlistOption('playlist-track-up',tr("向上移动"),'up');
      if(ctx.index<(d.data.tracks||[]).length-1)h+=playlistOption('playlist-track-down',tr("向下移动"),'down');
    }return h;
  }
  function editPlaylistTrack(action,n){
    var ctx=state.playlistContext;if(!ctx||!editablePlaylist(ctx.detail)||ctx.detail.stale||ctx.busy||n.disabled)return;var d=ctx.detail,to=ctx.index+(action==='playlist-track-up'?-1:1),remove=action==='playlist-remove-track',method=remove?'removeFromPlaylist':'movePlaylistTrack';
    if(!can(d.source,method))return;ctx.busy=true;n.disabled=true;
    callFor(d.source,method,remove?{id:d.item.id,trackIds:[ctx.track.id]}:{id:d.item.id,from:ctx.index,to:to},function(e){
      ctx.busy=false;n.disabled=false;if(e){toast(e);return;}d.stale=true;if(state.detail!==d||state.page!=='detail')return;
      closeModal(true);refreshPlaylist(d,'track-more-'+Math.max(0,remove?ctx.index:to));
    });
  }
  function refreshPlaylist(d,focus){
    if(!d||d.type!=='playlist'||d.reloading)return;var gen=state.pageGen;d.reloading=true;
    callFor(d.source,'playlist',{id:d.item.id},function(e,data){
      d.reloading=false;if(gen!==state.pageGen||state.detail!==d)return;
      var scroll=$('content').scrollTop;
      if(e){d.stale=true;state.restoreFocus='refresh-detail';state.restoreScroll=scroll;paintDetail(d);toast(tr("歌单已更新，刷新失败，请重试"));return;}
      d.stale=false;d.data=data||{};d.entity=d.data.playlist||(d.data.id?d.data:d.item);if(focus&&focus.indexOf('track-more-')===0)focus=(d.data.tracks||[]).length?'track-more-'+Math.min(+(focus.slice(11)),d.data.tracks.length-1):'manage-playlist';state.restoreFocus=focus;state.restoreScroll=scroll;paintDetail(d);toast(tr("歌单已更新"));
    });
  }
  function saveEntity(n){var d=state.detail;if(!d)return;var spec={album:['saveAlbum','saved',tr("收藏专辑")],artist:['followArtist','following',tr("关注歌手")],playlist:['savePlaylist','saved',tr("收藏歌单")],show:['subscribeShow','subscribed',tr("订阅播客")]}[d.type];if(!spec)return;var on=!d.entity[spec[1]];n.disabled=true;callFor(d.source,spec[0],{id:d.item.id,on:on},function(e){if(!document.documentElement.contains(n))return;n.disabled=false;if(e){toast(e);return;}d.entity[spec[1]]=on;n.setAttribute('aria-pressed',String(on));n.innerHTML=buttonContent(on?tr("取消")+spec[2].slice(0,2):spec[2],'heart');toast(on?tr("已保存到音乐源账号"):tr("已取消"));focusNode(n);});}
  function marketButtonBusy(action,busy){
    var n=$('header-actions').querySelector('[data-action="'+action+'"]');if(!n)return;
    var next=String(!!busy);if(n.getAttribute('aria-busy')!==next){var svg=n.querySelector('.icon');if(svg)svg.outerHTML=icon(busy||action==='check-all-updates'?'refresh':'catalog');}
    n.setAttribute('aria-busy',next);n.setAttribute('aria-disabled',next);
  }
  function loadCatalog(gen,refresh){
    state.marketRefreshBusy=true;marketButtonBusy('refresh-catalog',true);
    api('/api/catalog'+(refresh?'?refresh=1':''),function(e,data){
      if(gen!==state.pageGen)return;state.marketRefreshBusy=false;marketButtonBusy('refresh-catalog',false);
      if(e){if(refresh)toast(e);else error(e);return;}
      var active=activeID(),scroll=$('content').scrollTop;state.catalog=data.entries||[];paintCatalog(data.stale,data.message);
      if(refresh){$('content').scrollTop=scroll;if(!focusId(active,true)&&!state.modal)focusContent();}else afterContent();
    });
  }
  function renderMarket(gen,refresh){
    title(tr("插件市场"),tr("在线音乐源"));
    $('header-actions').innerHTML=button('check-all-updates',tr("检查全部更新"),'','refresh')+button('refresh-catalog',tr("刷新目录"),'','catalog');
    loading();patchCatalog();refreshUpdates();loadCatalog(gen,refresh);
  }
  function updateFor(installed){return installed&&state.updates[installed.instanceId];}
  function installationBadge(installed,update){
    var available=installed&&update&&update.available;
    return '<span class="install-badge '+(available?'update-available':installed?'installed':'not-installed')+'">'+icon(available?'refresh':installed?'check':'download')+(available?tr("有更新"):installed?tr("已安装"):tr("未安装"))+'</span>';
  }
  function updateBusy(u){return u&&['downloading','installing','awaiting-confirmation'].indexOf(u.state)>=0;}
  function updateStatus(u){
    if(!u)return tr("尚未检查更新");
    return {checking:tr("正在检查更新…"),current:tr("已是最新版本"),available:tr("有新版本可用"),checkFailed:tr("检查失败，请重试"),downloading:tr("正在下载…"),installing:tr("正在安装…"),'awaiting-confirmation':tr("等待确认新增权限"),updateFailed:tr("更新失败，请重试")}[u.state]||tr("尚未检查更新");
  }
  function pluginVersion(installed,u){
    if(!installed)return '';
    var version=installed.manifest.version||installed.revision||tr("版本未知");
    return version+(u&&u.available?' → '+u.latestVersion:'');
  }
  function paintCatalog(stale,message){
    var html='<div class="hero"><h2>'+tr("你的音乐，不止一种来源。")+'</h2><p>'+tr("选择社区插件，安装后使用熟悉的音乐服务。")+'</p></div>';
    if(stale)html+='<div class="empty-banner">'+esc(message)+'</div>';
    html+='<div class="section-head"><h2>'+tr("探索全部插件")+'</h2><span id="market-update-status" role="status"></span></div><div class="grid">';
    state.catalog.forEach(function(entry,index){
      var installed=state.installed[entry.repository.toLowerCase()],u=updateFor(installed),name=entry.name.replace(/^mygo-music-(plugin-)?/i,'');
      html+='<button class="plugin-card'+(installed?' is-installed':'')+'" data-focus="catalog-'+esc(entry.repository)+'" data-catalog="'+index+'">';
      html+='<span class="card-top"><span class="monogram">'+esc(name.charAt(0).toUpperCase())+'</span>'+installationBadge(installed,u)+'</span>';
      html+='<span class="card-heading"><strong class="card-name">'+esc(name)+'</strong><span class="card-owner">'+esc(entry.repository.split('/')[0])+'</span></span>';
      html+='<span class="card-description">'+esc(entry.description||tr("社区在线音乐源插件"))+'</span><span class="plugin-version">'+esc(pluginVersion(installed,u))+'</span>';
      html+='<span class="card-bottom"><span>'+(installed?tr("查看与更新"):tr("查看与安装"))+'</span>'+icon('arrow')+'</span></button>';
    });
    $('content').innerHTML=html+'</div>'+(!state.catalog.length?'<div class="state"><p>'+tr("目录暂无插件，请刷新重试")+'</p></div>':'');
    patchCatalog();
  }
  function patchCatalog(){
    if(state.page==='market'){
      Array.prototype.forEach.call($('content').querySelectorAll('[data-catalog]'),function(n){
        var entry=state.catalog[+n.getAttribute('data-catalog')];if(!entry)return;
        var installed=state.installed[entry.repository.toLowerCase()],u=updateFor(installed),badge=n.querySelector('.install-badge'),fresh=installationBadge(installed,u);
        if(badge&&badge.outerHTML!==fresh)badge.outerHTML=fresh;
        n.classList.toggle('is-installed',!!installed);n.classList.toggle('has-update',!!(u&&u.available));
        n.querySelector('.plugin-version').textContent=pluginVersion(installed,u);
        n.querySelector('.card-bottom span').textContent=installed?tr("查看与更新"):tr("查看与安装");
        n.setAttribute('aria-label',entry.name+(u&&u.available?'，'+tr("有更新"):installed?tr("，已安装，查看与更新"):tr("，未安装，查看与安装")));
      });
      var checking=false,count=0;
      Object.keys(state.updates).forEach(function(id){var u=state.updates[id];checking=checking||u.state==='checking';if(u.available)count++;});
      var status=$('market-update-status');if(status)status.textContent=state.updateError|| (checking?tr("正在检查更新…"):count?count+' '+tr("个插件可更新"):state.catalog.length+tr(" 个来源"));
      marketButtonBusy('check-all-updates',state.marketCheckBusy||checking&&!state.updateError);
    }
    patchCatalogDetail();
  }
  function receiveUpdates(list){state.updates={};(list||[]).forEach(function(u){state.updates[u.instanceId]=u;});state.updateError='';patchCatalog();}
  function refreshUpdates(done){api('/api/plugins/updates',function(e,list){if(!e)receiveUpdates(list);else{state.updateError=tr("更新状态读取失败，请重试");patchCatalog();}if(done)done(e);});}
  function pollUpdates(){
    refreshUpdates(function(){var active=false;Object.keys(state.updates).forEach(function(id){var u=state.updates[id];active=active||u.state==='checking'||updateBusy(u);});state.updatesTimer=setTimeout(pollUpdates,active?1500:15000);});
  }
  function checkUpdates(all){
    var installed=!all&&state.selected&&state.installed[state.selected.repository.toLowerCase()];
    if(!all&&!installed)return;
    if(!all&&catalogOpen(state.catalogView)){state.catalogView.error='';state.catalogView.job=null;}
    if(all){state.marketCheckBusy=true;state.updateError='';patchCatalog();}
    post('/api/plugins/check-updates',all?{}:{instanceId:installed.instanceId},function(e,list){if(all)state.marketCheckBusy=false;if(e){toast(e);state.updateError=tr("检查失败，请重试");patchCatalog();return;}receiveUpdates(list);clearTimeout(state.updatesTimer);state.updatesTimer=setTimeout(pollUpdates,700);});
  }
  function catalogOpen(ctx){return ctx&&state.modal&&state.modalGen===ctx.gen&&state.catalogView===ctx;}
  function showCatalog(index){
    var c=state.catalog[index];if(!c)return;state.selected=c;
    var installed=state.installed[c.repository.toLowerCase()],u=updateFor(installed);
    var html='<div class="plugin-detail-body scroll"><div id="catalog-badge">'+installationBadge(installed,u)+'</div><p class="plugin-description">'+esc(c.description||tr("社区在线音乐源"))+'</p><div class="badge-line">'+esc(c.repository)+'</div><p id="catalog-version" class="catalog-version"></p><p id="catalog-update-status" role="status"></p><div id="catalog-permissions"></div><div id="catalog-compatibility"></div><p class="hint plugin-install-hint">'+tr("安装后按插件能力提供功能。部分功能需要账号、其他播放设备或平台适配。")+'</p></div>';
    var actions=backButton('cancel')+button('check-update',tr("检查更新"),'secondary','refresh')+button('retry-job',tr("重试"))+button('confirm-update',tr("确认并更新"),'primary')+button('update-plugin',tr("更新插件"),'primary','download')+button('install',tr("安装插件"),'primary','download');
    var gen=modal(c.name,html,actions);$('modal-layer').firstChild.className+=' plugin-dialog';
    state.catalogView={repository:c.repository,gen:gen,job:null,error:'',permissionJob:''};patchCatalogDetail();
    if(u&&u.jobId)pollJob(u.jobId,state.catalogView);else refreshUpdates();
    refreshCompatibility();
  }
  function refreshCompatibility(){
    if(state.compatibility){patchCatalogDetail();return;}
    api('/api/plugins/compatibility',function(e,d){state.compatibilityError=e;if(!e)state.compatibility=d;patchCatalogDetail();});
  }
  function paintCompatibility(repo,installed){
    var box=$('catalog-compatibility');if(!box)return;
    var report=state.compatibility,entry=null,stages;
    if(report)(report.entries||[]).some(function(e){if(e.repository.toLowerCase()===repo.toLowerCase()){entry=e;return true;}return false;});
    var key=JSON.stringify([entry,installed&&installed.revision,state.compatibilityError]);var restore=activeID()==='compatibility-retry';if(box.getAttribute('data-state')===key)return;box.setAttribute('data-state',key);
    var text=[];
    if(state.compatibilityError){box.innerHTML='<p class="hint">'+tr("验证记录读取失败，可重试")+'</p>'+button('compatibility-retry',tr("重试"),'secondary','refresh');return;}
    if(!entry){box.innerHTML=report?'<p class="hint">'+tr("尚无此版本的验证记录")+'</p>':'';return;}
    var stale=installed&&installed.revision!==entry.revision;
    if(stale)text.push(tr("此记录对应其他版本"));
    stages=entry.stages||{};
    text.push(tr(stages.install&&stages.install.state==='passed'?"安装检查通过":"安装检查未完成"));
    if(stages.search){var search=stages.search;text.push(tr(search.state==='passed'?"搜索接口已验证":search.code==='sign-in-required'||search.code==='setup-required'?"搜索需要登录或配置":"搜索暂未通过"));}
    text.push(tr(stages.streamResolve&&stages.streamResolve.state==='passed'?"已取得音频地址，待播放验证":"尚未验证实际播放"));
    if(entry.process&&entry.process.length)text.push(tr("声明外部程序，部分功能需要适配"));
    if(entry.playback==='remote')text.push(tr("独立设备控制来源"));
    box.innerHTML='<div class="compatibility-record" tabindex="0" data-focus="compatibility-record"><h3>'+tr("兼容性记录")+'</h3><p class="hint">'+esc(entry.version||entry.revision||'')+' · '+esc((report.observedAt||'').slice(0,10))+'</p><ul>'+text.map(function(t){return '<li>'+esc(t)+'</li>';}).join('')+'</ul></div>';if(restore)focusId('compatibility-record',true);
  }
  function patchCatalogDetail(){
    var ctx=state.catalogView;if(!catalogOpen(ctx))return;var active=document.activeElement;
    var installed=state.installed[ctx.repository.toLowerCase()],u=updateFor(installed),job=ctx.job;
    if(!job&&u&&u.jobId&&updateBusy(u)){ctx.job=job={id:u.jobId,operation:'update',state:u.state};pollJob(u.jobId,ctx);}
    var busy=updateBusy(u)||job&&['downloading','installing','awaiting-confirmation'].indexOf(job.state)>=0;
    var waiting=job&&job.state==='awaiting-confirmation';
    $('modal-layer').firstChild.classList.toggle('awaiting-permissions',!!waiting);
    var badge=$('catalog-badge');badge.innerHTML=installationBadge(installed,u);paintCompatibility(ctx.repository,installed);
    $('catalog-version').textContent=installed?tr("当前版本：")+pluginVersion(installed,u):'';
    $('catalog-update-status').textContent=ctx.error|| (job&&job.state==='failed'?(job.operation==='update'?tr("更新失败，请重试"):tr("安装未完成"))+' · '+job.message:job&&busy?(job.message?tr(job.message):updateStatus({state:job.state})):installed?updateStatus(u):'');
    $('catalog-update-status').title=u&&u.message||'';
    var layer=$('modal-layer'),check=layer.querySelector('[data-action="check-update"]'),update=layer.querySelector('[data-action="update-plugin"]'),installButton=layer.querySelector('[data-action="install"]'),confirm=layer.querySelector('[data-action="confirm-update"]'),retry=layer.querySelector('[data-action="retry-job"]');
    check.hidden=!installed;check.disabled=!!(busy||u&&u.state==='checking'||installed&&(installed.instanceId==='fixture'||!installed.revision));
    update.hidden=!installed||!u||!u.available||waiting;update.disabled=!!busy;update.innerHTML=buttonContent(tr("更新到 ")+ (u?u.latestVersion:''),'download');
    installButton.hidden=!!installed;installButton.disabled=!!busy;
    confirm.hidden=!waiting;retry.hidden=!ctx.error||!job;
    if(!ctx.error)retry.hidden=true;
    if(waiting&&ctx.permissionJob!==job.id){
      ctx.permissionJob=job.id;
      var permissions=job.permissions||{},html='<h3>'+tr("新版本需要新增权限")+'</h3>',index=0;
      (permissions.network||[]).forEach(function(host){html+='<div class="source-option permission-item" tabindex="0" data-focus="permission-'+index+++'">'+tr("访问域名：")+esc(host)+'</div>';});
      (permissions.process||[]).forEach(function(program){html+='<div class="source-option permission-item" tabindex="0" data-focus="permission-'+index+++'">'+tr("外部程序声明：")+esc(program)+'</div>';});
      if((permissions.process||[]).length)html+='<p class="hint">'+tr("电视端仍禁止运行外部程序。")+'</p>';
      $('catalog-permissions').innerHTML=html;focusId('permission-0');
    }else if(!waiting){ctx.permissionJob='';$('catalog-permissions').innerHTML='';}
    if(layer.contains(active)&&(active.hidden||active.disabled))focusId('cancel');
  }
  function install(){
    var ctx=state.catalogView;if(!catalogOpen(ctx))return;
    ctx.error='';post('/api/plugins/install',{repository:ctx.repository},function(e,j){if(e){if(catalogOpen(ctx)){ctx.error=e;patchCatalogDetail();}else toast(e);return;}ctx.job=j;patchCatalogDetail();pollJob(j.id,ctx);});
  }
  function updatePlugin(){
    var ctx=state.catalogView;if(!catalogOpen(ctx))return;var installed=state.installed[ctx.repository.toLowerCase()],u=updateFor(installed);if(!u||!u.available)return;
    ctx.error='';post('/api/plugins/update',{instanceId:installed.instanceId,version:u.latestVersion},function(e,j){if(e){if(catalogOpen(ctx)){ctx.error=e;patchCatalogDetail();}else toast(e);return;}ctx.job=j;u.state=j.state;patchCatalog();pollJob(j.id,ctx);});
  }
  function confirmUpdate(){
    var ctx=state.catalogView;if(!catalogOpen(ctx)||!ctx.permissionJob)return;var id=ctx.permissionJob;
    post('/api/jobs/'+id+'/confirm',{allow:true},function(e,j){if(e){ctx.error=e;patchCatalogDetail();return;}ctx.job=j;patchCatalogDetail();pollJob(id,ctx);});
  }
  function pollJob(id,ctx){
    var existing=state.jobPolls[id];if(existing){existing.context=ctx;return;}
    var poll=state.jobPolls[id]={context:ctx};
    function next(){api('/api/jobs/'+id,function(e,j){
      var owner=poll.context;
      if(e){delete state.jobPolls[id];if(catalogOpen(owner)){owner.error=tr("任务状态读取失败，请重试");patchCatalogDetail();}return;}
      state.jobs[id]=j;if(catalogOpen(owner)){owner.job=j;owner.error='';patchCatalogDetail();}
      if(j.state==='complete'){
        delete state.jobPolls[id];loadSources(function(err){if(err)return;refreshUpdates();toast(j.operation==='update'?tr("更新完成"):tr("安装完成"));if(j.operation!=='update'&&catalogOpen(owner))setSource(j.instanceId);});
      }else if(j.state==='awaiting-confirmation'){
        delete state.jobPolls[id];
        if(!catalogOpen(owner))post('/api/jobs/'+id+'/confirm',{allow:false},function(){refreshUpdates();});
      }else if(j.state==='failed'||j.state==='cancelled'){delete state.jobPolls[id];refreshUpdates();}
      else setTimeout(next,900);
    });}
    next();
  }
  function renderSettings(keepFocus){title(tr("设置"),tr("你的聆听偏好"));var h=("<section class=\"settings-card\"><h2>"+tr("侧边栏显示")+"</h2><button class=\"secondary\" data-focus=\"pref-expanded\" data-pref=\"expanded\" aria-pressed=\"")+(state.pref==='expanded')+("\">"+tr("展开显示")+"</button><button class=\"secondary\" data-focus=\"pref-icons\" data-pref=\"icons\" aria-pressed=\"")+(state.pref==='icons')+("\">"+tr("仅显示图标")+"</button></section><section class=\"settings-card\"><h2>"+tr("播放与歌词")+"</h2>")+button('play-mode',tr(modeLabels[state.player?state.player.mode:'sequence']),'secondary',state.player?state.player.mode:'sequence')+button('translation-setting',state.translation?tr("歌词翻译：开"):tr("歌词翻译：关"),'secondary','lyrics')+'</section>';
    h+='<section class="settings-card"><h2>'+tr("播放音质")+'</h2>'+['standard','high','lossless'].map(function(q){return '<button class="secondary" data-focus="quality-'+q+'" data-quality="'+q+'" aria-pressed="'+(state.quality===q)+'">'+tr({standard:'标准音质',high:'高音质',lossless:'无损音质'}[q])+'</button>';}).join('')+'<p class="hint">'+tr("下次播放生效，实际音质由音乐源和账号权限决定。")+'</p></section>';
    h+=("<section class=\"settings-card appearance-card\"><h2>"+tr("主题")+"</h2><p class=\"hint\">"+tr("选择适合客厅环境的外观")+"</p><div class=\"appearance-choices\">")+appearanceChoice('theme','dark',tr("深色主题"),tr("保留当前深绿风格"),'moon')+appearanceChoice('theme','light',tr("淡色主题"),tr("浅色背景，柔和清晰"),'sun')+'</div></section>';
    h+=("<section class=\"settings-card\"><h2>"+tr("界面语言")+"</h2><button class=\"secondary\" data-focus=\"language-zh-CN\" data-language=\"zh-CN\" aria-pressed=\"")+(state.language==='zh-CN')+("\">"+tr("简体中文")+"</button><button class=\"secondary\" data-focus=\"language-zh-TW\" data-language=\"zh-TW\" aria-pressed=\"")+(state.language==='zh-TW')+("\">"+tr("繁體中文")+"</button><p class=\"hint\">"+tr("仅切换应用界面，歌曲、歌词和评论保留原文。")+"</p></section>");
    if(state.source){h+='<section class="settings-card"><h2>'+esc(state.source.manifest.name)+'</h2><p class="hint">'+esc(state.source.repository)+'</p>'+button('login',tr("账号 / 登录"),'primary','artist')+button('signout',tr("退出账号"))+button('uninstall',tr("卸载来源"))+(state.source.manifest.playback==='remote'?button('remote-devices',tr("播放设备")):'' )+'<p class="hint">'+(state.source.process&&state.source.process.length?tr("部分功能依赖外部程序，可能需要电视适配。"):tr("账号与内容由当前音乐源提供。"))+'</p>';(state.source.manifest.settings||[]).forEach(function(setting,i){h+='<label for="setting-'+i+'">'+esc(setting.label)+'</label><p class="hint">'+esc(setting.help)+'</p><input id="setting-'+i+'" type="text" data-focus="setting-'+i+'" autocomplete="off"><button class="secondary" data-focus="save-'+i+'" data-setting="'+i+("\">"+tr("保存")+"</button>");});h+='</section>';}
    h+='<section class="settings-card app-update-card"><h2>'+tr("版本更新")+'</h2><p class="hint">'+tr("当前版本：")+esc(state.version||'')+'</p><p id="app-update-status" class="hint" role="status"></p>'+button('app-check-update',tr("检查更新"),'secondary','refresh')+'</section>';
    h+=("<section class=\"settings-card\"><h2>My Music+ · ")+esc(state.version||'')+("</h2><p class=\"muted\">"+tr("插件驱动的音乐播放器")+"</p></section>");$('content').innerHTML=h;refreshAppUpdate();if(!keepFocus)afterContent();
  }
  function refreshAppUpdate(){
    var bridge=window.MyGoAppUpdates,data={supported:false,state:'browser',message:tr("请在 Android 正式版中检查更新")};
    if(bridge)try{data=JSON.parse(bridge.getStatus());bridge.setPromptAllowed(canShowAppUpdate(true));}catch(_){data={supported:false,state:'error',message:tr("更新功能暂时不可用")};}
    state.appUpdate=data;var status=$('app-update-status'),action=document.querySelector('[data-action="app-check-update"]');if(!status||!action)return;
    var busy=['checking','downloading','installing'].indexOf(data.state)>=0,label=data.state==='ready'?tr("继续安装"):data.state==='available'?tr("查看更新"):data.state==='checking'?tr("正在检查更新…"):data.state==='downloading'?tr("正在下载…"):data.state==='installing'?tr("等待系统确认安装…"):tr("检查更新");
    status.textContent=data.message||tr("尚未检查更新");
    if(data.state==='available'&&data.latest_version)status.textContent=tr("有新版本可用")+' · '+data.latest_version;
    if(data.state==='downloading'&&data.size)status.textContent=tr("正在下载…")+' '+Math.min(100,Math.floor(data.downloaded*100/data.size))+'%';
    action.disabled=!data.supported;action.setAttribute('aria-disabled',String(!data.supported||busy));action.setAttribute('aria-busy',String(busy));
    if(action.getAttribute('data-update-label')!==label){action.innerHTML=buttonContent(label,busy||data.state!=='ready'?'refresh':'download');action.setAttribute('data-update-label',label);}
  }
  function activateAppUpdate(){var bridge=window.MyGoAppUpdates;if(!bridge)return;refreshAppUpdate();try{if(state.appUpdate.state==='ready')bridge.install();else bridge.check();setTimeout(refreshAppUpdate,100);}catch(_){toast(tr("更新功能暂时不可用"));}}
  function appearanceChoice(key,value,label,hint,ico){return '<button class="appearance-choice secondary" data-focus="'+key+'-'+value+'" data-'+key+'="'+value+'" aria-pressed="'+(state[key]===value)+'"><span class="button-content"><span class="theme-swatch '+value+'">'+icon(ico)+'</span><span class="appearance-copy"><strong>'+esc(label)+'</strong><small>'+esc(hint)+'</small></span><span class="choice-check">'+icon('check')+'</span></span></button>';}
  function syncAppearanceChoices(){['theme','language','quality'].forEach(function(key){Array.prototype.forEach.call(document.querySelectorAll('button[data-'+key+']'),function(n){n.setAttribute('aria-pressed',String(n.getAttribute('data-'+key)===state[key]));});});}
  function applyAppearance(prefs){
    state.quality=prefs.quality||'high';state.preferredSource=prefs.source||'';state.theme=prefs.theme==='dark'?'dark':'light';state.language=prefs.language==='zh-TW'?'zh-TW':'zh-CN';
    window.MyGoI18n.apply(state.theme,state.language);window.MyGoI18n.localize(document);syncAppearanceChoices();
    if(window.Android&&window.Android.applyAppearance)window.Android.applyAppearance(state.theme,state.language);
  }
  function refreshLanguage(){
    var id=activeID(),scroll=$('content').scrollTop,values={};
    window.MyGoI18n.localize(document);renderNav();renderAccount();paintNowTrack(currentTrack());
    if(state.player){var p=state.player;state.player=null;applyPlayer(p);}
    if(state.modal){state.localeDirty=true;return;}
    if(state.page==='settings'){
      Array.prototype.forEach.call($('content').querySelectorAll('input'),function(n){values[n.id]=n.value;});
      renderSettings(true);Object.keys(values).forEach(function(key){if($(key))$(key).value=values[key];});
      $('content').scrollTop=scroll;if(id)focusId(id,true);
    }else{state.restoreFocus=id;state.restoreScroll=scroll;navigate(state.page);}
  }
  // Serialize writes so rapid choices cannot persist out of order. Only a successful save changes the UI.
  function saveAppearance(key,value){state.appearancePending=state.appearancePending||{};state.appearancePending[key]=value;flushAppearance();}
  function flushAppearance(){
    if(state.appearanceBusy||!state.appearancePending||!Object.keys(state.appearancePending).length)return;
    var change=state.appearancePending;state.appearancePending={};state.appearanceBusy=true;
    post('/api/preferences',change,function(e,prefs){state.appearanceBusy=false;if(e)toast(e);else{var language=state.language;applyAppearance(prefs);if(language!==state.language)refreshLanguage();}flushAppearance();});
  }
  function refreshLikes(tracks){var groups={},versions={};state.likeVersions=state.likeVersions||{};tracks.forEach(function(t){if(can(t.source,'isLiked')){if(!groups[t.source])groups[t.source]=[];if(groups[t.source].indexOf(t.id)<0)groups[t.source].push(t.id);}});Object.keys(groups).forEach(function(id){groups[id].forEach(function(tid){versions[id+':'+tid]=state.likeVersions[id+':'+tid]||0;});callFor(id,'isLiked',{ids:groups[id]},function(e,values){if(e)return;groups[id].forEach(function(tid){var key=id+':'+tid;if(versions[key]===(state.likeVersions[key]||0)&&(!state.likeBusy||!state.likeBusy[key]))state.likes[key]=!!(values||{})[tid];});updateLikeButtons();});});}
  function likeButton(t,id,label){var key=trackKey(t),on=!!state.likes[key];return '<button class="'+(label?'menu-option':'icon-button')+'" data-focus="'+esc(id)+'" data-action="track-like" data-like-key="'+esc(key)+'" data-like-label="'+(label?'yes':'no')+'" aria-pressed="'+on+'" aria-label="'+(on?tr("取消喜欢"):tr("喜欢这首歌"))+'">'+buttonContent(label?(on?tr("取消喜欢"):tr("喜欢这首歌")):null,'heart')+'</button>';}
  function updateLikeButtons(){Array.prototype.forEach.call(document.querySelectorAll('[data-like-key]'),function(n){var key=n.getAttribute('data-like-key'),on=!!state.likes[key];n.setAttribute('aria-pressed',String(on));n.setAttribute('aria-label',on?tr("取消喜欢"):tr("喜欢这首歌"));n.title=on?tr("取消喜欢"):tr("喜欢这首歌");n.disabled=!!(state.likeBusy&&state.likeBusy[key]);if(n.getAttribute('data-like-label')==='yes')n.innerHTML=buttonContent(on?tr("取消喜欢"):tr("喜欢这首歌"),'heart');});}
  function toggleLike(t,n){if(!t)return;var key=trackKey(t),method=t.showId?'likeEpisode':'like';if(!can(t.source,method)){toast(tr("此音乐源没有提供这项收藏功能"));return;}state.likeBusy=state.likeBusy||{};if(state.likeBusy[key])return;state.likeVersions=state.likeVersions||{};state.likeVersions[key]=(state.likeVersions[key]||0)+1;state.likeBusy[key]=true;updateLikeButtons();n.disabled=true;
    function commit(){var on=!state.likes[key];callFor(t.source,method,{id:t.id,on:on},function(e){state.likeBusy[key]=false;n.disabled=false;if(e){updateLikeButtons();toast(e);return;}state.likes[key]=on;updateLikeButtons();toast(on?tr("已加入音乐源的我喜欢"):tr("已取消喜欢"));if(document.documentElement.contains(n)&&n.getAttribute('data-like-key')===key&&document.activeElement===n)focusNode(n);});}
    if(state.likes[key]==null&&can(t.source,'isLiked')){callFor(t.source,'isLiked',{ids:[t.id]},function(e,values){if(e){state.likeBusy[key]=false;updateLikeButtons();toast(e);return;}state.likes[key]=!!(values||{})[t.id];commit();});}else commit();
  }
  function trackMenu(t,index){if(!t)return;state.actionTrack=t;state.playlistContext=editablePlaylist(state.detail)&&state.page==='detail'&&typeof index==='number'?{detail:state.detail,index:index,track:t}:null;var method=t.showId?'likeEpisode':'like',h='<p>'+esc(artists(t))+'</p>';
    if(can(t.source,method))h+=likeButton(t,'menu-like',true);
    h+=playlistOption('queue-next',tr("下一首播放"),'next')+playlistOption('queue-append',tr("加入播放队列"),'queue');
    if(can(t.source,'playlists')&&can(t.source,'addToPlaylist'))h+=playlistOption('add-playlist',tr("加入歌单"),'plus');
    if(can(t.source,'comments'))h+=playlistOption('track-comments',tr("查看评论"),'comment');
    h+=playlistTrackActions(state.playlistContext);modal(t.name,h,backButton('cancel'));refreshLikes([t]);
  }
  function playlistPicker(t){if(!t)return;state.actionTrack=t;var ctx={track:t,busy:false,dirty:false};state.pickContext=ctx;ctx.gen=dialog('加入歌单',("<div id=\"playlist-options\" class=\"panel-status\">"+tr("正在加载歌单…")+"</div>"),backButton('cancel')+(can(t.source,'createPlaylist')?button('create-for-track',tr("新建歌单"),'primary','plus'):''),{nest:true});loadPlaylists(ctx);}
  function loadPlaylists(ctx){if(!ctx||ctx.gen!==state.modalGen)return;ctx.busy=true;ctx.dirty=false;var req=ctx.request=(ctx.request||0)+1;callFor(ctx.track.source,'playlists',{},function(e,list){if(ctx!==state.pickContext||ctx.gen!==state.modalGen||req!==ctx.request)return;ctx.busy=false;if(e){$('playlist-options').innerHTML='<p>'+esc(e)+'</p>'+button('playlist-retry',tr("重试"),'secondary','refresh');return;}state.pickPlaylists=(list||[]).filter(function(p){return p.mine!==false&&!p.fixed;});$('playlist-options').className='';$('playlist-options').innerHTML=state.pickPlaylists.length?state.pickPlaylists.map(function(p,i){return '<button class="source-option" data-focus="pick-playlist-'+esc(p.id)+'" data-pick-playlist="'+i+'">'+esc(p.name)+'</button>';}).join(''):("<p>"+tr("暂无可加入的歌单，请先新建。")+"</p>");focusLoadedList();});}
  function addPlaylist(i,n){var t=state.actionTrack,p=state.pickPlaylists[i],gen=state.modalGen;if(!t||!p)return;n.disabled=true;callFor(t.source,'addToPlaylist',{id:p.id,trackIds:[t.id]},function(e){n.disabled=false;if(e){toast(e);return;}toast(tr("已加入 ")+p.name);if(gen===state.modalGen)closeModal(true);});}
  function createPlaylist(t){var id=t?t.source:state.source&&state.source.instanceId;if(!id)return;state.compose={kind:'playlist',source:id,track:t};dialog('新建歌单',("<form id=\"compose-form\"><input id=\"compose-input\" data-focus=\"compose-input\" type=\"text\" maxlength=\"80\" placeholder=\""+tr("歌单名称")+"\" aria-label=\""+tr("歌单名称")+"\"></form>"),button('cancel',tr("取消"))+button('compose-submit',tr("创建歌单"),'primary'),{nest:true});}
  function submitCompose(n){var ctx=state.compose,input=$('compose-input');if(!ctx||!input||n.disabled)return;var text=input.value.replace(/^\s+|\s+$/g,'');if(!text){toast(ctx.kind==='comment'?tr("请输入评论内容"):tr("请输入歌单名称"));focusNode(input);return;}var gen=state.modalGen;n.disabled=true;finishEditing();if(ctx.kind==='rename'){submitPlaylistRename(ctx,text,n,gen);return;}
    callFor(ctx.source,ctx.kind==='comment'?'postComment':'createPlaylist',ctx.kind==='comment'?{trackId:ctx.track.id,text:text}:{name:text},function(e,result){n.disabled=false;if(e){toast(e);return;}if(ctx.kind==='playlist'&&ctx.track&&result&&result.id){callFor(ctx.source,'addToPlaylist',{id:result.id,trackIds:[ctx.track.id]},function(err){toast(err?tr("歌单已创建，歌曲加入失败：")+err:tr("歌单已创建并加入歌曲"));if(state.pickContext&&state.pickContext.track===ctx.track)state.pickContext.dirty=true;if(gen===state.modalGen)closeModal();});return;}
      if(gen!==state.modalGen){toast(ctx.kind==='comment'?tr("评论已发布"):tr("歌单已创建"));return;}
      if(ctx.kind==='comment'){toast(tr("评论已发布"));closeModal();if(state.comments&&state.comments.track===ctx.track){state.comments.items=[];state.comments.offset=0;state.comments.busy=false;state.comments.request=(state.comments.request||0)+1;loadComments();}}else{if(state.pickContext&&state.pickContext.track===ctx.track)state.pickContext.dirty=true;closeModal();toast(tr("歌单已创建"));if(!state.modal&&state.page==='playlists')navigate('playlists');}
    });
  }
  function comments(t){if(!t)return;var ctx={track:t,offset:0,items:[],more:false,busy:false,total:0};state.comments=ctx;
    dialog('歌曲评论','<div class="panel-subtitle">'+esc(t.name)+' · '+esc(artists(t))+'</div><div class="panel-scroll scroll" id="comment-list"></div><div class="panel-footer">'+(can(t.source,'postComment')?button('write-comment',tr("写评论"),'secondary','comment'):("<span class=\"hint\">"+tr("当前音乐源未提供发表评论")+"</span>"))+'</div>','',{drawer:true,nest:true});ctx.gen=state.modalGen;loadComments();
  }
  function commentHTML(c,i){var long=c.text&&c.text.length>100;return '<article class="comment-card" tabindex="0" data-focus="comment-'+esc(c.id)+'" data-comment-index="'+i+'"><div class="comment-head"><span class="comment-author">'+(c.avatarUrl?'<img class="comment-avatar" src="'+esc(c.avatarUrl)+'" alt="">':'')+esc(c.author||tr("听众"))+'</span><span>'+ (c.time?esc(new Date(c.time).toLocaleDateString(state.language)):'')+'</span></div><div class="comment-text" id="comment-text-'+i+'">'+esc(c.text)+'</div><div class="comment-actions">'+(long?'<button data-focus="comment-expand-'+esc(c.id)+'" data-comment-expand="'+i+("\">"+tr("展开全文")+"</button>"):'')+(can(state.comments.track.source,'likeComment')?'<button data-focus="comment-like-'+esc(c.id)+'" data-comment-like="'+i+'" aria-label="'+(c.liked?tr("取消点赞"):tr("点赞评论"))+'" aria-pressed="'+!!c.liked+'">'+buttonContent(c.likes||0,'like')+'</button>':'')+'</div></article>';}
  function moveComments(active,dir){if(state.modal!=='歌曲评论')return false;var ctx=state.comments,list=$('comment-list'),card=closest(active,'[data-comment-index]'),vertical=dir==='ArrowUp'||dir==='ArrowDown';
    if(!card){if(active.getAttribute('data-focus')==='cancel'&&dir==='ArrowDown'){focusNode(list.querySelector('[data-comment-index]')||list.querySelector('[data-focus]')||$('modal-layer').querySelector('[data-action="write-comment"]'));return true;}if(dir==='ArrowUp'&&active.getAttribute('data-focus')!=='cancel'){var cards=list.querySelectorAll('[data-comment-index]');if(cards.length){focusNode(cards[cards.length-1]);return true;}}return false;}
    if(active.className==='comment-text expanded'&&vertical){var delta=dir==='ArrowUp'?-90:90;if(delta<0&&active.scrollTop>0||delta>0&&active.scrollTop<active.scrollHeight-active.clientHeight-1){active.scrollTop+=delta;return true;}}
    if(vertical){var index=+card.getAttribute('data-comment-index'),next=index+(dir==='ArrowDown'?1:-1);if(next>=0&&next<ctx.items.length){focusId('comment-'+ctx.items[next].id);return true;}if(dir==='ArrowUp'){focusId('cancel');return true;}if(ctx.more&&!ctx.error){ctx.advanceFrom=activeID();loadComments();return true;}if(!focusId('comments-more')&&!focusId('write-comment'))focusId('cancel');return true;}
    var actions=Array.prototype.slice.call(card.querySelectorAll('button[data-focus]')),at=actions.indexOf(active);if(dir==='ArrowLeft'){if(at>0)focusNode(actions[at-1]);else focusNode(card);}else if(active===card||active.className==='comment-text expanded')focusNode(actions[0]);else if(actions[at+1])focusNode(actions[at+1]);return true;
  }
  function commentPager(ctx){var pager=$('comment-pager');if(!pager){pager=document.createElement('div');pager.id='comment-pager';pager.className='panel-status';$('comment-list').appendChild(pager);}var retry=pager.querySelector('[data-action="comments-more"]');if(ctx.busy&&retry&&document.activeElement===retry){retry.textContent=tr("正在重试…");retry.setAttribute('aria-disabled','true');return pager;}pager.setAttribute('role','status');pager.innerHTML=ctx.busy?tr("正在加载评论…"):ctx.error?esc(ctx.error)+'<div>'+button('comments-more',tr("重试加载"),'secondary','refresh')+'</div>':ctx.more?tr("继续下移，加载更多评论"):ctx.items.length?tr("已展示 ")+ctx.items.length+tr(" 条评论"):tr("还没有评论，留下你的感受吧");return pager;}
  function loadComments(){var ctx=state.comments;if(!ctx||ctx.gen!==state.modalGen||ctx.busy)return;ctx.busy=true;ctx.error=null;var req=ctx.request=(ctx.request||0)+1,list=$('comment-list');if(!ctx.items.length)list.innerHTML='';commentPager(ctx);
    callFor(ctx.track.source,'comments',{trackId:ctx.track.id,offset:ctx.offset},function(e,d){if(ctx!==state.comments||ctx.gen!==state.modalGen||req!==ctx.request)return;ctx.busy=false;var advance=ctx.advanceFrom,retryFocused=activeID()==='comments-more';ctx.advanceFrom=null;if(e){ctx.error=e;var advanceFocused=advance&&activeID()===advance;commentPager(ctx);if(advanceFocused||retryFocused)focusId('comments-more');return;}
      var batch=(d||{}).comments||[],oldLen=ctx.items.length,seen={};ctx.offset+=batch.length;ctx.total=(d||{}).total||0;ctx.items.forEach(function(c){seen['$'+c.id]=true;});batch.forEach(function(c){if(!seen['$'+c.id]){seen['$'+c.id]=true;ctx.items.push(c);}});ctx.more=!!(d&&d.more&&ctx.items.length>oldLen);
      var pager=$('comment-pager'),scroll=list.scrollTop;if(pager&&pager.parentNode)pager.parentNode.removeChild(pager);var html='';for(var i=oldLen;i<ctx.items.length;i++)html+=commentHTML(ctx.items[i],i);list.insertAdjacentHTML('beforeend',html);commentPager(ctx);list.scrollTop=scroll;focusLoadedList();
      if(advance&&activeID()===advance||retryFocused){if(ctx.items[oldLen])focusId('comment-'+ctx.items[oldLen].id);else if(ctx.items.length)focusId('comment-'+ctx.items[ctx.items.length-1].id);else focusId('write-comment')||focusId('cancel');}
    });
  }
  document.addEventListener('scroll',function(e){var ctx=state.comments,box=e.target;if(box.id==='comment-list'&&state.modal==='歌曲评论'&&ctx&&ctx.gen===state.modalGen&&ctx.more&&!ctx.error&&box.scrollHeight-box.scrollTop-box.clientHeight<100)loadComments();},true);
  function likeComment(i,n){var ctx=state.comments,c=ctx&&ctx.items[i];if(!c||n.disabled)return;var on=!c.liked;n.disabled=true;callFor(ctx.track.source,'likeComment',{trackId:ctx.track.id,commentId:c.id,on:on},function(e){n.disabled=false;if(e){toast(e);return;}c.liked=on;c.likes=Math.max(0,(c.likes||0)+(on?1:-1));if(ctx===state.comments){n.setAttribute('aria-pressed',String(on));n.setAttribute('aria-label',on?tr("取消点赞"):tr("点赞评论"));n.innerHTML=buttonContent(c.likes,'like');if(ctx.gen===state.modalGen&&document.activeElement===n)focusNode(n);}});}
  function writeComment(){var ctx=state.comments;if(!ctx)return;state.compose={kind:'comment',source:ctx.track.source,track:ctx.track};dialog('写评论','<p>'+esc(ctx.track.name)+("</p><form id=\"compose-form\"><textarea id=\"compose-input\" data-focus=\"compose-input\" maxlength=\"1000\" placeholder=\""+tr("分享你的聆听感受")+"\" aria-label=\""+tr("评论内容")+"\"></textarea></form><p class=\"hint\">"+tr("将发布到当前音乐源的歌曲评论区。")+"</p>"),button('cancel',tr("取消"))+button('compose-submit',tr("发布评论"),'primary'),{nest:true});}
  function syncCoverMotion(){var cover=$('open-player'),p=state.player,playing=p&&p.wantPlay&&p.state==='playing'&&!document.hidden?'true':'false';if(cover.getAttribute('data-playing')!==playing)cover.setAttribute('data-playing',playing);}
  function applyPlayer(p){if(!p)return;if(state.player&&(p.generation<state.player.generation||p.generation===state.player.generation&&(p.revision<state.player.revision||p.revision===state.player.revision&&p.positionAt<state.player.positionAt)))return;var old=state.player;state.player=p;if(state.scrub){if(state.scrub.generation!==p.generation||!canSeek())cancelSeek();else state.scrub.value=Math.min(p.duration,state.scrub.value);}syncAudio(p);syncCoverMotion();var t=currentTrack(),metadataKey=t?JSON.stringify([p.generation,t]):'';if(state.nowTrack!==metadataKey){state.nowTrack=metadataKey;paintNowTrack(t);renderAccount();}
    if(p.persistenceError&&(!old||old.persistenceError!==p.persistenceError))toast(tr(p.persistenceError));
    var status=tr(p.error)||(p.restored?tr("已恢复上次播放，按播放继续"):p.station&&p.station.error?tr(p.station.error):'')||(p.remote?tr("远端设备 · "):'')+({preparing:tr("正在准备"),buffering:tr("缓冲中"),ended:tr("播放完毕"),paused:tr("已暂停"),failed:tr("播放失败")}[p.state]||'');$('playback-status').textContent=status;$('playback-status').title=status;
    var playing=p.wantPlay&&p.state!=='ended'&&p.state!=='failed';if(!old||old.wantPlay!==p.wantPlay||old.state!==p.state){$('toggle').innerHTML=buttonContent(null,playing?'pause':'play');$('toggle').setAttribute('aria-label',playing?tr("暂停"):tr("播放"));}
    if(!old||old.mode!==p.mode||!!old.station!==!!p.station){$('mode-button').innerHTML=buttonContent(null,p.station?'radio':p.mode);$('mode-button').setAttribute('aria-label',p.station?tr("电台连续播放"):tr(modeLabels[p.mode])||tr("播放模式"));$('mode-button').title=p.station?tr("电台连续播放"):tr(modeLabels[p.mode]);}
    if(state.nowArt!==(t&&t.album&&t.album.imageUrl||'')){state.nowArt=t&&t.album&&t.album.imageUrl||'';$('open-player').innerHTML=playbackArtwork(state.nowArt,'music');var cover=document.querySelector('.large-cover');if(cover)cover.innerHTML=playbackArtwork(state.nowArt,'album',tr("专辑封面"));}
    if(state.page==='player'){if(!old||state.playerTrack!==p.generation)renderPlayerPage();else tickLyrics();}
    if(state.modal==='播放队列'&&state.queueRevision!==p.queueRevision+':'+p.index+':'+p.mode){paintQueue();}
    paintStationControls();paintCurrentTracks();renderProgress();
  }
  document.addEventListener('error',function(e){var img=e.target;if(!img.getAttribute||!img.hasAttribute('data-playback-art'))return;img.hidden=true;var attempts=Number(img.getAttribute('data-retries')||0);if(attempts>=2)return;img.setAttribute('data-retries',String(attempts+1));var address=img.getAttribute('src');setTimeout(function(){if(document.documentElement.contains(img)&&img.getAttribute('src')===address)img.src=address;},attempts?2400:800);},true);
  document.addEventListener('load',function(e){var img=e.target;if(img.getAttribute&&img.hasAttribute('data-playback-art'))img.hidden=false;},true);
  function paintNowTrack(t){renderLyricButton();renderNowLikeVisibility();$('now-title').textContent=t?t.name:tr("音乐，即将响起");$('now-title').title=t?t.name:'';var artist=$('now-artist'),album=$('now-album'),like=$('now-like'),focusedCredit=document.activeElement===artist?artist:document.activeElement===album?album:null;artist.textContent=t?artists(t)||tr("未知歌手"):tr("选择音乐，开始聆听");artist.title=artist.textContent;artist.disabled=!t||!can(t.source,'artist')||!(t.artists||[]).some(function(a){return !!a.id;});album.hidden=!t;album.textContent=t?tr("专辑 · ")+(t.album&&t.album.name||tr("未知专辑")):'';album.title=album.textContent;album.disabled=!t||!t.album||!t.album.id||!can(t.source,'album');if(t){like.setAttribute('data-like-key',trackKey(t));updateLikeButtons();refreshLikes([t]);}else like.removeAttribute('data-like-key');if(!state.modal&&hasPlayerBar()&&focusedCredit&&focusedCredit.disabled)focusNode(footerCredit()||$('open-player'));}
  function playerCommand(path,data,done){state.playerEpoch=(state.playerEpoch||0)+1;var epoch=state.playerEpoch;post(path,data,function(e,p){if(!e&&epoch===state.playerEpoch)applyPlayer(p);if(e)toast(e);if(done)done(e,p);});}
  function play(i){if(!state.shown.length)return;if(state.shown[i]&&state.shown[i].unavailable){toast(tr("此歌曲暂不可播放"));return;}var d=state.page==='detail'&&state.detail,station=d&&d.type==='station'?{source:d.source,id:d.item.id,name:d.item.name}:null;playerCommand('/api/player/play',{queue:state.shown,index:i,station:station});}
  function control(action,pos){playerCommand('/api/player/control',{action:action,position:Math.max(0,Math.floor(pos||0))});}
  function toggle(){var p=state.player;if(!p||!p.queue.length){if(state.shown.length)play(0);else toast(tr("先选择一首音乐"));return;}control(p.state==='ended'||p.state==='failed'||p.state==='idle'?'retry':p.wantPlay?'pause':'resume');}
  function queueChange(action,t,entryId,done){playerCommand('/api/player/queue',{action:action,tracks:t?[t]:[],entryId:entryId||''},done);}
  function queue(){dialog('播放队列','<div class="panel-subtitle" id="queue-summary"></div><div id="station-controls"></div><div class="panel-scroll scroll" id="queue-list"></div><div class="panel-footer">'+button('play-mode',tr("播放模式"),'secondary','sequence')+button('queue-clear',tr("清空队列"),'secondary','trash')+'</div>','',{drawer:true});paintQueue();}
  function paintQueue(){var p=state.player;if(!p||!$('queue-list'))return;var active=activeID(),box=$('queue-list'),scroll=box.scrollTop,oldRows=Array.prototype.slice.call(box.querySelectorAll('.track-wrap')),oldIndex=oldRows.indexOf(closest(document.activeElement,'.track-wrap'));state.queueRevision=p.queueRevision+':'+p.index+':'+p.mode;$('queue-summary').textContent=p.queue.length+tr(" 首 · ")+(p.station?tr("电台连续播放"):tr(modeLabels[p.mode]));box.innerHTML=p.queue.length?p.queue.map(function(t,i){var id=p.entryIds[i];return '<div class="track-wrap '+(i===p.index?'current':'')+'"><button class="track-row"'+(i===p.index?' aria-current="true"':'')+' data-focus="queue-entry-'+id+'" data-queue-jump="'+id+'"><span class="track-no">'+(i===p.index?currentSymbol():i+1)+'</span><span class="track-meta"><strong>'+esc(t.name)+'</strong><small>'+esc(artists(t))+'</small></span></button><button class="queue-remove icon-button" data-focus="queue-remove-'+id+'" data-queue-remove="'+id+'" aria-label="'+tr("移除 ")+esc(t.name)+'">'+buttonContent(null,'close')+'</button></div>';}).join(''):("<div class=\"state\"><h2>"+tr("队列是空的")+"</h2><p>"+tr("从搜索或歌单中加入音乐")+"</p></div>");box.scrollTop=scroll;if(oldIndex>=0&&!focusId(active,true)){if(p.queue.length)focusId('queue-entry-'+p.entryIds[Math.min(oldIndex,p.queue.length-1)]);else focusId('cancel');}paintStationControls();focusLoadedList();}
  function paintStationControls(){
    var box=$('station-controls'),st=state.player&&state.player.station;if(!box)return;
    var mode=$('modal-layer').querySelector('[data-action="play-mode"]');if(mode)mode.hidden=!!st;
    var key=st?JSON.stringify([st.source,st.id,st.name,st.loading,st.error,st.exhausted]):'';if(box.getAttribute('data-state')===key)return;
    var focus=activeID();box.setAttribute('data-state',key);box.innerHTML=st?'<div class="station-panel"><span>'+icon('radio')+esc(st.name||tr("电台连续播放"))+'</span><p class="hint" role="status">'+esc(st.error?tr(st.error):st.loading?tr("正在获取下一批歌曲…"):st.exhausted?tr("电台暂无更多歌曲"):tr("自动继续播放电台推荐"))+'</p><div>'+(st.error||st.exhausted?button('station-retry',tr("重试续播"),'secondary','refresh'):'')+button('leave-station',tr("退出电台"),'secondary','close')+'</div></div>':'';
    if(focus==='station-retry'||focus==='leave-station'){if(!focusId(focus,true))focusId('leave-station',true)||focusId('play-mode',true)||focusId('cancel');}
  }
  function modeMenu(){var p=state.player;if(p&&p.station){queue();return;}var mode=p?p.mode:'sequence';dialog('播放顺序',Object.keys(modeLabels).map(function(m){return '<button class="menu-option" data-focus="mode-'+m+'" data-set-mode="'+m+'" aria-pressed="'+(m===mode)+'">'+buttonContent(tr(modeLabels[m])+(m===mode?tr(" · 当前"):''),m)+'</button>';}).join(''),backButton('cancel'),{nest:true});}
  function canSeek(){return !!(state.player&&currentTrack()&&state.player.duration>0);}
  function cancelSeek(){clearTimeout(state.seekTimer);state.scrub=null;renderProgress();}
  function previewSeek(value,drag){if(!canSeek())return;var p=state.player,s=state.scrub;if(!s||s.generation!==p.generation)s=state.scrub={generation:p.generation,value:playPosition(),serial:0};s.value=Math.max(0,Math.min(p.duration,Math.floor(value)));s.drag=!!drag;s.dirty=true;renderProgress();}
  function commitSeek(){clearTimeout(state.seekTimer);var s=state.scrub;if(!s||!s.dirty||!canSeek()||s.generation!==state.player.generation)return;s.drag=false;s.dirty=false;var serial=++s.serial;playerCommand('/api/player/control',{action:'seek',position:s.value},function(){if(state.scrub===s&&s.serial===serial&&!s.dirty){state.scrub=null;renderProgress();}});}
  function stepSeek(delta){if(!canSeek())return;previewSeek((state.scrub?state.scrub.value:playPosition())+delta,false);clearTimeout(state.seekTimer);state.seekTimer=setTimeout(commitSeek,250);}
  function seekAt(clientX,drag){var r=$('seek').querySelector('.progress-track').getBoundingClientRect();if(r.width>0)previewSeek((clientX-r.left)/r.width*state.player.duration,drag);}
  function renderProgress(){var p=state.player;if(!p)return;var pos=state.scrub?state.scrub.value:playPosition(),seek=$('seek');$('position').textContent=time(pos);$('duration').textContent=time(p.duration);$('progress').style.width=(p.duration?Math.max(0,Math.min(100,pos/p.duration*100)):0)+'%';seek.disabled=!canSeek();seek.setAttribute('aria-valuemax',Math.floor(p.duration||0));seek.setAttribute('aria-valuenow',Math.floor(pos));seek.setAttribute('aria-valuetext',time(pos)+' / '+time(p.duration));}
  $('seek').addEventListener('mousedown',function(e){if(e.button!==0||state.modal||!canSeek())return;e.preventDefault();focusId('seek');seekAt(e.clientX,true);});
  document.addEventListener('mousemove',function(e){if(state.scrub&&state.scrub.drag)seekAt(e.clientX,true);});
  document.addEventListener('mouseup',function(e){if(e.button!==0||!state.scrub||!state.scrub.drag)return;seekAt(e.clientX,false);commitSeek();});
  $('seek').addEventListener('touchstart',function(e){if(state.modal||!canSeek()||!e.touches.length)return;e.preventDefault();focusId('seek');seekAt(e.touches[0].clientX,true);},{passive:false});
  document.addEventListener('touchmove',function(e){if(state.scrub&&state.scrub.drag&&e.touches.length){e.preventDefault();seekAt(e.touches[0].clientX,true);}},{passive:false});
  document.addEventListener('touchend',function(e){if(!state.scrub||!state.scrub.drag)return;if(e.changedTouches.length)seekAt(e.changedTouches[0].clientX,false);commitSeek();});
  document.addEventListener('touchcancel',function(){if(state.scrub&&state.scrub.drag)cancelSeek();});
  window.addEventListener('blur',function(){if(state.scrub&&state.scrub.drag)cancelSeek();else commitSeek();});
  function playPosition(){var p=state.player;if(!p)return 0;if(!nativePlayer&&audioGen===p.generation&&p.media&&audioSeek===p.seekRevision&&isFinite(audio.currentTime))return Math.max(0,audio.currentTime*1000);var pos=p.position||0;if(p.state==='playing'&&p.positionAt)pos+=Math.max(0,Math.min(2500,Date.now()-p.positionAt));return p.duration?Math.min(p.duration,pos):pos;}
  function openPlayer(){if(state.page!=='player')rememberPage();navigate('player');}
  function renderPlayerPage(){stopLyricFrame();state.lyricNodes=null;state.lyricWordNodes=null;title(tr("正在播放"));$('header-actions').innerHTML=backButton('player-back','','back');var p=state.player,t=currentTrack(),savedFocus=activeID();state.playerTrack=p?p.generation:-1;appClass();if(!t){empty(tr("还没有正在播放的音乐"),tr("从歌单或搜索结果开始"),button('go-search',tr("搜索音乐"),'primary','search'));return;}
    var tools='';if(can(t.source,t.showId?'likeEpisode':'like'))tools+=likeButton(t,'player-like',false);if(can(t.source,'comments'))tools+=tool('player-comments',tr("歌曲评论"),'comment');tools+=tool('player-more',tr("更多歌曲操作"),'more');
    $('content').innerHTML='<div class="listening '+(state.lyricFull?'lyrics-only':'')+'"><div class="record-column"><div class="large-cover">'+playbackArtwork(t.album&&t.album.imageUrl,'album',tr("专辑封面"))+'</div><div class="player-heading"><h2>'+esc(t.name)+'</h2><p><button class="credit-link" data-focus="player-artist" data-action="now-artist" '+(!can(t.source,'artist')||!(t.artists||[]).some(function(a){return !!a.id;})?'disabled':'')+'>'+esc(artists(t)||tr("未知歌手"))+'</button></p><div class="player-album"><button class="credit-link" data-focus="player-album" data-action="now-album" '+(!can(t.source,'album')||!t.album||!t.album.id?'disabled':'')+'>'+esc(tr("专辑 · ")+(t.album&&t.album.name||tr("未知专辑")))+'</button></div></div><div class="player-tools">'+tools+'</div></div><section class="lyric-column" aria-label="'+tr("歌词")+'"><div class="lyric-window" id="lyrics"></div></section></div>';
    if(state.lyricKey!==trackKey(t)){state.lyricKey=trackKey(t);state.lyrics=[];state.lyricState='idle';}drawLyrics();if(state.lyricState==='idle')loadLyrics(false);refreshLikes([t]);if(!state.modal&&savedFocus&&!focusId(savedFocus,true)&&state.page==='player')focusId('toggle');
  }
  function loadLyrics(){var t=currentTrack();if(!t)return;var key=trackKey(t),req=state.lyricRequest=(state.lyricRequest||0)+1;state.lyricKey=key;state.lyricState='loading';drawLyrics();if(!can(t.source,'lyrics')){state.lyricState='unsupported';drawLyrics();return;}api('/api/sources/'+encodeURIComponent(t.source)+'/lyrics?id='+encodeURIComponent(t.id),function(e,d){if(state.lyricKey!==key||req!==state.lyricRequest)return;if(e){state.lyricState='failed';state.lyricError=e;drawLyrics();return;}state.lyrics=(d&&d.lines)||[];state.lyricTimed=!!(d&&d.timed);state.lyricState=state.lyrics.length?'ready':'empty';drawLyrics();});}
  function validLyricWords(line){
    var words=line.words,text='',previous=-1;
    if(!Array.isArray(words)||!words.length)return false;
    for(var i=0;i<words.length;i++){
      var w=words[i];
      if(!w||typeof w.text!=='string'||typeof w.start!=='number'||typeof w.end!=='number'||!isFinite(w.start)||!isFinite(w.end)||w.start<0||w.start<line.start||w.start<previous||w.end<=w.start)return false;
      previous=w.start;text+=w.text;
    }
    return text.trim()!==''&&(!line.text||text.trim()===line.text.trim());
  }
  var lyricFrame=null,lyricFrameAt=0,lyricMotion=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  function lyricEffectsAvailable(){return typeof window.requestAnimationFrame==='function'&&typeof window.cancelAnimationFrame==='function'&&'transform' in document.documentElement.style&&!(lyricMotion&&lyricMotion.matches);}
  function stopLyricFrame(){if(lyricFrame!==null){window.cancelAnimationFrame(lyricFrame);lyricFrame=null;}}
  function requestLyricFrame(){
    if(lyricFrame!==null)return;
    lyricFrame=window.requestAnimationFrame(function(now){
      lyricFrame=null;
      // Only active words need extra frames. The ordinary 100ms clock remains the fallback.
      if(now-lyricFrameAt>=40){lyricFrameAt=now;tickLyrics();}else requestLyricFrame();
    });
  }
  function resetLyricWords(nodes){Array.prototype.forEach.call(nodes||[],function(w){w.className='lyric-word';w.style.color='';w.firstChild.style.transform='';});}
  function paintLyricWords(nodes,pos,effects){
    var light=window.MyGoI18n.theme==='light',dim=light?[142,142,154]:[154,186,150],lit=light?[29,29,31]:[210,245,205],moving=false;
    Array.prototype.forEach.call(nodes,function(w){
      var start=+w.getAttribute('data-start'),end=+w.getAttribute('data-end'),sung=pos>=start,progress=Math.max(0,Math.min(1,(pos-start)/(end-start))),active=sung&&pos<end;
      var cls='lyric-word'+(sung?' sung':'');if(w.className!==cls)w.className=cls;
      var color=effects?'rgb('+dim.map(function(c,i){return Math.round(c+(lit[i]-c)*progress);}).join(', ')+')':'';
      if(w.style.color!==color)w.style.color=color;
      // Small transforms leave line wrapping and the remote focus geometry unchanged.
      var pulse=effects&&active?Math.sin(progress*Math.PI):0,transform=pulse?'translateY('+(Math.round(-1800*pulse)/1000)+'px) scale('+(Math.round(1000+45*pulse)/1000)+')':'';
      if(w.firstChild.style.transform!==transform)w.firstChild.style.transform=transform;
      if(active)moving=true;
    });
    return moving;
  }
  if(lyricMotion){if(lyricMotion.addEventListener)lyricMotion.addEventListener('change',tickLyrics);else if(lyricMotion.addListener)lyricMotion.addListener(tickLyrics);}
  document.addEventListener('visibilitychange',function(){syncCoverMotion();if(document.hidden)stopLyricFrame();else if(state.page==='player')tickLyrics();});
  window.addEventListener('pagehide',stopLyricFrame);
  function drawLyrics(){stopLyricFrame();state.lyricNodes=null;state.lyricWordNodes=null;var root=$('lyrics');if(!root)return;state.lyricActive=-2;root.className='lyric-window';root.removeAttribute('data-focus');root.removeAttribute('tabindex');
    if(state.lyricState!=='ready'){var label={idle:tr("正在准备歌词"),loading:tr("正在加载歌词"),failed:tr("歌词暂时无法加载"),empty:tr("暂无歌词"),unsupported:tr("此音乐源没有提供歌词")}[state.lyricState];root.innerHTML='<div class="lyrics-state">'+icon('lyrics')+'<p>'+esc(label)+'</p>'+(state.lyricState==='empty'?("<p>"+tr("享受音乐本身，也可以稍后重试。")+"</p>"):'')+(state.lyricState==='failed'?'<p>'+esc(state.lyricError)+'</p>':'')+(state.lyricState==='failed'||state.lyricState==='empty'?button('lyrics-retry',tr("重试"),'secondary','refresh'):'')+'</div>';return;}
    if(!state.lyricTimed){root.className+=' untimed';root.setAttribute('data-focus','lyrics');root.setAttribute('tabindex','0');}
    root.innerHTML='<div class="lyric-lines">'+state.lyrics.map(function(l,i){return '<p class="lyric-line" data-line="'+i+'">'+(state.lyricTimed&&validLyricWords(l)?l.words.map(function(w){return '<span class="lyric-word" data-start="'+w.start+'" data-end="'+w.end+'"><span class="lyric-ink">'+esc(w.text)+'</span></span>';}).join(''):esc(l.text))+(state.translation&&l.translation?'<span class="translation">'+esc(l.translation)+'</span>':'')+'</p>';}).join('')+'</div>';state.lyricNodes=root.querySelectorAll('.lyric-line');tickLyrics();
  }
  function centerLyrics(){var root=$('lyrics');if(!root||state.lyricState!=='ready'||!state.lyricTimed)return;var line=root.querySelectorAll('.lyric-line')[Math.max(0,state.lyricActive)],strip=root.querySelector('.lyric-lines');if(line&&strip)strip.style.transform='translateY('+(root.clientHeight*.43-line.offsetTop-line.offsetHeight/2)+'px)';}
  function tickLyrics(){var root=$('lyrics');if(state.page!=='player'||document.hidden||!root||state.lyricState!=='ready'||!state.lyricTimed){stopLyricFrame();return;}
    var pos=playPosition(),at=-1,lo=0,hi=state.lyrics.length,nodes=state.lyricNodes,recenter=false;
    while(lo<hi){var mid=Math.floor((lo+hi)/2);if(state.lyrics[mid].start<=pos){at=mid;lo=mid+1;}else hi=mid;}
    if(state.lyricActive!==at){
      if(state.lyricActive>=0&&nodes[state.lyricActive])nodes[state.lyricActive].className='lyric-line';
      resetLyricWords(state.lyricWordNodes);state.lyricWordNodes=at>=0&&nodes[at]?nodes[at].querySelectorAll('.lyric-word'):[];state.lyricActive=at;recenter=true;
    }
    var effects=lyricEffectsAvailable()&&state.lyricWordNodes&&state.lyricWordNodes.length>0;
    if(at>=0&&nodes[at]){var cls='lyric-line current'+(effects?' word-effects':'');if(nodes[at].className!==cls){nodes[at].className=cls;recenter=true;}}
    if(recenter)centerLyrics();
    var moving=paintLyricWords(state.lyricWordNodes||[],pos,effects);
    if(effects&&moving&&state.player&&state.player.state==='playing')requestLyricFrame();else stopLyricFrame();
  }
  function toggleTranslation(n){var next=!state.translation;n.disabled=true;post('/api/preferences',{translation:next?'on':'off'},function(e){n.disabled=false;if(e){toast(e);return;}state.translation=next;if(state.page==='settings'){renderSettings();focusId('translation-setting');}else if(state.page==='player')drawLyrics();});}
  function emitEvent(name){if(!state.player||audioGen!==state.player.generation||!mediaPath)return;post('/api/player/event',{generation:audioGen,state:name,seekRevision:audioSeek,position:Math.floor(audio.currentTime*1000)||0,duration:isFinite(audio.duration)?Math.floor(audio.duration*1000):0},function(){});}
  audio.addEventListener('playing',function(){emitEvent('playing');});audio.addEventListener('pause',function(){if(state.player&&!audio.ended&&state.player.state!=='preparing'&&mediaPath)emitEvent('paused');});audio.addEventListener('waiting',function(){emitEvent('buffering');});audio.addEventListener('ended',function(){emitEvent('ended');});audio.addEventListener('error',function(){emitEvent('failed');});audio.addEventListener('timeupdate',function(){if(Date.now()-lastEvent>1000&&!audio.paused){lastEvent=Date.now();emitEvent('playing');}});
  function syncAudio(p){if(nativePlayer)return;if(audioGen!==p.generation){mediaPath='';audioGen=p.generation;audio.pause();audio.removeAttribute('src');audio.load();audioSeek=-1;}if(p.media&&mediaPath!==p.media){mediaPath=p.media;audio.src=p.media;audio.load();}if(p.media&&audioSeek!==p.seekRevision){try{audio.currentTime=p.position/1000;audioSeek=p.seekRevision;}catch(_){}}if(p.wantPlay&&p.media&&audio.paused&&p.state!=='failed'&&p.state!=='ended'){var promise=audio.play();if(promise&&promise.catch)promise.catch(function(){});}if(!p.wantPlay&&!audio.paused)audio.pause();}
  function pollPlayer(){var epoch=state.playerEpoch||0;api('/api/player',function(e,p){if(!e&&epoch===(state.playerEpoch||0))applyPlayer(p);});}
  setInterval(function(){renderProgress();if(state.page==='player')tickLyrics();},100);
  function login(id){id=id||state.source&&state.source.instanceId;if(!id)return;var gen=state.pageGen,modalGen=state.modalGen,action=state.accountAction=(state.accountAction||0)+1;refreshAccount(id,function(e,account){if(gen!==state.pageGen||modalGen!==state.modalGen||action!==state.accountAction)return;state.accountTarget=id;if(e){dialog('账号状态暂不可用',(account&&account.name?("<p>"+tr("当前账号："))+esc(account.name)+'</p>':'')+'<p>'+esc(e)+'</p>',backButton('cancel')+button('account-retry',tr("重试"))+(can(id,'signIn')?button('account-login',tr("重新登录"),'primary'):''));return;}if(account&&account.name){var src=sourceInfo(id);dialog('当前账号','<p>'+esc(account.name)+'</p><p class="hint">'+esc(src?src.manifest.name:'')+'</p>',backButton('cancel')+(can(id,'signOut')?button('signout',tr("退出账号"),'primary'):''));return;}beginLogin(id);});}
  function beginLogin(id){
    if(!can(id,'signIn')){toast(tr("此音乐源没有提供登录"));return;}
    if(state.modal==='登录音乐源'){closeModal();}
    var gen=state.pageGen,modalGen=state.modalGen,action=state.accountAction=(state.accountAction||0)+1;
    post('/api/login/'+encodeURIComponent(id),{},function(err,d){
      if(gen!==state.pageGen||modalGen!==state.modalGen||action!==state.accountAction){if(d&&d.id)request('DELETE','/api/login?id='+encodeURIComponent(d.id),null,function(){});return;}
      if(err){toast(err);return;}state.loginSource=id;state.loginID=d&&d.id;state.loginPaint='';state.loginWeb=null;
      dialog('登录音乐源','<div id="login-status" class="scroll" data-focus="login-instructions" tabindex="0" role="region" aria-label="'+tr("登录提示")+'"><p>'+tr("正在准备登录…")+'</p></div><div id="login-web-actions"></div>',button('cancel',tr("取消")),{centered:true});pollLogin();
    });
  }
  function openLoginWeb(){
    var w=state.loginWeb;if(!w||state.modal!=='登录音乐源')return;
    if(window.Android&&window.Android.openLogin){window.Android.openLogin(state.loginID,w.id);return;}
    if(w.kind==='oauth'&&/^https:\/\//i.test(w.url)){window.open(w.url,'_blank','noopener,noreferrer');}
    else toast(tr("网页 Cookie 登录请在电视应用中完成"));
  }
  function signOut(){var id=state.modal==='当前账号'?state.accountTarget:state.source&&state.source.instanceId,gen=state.modalGen;if(!id)return;callFor(id,'signOut',{},function(err){if(err){toast(err);return;}state.accountAction=(state.accountAction||0)+1;state.accounts[id]={account:null,status:'ready',request:0,updatedAt:Date.now()};invalidateLikes(id);renderAccount();if(state.modal&&gen===state.modalGen)closeModal();toast(tr("已退出账号"));});}
  window.MyGo.resumeLogin=function(){if(state.modal==='登录音乐源'){clearTimeout(state.loginTimer);pollLogin();}};
  function pollLogin(){
    if(state.modal!=='登录音乐源')return;var gen=state.modalGen,id=state.loginSource,session=state.loginID;
    if(state.loginPolling&&state.loginPolling.gen===gen&&state.loginPolling.session===session)return;var ticket={gen:gen,session:session};state.loginPolling=ticket;
    api('/api/login',function(e,d){
      if(state.loginPolling===ticket)state.loginPolling=null;
      if(gen!==state.modalGen||session!==state.loginID)return;
      if(e){var box=$('login-web-actions');if(box&&!box.querySelector('[data-action="login-poll-retry"]'))box.insertAdjacentHTML('beforeend','<p class="hint">'+tr("登录状态读取失败，请重试")+'</p>'+button('login-poll-retry',tr("重试"),'secondary','refresh'));return;}
      if(session&&d.id!==session)return;
      if(d.state==='complete'){closeModal();invalidateLikes(id);refreshAccount(id);toast(tr("登录成功"));navigate(state.page);return;}
      var q=d.prompt||{},w=d.web||null,key=JSON.stringify([d.state,d.message,q,w]);state.loginWeb=w;
      if(state.loginPaint!==key){state.loginPaint=key;var status=$('login-status'),actions=$('login-web-actions'),active=activeID();
        var failed=d.state==='failed'||d.state==='cancelled';
        status.innerHTML=(q.qr&&!failed?'<img class="qr" src="/api/login/qr?id='+encodeURIComponent(session||'')+'&v='+encodeURIComponent(q.qr.slice(-30))+'" alt="'+tr("使用音乐服务手机 App 扫码")+'">':'')+'<p>'+esc(failed?tr(d.message||"登录已取消"):q.text|| (w?tr("在登录网页完成授权后自动返回"):tr("等待音乐源响应…")))+'</p>';
        actions.innerHTML=failed?button('login-retry',tr("重新登录"),'secondary','refresh'):w?button('login-open-web',tr("打开登录网页"),'primary','arrow')+(w.kind==='cookies'&&!(window.Android&&window.Android.openLogin)?'<p class="hint">'+tr("网页 Cookie 登录请在电视应用中完成")+'</p>':''):'';
        if(active&&active!=='login-instructions')focusId(active,true)||focusId('login-instructions',true);
      }
      if(d.state==='waiting')state.loginTimer=setTimeout(pollLogin,1200);
    });
  }
  document.addEventListener('submit',function(e){if(e.target.id==='search-form'){e.preventDefault();search();}if(e.target.id==='compose-form'){e.preventDefault();var n=$('modal-layer').querySelector('[data-action="compose-submit"]');if(n)submitCompose(n);}});
  document.addEventListener('click',function(e){
    var n=actionable(e.target);if(!n||n.disabled||n.getAttribute('aria-disabled')==='true')return;if(state.modal)state.modalEntry=null;var v;
    if((v=n.getAttribute('data-nav'))!==null){state.stack=[];state.detail=null;navigate(v);return;}
    if((v=n.getAttribute('data-source'))!==null){setSource(v);return;}
    if((v=n.getAttribute('data-catalog'))!==null){showCatalog(+v);return;}
    if((v=n.getAttribute('data-track'))!==null){play(+v);return;}
    if((v=n.getAttribute('data-track-more'))!==null){trackMenu(state.shown[+v],+v);return;}
    if((v=n.getAttribute('data-credit-artist'))!==null){var credit=state.creditArtists[+v],creditSource=state.creditTrack.source;closeModal(true);openEntity(credit,'artist',creditSource);return;}
    if((v=n.getAttribute('data-detail-section'))!==null){state.detail.section=v;paintDetail(state.detail);focusId('detail-'+v);return;}
    if((v=n.getAttribute('data-item'))!==null){openItem(+v,n.getAttribute('data-kind'));return;}
    if((v=n.getAttribute('data-browse'))!==null){rememberPage();state.detail=null;navigate('browse:'+v);return;}
    if((v=n.getAttribute('data-search-kind'))!==null){state.searchKind=v;Array.prototype.forEach.call(document.querySelectorAll('[data-search-kind]'),function(b){b.setAttribute('aria-pressed',String(b===n));});if($('search-input').value)search();return;}
    if((v=n.getAttribute('data-theme'))!==null){saveAppearance('theme',v);return;}
    if((v=n.getAttribute('data-quality'))!==null){saveAppearance('quality',v);return;}
    if((v=n.getAttribute('data-language'))!==null){saveAppearance('language',v);return;}
    if((v=n.getAttribute('data-pref'))!==null){post('/api/preferences',{sidebar:v},function(err){if(err){toast(err);return;}state.pref=v;appClass();if(!$('nav').contains(document.activeElement))showActiveNav();Array.prototype.forEach.call($('content').querySelectorAll('[data-pref]'),function(choice){choice.setAttribute('aria-pressed',String(choice.getAttribute('data-pref')===v));});});return;}
    if((v=n.getAttribute('data-setting'))!==null){var setting=state.source.manifest.settings[+v];post('/api/sources/'+state.source.instanceId+'/settings',{key:setting.key,value:$('setting-'+v).value},function(err){toast(err||tr("已保存"));});return;}
    if((v=n.getAttribute('data-set-mode'))!==null){var modeGen=state.modalGen;playerCommand('/api/player/mode',{mode:v},function(err){if(!err){if(modeGen===state.modalGen)closeModal();toast(tr(modeLabels[v]));if(state.page==='settings')renderSettings();}});return;}
    if((v=n.getAttribute('data-queue-jump'))!==null){queueChange('jump',null,v);return;}
    if((v=n.getAttribute('data-queue-remove'))!==null){queueChange(state.player.queue.length===1?'clear':'remove',null,v);return;}
    if((v=n.getAttribute('data-pick-playlist'))!==null){addPlaylist(+v,n);return;}
    if((v=n.getAttribute('data-comment-like'))!==null){likeComment(+v,n);return;}
    if((v=n.getAttribute('data-comment-expand'))!==null){var text=$('comment-text-'+v),expanded=text.className.indexOf('expanded')>=0;text.className='comment-text'+(expanded?'':' expanded');n.textContent=expanded?tr("展开全文"):tr("收起");if(expanded){text.removeAttribute('data-focus');text.removeAttribute('tabindex');focusNode(n);}else{text.setAttribute('data-focus','comment-body-'+state.comments.items[+v].id);text.setAttribute('tabindex','0');focusNode(text);}return;}
    if((v=n.getAttribute('data-device'))!==null){sourceCall('remoteUse',{deviceId:state.devices[+v].id},function(err){if(err)toast(err);else{closeModal();toast(tr("播放设备已切换"));}});return;}
    var a=n.getAttribute('data-action')||n.id;
    switch(a){
    case 'app-check-update':activateAppUpdate();break;
    case 'source-switch':sourceMenu();break;case 'go-market':state.stack=[];navigate('market');break;case 'go-search':state.stack=[];state.detail=null;navigate('search');break;case 'cancel':closeModal();break;
    case 'check-all-updates':checkUpdates(true);break;case 'check-update':checkUpdates(false);break;case 'update-plugin':updatePlugin();break;case 'confirm-update':confirmUpdate();break;case 'retry-job':if(state.catalogView&&state.catalogView.job){state.catalogView.error='';pollJob(state.catalogView.job.id,state.catalogView);patchCatalogDetail();}break;case 'install':install();break;case 'refresh-catalog':if(!state.marketRefreshBusy)loadCatalog(state.pageGen,true);break;case 'retry':navigate(state.page);break;case 'load-more':n.disabled=true;n.textContent=tr("正在加载…");fetchList(true,state.pageGen);break;
    case 'feature-play':play(state.featureTrack);break;case 'play-all':play(0);break;case 'toggle':toggle();break;case 'previous':control('previous');break;case 'next':control('next');break;case 'seek':commitSeek();break;case 'open-player':openPlayer();break;case 'player-back':case 'detail-back':back();break;
    case 'now-artist':openTrackArtist();break;case 'now-album':var albumTrack=currentTrack();if(albumTrack)openEntity(albumTrack.album,'album',albumTrack.source);break;case 'now-like':toggleLike(currentTrack(),n);break;
    case 'queue-button':queue();break;case 'play-mode':modeMenu();break;case 'queue-clear':dialog('清空播放队列？',("<p>"+tr("将停止当前播放并移除全部歌曲。")+"</p>"),button('cancel',tr("取消"))+button('queue-clear-confirm',tr("清空"),'primary'),{nest:true});break;
    case 'queue-clear-confirm':var clearGen=state.modalGen;queueChange('clear',null,'',function(err){if(!err){if(clearGen===state.modalGen)closeModal();toast(tr("队列已清空"));}});break;
    case 'queue-next':case 'queue-append':var queueGen=state.modalGen;queueChange(a==='queue-next'?'next':'append',state.actionTrack,'',function(err){if(!err){if(queueGen===state.modalGen)closeModal(true);toast(a==='queue-next'?tr("已设为下一首播放"):tr("已加入播放队列"));}});break;
    case 'track-like':toggleLike(state.page==='player'&&!state.modal?currentTrack():state.actionTrack,n);break;case 'player-comments':comments(currentTrack());break;case 'track-comments':comments(state.actionTrack);break;case 'player-more':trackMenu(currentTrack());break;
    case 'add-playlist':playlistPicker(state.actionTrack);break;case 'playlist-retry':loadPlaylists(state.pickContext);break;case 'create-for-track':createPlaylist(state.actionTrack);break;case 'create-playlist':createPlaylist(null);break;case 'compose-submit':submitCompose(n);break;
    case 'manage-playlist':managePlaylist();break;case 'rename-playlist':renamePlaylist();break;case 'delete-playlist':confirmPlaylistDelete();break;case 'delete-playlist-confirm':deletePlaylist(n);break;case 'playlist-remove-track':case 'playlist-track-up':case 'playlist-track-down':editPlaylistTrack(a,n);break;case 'refresh-detail':refreshPlaylist(state.detail,'manage-playlist');break;case 'episodes-more':loadEpisodes(true);break;
    case 'station-retry':control('station-retry');break;case 'leave-station':control('leave-station');break;
    case 'comments-more':loadComments();break;case 'write-comment':writeComment();break;case 'save-entity':saveEntity(n);break;
    case 'full-lyrics':if(state.page!=='player'||!currentTrack())break;state.lyricFull=!state.lyricFull;renderPlayerPage();focusId('full-lyrics');break;case 'translation-setting':toggleTranslation(n);break;case 'lyrics-retry':loadLyrics(true);break;
    case 'login-open-web':openLoginWeb();break;case 'login-retry':beginLogin(state.loginSource);break;case 'login-poll-retry':state.loginPaint='';$('login-web-actions').innerHTML='';pollLogin();break;
    case 'compatibility-retry':state.compatibility=null;refreshCompatibility();break;
    case 'account':login(n.getAttribute('data-account-source'));break;case 'account-retry':login(state.accountTarget);break;case 'account-login':beginLogin(state.accountTarget);break;case 'login':login();break;case 'signout':signOut();break;
    case 'uninstall':dialog('卸载音乐源？',("<p>"+tr("移除插件，保留账号数据以便重新安装。")+"</p>"),button('cancel',tr("取消"))+button('remove-source',tr("卸载"),'primary'));break;
    case 'remove-source':request('DELETE','/api/sources/'+state.source.instanceId,null,function(err){if(err){toast(err);return;}closeModal();state.source=null;loadSources(function(){navigate('home');});});break;
    case 'remote-devices':sourceCall('remoteDevices',{},function(err,devices){if(err){toast(err);return;}state.devices=devices||[];dialog('选择播放设备',state.devices.length?state.devices.map(function(d,i){return '<button class="source-option" data-focus="device-'+i+'" data-device="'+i+'">'+esc(d.name)+(d.active?tr(" · 当前设备"):'')+'</button>';}).join(''):("<p>"+tr("暂无可用设备，请先打开服务的播放设备。")+"</p>"),backButton('cancel'));});break;
    case 'exit':control('stop');closeModal();toast(tr("播放已停止（浏览器预览）"));break;
    }
  });
  function start(){window.MyGoI18n.localize(document);var boot=++state.boot;$('startup-retry').hidden=true;api('/health',function(err){if(err){$('startup-status').textContent=tr("核心连接失败，请重试");$('startup-retry').hidden=false;$('startup-retry').focus();return;}api('/api/config',function(e,conf){if(e){$('startup-status').textContent=e;$('startup-retry').hidden=false;return;}state.mode=conf.mode;state.version=conf.app.versionName;$('startup-version').textContent=tr("版本")+' '+state.version;api('/api/preferences',function(prefError,prefs){if(prefError){$('startup-status').textContent=prefError;$('startup-retry').hidden=false;return;}applyAppearance(prefs||{});state.pref=prefs&&prefs.sidebar==='icons'?'icons':'expanded';state.translation=!prefs||prefs.translation!=='off';appClass();loadSources(function(sourceError){if(sourceError){$('startup-status').textContent=tr("音乐源加载失败，请重试");$('startup-retry').hidden=false;return;}$('startup').hidden=true;$('app').hidden=false;navigate(state.sources.length?'home':'market');clearInterval(state.poll);state.poll=setInterval(pollPlayer,600);pollPlayer();clearTimeout(state.updatesTimer);pollUpdates();if(window.Android&&window.Android.uiReady)window.Android.uiReady();});});});});}
  state.boot=0;$('startup-retry').onclick=start;start();setInterval(refreshAppUpdate,1000);
}());
