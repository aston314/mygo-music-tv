package dev.aston.mygo.music.tv;

import org.junit.Test;
import static org.junit.Assert.*;

public class UpdatePolicyTest {
    @Test public void checkThrottleAndClockChanges() {
        assertTrue(UpdatePolicy.automaticCheckDue(100, 0));
        assertFalse(UpdatePolicy.automaticCheckDue(1000, 100));
        assertTrue(UpdatePolicy.automaticCheckDue(1000, 2000));
        assertTrue(UpdatePolicy.automaticCheckDue(100 + UpdatePolicy.CHECK_INTERVAL, 100));
    }
    @Test public void builtInMirrorsAlwaysEndWithDirectSource() {
        assertArrayEquals(new String[]{
                        "https://gh-proxy.com/https://github.com/a",
                        "https://v4.gh-proxy.org/https://github.com/a",
                        "https://gh-proxy.org/https://github.com/a",
                        "https://ghfast.top/https://github.com/a",
                        "https://github.com/a"},
                UpdatePolicy.sources("https://github.com/a"));
    }
    @Test public void versionCodeAndCompleteSignerSetDecideInstall() {
        assertTrue(match(9, "0.2.10", new String[]{"A", "B"}, new String[]{"B", "A"}));
        assertFalse(match(8, "0.2.10", new String[]{"A"}, new String[]{"A"}));
        assertFalse(match(7, "0.2.10", new String[]{"A"}, new String[]{"A"}));
        assertFalse(match(9, "0.2.10", new String[]{"A"}, new String[]{"forged"}));
        assertFalse(match(9, "0.2.10", new String[0], new String[0]));
        assertFalse(UpdatePolicy.matchingArchive("app", 8, "other", 9, "0.2.10", 9, "0.2.10", new String[]{"A"}, new String[]{"A"}));
        assertFalse(UpdatePolicy.matchingArchive("app", 8, "app", 9, "0.2.9", 9, "0.2.10", new String[]{"A"}, new String[]{"A"}));
    }
    private boolean match(int code, String name, String[] left, String[] right) {
        return UpdatePolicy.matchingArchive("app", 8, "app", code, name, code, name, left, right);
    }
    @Test public void manifestRejectsForeignOrMutableDownloadTargets() {
        String url = "https://github.com/aston314/my-music-release/releases/download/v0.2.7/mygo-music-tv-0.2.7.apk";
        UpdatePolicy.validate("app", 9, "0.2.7", 23, 100, new String(new char[64]).replace('\0', 'a'), url, "app", 8, "0.2.6");
        for (String bad : new String[]{url.replace("github.com", "github.com.evil.test"), url.replace("download/v0.2.7", "latest/download"), url + "?token=x", url.replace("my-music-release", "private-source")}) {
            try { UpdatePolicy.validate("app", 9, "0.2.7", 23, 100, new String(new char[64]).replace('\0', 'a'), bad, "app", 8, "0.2.6"); fail(bad); }
            catch (IllegalArgumentException expected) { /* expected */ }
        }
    }
    @Test public void staleOrInconsistentMetadataNeverClaimsCurrentVersion() {
        String sha = new String(new char[64]).replace('\0', 'a');
        for (String name : new String[]{"0.2.6", "0.2.8"}) {
            String url = "https://github.com/aston314/my-music-release/releases/download/v" + name + "/mygo-music-tv-" + name + ".apk";
            try { UpdatePolicy.validate("app", name.equals("0.2.6") ? 8 : 9, name, 23, 100, sha, url, "app", 9, "0.2.7"); fail("stale metadata accepted"); }
            catch (IllegalArgumentException expected) { /* Try the next transport. */ }
        }
        String url = "https://github.com/aston314/my-music-release/releases/download/v0.2.7/mygo-music-tv-0.2.7.apk";
        UpdatePolicy.validate("app", 9, "0.2.7", 23, 100, sha, url, "app", 9, "0.2.7");
    }
}
