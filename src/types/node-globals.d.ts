/**
 * Polyfill type declarations for NodeJS globals used in browser code.
 * This avoids needing @types/node which can conflict with DOM types.
 */

// NodeJS.Timeout is returned by setTimeout/setInterval in many TS configs
declare namespace NodeJS {
  interface Timeout {}
  interface Timer {}
}

// process.env used in some modules
declare const process: {
  env: Record<string, string | undefined>;
};
