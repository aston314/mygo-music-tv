# SHIELD device verification — 2026-11-11

## Installed build

- Private prerelease: [v0.1.1](https://github.com/aston314/mygo-music-tv/releases/tag/v0.1.1), versionCode 2, commit `870c6ab`.
- Downloaded the signed Release APK, verified it against the published checksums, and installed it over v0.1.0 with ADB. Existing source/account data remained available.
- Hardware: NVIDIA SHIELD Android TV, Android 11, Google Android WebView 120.0.6099.230.
- `wm size`: physical 3840×2160, override 1920×1080. `wm density`: 320.
- Device screenshots use 3840×2160 output pixels; accessibility/input coordinates use 1920×1080. These are distinct from WebView CSS coordinates.

## Findings and fixes included in v0.1.1

The first signed build cropped the right and bottom edges. Mobile browser
emulation reproduced the cause: the visible root client area was 960×540, but
`innerWidth/innerHeight` reported 1280×720 because of the unscaled canvas's
overflow. The original formula incorrectly selected scale 1.

The app now reads `document.documentElement.clientWidth/clientHeight`, with
window inner dimensions as a fallback. The stage, focus-direction tolerances
and scroll-to-focus helpers use the same scale calculation. The installed
v0.1.1 displayed the complete main page, market, settings, playback controls,
queue dialog and fullscreen lyrics on the SHIELD.

Version 0.1.1 uses one 1280×720 design. Scaling is continuous for the actual
available viewport, without per-resolution branches. That release fits and
centers the canvas:

```text
s = min(visibleWidth / 1280, visibleHeight / 720)
left = (visibleWidth - 1280 * s) / 2
top = (visibleHeight - 720 * s) / 2
```

Initial source-directory refresh also encountered an upstream TLS timeout on
the television. v0.1.1 includes the official 62-entry directory snapshot and
refreshes it in the background, retaining usable entries after a failed refresh.
The complete directory was visible in the installed build.

## Hardware observations

| Check | Observation |
| --- | --- |
| Installation | Signed v0.1.1 covered v0.1.0 successfully; package versionCode 2 confirmed. |
| Layout | Right/bottom controls visible; queue dialog centered and fully inside the screen. |
| Account visibility | Existing account retained; market/settings omit the header account control. |
| Source directory | 62 entries, installed/uninstalled badges, clean descriptions without trailing install/GitHub actions. |
| Playback | Native Media3 session reported state 3, speed 1, no error for a real online song; native positions advanced. This is player evidence, not an assessment of audible sound quality. |
| Pause and seek | Pause reported native state 2/speed 0. D-pad Down reached the seek control; Right changed the native position while paused, without opening a dialog. |
| Queue | Current song had a distinct colored row and play indicator, separate from the first row's focus ring. Opening the queue focused a list item. |
| Fullscreen lyrics | Entering hid the cover and expanded lyrics; the button changed to exit-fullscreen state. Back restored the cover and left-side controls. |
| Background/foreground | Home left native playback running: the same session PID advanced from position 88703 to 124676. Bringing the Activity forward reused it; final playback state was paused. |
| Remote boundary | From the bottom cover, Left reached the nearest visible sidebar item (Settings); Down reached the cover and Up returned to Settings. |

One selected NetEase song returned upstream error `-460`; the app displayed
the failure. Another song in the same installed source produced the successful
native playback observations above. This does not establish universal song or
plugin availability.

Local evidence is stored under ignored `build/tv-qa/`, including
`05-v011-launch.png`, `07-v011-market.png`, `08-v011-settings.png`,
`10-v011-queue.png`, and `11-v011-fullscreen.png`. Account values, cookies and
media URLs are intentionally omitted from this report.

## Browser and reusable adaptation checks

A browser follow-up found that fitting a locked 16:9 rectangle left large bands
in the user's 928×696 preview. The current source now keeps 1280×720 as its
minimum design size and extends the logical stage along the surplus axis:

```text
s = min(visibleWidth / 1280, visibleHeight / 720)
stageWidth = visibleWidth / s
stageHeight = visibleHeight / s
left = top = 0
```

This preserves uniform scaling while filling the available window. At 928×696,
the logical stage is 1280×960; at 1280×800, it is 1280×800. The 16:9 television
layout is unchanged. This follow-up is in source/browser preview; it is not part
of the already published v0.1.1 APK.

A separate real-data preview passed stage/player bounds checks in 11 contexts:
928×696, 1920×800, 960×540, 1280×720, 1366×768, 1600×900, 1920×1080 and
1280×800 desktop windows, plus Android-like mobile contexts at the three
standard 16:9 sizes with DPR 2. Each rendered stage filled the complete viewport.
A real directory detail dialog stayed fully inside the 1280×720 viewport.

The reusable skill's standalone ES5 implementation passed 12 contexts with
three initial/resize checks each: desktop/mobile, DPR 1/2/3 and non-16:9 sizes.
The pre-scale mobile reproduction measured inner 1280×720 versus client 960×540.
The personal `android-tv-go-webview` skill now requires viewport setup before
feature pages, mobile-context and non-16:9 regression checks, window filling by
stage expansion, and a shared scale for render, focus, scrolling and native-bound
conversion. Its schema and reference links were validated. The app's targeted
appearance, focus and viewport regression suite passed 36 tests after the
window-filling change.

[Lampa CSS](https://raw.githubusercontent.com/yumata/lampa/refs/heads/main/css/app.css)
uses `em` extensively; its
[application bundle](https://raw.githubusercontent.com/yumata/lampa/main/app.min.js)
adjusts body font size with viewport width and interface-size preferences,
alongside breakpoint layouts. This differs from MyGo's fixed design canvas.
The reusable principle is a consistent scaling system, rather than copying
Lampa's sizing strategy into this product.

## Limits

Only this SHIELD/Android 11/WebView 120 combination received physical-device
verification. Android 6 compatibility still needs hardware evidence. Browser
mobile emulation is not an old-WebView test. New account authorization,
favorite/comment/playlist writes, a new plugin installation/update, long-run
stability, and network-loss recovery were not exercised in this device pass.
