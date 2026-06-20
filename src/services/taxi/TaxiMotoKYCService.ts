/**
 * SERVICE KYC TAXI MOTO - 224SOLUTIONS
 * Vérification des documents des chauffeurs
 */

import { supabase } from "@/integrations/supabase/client";
import { uploadToGCSDirect } from "@/lib/gcsUpload";

export interface KYCDocument {
  type: 'permis' | 'carte_identite' | 'assurance' | 'carte_grise';
  url: string;
  verified: boolean;
  verified_at?: string;
  verified_by?: string;
  rejection_reason?: string;
}

export interface KYCStatus {
  driver_id: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  documents: KYCDocument[];
  completion_percentage: number;
  can_work: boolean;
}

export class TaxiMotoKYCService {
  /**
   * Télécharger un document KYC
   */
  static async uploadDocument(
    driverId: string,
    documentType: KYCDocument['type'],
    file: File
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${documentType}_${Date.now()}.${fileExt}`;
      const contentType = file.type || 'application/octet-stream';

      // Upload via GCS (fallback Supabase kyc-documents)
      const uploadResult = await uploadToGCSDirect(file, 'kyc', fileName, contentType, driverId);

      if (!uploadResult.success || !uploadResult.publicUrl) {
        throw new Error(uploadResult.error || 'Échec upload document');
      }

      const urlData = { publicUrl: uploadResult.publicUrl };

      // Enregistrer dans la base
      await supabase
        .from('taxi_driver_documents' as any)
        .insert({
          driver_id: driverId,
          document_type: documentType,
          document_url: urlData.publicUrl,
          status: 'pending',
          uploaded_at: new Date().toISOString()
        });

      return {
        success: true,
        url: urlData.publicUrl
      };
    } catch (err: any) {
      console.error('[KYC] Upload error:', err);
      return {
        success: false,
        error: err.message || 'Erreur d\'upload'
      };
    }
  }

  /**
   * Obtenir le statut KYC d'un chauffeur
   */
  static async getKYCStatus(driverId: string): Promise<KYCStatus> {
    try {
      const { data: documents, error } = await supabase
        .from('taxi_driver_documents' as any)
        .select('*')
        .eq('driver_id', driverId);

      if (error) throw error;

      const requiredDocs = ['permis', 'carte_identite', 'assurance', 'carte_grise'];
      const uploadedTypes = new Set(documents?.map((d: any) => d.document_type) || []);

      const completionPercentage = Math.round(
        (uploadedTypes.size / requiredDocs.length) * 100
      );

      const allVerified = documents?.every((d: any) => d.status === 'approved') || false;
      const hasRejected = documents?.some((d: any) => d.status === 'rejected') || false;

      let status: KYCStatus['status'] = 'pending';
      if (allVerified && completionPercentage === 100) {
        status = 'approved';
      } else if (hasRejected) {
        status = 'rejected';
      } else if (documents && documents.length > 0) {
        status = 'in_review';
      }

      return {
        driver_id: driverId,
        status,
        documents: documents?.map((d: any) => ({
          type: d.document_type as KYCDocument['type'],
          url: d.document_url,
          verified: d.status === 'approved',
          verified_at: d.verified_at,
          verified_by: d.verified_by,
          rejection_reason: d.rejection_reason
        })) || [],
        completion_percentage: completionPercentage,
        can_work: status === 'approved'
      };
    } catch (err) {
      console.error('[KYC] Error fetching status:', err);
      return {
        driver_id: driverId,
        status: 'pending',
        documents: [],
        completion_percentage: 0,
        can_work: false
      };
    }
  }

  /**
   * Vérifier un document (admin/PDG seulement)
   */
  static async verifyDocument(
    documentId: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<boolean> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Non authentifié');

      const { error } = await supabase
        .from('taxi_driver_documents' as any)
        .update({
          status: approved ? 'approved' : 'rejected',
          verified_at: new Date().toISOString(),
          verified_by: user.user.id,
          rejection_reason: rejectionReason
        })
        .eq('id', documentId);

      if (error) throw error;

      // Si tous les documents sont approuvés, activer le chauffeur
      if (approved) {
        const { data: doc } = await supabase
          .from('taxi_driver_documents' as any)
          .select('driver_id')
          .eq('id', documentId)
          .single();

        if (doc) {
          const kycStatus = await this.getKYCStatus((doc as any).driver_id);
          if (kycStatus.can_work) {
            await supabase
              .from('taxi_drivers')
              .update({ can_work: true })
              .eq('id', (doc as any).driver_id);
          }
        }
      }

      return true;
    } catch (err) {
      console.error('[KYC] Verification error:', err);
      return false;
    }
  }

  /**
   * Obtenir tous les chauffeurs en attente de vérification (PDG)
   */
  static async getPendingVerifications(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('taxi_driver_documents' as any)
        .select(`
          *,
          taxi_drivers!inner (
            id,
            full_name,
            phone,
            email
          )
        `)
        .eq('status', 'pending')
        .order('uploaded_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[KYC] Error fetching pending:', err);
      return [];
    }
  }

  /**
   * Obtenir les statistiques KYC (PDG)
   */
  static async getKYCStats(): Promise<{
    pending: number;
    in_review: number;
    approved: number;
    rejected: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('taxi_driver_documents' as any)
        .select('status');

      if (error) throw error;

      const stats = {
        pending: 0,
        in_review: 0,
        approved: 0,
        rejected: 0
      };

      data?.forEach((doc: any) => {
        if (doc.status === 'pending') stats.pending++;
        else if (doc.status === 'approved') stats.approved++;
        else if (doc.status === 'rejected') stats.rejected++;
      });

      return stats;
    } catch (err) {
      console.error('[KYC] Error fetching stats:', err);
      return {
        pending: 0,
        in_review: 0,
        approved: 0,
        rejected: 0
      };
    }
  }
}
