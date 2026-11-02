import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android app = native shell around the deployed web app.
 * The app needs its server (API routes keep the Claude key secret), so the shell loads
 * APP_URL. android-shell/ is only the offline fallback page.
 */
const config: CapacitorConfig = {
  appId: "app.smartpantry.kitchen",
  appName: "Smart Pantry",
  webDir: "android-shell",
  server: {
    url: process.env.APP_URL || "https://your-smart-pantry.vercel.app",
    androidScheme: "https",
    errorPath: "index.html",
  },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#15803d", showSpinner: false },
    StatusBar: { backgroundColor: "#15803d", style: "DARK" },
  },
};
export default config;
