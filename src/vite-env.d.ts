/// <reference types="vite/client" />

/**
 * Polyfill type declarations for NodeJS globals used in browser code.
 */
declare namespace NodeJS {
  interface Timeout {}
  interface Timer {}
}

declare const process: {
  env: Record<string, string | undefined>;
};
