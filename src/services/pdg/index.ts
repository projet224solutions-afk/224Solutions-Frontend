/**
 * 🌐 SERVICES PDG - INDEX CENTRAL
 *
 * Point d'entrée pour tous les services de l'interface PDG
 */

export { pdgSyncService, default as PDGSyncService } from './PDGSyncService';

export type {
  SyncResult,
  DataConsistencyCheck
} from './PDGSyncService';
