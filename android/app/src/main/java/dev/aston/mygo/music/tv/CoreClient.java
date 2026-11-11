package dev.aston.mygo.music.tv;

import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Native transport talks only to this service's Go instance. */
final class CoreClient {
    final String base, token;
    CoreClient(String base, String token) { this.base = base; this.token = token; }
    JSONObject request(String method, String path, JSONObject body) throws Exception {
        if (!path.startsWith("/api/") && !path.equals("/health")) throw new IllegalArgumentException("local API only");
        HttpURLConnection c = (HttpURLConnection) new URL(base + path).openConnection();
        c.setConnectTimeout(3000); c.setReadTimeout(5000); c.setRequestMethod(method);
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Content-Type", "application/json");
        try {
            if (body != null) { c.setDoOutput(true); try (java.io.OutputStream out = c.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); } }
            if (c.getResponseCode() != 200) throw new java.io.IOException("Core HTTP " + c.getResponseCode());
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] bytes = new byte[8192]; int n;
                while ((n = in.read(bytes)) != -1) { if (out.size() + n > 2 * 1024 * 1024) throw new java.io.IOException("Response too large"); out.write(bytes, 0, n); }
                return new JSONObject(out.toString("UTF-8"));
            }
        } finally { c.disconnect(); }
    }
}
