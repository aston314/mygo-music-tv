package dev.aston.mygo.music.tv;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

/** Pure policy shared by both WebView navigation overloads and unit tests. */
final class BrowserLoginPolicy {
    private BrowserLoginPolicy() { }
    static boolean securePage(String value) {
        try {
            URI u = new URI(value); String h = u.getHost();
            if (!"https".equalsIgnoreCase(u.getScheme()) || h == null || u.getUserInfo() != null) return false;
            h = h.toLowerCase(java.util.Locale.ROOT);
            return !h.equals("localhost") && !h.endsWith(".localhost") && !h.contains(":") && !h.matches("[0-9.]+") && !h.endsWith(".local");
        } catch (Exception ignored) { return false; }
    }
    static boolean callback(String value, String expected) {
        try {
            URI u = new URI(value), e = new URI(expected);
            return "http".equals(u.getScheme()) && "127.0.0.1".equals(u.getHost()) && u.getUserInfo() == null
                && u.getPort() == e.getPort() && u.getPath().equals(e.getPath()) && u.getRawQuery() != null;
        } catch (Exception ignored) { return false; }
    }
    static boolean allowed(String value, String expected) { return securePage(value) || callback(value, expected); }
    static boolean complete(String cookies, String[] required) {
        if (cookies == null || cookies.length() > 65536 || cookies.indexOf('\r') >= 0 || cookies.indexOf('\n') >= 0 || required.length == 0) return false;
        Map<String,String> found = new HashMap<>();
        for (String part : cookies.split(";")) { int at=part.indexOf('='); if(at>0) found.put(part.substring(0,at).trim(),part.substring(at+1).trim()); }
        for(String key:required) if(!found.containsKey(key)||found.get(key).isEmpty()) return false;
        return true;
    }
}
