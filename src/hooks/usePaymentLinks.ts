import { useState, useEffect } from 'react';
import { secureRandomString } from '@/lib/security/inputSanitizer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCurrentVendor } from './useCurrentVendor';
import { useToast } from './use-toast';
import { getPublicBaseUrl } from '@/lib/site';

export type LinkType = 'payment' | 'invoice' | 'checkout' | 'service';
export type OwnerType = 'vendor' | 'provider' | 'agent';

export interface PaymentLink {
  id: string;
  payment_id: string;
  token: string;
  link_type: LinkType;
  vendeur_id: string;
  owner_type: OwnerType;
  owner_user_id?: string;
  client_id?: string;
  product_id?: string;
  service_id?: string;
  order_id?: string;
  title?: string;
  produit: string;
  description?: string;
  reference?: string;
  montant: number;
  gross_amount?: number;
  platform_fee?: number;
  net_amount?: number;
  remise?: number;
  type_remise?: 'percentage' | 'fixed';
  frais: number;
  total: number;
  devise: string;
  status: 'pending' | 'success' | 'failed' | 'expired' | 'cancelled';
  payment_type?: string;
  is_single_use?: boolean;
  use_count?: number;
  expires_at: string;
  paid_at?: string;
  viewed_at?: string;
  payment_method?: string;
  transaction_id?: string;
  wallet_credit_status?: string;
  wallet_transaction_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  created_at: string;
  client?: {
    name: string;
    email: string;
  };
}

export interface PaymentStats {
  total_links: number;
  successful_payments: number;
  pending_payments: number;
  failed_payments: number;
  expired_payments: number;
  total_revenue: number;
  total_fees: number;
  avg_payment_amount: number;
}

export interface PaymentLinkItem {
  product_id?: string;
  name: string;
  price: number;
  qty: number;
  image?: string | null;
}

export interface CreatePaymentLinkData {
  linkType?: LinkType;
  ownerType?: OwnerType;
  items?: PaymentLinkItem[];
  produit: string;
  title?: string;
  description?: string;
  montant: number;
  devise: string;
  client_id?: string;
  remise?: number;
  type_remise?: 'percentage' | 'fixed';
  reference?: string;
  product_id?: string;
  service_id?: string;
  order_id?: string;
  payment_type?: string;
  is_single_use?: boolean;
  expires_days?: number;
}

