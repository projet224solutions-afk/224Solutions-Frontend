/**
 * Déclarations de types globales pour résoudre les erreurs TypeScript
 */

// Déclarations de modules pour les imports dynamiques
declare module '*.tsx' {
  const content: unknown;
  export default content;
}

declare module '*.ts' {
  const content: unknown;
  export default content;
}

// Type pour les imports meta avec variables d'environnement typées
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENVIRONMENT?: 'development' | 'production' | 'staging';
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_AGORA_APP_ID?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
  [key: string]: string | undefined;
}

interface _ImportMeta {
  readonly env: ImportMetaEnv;
}

// Interfaces pour les APIs de reconnaissance vocale
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

declare var _webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

// Extensions globales
declare global {
  interface Window {
    webkitSpeechRecognition: typeof webkitSpeechRecognition;
    SpeechRecognition: typeof SpeechRecognition;
  }
}

export {};
