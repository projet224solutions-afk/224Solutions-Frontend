// ============================================================================
// Formulaire d'ajout d'actionnaire (PDG)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shareholderService } from '@/services/shareholderService';
import { CATEGORY_LABELS, SCOPE_LABELS } from '@/types/shareholder';
import type {
  CreateShareholderDto,
  ShareholderCategory,
  ActionScope,
  PercentageSummary,
} from '@/types/shareholder';

// Liste des pays (simplifiée — principaux pays d'opération)
const COUNTRIES = [
  { code: 'GN',  label: 'Guinée' },
  { code: 'SN',  label: 'Sénégal' },
  { code: 'ML',  label: 'Mali' },
  { code: 'CI',  label: "Côte d'Ivoire" },
  { code: 'BF',  label: 'Burkina Faso' },
  { code: 'NE',  label: 'Niger' },
  { code: 'TG',  label: 'Togo' },
  { code: 'BJ',  label: 'Bénin' },
  { code: 'CM',  label: 'Cameroun' },
  { code: 'CD',  label: 'Congo (RDC)' },
  { code: 'CG',  label: 'Congo (Brazzaville)' },
  { code: 'GA',  label: 'Gabon' },
  { code: 'FR',  label: 'France' },
  { code: 'BE',  label: 'Belgique' },
  { code: 'OTHER', label: 'Autre' },
];

// ============================================================================
// Composant de disponibilité du pourcentage
// ============================================================================
function PercentageAvailability({
  category,
  scope,
  country,
  requested,
  excludeId,
}: {
  category: ShareholderCategory | '';
  scope: ActionScope | '';
  country: string;
  requested: number;
  excludeId?: string;
}) {
  const [info, setInfo] = useState<{
    valid: boolean;
    current: number;
    remaining: number;
    message?: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    if (!category || !scope || requested <= 0) { setInfo(null); return; }
    if (scope === 'country' && !country) { setInfo(null); return; }
    setChecking(true);
    try {
      const result = await shareholderService.validatePercentage(
        category as ShareholderCategory,
        scope as ActionScope,
        scope === 'country' ? country : null,
        requested,
        excludeId,
      );
      setInfo(result);
    } catch {
      setInfo(null);
    } finally {
      setChecking(false);
    }
  }, [category, scope, country, requested, excludeId]);

  useEffect(() => {
    const timer = setTimeout(check, 600);
    return () => clearTimeout(timer);
  }, [check]);

  if (!category || !scope || requested <= 0) return null;
  if (scope === 'country' && !country) return null;

  return (
    <div className={cn(
      'flex items-start gap-2 p-2.5 rounded-lg text-xs mt-1.5',
      checking                  && 'bg-muted/50 text-muted-foreground',
      !checking && info?.valid  && 'bg-orange-50 text-[#ff4000]',
      !checking && info && !info.valid && 'bg-orange-50 text-[#ff4000]',
    )}>
      {checking ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin mt-0.5 shrink-0" />
      ) : info?.valid ? (
        <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      )}
      <span>
        {checking
          ? 'Vérification en cours…'
          : info?.valid
            ? `Disponible — Utilisé: ${info.current}%, Restant: ${info.remaining}%`
            : info
              ? `${info.message || 'Limite dépassée'} (Utilisé: ${info.current}%, Restant: ${info.remaining}%)`
              : ''
        }
      </span>
    </div>
  );
}

