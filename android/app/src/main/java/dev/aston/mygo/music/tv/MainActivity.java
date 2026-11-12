package dev.aston.mygo.music.tv;

import android.app.*;
import android.content.*;
import android.os.*;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.webkit.*;
import android.widget.*;
import androidx.core.content.ContextCompat;
import java.net.URI;

public final class MainActivity extends Activity {
    private WebView web;
    private FrameLayout root;
    private TextView status, version;
    private LinearLayout startup;
    private StartupLogoView startupLogo;
    private AppUpdater appUpdater;
    private volatile boolean pageReady, foreground;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean loaded, destroyed, editing, exitVisible;
    private volatile int nativeViewWidth;
    private long backSequence;
    private final BroadcastReceiver receiver = new BroadcastReceiver() { @Override public void onReceive(Context c, Intent i) { connect(); } };
    @Override public void onCreate(Bundle state) {
        setTheme(Appearance.light(this)?android.R.style.Theme_Material_Light_NoActionBar:android.R.style.Theme_Material_NoActionBar);
        super.onCreate(state); immersive();
        root = new FrameLayout(this); root.setBackgroundColor(Appearance.background(this)); setContentView(root);
        web = new WebView(this) {
            @Override public boolean onKeyPreIme(int keyCode, KeyEvent event) {
                return routeEditingDirection(event) || super.onKeyPreIme(keyCode, event);
            }
        }; web.setBackgroundColor(Appearance.background(this));
        web.addOnLayoutChangeListener((v,left,top,right,bottom,oldLeft,oldTop,oldRight,oldBottom)->{
            int width=right-left;
            if(width>0&&width!=nativeViewWidth){nativeViewWidth=width;if(loaded&&!destroyed)web.evaluateJavascript("if(window.MyGo&&window.MyGo.refreshViewport)window.MyGo.refreshViewport()",null);}
        });
        web.setVerticalScrollBarEnabled(false); web.setHorizontalScrollBarEnabled(false);
        WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setMediaPlaybackRequiresUserGesture(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);
        web.addJavascriptInterface(new Bridge(), "Android");
        appUpdater = new AppUpdater(this, new AppUpdater.Host() {
            public boolean trusted() { return pageReady && !destroyed; }
            public boolean foreground() { return foreground; }
            public void restoreFocus() { if (!destroyed) { web.requestFocus(); immersive(); } }
            public void allowPrompt(boolean manual, AppUpdater.PromptCheck check) {
                if (!pageReady || destroyed) { check.result(false); return; }
                web.evaluateJavascript("!!(window.MyGo&&window.MyGo.canShowAppUpdate("+manual+"))", value -> check.result("true".equals(value)));
            }
        });
        web.addJavascriptInterface(appUpdater.new Bridge(), "MyGoAppUpdates");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) { pageReady=false; }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return !trusted(url); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest r) { return !trusted(r.getUrl().toString()); }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1,-1)); showStartup();
        IntentFilter filter = new IntentFilter(CoreService.STATUS);
        ContextCompat.registerReceiver(this, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        startCore(); connect();
    }
    private void startCore() { Intent i = new Intent(this, CoreService.class); if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i); }
    private void showStartup() {
        if (startup != null) root.removeView(startup);
        startup = new LinearLayout(this); startup.setOrientation(LinearLayout.VERTICAL); startup.setGravity(Gravity.CENTER); startup.setBackgroundColor(Appearance.background(this));
        startupLogo = new StartupLogoView(this); int size = dp(94);
        startup.addView(startupLogo,new LinearLayout.LayoutParams(size,size));
        status = new TextView(this); status.setText(Appearance.text(this,R.string.app_starting)); status.setTextColor(Appearance.foreground(this)); status.setTextSize(18); status.setGravity(Gravity.CENTER); LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(-2,dp(46)); statusParams.topMargin=dp(16); startup.addView(status,statusParams);
        version = new TextView(this); version.setText(String.format(Appearance.text(this,R.string.version_label),BuildConfig.VERSION_NAME)); version.setTextColor(Appearance.muted(this)); version.setTextSize(13); version.setGravity(Gravity.CENTER);
        startup.addView(version,new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT,LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(startup,new FrameLayout.LayoutParams(-1,-1));
    }
    private int dp(int value) { return (int)(getResources().getDisplayMetrics().density * value); }
    private void connect() {
        if (destroyed || loaded) return; CoreService service = CoreService.get();
        if (service != null && service.pageURL() != null) { loaded = true; web.loadUrl(service.pageURL()); return; }
        if (service != null && service.error() != null) {
            startupLogo.setLoading(false);
            status.setText(service.error());
            if (startup.getChildCount() == 3) { Button retry = new Button(this); retry.setText(Appearance.text(this,R.string.retry)); retry.setOnClickListener(v -> { stopService(new Intent(this, CoreService.class)); showStartup(); startCore(); handler.postDelayed(this::connect, 500); }); LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(-2,-2); retryParams.topMargin=dp(12); startup.addView(retry,retryParams); retry.requestFocus(); }
        } else handler.postDelayed(this::connect, 250);
    }
    private boolean trusted(String url) { try { CoreService s = CoreService.get(); if (s == null || s.pageURL() == null) return false; URI a = new URI(url), b = new URI(s.pageURL()); return "http".equals(a.getScheme()) && a.getHost().equals(b.getHost()) && a.getPort() == b.getPort(); } catch (Exception e) { return false; } }
    private void immersive() { getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE); }
    @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if (focus) immersive(); }
    @Override protected void onResume() { super.onResume(); foreground=true; if(appUpdater!=null)appUpdater.resume(); if(loaded&&web!=null)web.evaluateJavascript("if(window.MyGo&&window.MyGo.resumeLogin)window.MyGo.resumeLogin()",null); }
    @Override protected void onPause() { foreground=false;
        long before=System.currentTimeMillis();
        if(loaded&&!destroyed)web.evaluateJavascript("if(window.MyGo&&window.MyGo.cancelScanInput)window.MyGo.cancelScanInput("+before+")",null);
        CoreService service=CoreService.get();if(service!=null)service.cancelPhoneInput(before);
        super.onPause();
    }
    @Override public void onBackPressed() {
        if (appUpdater!=null && appUpdater.back()) return;
        if (editing) { finishEditing(); web.evaluateJavascript("if(document.activeElement)document.activeElement.blur()",null); return; }
        if (!loaded) { confirmExit(); return; }
        final long seq = ++backSequence;
        web.evaluateJavascript("!!(window.MyGo&&window.MyGo.nativeBack())", value -> { if (seq == backSequence && !"true".equals(value)) confirmExit(); });
        handler.postDelayed(() -> { if (seq == backSequence && !exitVisible && !web.isAttachedToWindow()) confirmExit(); }, 700);
    }
    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        return routeEditingDirection(event) || super.dispatchKeyEvent(event);
    }
    private boolean routeEditingDirection(KeyEvent event) {
        String direction = KeyRoutingPolicy.editDirection(editing, event.getKeyCode());
        if (direction != null) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) web.evaluateJavascript("if(window.MyGo&&window.MyGo.nativeEditDirection)window.MyGo.nativeEditDirection('" + direction + "')", null);
            return true;
        }
        return false;
    }
    private void finishEditing() { editing = false; ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(web.getWindowToken(),0); }
    private void confirmExit() {
        if (destroyed || exitVisible) return; exitVisible=true; ++backSequence;
        AlertDialog dialog = new AlertDialog.Builder(this,Appearance.light(this)?android.R.style.Theme_Material_Light_Dialog_Alert:android.R.style.Theme_Material_Dialog_Alert).setTitle(Appearance.text(this,R.string.exit_title)).setMessage(Appearance.text(this,R.string.exit_message)).setNegativeButton(Appearance.text(this,R.string.cancel),(d,w)->{}).setPositiveButton(Appearance.text(this,R.string.exit),(d,w)->{ finishEditing(); stopService(new Intent(this, CoreService.class)); finish(); }).create();
        dialog.setOnDismissListener(d->{exitVisible=false;immersive();}); dialog.setOnShowListener(d->{Appearance.styleExitDialog(this,dialog);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).requestFocus();}); dialog.show();
    }
    private final class Bridge {
        @JavascriptInterface public String platform() { return "android-tv"; }
        @JavascriptInterface public String lanAddress() { return PhoneInputNetwork.address(MainActivity.this); }
        @JavascriptInterface public int nativeViewWidth() { return nativeViewWidth; }
        @JavascriptInterface public boolean webSignInSupported() { return true; }
        @JavascriptInterface public void openLogin(String id,String requestId) {
            if(id==null||requestId==null||!id.matches("[a-f0-9]{48}")||!requestId.matches("[a-f0-9]{48}"))return;
            handler.post(()->{if(!destroyed)startActivity(new Intent(MainActivity.this,BrowserLoginActivity.class).putExtra("id",id).putExtra("requestId",requestId));});
        }
        @JavascriptInterface public String appearance() { return Appearance.json(MainActivity.this); }
        @JavascriptInterface public void applyAppearance(String theme, String language) {
            if (!Appearance.valid(theme,language)) return;
            handler.post(()->{
                if(destroyed) return;
                Appearance.save(MainActivity.this,theme,language);
                appUpdater.refreshAppearance();
                root.setBackgroundColor(Appearance.background(MainActivity.this));web.setBackgroundColor(Appearance.background(MainActivity.this));
                if(startup!=null) { startup.setBackgroundColor(Appearance.background(MainActivity.this));startupLogo.setTintColor(Appearance.foreground(MainActivity.this));status.setTextColor(Appearance.foreground(MainActivity.this));version.setText(String.format(Appearance.text(MainActivity.this,R.string.version_label),BuildConfig.VERSION_NAME)); }
                CoreService service=CoreService.get();if(service!=null)service.refreshAppearance();
            });
        }
        @JavascriptInterface public boolean nativePlayer() { return true; }
        @JavascriptInterface public void uiReady() { handler.post(()->{if(!destroyed && trusted(web.getUrl())){pageReady=true;if(startup!=null){root.removeView(startup);startup=null;web.requestFocus();}appUpdater.start();}}); }
        @JavascriptInterface public void confirmExit() { handler.post(MainActivity.this::confirmExit); }
        @JavascriptInterface public void startSearchEditing() { handler.post(()->editing=true); }
        @JavascriptInterface public void finishSearchEditing() { handler.post(MainActivity.this::finishEditing); }
    }
    @Override protected void onDestroy() { destroyed=true; pageReady=false; if(appUpdater!=null)appUpdater.destroy(); ++backSequence; handler.removeCallbacksAndMessages(null); unregisterReceiver(receiver); finishEditing(); web.removeJavascriptInterface("MyGoAppUpdates"); web.removeJavascriptInterface("Android"); web.destroy(); super.onDestroy(); }
}
