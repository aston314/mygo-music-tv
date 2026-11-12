package dev.aston.mygo.music.tv;

import android.content.Context;
import android.app.AlertDialog;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import java.util.Locale;
import org.json.JSONObject;

/** Native paint cache; Go preferences are authoritative after the UI connects. */
final class Appearance {
    private Appearance() { }
    private static String value(Context context,String key,String fallback) { return context.getSharedPreferences("appearance",Context.MODE_PRIVATE).getString(key,fallback); }
    static boolean valid(String theme,String language) { return ("dark".equals(theme)||"light".equals(theme))&&("zh-CN".equals(language)||"zh-TW".equals(language)); }
    static void save(Context context,String theme,String language) { if(valid(theme,language))context.getSharedPreferences("appearance",Context.MODE_PRIVATE).edit().putString("theme",theme).putString("language",language).apply(); }
    static String json(Context context) { try { return new JSONObject().put("theme",light(context)?"light":"dark").put("language",value(context,"language","zh-CN")).toString(); } catch(Exception ignored) { return "{}"; } }
    static boolean light(Context context) { return !"dark".equals(value(context,"theme","light")); }
    static int background(Context context) { return light(context)?Color.rgb(248,248,250):Color.rgb(16,22,25); }
    static int foreground(Context context) { return light(context)?Color.rgb(229,50,75):Color.rgb(198,245,223); }
    static int muted(Context context) { return light(context)?Color.rgb(110,110,120):Color.rgb(135,148,145); }
    /** Apply after show so platform buttons exist; retain native Back/exit ownership. */
    static void styleExitDialog(Context context, AlertDialog dialog) {
        boolean light = light(context);
        float density = context.getResources().getDisplayMetrics().density;
        int surface = light ? Color.WHITE : Color.rgb(28,48,37);
        int text = light ? Color.rgb(29,29,31) : Color.rgb(231,240,236);
        int accent = light ? Color.rgb(229,50,75) : Color.rgb(183,245,215);
        GradientDrawable panel = new GradientDrawable(); panel.setColor(surface); panel.setCornerRadius(20*density);
        if (dialog.getWindow() != null) dialog.getWindow().setBackgroundDrawable(panel);
        TextView message = dialog.findViewById(android.R.id.message);
        if (message != null) message.setTextColor(text);
        int titleId = context.getResources().getIdentifier("alertTitle", "id", "android");
        TextView title = titleId == 0 ? null : dialog.findViewById(titleId);
        if (title != null) title.setTextColor(text);
        for (int which : new int[]{AlertDialog.BUTTON_NEGATIVE, AlertDialog.BUTTON_POSITIVE}) {
            Button button = dialog.getButton(which);
            if (button == null) continue;
            StateListDrawable background = new StateListDrawable();
            GradientDrawable focused = new GradientDrawable(); focused.setColor(accent); focused.setCornerRadius(26*density);
            GradientDrawable idle = new GradientDrawable(); idle.setColor(light ? Color.rgb(236,236,241) : Color.rgb(43,73,51)); idle.setCornerRadius(26*density);
            background.addState(new int[]{android.R.attr.state_focused}, focused);
            background.addState(new int[]{android.R.attr.state_pressed}, focused);
            background.addState(new int[]{}, idle);
            button.setBackground(background);
            int focusedText = light ? Color.WHITE : Color.rgb(22,48,36);
            button.setTextColor(new ColorStateList(new int[][]{new int[]{android.R.attr.state_focused},new int[]{android.R.attr.state_pressed},new int[]{}},new int[]{focusedText,focusedText,text}));
            button.setAllCaps(false); button.setTextSize(16); button.setMinHeight((int)(52*density));
            button.setPadding((int)(22*density),0,(int)(22*density),0);
            if (button.getLayoutParams() instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams)button.getLayoutParams();
                params.leftMargin = (int)(8*density); params.bottomMargin = (int)(8*density); button.setLayoutParams(params);
            }
        }
    }
    static String text(Context context,int resource) {
        Configuration config=new Configuration(context.getResources().getConfiguration());
        config.setLocale("zh-TW".equals(value(context,"language","zh-CN"))?Locale.TRADITIONAL_CHINESE:Locale.SIMPLIFIED_CHINESE);
        return context.createConfigurationContext(config).getString(resource);
    }
}
