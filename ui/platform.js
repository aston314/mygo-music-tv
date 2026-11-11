(function (root) {
  'use strict';
  var platform = '', host = root.MyGoHost || {}, ua = root.navigator.userAgent || '';
  var tvPlatforms = {'android-tv':true,webos:true,tizen:true,tv:true};
  var desktopPlatforms = {browser:true,macos:true,linux:true,windows:true,desktop:true};
  function known(name) { return tvPlatforms[name] || desktopPlatforms[name]; }
  if (known(host.platform)) platform = host.platform;
  if (!platform && root.Android) {
    try { if (root.Android.platform) platform = root.Android.platform(); } catch (_) { }
    if (!known(platform)) platform = root.Android.nativePlayer ? 'android-tv' : '';
  }
  if (!platform && (root.PalmSystem || /Web0S|webOS.*SmartTV/i.test(ua))) platform = 'webos';
  if (!platform && (root.tizen && root.tizen.tvinputdevice || /SMART-TV.*Tizen|Tizen.*(?:SMART-TV|\bTV\b)/i.test(ua))) platform = 'tizen';
  if (!platform && /SmartTV|SMART-TV|Android TV|GoogleTV/i.test(ua)) platform = 'tv';
  if (!platform) platform = 'browser';
  root.MyGoPlatform = {name:platform,tv:!!tvPlatforms[platform]};
  root.document.documentElement.setAttribute('data-platform', platform);
  root.document.documentElement.setAttribute('data-form-factor', root.MyGoPlatform.tv ? 'tv' : 'desktop');
}(window));
