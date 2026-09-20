import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android wrapper for the whole site.
 *
 * Capacitor serves `www/` from a local origin inside the WebView, so the site
 * is built at BASE=/ for this — unlike the Pages build, which lives under
 * /mindbuild/ and has that written into it.
 *
 * `www/` is not checked in. tools/build-apk.sh builds the site and copies it
 * here, which is the whole reason a new version is one command: there is no
 * app source to update, only a directory to replace.
 *
 * Versions match apps/syllogimous, which has been producing an APK from this
 * same toolchain for a while. Two Capacitor majors in one repository is a
 * problem nobody needs.
 */
const config: CapacitorConfig = {
    appId: 'com.gagafutzi.mindbuild',
    appName: 'mindbuild',
    webDir: 'www',
    android: {
        /*
         * Nothing in the app talks to a network. The one thing that ever did
         * was the gate's heartbeat to 127.0.0.1, and the APK is built from the
         * gate-free hub — on a phone there is no daemon to answer it and no
         * screen for it to hold. So a cleartext exception would only widen
         * what this is allowed to do.
         */
        allowMixedContent: false,
    },
};

export default config;
