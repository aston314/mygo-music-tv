package dev.aston.mygo.music.tv;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.drawable.Drawable;
import android.os.SystemClock;
import android.view.View;

/** Keep the circular brand and note still; rotate only the plus around its center. */
final class StartupLogoView extends View {
    private static final long TURN_MILLIS = 3000;
    private final Paint plusPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Drawable logo;
    private boolean loading = true;

    StartupLogoView(Context context) {
        super(context);
        logo = context.getDrawable(R.drawable.startup_logo_base).mutate();
        plusPaint.setColor(Color.WHITE);
        plusPaint.setStyle(Paint.Style.STROKE);
        plusPaint.setStrokeCap(Paint.Cap.ROUND);
        plusPaint.setStrokeWidth(7.5f);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    void setLoading(boolean value) { loading = value; invalidate(); }

    @Override protected void onWindowVisibilityChanged(int visibility) {
        super.onWindowVisibilityChanged(visibility);
        if (visibility == VISIBLE) invalidate();
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float size = Math.min(getWidth(), getHeight());
        float cx = getWidth() / 2f, cy = getHeight() / 2f;
        // Preserve the WebView's 78/126 artwork-to-slot ratio.
        int half = Math.round(size * 78f / 126f / 2f);
        int left = Math.round(cx)-half, top = Math.round(cy)-half;
        logo.setBounds(left, top, left+half*2, top+half*2);
        logo.draw(canvas);
        canvas.save();
        canvas.translate(left, top);
        canvas.scale(half*2f/108f, half*2f/108f);
        // These are the original SVG group's transform and plus coordinates.
        canvas.translate(-0.53f, 7.83f);
        canvas.scale(0.95f, 0.95f);
        float angle = loading ? (SystemClock.uptimeMillis() % TURN_MILLIS) * 360f / TURN_MILLIS : 0;
        canvas.rotate(angle, 72, 32);
        canvas.drawLine(59, 32, 85, 32, plusPaint);
        canvas.drawLine(72, 19, 72, 45, plusPaint);
        canvas.restore();
        if (loading && isShown() && getWindowVisibility() == VISIBLE) postInvalidateOnAnimation();
    }
}
