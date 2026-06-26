import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import obfuscatorPlugin from "rollup-plugin-obfuscator";
// @ts-ignore - JS config file
import { obfuscatorConfig, excludePatterns } from "./obfuscator.config.js";
import { buildInfoPlugin } from "./vite-plugins/buildInfo";

// Fonction de chunking partagée
function getManualChunks(id: string) {
  // Vendor dependencies - OPTIMISÉ POUR RÉDUIRE TBT
  if (id.includes('node_modules')) {
    // Core React - séparer pour cache optimal
    if (id.includes('react-dom')) return 'vendor-react-dom';
    if (id.includes('react-router')) return 'vendor-router';
    if (id.includes('/react/') || id.includes('\\react\\')) return 'vendor-react';

    // UI Libraries - SÉPARER RADIX PAR COMPOSANT (lazy load)
    if (id.includes('@radix-ui')) {
      if (id.includes('dialog')) return 'ui-dialog';
      if (id.includes('dropdown')) return 'ui-dropdown';
      if (id.includes('select')) return 'ui-select';
      if (id.includes('popover')) return 'ui-popover';
      if (id.includes('accordion')) return 'ui-accordion';
      return 'ui-radix-common';
    }

    // Icônes - lazy load
    if (id.includes('lucide-react')) return 'vendor-icons';

    // Animations - SÉPARÉ (lourd, 681ms TBT)
    if (id.includes('framer-motion')) return 'vendor-motion';

    // Backend - CRITIQUE mais peut être différé
    if (id.includes('@supabase')) return 'vendor-supabase';
    if (id.includes('@tanstack')) return 'vendor-tanstack';

    // Stripe - LAZY LOAD (seulement pages paiement)
    if (id.includes('@stripe')) return 'vendor-stripe';

    // Charts (recharts + d3 + victory-vendor) : NE PAS isoler — les séparer de leurs
    // dépendances crée une dépendance circulaire entre chunks → TDZ au démarrage
    // (« Cannot access 'C' before initialization ») qui empêche React de monter.
    // On les laisse dans vendor-misc avec leur écosystème (cycle intra-chunk = OK).

    // Forms - utilisé partout
    if (id.match(/react-hook-form|@hookform|zod/)) return 'vendor-forms';

    // PDF - LAZY LOAD (utilisé rarement)
    if (id.match(/jspdf|html2canvas|qrcode/)) return 'vendor-pdf';

    // Maps - LAZY LOAD
    if (id.includes('mapbox')) return 'vendor-maps';

    // Agora - LAZY LOAD (communication)
    if (id.includes('agora')) return 'vendor-agora';

    // Firebase - utilisé partout
    if (id.includes('firebase')) return 'vendor-firebase';

    // Utilities - petit, garder ensemble
    if (id.match(/date-fns|clsx|tailwind-merge|class-variance/)) return 'vendor-utils';

    // Node_modules restants
    return 'vendor-misc';
  }

  // Code APPLICATIF (src/) : on NE force PLUS de chunks manuels.
  // Le découpage manuel par feature (comp-ui, comp-pdg, page-*, hooks…) créait des
  // dépendances circulaires ENTRE chunks → erreurs runtime au démarrage
  // (« Cannot read properties of undefined (reading 'displayName') ») empêchant
  // React de monter. On laisse Vite/Rollup découper automatiquement (dépendance-aware,
  // + chunks de route via les import() dynamiques existants) → cycles intra-chunk = OK.
  return undefined;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    // Base URL absolue pour le déploiement Vercel
    base: '/',
    server: {
      host: "::",
      port: 8080,
      strictPort: false,
      open: false,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/edge-functions': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      host: true,
    },
    plugins: [
      react(),
      buildInfoPlugin(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      // Prévenir les instances React dupliquées - FIX pour "Cannot read properties of null"
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    optimizeDeps: {
      include: ["@tanstack/react-query", "react", "react-dom"],
      exclude: [],
    },
    build: {
      rollupOptions: {
        output: {
          // Nomme les chunks de langue pour le debug : assets/locale-fr-[hash].js, etc.
          // (chaque src/i18n/locales/{code}.ts devient un chunk chargé à la volée).
          chunkFileNames: (chunkInfo) => {
            if (chunkInfo.facadeModuleId?.includes('/i18n/locales/')) {
              return 'assets/locale-[name]-[hash].js';
            }
            return 'assets/[name]-[hash].js';
          },
          // manualChunks DÉSACTIVÉ : le découpage manuel (vendors + code app) créait des
          // dépendances circulaires ENTRE chunks → erreurs runtime au démarrage empêchant
          // React de monter (TDZ « before initialization », « Class extends undefined »,
          // « reading 'displayName' »). On laisse Vite/Rollup découper automatiquement
          // (dépendance-aware + chunks de route via import() dynamiques) → app stable.
          // (getManualChunks conservé pour référence ; optimisation du chunking à revoir.)
        },
        // Obfuscation avancée uniquement avec OBFUSCATE=true
        // Usage: OBFUSCATE=true npm run build
        plugins: (isProduction && process.env.OBFUSCATE === 'true') ? [
          obfuscatorPlugin({
            options: obfuscatorConfig.production as any,
            exclude: excludePatterns
          })
        ] : []
      },
      chunkSizeWarningLimit: 1000,
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
          passes: 2
        },
        mangle: {
          safari10: true,
          properties: {
            regex: /^_private_/
          }
        }
      }
    }
  };
});
