/**
 * Type declarations for obfuscator.config.js
 */

export interface ObfuscatorOptions {
  compact?: boolean;
  controlFlowFlattening?: boolean;
  controlFlowFlatteningThreshold?: number;
  deadCodeInjection?: boolean;
  debugProtection?: boolean;
  disableConsoleOutput?: boolean;
  identifierNamesGenerator?: string;
  log?: boolean;
  numbersToExpressions?: boolean;
  renameGlobals?: boolean;
  selfDefending?: boolean;
  simplify?: boolean;
  splitStrings?: boolean;
  splitStringsChunkLength?: number;
  stringArray?: boolean;
  stringArrayCallsTransform?: boolean;
  stringArrayEncoding?: string[];
  stringArrayIndexShift?: boolean;
  stringArrayRotate?: boolean;
  stringArrayShuffle?: boolean;
  stringArrayWrappersCount?: number;
  stringArrayWrappersChainedCalls?: boolean;
  stringArrayWrappersType?: string;
  stringArrayThreshold?: number;
  transformObjectKeys?: boolean;
  unicodeEscapeSequence?: boolean;
  reservedNames?: string[];
  reservedStrings?: string[];
}

export interface ObfuscatorConfig {
  production: ObfuscatorOptions;
  staging: ObfuscatorOptions;
  development: ObfuscatorOptions;
}

export declare const obfuscatorConfig: ObfuscatorConfig;
export declare const excludePatterns: string[];
export default obfuscatorConfig;
