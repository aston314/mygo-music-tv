package dev.aston.mygo.music.tv;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Temporary login browser. Remote content has NO JavaScript/native bridge.
 * CookieManager is process-wide on API 23: serialize logins, clear remote
 * cookies before/after, and restore only our loopback HttpOnly core cookie.
 * Plugin credentials live solely in the Go instance's own storage directory.
 */
public final class BrowserLoginActivity extends Activity {
    private static boolean occupied;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private CoreClient client;
    private WebView web;
    private TextView status;
    private String id, requestId, address, cookiesOf;
    private volatile String callback = "";
    private String[] until = new String[0];
    private boolean owner, exiting, submitting, loaded;
    @Override public void onCreate(Bundle state) {
        setTheme(Appearance.light(this)?android.R.style.Theme_Material_Light_NoActionBar:android.R.style.Theme_Material_NoActionBar);
        super.onCreate(state);
        if(occupied) { finish(); return; } occupied=true; owner=true;
        CoreService service=CoreService.get();client=service==null?null:service.loginClient();
        id=getIntent().getStringExtra("id");requestId=getIntent().getStringExtra("requestId");
        if(client==null||id==null||requestId==null) { finish();return; }
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Appearance.background(this));setContentView(root);
        LinearLayout bar=new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(20,8,20,8);
        Button cancel=new Button(this);cancel.setText(Appearance.text(this,R.string.cancel));cancel.setOnClickListener(v->leave(true));bar.addView(cancel);
        Button retry=new Button(this);retry.setText(Appearance.text(this,R.string.retry));retry.setEnabled(false);retry.setOnClickListener(v->{if(!exiting&&!submitting&&loaded){status.setText(Appearance.text(this,R.string.login_loading));web.loadUrl(address);}});bar.addView(retry);
        status=new TextView(this);status.setText(Appearance.text(this,R.string.login_loading));status.setTextSize(18);status.setTextColor(Appearance.muted(this));bar.addView(status,new LinearLayout.LayoutParams(0,-2,1));root.addView(bar);
        web=new WebView(this);WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setSaveFormData(false);s.setCacheMode(WebSettings.LOAD_NO_CACHE);s.setUseWideViewPort(true);s.setLoadWithOverviewMode(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setMediaPlaybackRequiresUserGesture(true);
        // Some service sign-ins use cross-site SSO frames. This cookie jar is
        // cleared on entry/exit and never reused for another plugin login.
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return !BrowserLoginPolicy.allowed(url,callback);}
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest r){return !BrowserLoginPolicy.allowed(r.getUrl().toString(),callback);}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest r){String url=r.getUrl().toString();return BrowserLoginPolicy.securePage(url)||r.isForMainFrame()&&BrowserLoginPolicy.callback(url,callback)?null:new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
            @Override public void onPageFinished(WebView view,String url){status.setText(Appearance.text(BrowserLoginActivity.this,R.string.login_browser_hint));checkCookies();}
            @Override public void onReceivedError(WebView v,android.webkit.WebResourceRequest r,android.webkit.WebResourceError e){if(r.isForMainFrame())status.setText(Appearance.text(BrowserLoginActivity.this,R.string.login_page_failed));}
        });
        root.addView(web,new LinearLayout.LayoutParams(-1,0,1));cancel.requestFocus();
        network.execute(()->{
            try {
                JSONObject spec=client.request("GET",nativePath(),null),w=spec.getJSONObject("web"),q=spec.optJSONObject("request");address=w.getString("url");callback=w.optString("callback","");
                if(!BrowserLoginPolicy.securePage(address))throw new IllegalArgumentException("Secure page required");
                String agent="";
                if(q!=null){cookiesOf=q.getString("cookiesOf");if(!BrowserLoginPolicy.securePage(cookiesOf))throw new IllegalArgumentException("Secure cookies required");JSONArray keys=q.getJSONArray("until");until=new String[keys.length()];for(int i=0;i<until.length;i++)until[i]=keys.getString(i);agent=q.optString("userAgent","");}
                final String ua=agent;
                handler.post(()->{if(exiting)return;if(!ua.isEmpty())web.getSettings().setUserAgentString(ua);resetCookies(()->{if(exiting)return;loaded=true;retry.setEnabled(true);web.loadUrl(address);web.requestFocus();handler.postDelayed(this::tick,1000);});});
            }catch(Exception ignored){handler.post(()->leave(true));}
        });
    }
    private String nativePath(){return "/api/login/native?id="+id+"&requestId="+requestId;}
    private void tick(){
        if(exiting)return;checkCookies();
        network.execute(()->{
            try {
                JSONObject l=client.request("GET","/api/login",null);
                if(!id.equals(l.optString("id"))||!"waiting".equals(l.optString("state"))){handler.post(()->leave(false));return;}
                JSONObject w=l.optJSONObject("web");if(w!=null)callback=w.optString("callback","");
            } catch(Exception ignored){handler.post(()->{if(!exiting)status.setText(Appearance.text(this,R.string.login_connection_failed));});}
            handler.post(()->{if(!exiting)handler.postDelayed(this::tick,1000);});
        });
    }
    private void checkCookies(){
        if(exiting||!loaded||submitting||cookiesOf==null)return;
        String cookie=CookieManager.getInstance().getCookie(cookiesOf);if(!BrowserLoginPolicy.complete(cookie,until))return;
        submitting=true;
        network.execute(()->{try{client.request("POST","/api/login/native",new JSONObject().put("id",id).put("requestId",requestId).put("cookie",cookie));handler.post(()->leave(false));}catch(Exception ignored){handler.post(()->{submitting=false;status.setText(Appearance.text(this,R.string.login_connection_failed));});}});
    }
    private void resetCookies(Runnable next){
        if(web!=null){web.clearCache(true);web.clearFormData();}
        CookieManager manager=CookieManager.getInstance();manager.removeAllCookies(ignored->{
            // The application WebView only visits this loopback origin. Keep
            // its auth alive while removing all previous remote-site state.
            manager.setCookie(client.base,"mygo_session="+client.token+"; Path=/; HttpOnly; SameSite=Strict",done->{manager.flush();WebStorage.getInstance().deleteAllData();next.run();});
        });
    }
    private void leave(boolean cancel){
        if(exiting)return;exiting=true;handler.removeCallbacksAndMessages(null);if(web!=null)web.stopLoading();
        if(cancel&&client!=null)network.execute(()->{try{client.request("DELETE","/api/login?id="+id,null);}catch(Exception ignored){}});
        if(client!=null)resetCookies(this::finish);else finish();
    }
    @Override public void onBackPressed(){leave(true);}
    @Override protected void onDestroy(){
        handler.removeCallbacksAndMessages(null);
        if(owner){if(!exiting&&client!=null){network.execute(()->{try{client.request("DELETE","/api/login?id="+id,null);}catch(Exception ignored){}});resetCookies(()->occupied=false);}else occupied=false;}
        exiting=true;if(web!=null){web.stopLoading();web.destroy();}network.shutdown();super.onDestroy();
    }
}
