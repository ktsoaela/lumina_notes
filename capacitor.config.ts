/**
 * Capacitor config for the Android (and future iOS) shell.
 * Build web assets first: `npm run build:mobile` then `npx cap sync`.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lumina.notes',
  appName: 'Lumina Notes',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // cleartext optional for LAN sync (http://192.168.x.x) — enable in Android network security if needed
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
