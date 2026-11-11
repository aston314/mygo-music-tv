package dev.aston.mygo.music.tv;

import org.junit.Test;
import static org.junit.Assert.*;

public final class KeyRoutingPolicyTest {
    @Test public void imeCanHandOffVerticalNavigationWithoutTakingTextKeys() {
        assertEquals("ArrowUp", KeyRoutingPolicy.editDirection(true, 19));
        assertEquals("ArrowDown", KeyRoutingPolicy.editDirection(true, 20));
        for (int key : new int[]{21,22,23,66,67,29}) assertNull(KeyRoutingPolicy.editDirection(true,key));
        assertNull(KeyRoutingPolicy.editDirection(false,19));
    }
}
