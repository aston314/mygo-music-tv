# My Music+ artwork

SVG artwork supplied by the product owner in `files (5).zip`:

- `ic_launcher.svg`: rounded square app icon.
- `ic_launcher_round.svg`: circular app icon and startup artwork.
- `tv_banner.svg`: TV launcher banner, including the outlined wordmark.

The same SVG shapes are inlined in `ui/index.html` so the startup artwork is
available before JavaScript loads. The sidebar uses only the note/plus shapes
with `currentColor`; startup keeps the original red background and white mark.
Startup separates the note and plus: the circle and note stay still while the
plus turns clockwise around its own center once every three seconds. There is
no outer loading ring. The plus returns upright on an error, restarts on retry,
and stops when the initial UI is ready. Launcher and sidebar artwork stay static.

Android vector equivalents are in `android/app/src/main/res/drawable/`.
`startup_logo_base.xml` contains the static circle and note; `StartupLogoView`
draws the rotating plus using the same SVG coordinates and group transform.
Keep their geometry aligned with these SVGs when changing the artwork.
