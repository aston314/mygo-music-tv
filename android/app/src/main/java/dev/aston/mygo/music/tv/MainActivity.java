package dev.aston.mygo.music.tv;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.os.*;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.webkit.*;
import android.widget.*;
import java.net.URI;

public final class MainActivity extends Activity {
    private WebView web;
    private FrameLayout root;
    private TextView status;
    private LinearLayout startup;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean loaded, destroyed, editing, exitVisible;
    private long backSequence;
    private final BroadcastReceiver receiver = new BroadcastReceiver() { @Override public void onReceive(Context c, Intent i) { connect(); } };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); immersive();
        root = new FrameLayout(this); root.setBackgroundColor(Color.rgb(16,22,25)); setContentView(root);
        web = new WebView(this); web.setBackgroundColor(Color.rgb(16,22,25));
        WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setMediaPlaybackRequiresUserGesture(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return !trusted(url); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest r) { return !trusted(r.getUrl().toString()); }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1,-1)); showStartup();
        IntentFilter filter = new IntentFilter(CoreService.STATUS);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED); else registerReceiver(receiver, filter);
        startCore(); connect();
    }
    private void startCore() { Intent i = new Intent(this, CoreService.class); if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i); }
    private void showStartup() {
        if (startup != null) root.removeView(startup);
        startup = new LinearLayout(this); startup.setOrientation(LinearLayout.VERTICAL); startup.setGravity(Gravity.CENTER); startup.setBackgroundColor(Color.rgb(16,22,25));
        FrameLayout logo = new FrameLayout(this); int size = dp(94);
        ProgressBar ring = new ProgressBar(this); logo.addView(ring, new FrameLayout.LayoutParams(-1,-1)); TextView note = new TextView(this); note.setText("♪"); note.setTextSize(46); note.setTextColor(Color.rgb(182,238,205)); note.setGravity(Gravity.CENTER); logo.addView(note,new FrameLayout.LayoutParams(-1,-1)); startup.addView(logo,new LinearLayout.LayoutParams(size,size));
        status = new TextView(this); status.setText("正在启动 MyGo Music TV…"); status.setTextColor(Color.WHITE); status.setTextSize(18); status.setGravity(Gravity.CENTER); LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(-2,dp(46)); statusParams.topMargin=dp(16); startup.addView(status,statusParams);
        TextView version = new TextView(this); version.setText("版本 " + BuildConfig.VERSION_NAME); version.setTextColor(Color.rgb(135,148,145)); version.setTextSize(13); startup.addView(version);
        root.addView(startup,new FrameLayout.LayoutParams(-1,-1));
    }
    private int dp(int value) { return (int)(getResources().getDisplayMetrics().density * value); }
    private void connect() {
        if (destroyed || loaded) return; CoreService service = CoreService.get();
        if (service != null && service.pageURL() != null) { loaded = true; web.loadUrl(service.pageURL()); return; }
        if (service != null && service.error() != null) {
            status.setText(service.error());
            if (startup.getChildCount() == 3) { Button retry = new Button(this); retry.setText("重试"); retry.setOnClickListener(v -> { stopService(new Intent(this, CoreService.class)); showStartup(); startCore(); handler.postDelayed(this::connect, 500); }); startup.addView(retry); retry.requestFocus(); }
        } else handler.postDelayed(this::connect, 250);
    }
    private boolean trusted(String url) { try { CoreService s = CoreService.get(); if (s == null || s.pageURL() == null) return false; URI a = new URI(url), b = new URI(s.pageURL()); return "http".equals(a.getScheme()) && a.getHost().equals(b.getHost()) && a.getPort() == b.getPort(); } catch (Exception e) { return false; } }
    private void immersive() { getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE); }
    @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if (focus) immersive(); }
    @Override public void onBackPressed() {
        if (editing) { finishEditing(); web.evaluateJavascript("if(document.activeElement)document.activeElement.blur()",null); return; }
        if (!loaded) { confirmExit(); return; }
        final long seq = ++backSequence;
        web.evaluateJavascript("!!(window.MyGo&&window.MyGo.nativeBack())", value -> { if (seq == backSequence && !"true".equals(value)) confirmExit(); });
        handler.postDelayed(() -> { if (seq == backSequence && !exitVisible && !web.isAttachedToWindow()) confirmExit(); }, 700);
    }
    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        String direction = KeyRoutingPolicy.editDirection(editing, event.getKeyCode());
        if (direction != null) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) web.evaluateJavascript("document.dispatchEvent(new KeyboardEvent('keydown',{key:'" + direction + "',bubbles:true}))", null);
            return true;
        }
        return super.dispatchKeyEvent(event);
    }
    private void finishEditing() { editing = false; ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(web.getWindowToken(),0); }
    private void confirmExit() {
        if (destroyed || exitVisible) return; exitVisible=true; ++backSequence;
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("退出 MyGo Music TV？").setMessage("退出后停止播放音乐").setNegativeButton("取消",(d,w)->{}).setPositiveButton("退出",(d,w)->{ finishEditing(); stopService(new Intent(this, CoreService.class)); finish(); }).create();
        dialog.setOnDismissListener(d->{exitVisible=false;immersive();}); dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_NEGATIVE).requestFocus()); dialog.show();
    }
    private final class Bridge {
        @JavascriptInterface public boolean nativePlayer() { return true; }
        @JavascriptInterface public void uiReady() { handler.post(()->{if(!destroyed && startup!=null){root.removeView(startup);startup=null;web.requestFocus();}}); }
        @JavascriptInterface public void confirmExit() { handler.post(MainActivity.this::confirmExit); }
        @JavascriptInterface public void startSearchEditing() { handler.post(()->editing=true); }
        @JavascriptInterface public void finishSearchEditing() { handler.post(MainActivity.this::finishEditing); }
    }
    @Override protected void onDestroy() { destroyed=true; ++backSequence; handler.removeCallbacksAndMessages(null); unregisterReceiver(receiver); finishEditing(); web.removeJavascriptInterface("Android"); web.destroy(); super.onDestroy(); }
}
