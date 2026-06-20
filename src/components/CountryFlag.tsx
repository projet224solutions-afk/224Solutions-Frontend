/**
 * 🏳️ DRAPEAU PAYS (image réelle) - 224SOLUTIONS
 * Les emojis-drapeaux ne s'affichent pas sur Windows (rendus en lettres « GN »).
 * Ce composant rend une VRAIE image de drapeau via flagcdn (SVG, sans clé API),
 * à partir d'un code ISO-2 OU d'un nom de pays. Rien n'est affiché si le pays
 * est indéterminé.
 */

import { getCountryCode2 } from '@/data/countryMappings';
import { cn } from '@/lib/utils';

interface CountryFlagProps {
  country?: string | null; // code ISO-2 (ex. "GN") ou nom ("Guinée")
  className?: string;
  /** Hauteur en px (le ratio est conservé). Défaut 14. */
  size?: number;
}

export function CountryFlag({ country, className, size = 14 }: CountryFlagProps) {
  const code = getCountryCode2(country || undefined);
  if (!code) return null;

  return (
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={code.toUpperCase()}
      title={code.toUpperCase()}
      loading="lazy"
      style={{ height: size, width: 'auto' }}
      className={cn('inline-block rounded-[2px] object-cover align-[-2px] shadow-sm', className)}
    />
  );
}

export default CountryFlag;
