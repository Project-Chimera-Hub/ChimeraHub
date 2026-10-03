import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android wrapper for the whole site.
 *
 * Capacitor serves `www/` from a local origin inside the WebView, so the site
 * is built at BASE=/ for this — unlike the Pages build, which lives under
 * /ChimeraHub/ and has that written into it.
 *
 * `www/` is not checked in. tools/build-apk.sh builds the site and copies it
 * here, which is the whole reason a new version is one command: there is no
 * app source to update, only a directory to replace.
 *
 * Versions match the ones Syllogimous built its own APK with while it was
 * here, a toolchain that had been producing working APKs for a while.
 */
const config: CapacitorConfig = {
    // Kept from before the rename: a new id installs as a new app, with none
    // of the old one's saved history.
    appId: 'com.gagafutzi.mindbuild',
    appName: 'Chimera Hub',
    webDir: 'www',
    android: {
        /*
         * Nothing in the app talks to a network. The one thing that ever did
         * was the gate's heartbeat to 127.0.0.1, and that is gone from the hub.
         * So a cleartext exception would only widen what this is allowed to do.
         */
        allowMixedContent: false,
    },
};

export default config;
