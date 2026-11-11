package dev.aston.mygo.music.tv;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import java.util.Locale;
import org.json.JSONObject;

/** Native paint cache; Go preferences are authoritative after the UI connects. */
final class Appearance {
    private Appearance() { }
    private static String value(Context context,String key,String fallback) { return context.getSharedPreferences("appearance",Context.MODE_PRIVATE).getString(key,fallback); }
    static boolean valid(String theme,String language) { return ("dark".equals(theme)||"light".equals(theme))&&("zh-CN".equals(language)||"zh-TW".equals(language)); }
    static void save(Context context,String theme,String language) { if(valid(theme,language))context.getSharedPreferences("appearance",Context.MODE_PRIVATE).edit().putString("theme",theme).putString("language",language).apply(); }
    static String json(Context context) { try { return new JSONObject().put("theme",value(context,"theme","dark")).put("language",value(context,"language","zh-CN")).toString(); } catch(Exception ignored) { return "{}"; } }
    static boolean light(Context context) { return "light".equals(value(context,"theme","dark")); }
    static int background(Context context) { return light(context)?Color.rgb(248,248,250):Color.rgb(16,22,25); }
    static int foreground(Context context) { return light(context)?Color.rgb(230,75,96):Color.rgb(198,245,223); }
    static int muted(Context context) { return light(context)?Color.rgb(119,119,125):Color.rgb(135,148,145); }
    static String text(Context context,int resource) {
        Configuration config=new Configuration(context.getResources().getConfiguration());
        config.setLocale("zh-TW".equals(value(context,"language","zh-CN"))?Locale.TRADITIONAL_CHINESE:Locale.SIMPLIFIED_CHINESE);
        return context.createConfigurationContext(config).getString(resource);
    }
}