export function usePaymentLinks() {
  const { user } = useAuth();
  const { vendorId: currentVendorId, userId: currentVendorUserId, isAgent, loading: vendorLoading } = useCurrentVendor();
  const { toast } = useToast();
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [ownerType, setOwnerType] = useState<OwnerType>('vendor');

  const effectiveOwnerUserId = currentVendorUserId || user?.id || null;

  useEffect(() => {
    loadOwnerInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentVendorId, currentVendorUserId, isAgent, vendorLoading]);

  useEffect(() => {
    if (effectiveOwnerUserId) {
      loadPaymentLinks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOwnerUserId, vendorId]);

  const loadOwnerInfo = async () => {
    if (vendorLoading) return;

    if (currentVendorId) {
      setVendorId(currentVendorId);
      setOwnerType('vendor');
      return;
    }

    if (!user?.id) return;

    // Check vendor first
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (vendor) {
      setVendorId(vendor.id);
      setOwnerType('vendor');
      return;
    }

    // Check if prestataire (has professional_services)
    const { data: service } = await supabase
      .from('professional_services')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (service) {
      setOwnerType('provider');
    }
  };

  const loadPaymentLinks = async (filters?: { status?: string; search?: string }) => {
    if (!effectiveOwnerUserId) return;

    try {
      setLoading(true);

      // Use owner_user_id for universal access (vendors + providers)
      let query = supabase
        .from('payment_links')
        .select(`
          *,
          client:profiles!payment_links_client_id_fkey(
            id, public_id, first_name, last_name, email
          )
        `)
        .eq('owner_user_id', effectiveOwnerUserId)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data: links, error } = await query;

      if (error) {
        console.error('Error loading payment links:', error);
        return;
      }

      let filteredLinks = links || [];
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filteredLinks = filteredLinks.filter((link: any) =>
          link.produit?.toLowerCase().includes(searchLower) ||
          link.title?.toLowerCase().includes(searchLower) ||
          link.description?.toLowerCase().includes(searchLower) ||
          link.reference?.toLowerCase().includes(searchLower) ||
          link.payment_id?.toLowerCase().includes(searchLower)
        );
      }

      const formattedLinks: PaymentLink[] = filteredLinks.map((link: any) => ({
        ...link,
        client: link.client ? {
          name: `${link.client.first_name || ''} ${link.client.last_name || ''}`.trim(),
          email: link.client.email,
        } : undefined,
      }));

      setPaymentLinks(formattedLinks);
      calculateStats(formattedLinks);
    } catch (error) {
      console.error('Error loading payment links:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (links: PaymentLink[]) => {
    const successfulLinks = links.filter(l => l.status === 'success');
    const totalRevenue = successfulLinks.reduce((sum, l) => sum + (l.net_amount || l.montant || 0), 0);

    setStats({
      total_links: links.length,
      pending_payments: links.filter(l => l.status === 'pending').length,
      successful_payments: successfulLinks.length,
      expired_payments: links.filter(l => l.status === 'expired').length,
      failed_payments: links.filter(l => l.status === 'failed').length,
      total_revenue: totalRevenue,
      total_fees: successfulLinks.reduce((sum, l) => sum + (l.platform_fee || l.frais || 0), 0),
      avg_payment_amount: successfulLinks.length > 0 ? totalRevenue / successfulLinks.length : 0,
    });
  };

  const createPaymentLink = async (data: CreatePaymentLinkData): Promise<string | null> => {
    if (!effectiveOwnerUserId) {
      toast({ title: "Erreur", description: "Connexion requise", variant: "destructive" });
      return null;
    }

    try {
      let montantFinal = data.montant;
      const remise = data.remise || 0;

      if (remise > 0) {
        montantFinal = data.type_remise === 'percentage'
          ? data.montant * (1 - remise / 100)
          : data.montant - remise;
      }

      const frais = montantFinal * 0.01;
      const total = montantFinal + frais;

      const timestamp = Date.now();
      const randomPart = secureRandomString(8).toUpperCase();
      const paymentId = `PAY-${timestamp}-${randomPart}`;

      // Resolve client UUID if provided
      let clientUuid: string | null = null;
      if (data.client_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('public_id', data.client_id)
          .single();
        if (profile) clientUuid = profile.id;
      }

      // Valider et normaliser expireDays
      let expireDays = data.expires_days || 30; // Augmenté de 7 à 30 jours par défaut
      // Sécurité: min 1 jour, max 365 jours
      expireDays = Math.max(1, Math.min(365, parseInt(String(expireDays)) || 30));

      // Calcul sûr de la date d'expiration
      const expiresAtMs = Date.now() + (expireDays * 24 * 60 * 60 * 1000);
      const expiresAtDate = new Date(expiresAtMs);

      // Vérification de validité
      if (isNaN(expiresAtDate.getTime())) {
        throw new Error('Erreur de calcul de date d\'expiration');
      }

      const { data: newLink, error } = await supabase
        .from('payment_links')
        .insert({
          payment_id: paymentId,
          link_type: data.linkType || 'payment',
          owner_type: ownerType,
          owner_user_id: effectiveOwnerUserId,
          vendeur_id: vendorId || null,
          client_id: clientUuid,
          product_id: data.product_id || null,
          service_id: data.service_id || null,
          order_id: data.order_id || null,
          title: data.title || data.produit,
          produit: data.produit,
          description: data.description || null,
          reference: data.reference || null,
          montant: data.montant,
          gross_amount: montantFinal,
          net_amount: montantFinal,
          remise: remise,
          type_remise: data.type_remise || 'percentage',
          frais: frais,
          total: total,
          devise: data.devise,
          payment_type: data.payment_type || 'full',
          is_single_use: data.is_single_use !== false,
          status: 'pending',
          expires_at: expiresAtDate.toISOString(),
          // Lignes produit (facture multi-produits). Stockées en metadata → décrément stock au paiement.
          metadata: (data.items && data.items.length > 0) ? { items: data.items } : {},
        })
        .select('token, payment_id')
        .single();

      if (error) throw new Error(error.message);

      if (newLink) {
        toast({
          title: "Lien créé !",
          description: "Le lien de paiement a été créé avec succès",
        });
        await loadPaymentLinks();
        return newLink.token || newLink.payment_id;
      }

      return null;
    } catch (error: any) {
      console.error('Create payment link error:', error);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return null;
    }
  };

  // Modifier un lien — UNIQUEMENT tant qu'il est « pending » (jamais un lien déjà payé/expiré).
  const updatePaymentLink = async (paymentId: string, data: CreatePaymentLinkData): Promise<boolean> => {
    try {
      let montantFinal = data.montant;
      const remise = data.remise || 0;
      if (remise > 0) {
        montantFinal = data.type_remise === 'percentage' ? data.montant * (1 - remise / 100) : data.montant - remise;
      }
      const frais = montantFinal * 0.01;
      const total = montantFinal + frais;

      let expireDays = Math.max(1, Math.min(365, parseInt(String(data.expires_days || 30)) || 30));
      const expiresAtDate = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);

      const { data: updated, error } = await supabase
        .from('payment_links')
        .update({
          link_type: data.linkType || 'payment',
          product_id: data.product_id || null,
          service_id: data.service_id || null,
          title: data.title || data.produit,
          produit: data.produit,
          description: data.description || null,
          reference: data.reference || null,
          montant: data.montant,
          gross_amount: montantFinal,
          net_amount: montantFinal,
          remise,
          type_remise: data.type_remise || 'percentage',
          frais,
          total,
          devise: data.devise,
          payment_type: data.payment_type || 'full',
          is_single_use: data.is_single_use !== false,
          expires_at: expiresAtDate.toISOString(),
          metadata: (data.items && data.items.length > 0) ? { items: data.items } : {},
          updated_at: new Date().toISOString(),
        })
        .eq('payment_id', paymentId)
        .eq('owner_user_id', effectiveOwnerUserId)
        .eq('status', 'pending')   // garde-fou : on ne modifie JAMAIS un lien déjà payé
        .select('id')
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!updated) {
        toast({ title: "Modification impossible", description: "Ce lien a déjà été payé ou n'est plus modifiable.", variant: "destructive" });
        return false;
      }
      toast({ title: "Lien mis à jour", description: "Les modifications ont été enregistrées." });
      await loadPaymentLinks();
      return true;
    } catch (error: any) {
      console.error('Update payment link error:', error);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const updatePaymentLinkStatus = async (paymentId: string, status: PaymentLink['status']) => {
    try {
      const { error } = await supabase
        .from('payment_links')
        .update({ status })
        .eq('payment_id', paymentId)
        .eq('owner_user_id', effectiveOwnerUserId);

      if (error) throw error;
      toast({ title: "Succès", description: "Statut mis à jour" });
      await loadPaymentLinks();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const deletePaymentLink = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('payment_links')
        .delete()
        .eq('payment_id', paymentId)
        .eq('owner_user_id', effectiveOwnerUserId);

      if (error) throw error;
      toast({ title: "Succès", description: "Lien supprimé" });
      await loadPaymentLinks();
      return true;
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const getPaymentUrl = (link: PaymentLink) => {
    const baseUrl = getPublicBaseUrl();

    if (link.token && link.token.trim() !== '') {
      return `${baseUrl}/pay/${encodeURIComponent(link.token)}`;
    }

    if (link.payment_id && link.payment_id.trim() !== '') {
      return `${baseUrl}/payment/${encodeURIComponent(link.payment_id)}`;
    }

    return `${baseUrl}/payment`;
  };

  return {
    paymentLinks,
    stats,
    loading,
    vendorId,
    ownerType,
    loadPaymentLinks,
    createPaymentLink,
    updatePaymentLink,
    updatePaymentLinkStatus,
    deletePaymentLink,
    getPaymentUrl,
  };
}
