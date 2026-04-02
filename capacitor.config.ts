import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mynotion.app',
  appName: 'My Notion',
  webDir: 'dist/My-Notion/browser',
  server: {
    androidScheme: 'https'
  }
};

export default config;
