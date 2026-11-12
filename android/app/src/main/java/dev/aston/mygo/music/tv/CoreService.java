package dev.aston.mygo.music.tv;

import android.app.*;
import android.content.*;
import android.os.*;
import androidx.media3.common.*;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import org.json.*;
import java.io.*;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.concurrent.*;

/** One foreground owner for core supervision and native background audio. */
public final class CoreService extends Service {
    static final String CHANNEL = "mygo-playback";
    static final String STATUS = "dev.aston.mygo.music.tv.CORE_STATUS";
    private static volatile CoreService current;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ScheduledExecutorService network = Executors.newSingleThreadScheduledExecutor();
    private java.lang.Process core;
    private volatile CoreClient client;
    private ExoPlayer player;
    private MediaSession session;
    private volatile boolean stopped;
    private String base, media = "";
    private String notificationTrack;
    private volatile int errorResource;
    private long generation = -1, seekRevision = -1, lastEventAt;
    private boolean applying;
    static CoreService get() { return current; }
    CoreClient loginClient() { return client; }
    String pageURL() { return client == null ? null : base + "/?token=" + client.token; }
    String error() { return errorResource == 0 ? null : Appearance.text(this,errorResource); }

    @Override public void onCreate() {
        super.onCreate(); current = this; startForeground(1, notification(Appearance.text(this,R.string.service_starting)));
        player = new ExoPlayer.Builder(this).build();
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true);
        player.setHandleAudioBecomingNoisy(true);
        player.setWakeMode(C.WAKE_MODE_LOCAL);
        session = new MediaSession.Builder(this, player).build();
        player.addListener(new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean playing) { if (!applying && generation >= 0) event(playing ? "playing" : "paused"); }
            @Override public void onPlayWhenReadyChanged(boolean ready, int reason) {
                if (!applying && client != null && !stopped) network.execute(() -> { try { client.request("POST", "/api/player/control", new JSONObject().put("action", ready ? "resume" : "pause")); } catch (Exception ignored) { } });
            }
            @Override public void onPlaybackStateChanged(int state) {
                if (applying || generation < 0) return;
                if (state == Player.STATE_BUFFERING) event("buffering");
                if (state == Player.STATE_ENDED) event("ended");
            }
            @Override public void onPlayerError(PlaybackException e) { event("failed"); }
        });
        network.execute(this::startCore);
    }
    private Notification notification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CHANNEL, Appearance.text(this,R.string.playback_channel), NotificationManager.IMPORTANCE_LOW));
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        return b.setSmallIcon(android.R.drawable.ic_media_play).setContentTitle(getString(R.string.app_name)).setContentText(text).setContentIntent(pi).setOngoing(true).build();
    }
    void cancelPhoneInput(long before) {
        if(stopped||client==null)return;
        try { network.execute(()->{try { if(client!=null)client.request("DELETE","/api/input-session?before="+before,null); } catch(Exception ignored) { }}); } catch(RejectedExecutionException ignored) { }
    }
    void refreshAppearance() {
        if(stopped)return;
        startForeground(1,notification(notificationTrack==null?Appearance.text(this,R.string.playing_music):notificationTrack));
    }
    private void startCore() {
        File ready = new File(getFilesDir(), "core-ready.json");
        try {
            if (ready.exists() && !ready.delete()) throw new IOException("Cannot reset readiness");
            File executable = new File(getApplicationInfo().nativeLibraryDir, "libmygocore.so");
            if (!executable.canExecute()) throw new IOException("Missing Go core for this ABI");
            int port; try (ServerSocket socket = new ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))) { port = socket.getLocalPort(); }
            byte[] random = new byte[24]; new SecureRandom().nextBytes(random); StringBuilder token = new StringBuilder(); for (byte b : random) token.append(String.format("%02x", b));
            ProcessBuilder pb = new ProcessBuilder(executable.getAbsolutePath(), "-port", String.valueOf(port), "-data-dir", new File(getFilesDir(), "music").getAbsolutePath(), "-parent-pid", String.valueOf(android.os.Process.myPid()), "-ready-file", ready.getAbsolutePath());
            pb.environment().put("MYGO_INSTANCE_TOKEN", token.toString());
            pb.redirectErrorStream(true); core = pb.start();
            // Drain output without persisting credentials or upstream media URLs.
            final InputStream log = core.getInputStream(); new Thread(() -> { try { byte[] b = new byte[4096]; while (log.read(b) >= 0) { } } catch (IOException ignored) { } }, "core-output").start();
            long deadline = System.currentTimeMillis() + 30000;
            CoreClient pending = new CoreClient("http://127.0.0.1:" + port, token.toString());
            while (!stopped && System.currentTimeMillis() < deadline) {
                if (ready.isFile()) { try { JSONObject health = pending.request("GET", "/health", null); if (health.optBoolean("ready")) { base = pending.base; client = pending; announce(); network.scheduleWithFixedDelay(this::poll, 0, 750, TimeUnit.MILLISECONDS); return; } } catch (Exception ignored) { } }
                Thread.sleep(120);
            }
            if (!stopped) throw new IOException("Core readiness timed out");
        } catch (Exception e) { if (!stopped) { errorResource = R.string.service_failed; announce(); if (core != null) core.destroy(); } }
    }
    private void announce() { sendBroadcast(new Intent(STATUS).setPackage(getPackageName())); }
    private void poll() {
        if (stopped || client == null) return;
        try { JSONObject state = client.request("GET", "/api/player", null); main.post(() -> apply(state)); }
        catch (Exception e) { errorResource = R.string.service_disconnected; announce(); }
    }
    private void apply(JSONObject s) {
        if (stopped) return;
        long gen = s.optLong("generation"), seek = s.optLong("seekRevision"); String path = s.optString("media");
        applying = true;
        try {
            if (gen != generation) { generation = gen; seekRevision = -1; player.stop(); player.clearMediaItems(); media = ""; }
            if (!path.isEmpty() && !path.equals(media)) {
                if (!path.matches("/media/[a-f0-9]{48}")) return;
                media = path;
                JSONArray queue = s.optJSONArray("queue"); JSONObject t = queue == null ? null : queue.optJSONObject(s.optInt("index"));
                MediaMetadata meta = new MediaMetadata.Builder().setTitle(t == null ? getString(R.string.app_name) : t.optString("name")).build();
                player.setMediaItem(new MediaItem.Builder().setUri(base + path).setMediaId(String.valueOf(gen)).setMediaMetadata(meta).build()); player.prepare();
                notificationTrack=t==null?null:t.optString("name");refreshAppearance();
            }
            if (!media.isEmpty() && seek != seekRevision) { seekRevision = seek; player.seekTo(s.optLong("position")); }
            if (s.optString("state").equals("idle")) { player.stop(); media = ""; }
            else if (!media.isEmpty()) player.setPlayWhenReady(s.optBoolean("wantPlay"));
        } finally { applying = false; }
        if (player.isPlaying() && System.currentTimeMillis() - lastEventAt > 1500) { lastEventAt = System.currentTimeMillis(); event("playing"); }
    }
    private void event(String state) {
        final long gen = generation, seek = seekRevision, position = player.getCurrentPosition(), duration = Math.max(0, player.getDuration());
        if (client == null || gen < 0 || stopped) return;
        network.execute(() -> { try { JSONObject e = new JSONObject().put("generation", gen).put("seekRevision", seek).put("state", state).put("position", position).put("duration", duration); client.request("POST", "/api/player/event", e); } catch (Exception ignored) { } });
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) { return START_NOT_STICKY; }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onTaskRemoved(Intent rootIntent) { stopSelf(); super.onTaskRemoved(rootIntent); }
    @Override public void onDestroy() {
        stopped = true; current = null; main.removeCallbacksAndMessages(null); network.shutdownNow();
        if (session != null) session.release(); if (player != null) player.release(); if (core != null) core.destroy();
        new File(getFilesDir(), "core-ready.json").delete(); stopForeground(true); super.onDestroy();
    }
}
