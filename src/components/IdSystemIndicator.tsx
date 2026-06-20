/**
 * 🆔 INDICATEUR SYSTÈME D'IDs
 * Widget visible montrant le système d'IDs standardisés
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from '@/components/ui/badge';
import { Hash, CheckCircle, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { StandardIdBadge } from './StandardIdBadge';
import { useStandardId } from '@/hooks/useStandardId';
import { useEffect, useState } from 'react';

export function IdSystemIndicator() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { validateStandardId, extractPrefix } = useStandardId();
  const [isStandardized, setIsStandardized] = useState(false);
  const [prefix, setPrefix] = useState<string | null>(null);

  useEffect(() => {
    const publicId = (profile as any)?.public_id;
    if (publicId) {
      const valid = validateStandardId(publicId);
      setIsStandardized(valid);
      if (valid) {
        setPrefix(extractPrefix(publicId));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const roleNames: Record<string, string> = {
    'USR': 'Utilisateur',
    'VND': 'Vendeur',
    'DRV': 'Livreur',
    'AGT': 'Agent',
    'PDG': 'PDG',
    'SYD': 'Syndicat',
    'CLT': 'Client',
    'CLI': 'Client (ancien format)'
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Hash className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">{t('idSystemIndicator.systemeDId')}</CardTitle>
              <CardDescription className="text-xs">224SOLUTIONS</CardDescription>
            </div>
          </div>
          {isStandardized && (
            <CheckCircle className="w-5 h-5 text-[#ff4000]" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* ID actuel */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t('idSystemIndicator.votreIdentifiant')}</p>
          {(profile as any)?.public_id ? (
            <StandardIdBadge
              standardId={(profile as any).public_id}
              size="md"
              copyable={true}
              showIcon={true}
            />
          ) : (
            <Badge variant="outline">{t('idSystemIndicator.enCoursDeGeneration')}</Badge>
          )}
        </div>

        {/* Type de compte */}
        {prefix && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t('idSystemIndicator.typeDeCompte')}</span>
            <Badge variant="secondary" className="font-semibold">
              {roleNames[prefix] || prefix}
            </Badge>
          </div>
        )}

        {/* Statut */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">Statut</span>
          <div className="flex items-center gap-1">
            {isStandardized ? (
              <>
                <div className="w-2 h-2 rounded-full bg-[#ff4000] animate-pulse" />
                <span className="text-xs font-medium text-[#ff4000]">Actif</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-[#ff4000] animate-pulse" />
                <span className="text-xs font-medium text-[#ff4000]">Configuration</span>
              </>
            )}
          </div>
        </div>

        {/* Format info */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="w-3 h-3" />
            <span>Format: AAA0001 (3 lettres + 4+ chiffres)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default IdSystemIndicator;
