import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solutions224.app',
  appName: '224Solutions',
  webDir: 'dist',
  server: {
    // URL du sandbox pour hot-reload en développement (commenter en production)
    // url: 'https://a00e0cf7-bf68-445f-848b-f2c774cf80ce.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    // Configuration Deep Links
    App: {
      // Universal Links (iOS) et App Links (Android)
      // Ces liens permettent d'ouvrir l'app depuis une URL web
    }
  },
  // Configuration Android pour Deep Links
  android: {
    // Permet les liens HTTP non sécurisés en dev
    allowMixedContent: true,
  },
  // Configuration iOS pour Deep Links
  ios: {
    // Scheme personnalisé pour deep links
    scheme: 'myapp'
  }
};

export default config;
