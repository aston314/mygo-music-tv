package dev.aston.mygo.music.tv;

/** Editing state survives IME window-focus handoff; text keys stay with the editor. */
final class KeyRoutingPolicy {
    static String editDirection(boolean editing, int keyCode) {
        if (!editing) return null;
        if (keyCode == 19) return "ArrowUp";
        if (keyCode == 20) return "ArrowDown";
        return null;
    }
}
