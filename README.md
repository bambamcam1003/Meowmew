# Dotwise

A logic puzzle with a dark theme. Place one dot in every row, column and coloured
region. Dots cannot touch, even diagonally. Every generated puzzle has exactly one
solution (checked by the solver in `web/puzzle.js`).

## Play on Android
Download `releases/Dotwise.apk` on your phone, open it, and allow
"install unknown apps" for your browser/file manager when Android asks.

## Play in a browser
Open `web/index.html`. No build step.

## Rebuild the APK
Needs JDK 17+ and the Android SDK (platform 35):

    cd android
    ./gradlew assembleRelease
    # output: android/app/build/outputs/apk/release/app-release.apk

The Android app is a tiny WebView wrapper; the game itself is the `web/` folder,
bundled into the APK so it works offline.
