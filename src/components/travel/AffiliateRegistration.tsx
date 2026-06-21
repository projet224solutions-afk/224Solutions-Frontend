/**
 * Formulaire d'inscription affilié voyage
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Users, Check, ArrowRight, Briefcase,
  Mail, Phone, FileText, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AffiliateRegistrationProps {
  onSuccess: (affiliateCode: string) => void;
  onCancel: () => void;
}

export function AffiliateRegistration({ onSuccess, onCancel }: AffiliateRegistrationProps) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [_step, _setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: (profile as any)?.full_name || (profile as any)?.name || '',
    email: (profile as any)?.email || user?.email || '',
    phone: profile?.phone || '',
    specialization: ['flights', 'hotels'] as string[],
    acceptTerms: false
  });

  const generateAffiliateCode = () => {
    const prefix = 'TRV';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${random}`;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t('affiliateRegistration.vousDevezEtreConnecte'));
      return;
    }

    if (!formData.acceptTerms) {
      toast.error(t('affiliateRegistration.veuillezAccepterLesConditions'));
      return;
    }

    setLoading(true);
    try {
      const affiliateCode = generateAffiliateCode();

      const { _data, error } = await (supabase as any)
        .from('travel_affiliates')
        .insert({
          user_id: user.id,
          affiliate_code: affiliateCode,
          status: 'pending',
          specialization: formData.specialization
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(t('affiliateRegistration.inscriptionReussieVotreCompteEst'));
      onSuccess(affiliateCode);
    } catch (error: any) {
      console.error('Error creating affiliate:', error);
      if (error.code === '23505') {
        toast.error(t('affiliateRegistration.vousEtesDejaInscritComme'));
      } else {
        toast.error(t('affiliateRegistration.erreurLorsDeLInscription'));
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialization = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specialization: prev.specialization.includes(spec)
        ? prev.specialization.filter(s => s !== spec)
        : [...prev.specialization, spec]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-[#ff4000] rounded-2xl flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{t('affiliateRegistration.devenirAffilieVoyage')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gagnez des commissions sur chaque réservation
        </p>
      </div>

      {/* Avantages */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">{t('affiliateRegistration.vosAvantages')}</h3>
          <div className="space-y-2">
            {[
              { icon: Wallet, text: 'Commissions jusqu\'à 10% sur les réservations' },
              { icon: Briefcase, text: 'Accès au catalogue complet de partenaires' },
              { icon: FileText, text: 'Dashboard de suivi en temps réel' },
              { icon: Mail, text: 'Support dédié aux affiliés' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-muted-foreground">{item.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Formulaire */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="fullName">Nom complet</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder={t('affiliateRegistration.votreNomComplet')}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder={t('affiliateRegistration.votreEmailCom')}
              />
            </div>

            <div>
              <Label htmlFor="phone">{t('affiliateRegistration.telephone')}</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+224 XXX XXX XXX"
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">{t('affiliateRegistration.specialisation')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'flights', label: 'Vols', icon: '✈️' },
                { id: 'hotels', label: 'Hôtels', icon: '🏨' }
              ].map((spec) => (
                <div
                  key={spec.id}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    formData.specialization.includes(spec.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => toggleSpecialization(spec.id)}
                >
                  <div className="flex items-center gap-2">
                    <span>{spec.icon}</span>
                    <span className="text-sm font-medium">{spec.label}</span>
                    {formData.specialization.includes(spec.id) && (
                      <Check className="w-4 h-4 text-primary ml-auto" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="terms"
              checked={formData.acceptTerms}
              onCheckedChange={(checked) =>
                setFormData(prev => ({ ...prev, acceptTerms: checked as boolean }))
              }
            />
            <label htmlFor="terms" className="text-xs text-muted-foreground leading-tight">
              J'accepte les conditions générales du programme d'affiliation et la politique de confidentialité
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || !formData.acceptTerms}
          className="flex-1 gap-2"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <>
              S'inscrire
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
