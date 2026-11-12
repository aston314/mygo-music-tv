package dev.aston.mygo.music.tv;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.drawable.Drawable;
import android.os.SystemClock;
import android.view.View;

/** Draw the ring at the outer edge, independently of platform ProgressBar insets. */
final class StartupLogoView extends View {
    private final Paint ringPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Drawable logo;
    private int tint;
    private boolean loading = true;

    StartupLogoView(Context context) {
        super(context);
        logo = context.getDrawable(R.drawable.app_icon_round).mutate();
        ringPaint.setStyle(Paint.Style.STROKE);
        ringPaint.setStrokeCap(Paint.Cap.ROUND);
        ringPaint.setStrokeWidth(2 * getResources().getDisplayMetrics().density);
        setTintColor(Appearance.foreground(context));
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    void setTintColor(int color) {
        tint = color;
        invalidate();
    }

    void setLoading(boolean value) { loading = value; invalidate(); }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float size = Math.min(getWidth(), getHeight());
        float cx = getWidth() / 2f, cy = getHeight() / 2f;
        float radius = size / 2f - ringPaint.getStrokeWidth();
        if (loading) {
            ringPaint.setColor(Color.argb(38, Color.red(tint), Color.green(tint), Color.blue(tint)));
            canvas.drawCircle(cx, cy, radius, ringPaint);
            ringPaint.setColor(tint);
            float angle = (SystemClock.uptimeMillis() % 1500) * 360f / 1500 - 90;
            canvas.drawArc(cx-radius, cy-radius, cx+radius, cy+radius, angle, 90, false, ringPaint);
        }
        // The circular brand stays red and white; only the outer ring is tinted.
        // Match the WebView's 78/126 diameter and leave clear space around it.
        int half = Math.round(size * 78f / 126f / 2f);
        logo.setBounds(Math.round(cx)-half, Math.round(cy)-half, Math.round(cx)+half, Math.round(cy)+half);
        logo.draw(canvas);
        if (loading && isShown()) postInvalidateOnAnimation();
    }
}
