/**
 * 🌍 Region Services - Export central
 */

export * from '@/config/regions';
export { regionService, default as RegionService } from './RegionService';
export { globalHealthService, default as GlobalHealthService } from './GlobalHealthService';

export type {
  HealthMetrics,
  HealthAlert,
} from './GlobalHealthService';
