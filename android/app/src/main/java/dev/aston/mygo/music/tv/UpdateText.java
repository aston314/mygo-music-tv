package dev.aston.mygo.music.tv;

import android.content.Context;
import android.content.res.Configuration;
import java.util.Arrays;
import java.util.Locale;

/** Native update messages use the same saved language as the Web UI. */
final class UpdateText {
    private static String[][] phrases;
    static synchronized String get(Context context, String value) {
        if (!"zh-TW".equals(context.getSharedPreferences("appearance", Context.MODE_PRIVATE)
                .getString("language", "zh-CN"))) return value;
        if (phrases == null) {
            Configuration config = new Configuration(context.getResources().getConfiguration());
            config.setLocale(Locale.SIMPLIFIED_CHINESE);
            String[] source = context.createConfigurationContext(config).getResources().getStringArray(R.array.update_messages);
            config.setLocale(Locale.TRADITIONAL_CHINESE);
            String[] target = context.createConfigurationContext(config).getResources().getStringArray(R.array.update_messages);
            phrases = new String[source.length][2];
            for (int i=0; i<source.length; i++) phrases[i] = new String[]{source[i], target[i]};
            Arrays.sort(phrases, (a,b) -> Integer.compare(b[0].length(), a[0].length()));
        }
        for (String[] phrase : phrases) value = value.replace(phrase[0], phrase[1]);
        return value;
    }
}
