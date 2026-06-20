/**
 * Configuration d'obfuscation JavaScript pour Vista-Flows
 * 224Solutions - Protection du code propriétaire
 *
 * NIVEAUX DE PROTECTION:
 * - production: Obfuscation maximale (recommandé pour déploiement)
 * - staging: Obfuscation moyenne (pour tests)
 * - development: Désactivé
 */

export const obfuscatorConfig = {
  // === PRODUCTION - Protection Optimisée (équilibre sécurité/performance) ===
  production: {
    compact: true,
    controlFlowFlattening: false, // Désactivé pour économiser la mémoire
    deadCodeInjection: false, // Désactivé pour économiser la mémoire
    debugProtection: false, // Géré par antiDebug.ts côté runtime
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false, // Désactivé pour économiser la mémoire
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: false, // Désactivé pour économiser la mémoire
    stringArrayEncoding: ['base64'], // base64 au lieu de rc4 (moins gourmand)
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: false,
    stringArrayWrappersType: 'variable',
    stringArrayThreshold: 0.5, // Réduit à 50%
    transformObjectKeys: false, // Désactivé pour économiser la mémoire
    unicodeEscapeSequence: false,

    // Exclusions pour éviter les erreurs
    reservedNames: [
      '^React',
      '^useState',
      '^useEffect',
      '^useCallback',
      '^useMemo',
      '^useRef',
      '^useContext',
      '^createContext',
      '^supabase',
      '^firebase',
      '^stripe',
      '^mapbox',
      '^agora'
    ],
    reservedStrings: [
      'supabase',
      'firebase',
      'stripe',
      'mapbox',
      'agora',
      'anthropic'
    ]
  },

  // === STAGING - Protection Moyenne ===
  staging: {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.5,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,

    reservedNames: [
      '^React',
      '^use[A-Z]',
      '^supabase',
      '^firebase'
    ]
  },

  // === DEVELOPMENT - Désactivé ===
  development: {
    compact: false,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    renameGlobals: false,
    selfDefending: false,
    simplify: false,
    splitStrings: false,
    stringArray: false,
    transformObjectKeys: false,
    unicodeEscapeSequence: false
  }
};

// Exclure certains fichiers de l'obfuscation (service workers, workers)
export const excludePatterns = [
  '**/sw.js',
  '**/service-worker.js',
  '**/worker*.js',
  '**/workbox*.js',
  '**/*.worker.js'
];

export default obfuscatorConfig;
