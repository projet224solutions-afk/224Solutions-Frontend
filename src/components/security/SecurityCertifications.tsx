/**
 * CERTIFICATIONS DE SÉCURITÉ
 * Gestion des certifications ISO 27001, PCI-DSS - Connecté à Supabase
 */

import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Certification {
  id: string;
  name: string;
  certification_type: string;
  status: 'certified' | 'in_progress' | 'planned' | 'expired';
  progress: number;
  valid_from?: string;
  valid_until?: string;
  description: string;
  issuing_authority?: string;
  certificate_url?: string;
  created_at: string;
  updated_at: string;
}

export function SecurityCertifications() {
  const { t } = useTranslation();
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCertifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('security_certifications')
        .select('*')
        .order('status', { ascending: false })
        .order('progress', { ascending: false });

      if (error) throw error;

      setCertifications((data || []) as Certification[]);
    } catch (error) {
      console.error('Erreur chargement certifications:', error);
      toast.error(t('securityCertifications.impossibleDeChargerLesCertifications'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertifications();
  }, []);

  const getStatusBadge = (status: Certification['status']) => {
    switch (status) {
      case 'certified':
        return <Badge className="bg-[#ff4000]"><CheckCircle2 className="w-3 h-3 mr-1" />{t('securityCertifications.certifie')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" />En cours</Badge>;
      case 'planned':
        return <Badge variant="outline"><AlertTriangle className="w-3 h-3 mr-1" />{t('securityCertifications.planifie')}</Badge>;
      case 'expired':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />{t('securityCertifications.expire')}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary animate-pulse" />
            Certifications de Sécurité
          </CardTitle>
          <CardDescription>
            Chargement des certifications...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Chargement en cours...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Certifications de Sécurité
            </CardTitle>
            <CardDescription>
              Conformité aux normes internationales de sécurité
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={loadCertifications}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {certifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t('securityCertifications.aucuneCertificationTrouvee')}</p>
          </div>
        ) : (
          <>
            {certifications.map((cert) => (
              <div key={cert.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold">{cert.name}</h4>
                    <p className="text-sm text-muted-foreground">{cert.description}</p>
                    {cert.issuing_authority && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Autorité: {cert.issuing_authority}
                      </p>
                    )}
                  </div>
                  {getStatusBadge(cert.status)}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progression</span>
                    <span className="font-medium">{cert.progress}%</span>
                  </div>
                  <Progress value={cert.progress} className="h-2" />
                </div>
                {cert.valid_until && (
                  <p className="text-xs text-muted-foreground">
                    Valide jusqu'au {new Date(cert.valid_until).toLocaleDateString('fr-FR')}
                  </p>
                )}
                {cert.valid_from && (
                  <p className="text-xs text-muted-foreground">
                    Obtenue le {new Date(cert.valid_from).toLocaleDateString('fr-FR')}
                  </p>
                )}
                {cert.certificate_url && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto"
                    onClick={() => window.open(cert.certificate_url, '_blank')}
                  >
                    Voir le certificat →
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" className="w-full">
              Télécharger les rapports de conformité
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
