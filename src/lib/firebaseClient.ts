/**
 * FIREBASE CLIENT CONFIGURATION
 * Configuration du client Firebase pour Firestore
 * 224SOLUTIONS - Système dual Firestore + Supabase
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { supabase } from '@/integrations/supabase/client';

// Variables pour stocker les instances Firebase
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let isInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

// Fonction pour récupérer la configuration Firebase depuis l'edge function
async function fetchFirebaseConfig(): Promise<Record<string, string> | null> {
  try {
    const { data, error } = await supabase.functions.invoke('firebase-config');

    if (error || !data?.configured) {
      console.warn('⚠️ Configuration Firebase non disponible:', error?.message || 'Non configuré');
      return null;
    }

    return data;
  } catch (err) {
    console.warn('⚠️ Impossible de récupérer la config Firebase:', err);
    return null;
  }
}

// Fonction d'initialisation asynchrone de Firebase
async function initializeFirebase(): Promise<boolean> {
  if (isInitialized) return true;
  if (typeof window === 'undefined') return false;

  try {
    const config = await fetchFirebaseConfig();

    if (!config || !config.apiKey || !config.projectId) {
      console.warn('⚠️ Firebase: Configuration incomplète, fonctionnant en mode Supabase uniquement');
      return false;
    }

    // Initialiser Firebase avec la configuration récupérée
    if (!getApps().length) {
      app = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });
    } else {
      app = getApps()[0];
    }

    db = getFirestore(app);
    auth = getAuth(app);

    // Activer la persistance hors ligne de Firestore
    try {
      await enableIndexedDbPersistence(db);
    } catch (err: any) {
      if (err.code === 'failed-precondition') {
        console.warn('Persistance Firestore: plusieurs onglets ouverts');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistance Firestore: navigateur non supporté');
      }
    }

    isInitialized = true;
    console.log('✅ Firebase initialisé avec persistance hors ligne');
    return true;
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error);
    return false;
  }
}

// Ne PAS initialiser Firebase au chargement du module.
// L'initialisation est déclenchée à la demande via waitForFirebase().
// Cela évite de charger ~426KB de Firebase sur toutes les pages.

// Fonctions d'accès aux instances
export function getFirestoreInstance(): Firestore | null {
  return db;
}

export function getFirebaseAuthInstance(): Auth | null {
  return auth;
}

export function getFirebaseAppInstance(): FirebaseApp | null {
  return app;
}

export async function waitForFirebase(): Promise<boolean> {
  if (isInitialized) return true;
  if (!initializationPromise) {
    initializationPromise = initializeFirebase();
  }
  return await initializationPromise;
}

export function isFirebaseReady(): boolean {
  return isInitialized;
}

// Exports pour compatibilité avec le code existant
export { db as firestore, auth as firebaseAuth, app as firebaseApp };
export default db;
