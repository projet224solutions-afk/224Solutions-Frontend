/**
 * VENDOR CERTIFICATION MANAGER
 * Interface PDG pour gérer les certifications vendeurs
 * Accès: CEO et SUPER_ADMIN uniquement
 * 224SOLUTIONS
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Users
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VendorCertification, VendorCertificationStatus } from '@/types/vendorCertification';
import { CertifiedVendorBadge } from './CertifiedVendorBadge';

interface VendorWithCertification {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  certification: VendorCertification | null;
}

export function VendorCertificationManager() {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<VendorWithCertification[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<VendorWithCertification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<VendorCertificationStatus | 'ALL'>('ALL');

  // Dialog state
  const [selectedVendor, setSelectedVendor] = useState<VendorWithCertification | null>(null);
  const [dialogAction, setDialogAction] = useState<'CERTIFY' | 'SUSPEND' | 'REJECT' | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    certified: 0,
    suspended: 0,
    nonCertified: 0
  });

  // Load vendors with certifications
  const loadVendors = async () => {
    try {
      setLoading(true);

      // Fetch vendors first
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, created_at')
        .eq('role', 'vendeur')
        .order('created_at', { ascending: false });

      if (vendorsError) {
        console.error('Error fetching vendors:', vendorsError);
        throw vendorsError;
      }

      // Fetch certifications separately (may fail due to RLS - that's ok)
      const certificationsMap: Record<string, any> = {};
      try {
        const { data: certsData, error: certsError } = await supabase
          .from('vendor_certifications')
          .select('*');

        if (!certsError && certsData) {
          certsData.forEach(cert => {
            certificationsMap[cert.vendor_id] = cert;
          });
        }
      } catch (certError) {
        console.log('Could not fetch certifications (RLS may restrict access):', certError);
      }

      // Mapper les résultats
      const vendorsWithCerts: VendorWithCertification[] = (vendorsData || []).map(vendor => {
        const cert = certificationsMap[vendor.id];
        return {
          id: vendor.id,
          full_name: vendor.full_name || 'Nom inconnu',
          email: vendor.email || '',
          avatar_url: vendor.avatar_url,
          created_at: vendor.created_at,
          certification: cert ? {
            id: cert.id,
            vendor_id: vendor.id,
            status: cert.status as VendorCertificationStatus,
            verified_at: cert.verified_at,
            kyc_verified_at: cert.kyc_verified_at,
            kyc_status: cert.kyc_status,
            last_status_change: cert.last_status_change,
            internal_notes: cert.internal_notes,
            rejection_reason: cert.rejection_reason,
            created_at: cert.created_at,
            updated_at: cert.updated_at
          } : null
        };
      });

      setVendors(vendorsWithCerts);
      setFilteredVendors(vendorsWithCerts);

      // Calculate stats
      const newStats = {
        total: vendorsWithCerts.length,
        certified: vendorsWithCerts.filter(v => v.certification?.status === 'CERTIFIE').length,
        suspended: vendorsWithCerts.filter(v => v.certification?.status === 'SUSPENDU').length,
        nonCertified: vendorsWithCerts.filter(v => !v.certification || v.certification.status === 'NON_CERTIFIE').length
      };
      setStats(newStats);

    } catch (error: any) {
      console.error('Error loading vendors:', error);
      toast.error(t('vendorCertificationManager.erreurLorsDuChargementDes') + (error.message || 'Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  // Filter vendors
  useEffect(() => {
    let filtered = vendors;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(vendor =>
        vendor.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(vendor =>
        vendor.certification?.status === statusFilter ||
        (!vendor.certification && statusFilter === 'NON_CERTIFIE')
      );
    }

    setFilteredVendors(filtered);
  }, [searchTerm, statusFilter, vendors]);

  // Handle certification action
  const handleCertificationAction = async () => {
    if (!selectedVendor || !dialogAction) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-vendor', {
        body: {
          vendor_id: selectedVendor.id,
          action: dialogAction,
          internal_notes: internalNotes || undefined,
          rejection_reason: rejectionReason || undefined
        }
      });

      if (error) throw error;

      toast.success(data.message);

      // Reload vendors
      await loadVendors();

      // Close dialog
      setSelectedVendor(null);
      setDialogAction(null);
      setInternalNotes('');
      setRejectionReason('');

    } catch (error: any) {
      console.error('Error updating certification:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  };

  const openDialog = (vendor: VendorWithCertification, action: 'CERTIFY' | 'SUSPEND' | 'REJECT') => {
    setSelectedVendor(vendor);
    setDialogAction(action);
    setInternalNotes(vendor.certification?.internal_notes || '');
    setRejectionReason(vendor.certification?.rejection_reason || '');
  };

  const getActionButtonLabel = () => {
    switch (dialogAction) {
      case 'CERTIFY': return 'Certifier';
      case 'SUSPEND': return 'Suspendre';
      case 'REJECT': return 'Rejeter';
      default: return 'Confirmer';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary" />
          Certification Vendeurs
        </h1>
        <p className="text-muted-foreground mt-2">
          Gérer les certifications des vendeurs de la marketplace
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Vendeurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              {stats.total}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Certifiés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2 text-[#ff4000]">
              <CheckCircle2 className="w-5 h-5" />
              {stats.certified}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Suspendus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2 text-[#ff4000]">
              <AlertTriangle className="w-5 h-5" />
              {stats.suspended}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Non certifiés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2 text-gray-600">
              <XCircle className="w-5 h-5" />
              {stats.nonCertified}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('vendorCertificationManager.rechercherUnVendeur')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('ALL')}
                size="sm"
              >
                Tous
              </Button>
              <Button
                variant={statusFilter === 'CERTIFIE' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('CERTIFIE')}
                size="sm"
              >
                Certifiés
              </Button>
              <Button
                variant={statusFilter === 'SUSPENDU' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('SUSPENDU')}
                size="sm"
              >
                Suspendus
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendors List */}
      <Card>
        <CardHeader>
          <CardTitle>Vendeurs ({filteredVendors.length})</CardTitle>
          <CardDescription>
            Gérer les certifications individuellement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredVendors.map((vendor) => (
              <Card key={vendor.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0">
                      {vendor.avatar_url ? (
                        <img
                          src={vendor.avatar_url}
                          alt={vendor.full_name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        vendor.full_name.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{vendor.full_name}</h3>
                        {vendor.certification && (
                          <CertifiedVendorBadge
                            status={vendor.certification.status}
                          />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{vendor.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Inscrit le {new Date(vendor.created_at).toLocaleDateString('fr-FR')}
                      </p>

                      {/* Notes internes */}
                      {vendor.certification?.internal_notes && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          <span className="font-semibold">Notes: </span>
                          {vendor.certification.internal_notes}
                        </div>
                      )}

                      {/* Raison rejet */}
                      {vendor.certification?.rejection_reason && (
                        <div className="mt-2 p-2 bg-orange-50 text-[#ff4000] rounded text-xs">
                          <span className="font-semibold">Rejet: </span>
                          {vendor.certification.rejection_reason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {(!vendor.certification || vendor.certification.status !== 'CERTIFIE') && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openDialog(vendor, 'CERTIFY')}
                        className="bg-[#04439e] hover:bg-[#04439e]"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Certifier
                      </Button>
                    )}

                    {vendor.certification?.status === 'CERTIFIE' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openDialog(vendor, 'SUSPEND')}
                      >
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Suspendre
                      </Button>
                    )}

                    {vendor.certification && vendor.certification.status !== 'NON_CERTIFIE' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog(vendor, 'REJECT')}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Rejeter
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {filteredVendors.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('vendorCertificationManager.aucunVendeurTrouve')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Certification Dialog */}
      <Dialog open={!!selectedVendor} onOpenChange={() => setSelectedVendor(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'CERTIFY' && 'Certifier le vendeur'}
              {dialogAction === 'SUSPEND' && 'Suspendre la certification'}
              {dialogAction === 'REJECT' && 'Rejeter la certification'}
            </DialogTitle>
            <DialogDescription>
              {selectedVendor?.full_name} ({selectedVendor?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dialogAction === 'REJECT' && (
              <div>
                <Label htmlFor="rejection_reason">{t('vendorCertificationManager.raisonDuRejet')}</Label>
                <Textarea
                  id="rejection_reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={t('vendorCertificationManager.expliquezPourquoiLaCertificationEst')}
                  rows={3}
                />
              </div>
            )}

            <div>
              <Label htmlFor="internal_notes">Notes internes (optionnel)</Label>
              <Textarea
                id="internal_notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder={t('vendorCertificationManager.notesInternesPourLEquipe')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedVendor(null)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCertificationAction}
              disabled={submitting || (dialogAction === 'REJECT' && !rejectionReason)}
              className={
                dialogAction === 'CERTIFY'
                  ? 'bg-[#ff4000] hover:bg-[#ff4000]'
                  : dialogAction === 'SUSPEND'
                  ? 'bg-[#ff4000] hover:bg-[#ff4000]'
                  : ''
              }
            >
              {submitting ? 'En cours...' : getActionButtonLabel()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
