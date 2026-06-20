/**
 * VENDOR CERTIFICATION TYPES v2.0
 * Types TypeScript pour le système de certification vendeur
 * ⚠️ KYC VALIDÉ OBLIGATOIRE pour certification
 * 224SOLUTIONS
 */

export type VendorCertificationStatus =
  | 'NON_CERTIFIE'
  | 'CERTIFIE'
  | 'SUSPENDU';

export interface VendorCertification {
  id: string;
  vendor_id: string;
  status: VendorCertificationStatus;
  verified_at: string | null;

  // ✅ KYC (OBLIGATOIRE pour certification)
  kyc_verified_at: string | null;
  kyc_status: string | null; // pending | verified | rejected

  // Historique
  last_status_change: string;

  // Notes
  internal_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function getCertificationStatusLabel(status: VendorCertificationStatus): string {
  switch (status) {
    case 'NON_CERTIFIE':
      return 'Non certifié';
    case 'CERTIFIE':
      return 'Certifié';
    case 'SUSPENDU':
      return 'Suspendu';
    default:
      return 'Inconnu';
  }
}

export const getCertificationStatusColor = (status: VendorCertificationStatus): string => {
  switch (status) {
    case 'NON_CERTIFIE':
      return 'gray';
    case 'CERTIFIE':
      return 'green';
    case 'SUSPENDU':
      return 'red';
    default:
      return 'gray';
  }
};

export const isCertified = (status: VendorCertificationStatus): boolean => {
  return status === 'CERTIFIE';
};
