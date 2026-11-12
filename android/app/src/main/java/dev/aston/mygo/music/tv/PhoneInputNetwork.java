package dev.aston.mygo.music.tv;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import java.net.Inet4Address;
import java.net.InetAddress;

/** LAN address hints only; Go owns the listener and all input capabilities. */
final class PhoneInputNetwork {
    private PhoneInputNetwork() { }
    static String address(Context context) {
        try {
            ConnectivityManager manager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (manager == null) return "";
            Network active = manager.getActiveNetwork();
            String result = address(manager,active);
            if (!result.isEmpty()) return result;
            for (Network network : manager.getAllNetworks()) {
                result = address(manager,network);
                if (!result.isEmpty()) return result;
            }
        } catch (Exception ignored) { }
        return "";
    }
    private static String address(ConnectivityManager manager, Network network) {
        if (network == null) return "";
        NetworkCapabilities capabilities = manager.getNetworkCapabilities(network);
        if (capabilities == null || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) ||
            !(capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))) return "";
        LinkProperties properties = manager.getLinkProperties(network);
        if (properties != null) for (LinkAddress link : properties.getLinkAddresses()) {
            InetAddress ip = link.getAddress();
            if (ip instanceof Inet4Address && (ip.isSiteLocalAddress() || ip.isLinkLocalAddress())) return ip.getHostAddress();
        }
        return "";
    }
}
