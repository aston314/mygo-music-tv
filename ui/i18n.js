(function (root) {
  'use strict';
  var catalogs = root.MyGoLocales || {}, current = 'zh-CN', theme = 'light';
  function text(key) { var selected = catalogs[current] || {}, fallback = catalogs['zh-CN'] || {}; return Object.prototype.hasOwnProperty.call(selected,key) ? selected[key] : Object.prototype.hasOwnProperty.call(fallback,key) ? fallback[key] : key; }
  function apply(nextTheme,nextLanguage) {
    theme = nextTheme === 'dark' ? 'dark' : 'light';current = nextLanguage === 'zh-TW' ? 'zh-TW' : 'zh-CN';
    document.documentElement.setAttribute('data-theme',theme);document.documentElement.lang=current;
    root.MyGoI18n.theme=theme;root.MyGoI18n.language=current;
    try { root.localStorage.setItem('mygo.appearance',JSON.stringify({theme:theme,language:current})); } catch (_) { }
  }
  function localize(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n]'),function(n){n.textContent=text(n.getAttribute('data-i18n'));});
    ['aria-label','title','placeholder'].forEach(function(attr){Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n-'+attr+']'),function(n){n.setAttribute(attr,text(n.getAttribute('data-i18n-'+attr)));});});
  }
  root.MyGoI18n={text:text,apply:apply,localize:localize,theme:theme,language:current};
  // A paint cache only; the Go preferences endpoint remains authoritative across hosts and Android ports.
  var cached=null;try { cached=JSON.parse(root.Android&&root.Android.appearance?root.Android.appearance():root.localStorage.getItem('mygo.appearance')); } catch (_) { }
  apply(cached&&cached.theme,cached&&cached.language);
}(window));
