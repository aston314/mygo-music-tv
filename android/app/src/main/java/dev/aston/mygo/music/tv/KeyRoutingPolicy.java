package dev.aston.mygo.music.tv;

/** Vertical TV navigation uses the page router; text and activation keys keep their native path. */
final class KeyRoutingPolicy {
    static String direction(boolean pageReady, boolean editing, int keyCode) {
        if (!pageReady && !editing) return null;
        if (keyCode == 19) return "ArrowUp";
        if (keyCode == 20) return "ArrowDown";
        return null;
    }
}
