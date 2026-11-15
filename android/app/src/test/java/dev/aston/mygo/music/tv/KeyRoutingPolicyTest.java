package dev.aston.mygo.music.tv;

import org.junit.Test;
import static org.junit.Assert.*;

public final class KeyRoutingPolicyTest {
    @Test public void imeCanHandOffVerticalNavigationWithoutTakingTextKeys() {
        assertEquals("ArrowUp", KeyRoutingPolicy.direction(false,true,19));
        assertEquals("ArrowDown", KeyRoutingPolicy.direction(false,true,20));
        for (int key : new int[]{21,22,23,66,67,29}) assertNull(KeyRoutingPolicy.direction(false,true,key));
        assertNull(KeyRoutingPolicy.direction(false,false,19));
    }
    @Test public void readyPageUsesOneVerticalRouteWithoutTakingHorizontalOrActivationKeys() {
        assertEquals("ArrowUp", KeyRoutingPolicy.direction(true,false,19));
        assertEquals("ArrowDown", KeyRoutingPolicy.direction(true,false,20));
        for (int key : new int[]{21,22,23,66,67,29,4}) assertNull(KeyRoutingPolicy.direction(true,false,key));
        assertNull(KeyRoutingPolicy.direction(false,false,20));
    }
}