// ============================================================================
// Champ de formulaire générique (hors composant pour éviter les re-mounts)
// ============================================================================
function Field({
  label, error, children, required,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">
        {label}{required && <span className="text-[#ff4000] ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-[#ff4000] flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{error}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Formulaire principal
// ============================================================================
interface AddShareholderFormProps {
  percentages: PercentageSummary[];
  onSubmit: (data: CreateShareholderDto) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  editMode?: boolean;
  initialData?: Partial<CreateShareholderDto>;
}

export default function AddShareholderForm({
  onSubmit,
  onCancel,
  loading,
  editMode = false,
  initialData,
}: AddShareholderFormProps) {
  const [fullName, setFullName]               = useState(initialData?.full_name          ?? '');
  const [email, setEmail]                     = useState(initialData?.email               ?? '');
  const [phone, setPhone]                     = useState(initialData?.phone               ?? '');
  const [tempPwd, setTempPwd]                 = useState(initialData?.temp_password       ?? '');
  const [showPwd, setShowPwd]                 = useState(false);
  const [residenceCountry, setResidenceCountry] = useState(initialData?.residence_country ?? '');
  const [category, setCategory]               = useState<ShareholderCategory | ''>(
    initialData?.category ?? '',
  );
  const [scope, setScope]                     = useState<ActionScope | ''>(
    initialData?.action_scope ?? '',
  );
  const [country, setCountry]                 = useState(initialData?.country ?? '');
  const [percentage, setPercentage]           = useState(
    initialData?.percentage ? String(initialData.percentage) : '',
  );
  const [notes, setNotes]                     = useState(initialData?.internal_notes ?? '');
  const [errors, setErrors]                   = useState<Record<string, string>>({});

  // Réinitialiser pays quand la portée change
  useEffect(() => {
    if (scope === 'global') setCountry('');
  }, [scope]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!fullName.trim())            e.fullName   = 'Nom requis';
    if (!email.trim())               e.email      = 'Email requis';
    if (!/\S+@\S+\.\S+/.test(email)) e.email     = 'Email invalide';
    if (!editMode && !tempPwd)       e.tempPwd    = 'Mot de passe temporaire requis';
    if (!category)                   e.category   = 'Catégorie requise';
    if (!scope)                      e.scope      = 'Portée requise';
    if (scope === 'country' && !country) e.country = 'Pays requis pour portée par pays';
    const pct = parseFloat(percentage);
    if (!percentage || isNaN(pct))   e.percentage = 'Pourcentage requis';
    else if (pct <= 0 || pct > 100)  e.percentage = 'Entre 0.01 et 100';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const dto: CreateShareholderDto = {
      full_name:          fullName.trim(),
      email:              email.trim().toLowerCase(),
      phone:              phone.trim() || undefined,
      temp_password:      tempPwd,
      category:           category as ShareholderCategory,
      action_scope:       scope as ActionScope,
      country:            scope === 'country' ? country : undefined,
      percentage:         parseFloat(percentage),
      internal_notes:     notes.trim() || undefined,
      residence_country:  residenceCountry || undefined,
    };
    await onSubmit(dto);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 py-1">
      {/* Identité */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Identité
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom complet" error={errors.fullName} required>
            <Input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Jean Dupont"
              className={cn(errors.fullName && 'border-[#ff4000]')}
            />
          </Field>
          <Field label="Téléphone" error={errors.phone}>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+224 6XX XXX XXX"
            />
          </Field>
        </div>
        <Field label="Email" error={errors.email} required>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="actionnaire@exemple.com"
            className={cn(errors.email && 'border-[#ff4000]')}
          />
        </Field>
        <Field label="Pays de résidence" error={errors.residenceCountry}>
          <Select value={residenceCountry} onValueChange={setResidenceCountry}>
            <SelectTrigger>
              <SelectValue placeholder="Pays de l'actionnaire (optionnel)…" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map(c => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Détermine la devise du wallet de l'actionnaire.
          </p>
        </Field>
        {!editMode && (
          <Field label="Mot de passe temporaire" error={errors.tempPwd} required>
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                value={tempPwd}
                onChange={e => setTempPwd(e.target.value)}
                placeholder="Mot de passe provisoire"
                className={cn('pr-9', errors.tempPwd && 'border-[#ff4000]')}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              L'actionnaire devra changer ce mot de passe à sa première connexion.
            </p>
          </Field>
        )}
      </div>

      {/* Assignation */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Assignation
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Catégorie" error={errors.category} required>
            <Select
              value={category}
              onValueChange={v => setCategory(v as ShareholderCategory)}
            >
              <SelectTrigger className={cn(errors.category && 'border-[#ff4000]')}>
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CATEGORY_LABELS) as [ShareholderCategory, string][]).map(
                  ([val, lbl]) => (
                    <SelectItem key={val} value={val}>{lbl}</SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Portée" error={errors.scope} required>
            <Select
              value={scope}
              onValueChange={v => setScope(v as ActionScope)}
            >
              <SelectTrigger className={cn(errors.scope && 'border-[#ff4000]')}>
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SCOPE_LABELS) as [ActionScope, string][]).map(
                  ([val, lbl]) => (
                    <SelectItem key={val} value={val}>{lbl}</SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {scope === 'country' && (
          <Field label="Pays" error={errors.country} required>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className={cn(errors.country && 'border-[#ff4000]')}>
                <SelectValue placeholder="Sélectionner le pays…" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Pourcentage (%)" error={errors.percentage} required>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={percentage}
              onChange={e => setPercentage(e.target.value)}
              placeholder="ex: 5.00"
              className={cn('max-w-[140px]', errors.percentage && 'border-[#ff4000]')}
            />
            {percentage && !isNaN(parseFloat(percentage)) && (
              <Badge variant="outline" className="text-sm font-bold">
                {parseFloat(percentage)}%
              </Badge>
            )}
          </div>
          <PercentageAvailability
            category={category}
            scope={scope}
            country={country}
            requested={parseFloat(percentage) || 0}
          />
        </Field>
      </div>

      {/* Notes internes */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Notes internes</Label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes confidentielles (non visibles par l'actionnaire)…"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
      </div>

      {/* Boutons */}
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading
            ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Création…</>
            : editMode ? 'Enregistrer les modifications' : 'Créer l\'actionnaire'
          }
        </Button>
      </div>
    </form>
  );
}
