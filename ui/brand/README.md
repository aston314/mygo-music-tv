# My Music+ artwork

SVG artwork supplied by the product owner in `files (5).zip`:

- `ic_launcher.svg`: rounded square app icon.
- `ic_launcher_round.svg`: circular app icon and startup artwork.
- `tv_banner.svg`: TV launcher banner, including the outlined wordmark.

The same SVG shapes are inlined in `ui/index.html` so the startup artwork is
available before JavaScript loads. The sidebar uses only the note/plus shapes
with `currentColor`; startup keeps the original red background and white mark.
The loading ring is separate from the artwork.

Android vector equivalents are in `android/app/src/main/res/drawable/`.
Keep their geometry aligned with these SVGs when changing the artwork.
