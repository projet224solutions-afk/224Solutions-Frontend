/**
 * Générateur de codes-barres EAN-13 compatibles
 * Génère des codes-barres uniques et scannables
 */

/**
 * Calcule le chiffre de contrôle EAN-13
 */
export function calculateEAN13CheckDigit(code: string): number {
  if (code.length !== 12) {
    throw new Error('Le code doit avoir exactement 12 chiffres');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    if (isNaN(digit)) {
      throw new Error('Le code doit contenir uniquement des chiffres');
    }
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Génère un code-barres EAN-13 unique
 * Format: 200 (préfixe interne) + timestamp (9 chiffres) + check digit
 */
export function generateEAN13Barcode(): string {
  // 200 = Préfixe pour codes internes (non officiels GS1)
  const prefix = '200';

  // Générer 9 chiffres basés sur le timestamp + random
  const timestamp = Date.now().toString().slice(-7);
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const code12 = prefix + timestamp + random;

  // Calculer le chiffre de contrôle
  const checkDigit = calculateEAN13CheckDigit(code12);

  return code12 + checkDigit.toString();
}

/**
 * Génère un code-barres CODE128 (alphanumérique)
 * Plus flexible que EAN-13, supporte lettres et chiffres
 */
export function generateCODE128Barcode(vendorPrefix?: string): string {
  const prefix = vendorPrefix || 'VF';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * Valide un code-barres EAN-13
 */
export function validateEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) {
    return false;
  }

  const code12 = barcode.slice(0, 12);
  const providedCheckDigit = parseInt(barcode[12], 10);
  const calculatedCheckDigit = calculateEAN13CheckDigit(code12);

  return providedCheckDigit === calculatedCheckDigit;
}

/**
 * Détermine le format d'un code-barres
 */
export function detectBarcodeFormat(barcode: string): 'EAN13' | 'EAN8' | 'CODE128' {
  if (/^\d{13}$/.test(barcode)) return 'EAN13';
  if (/^\d{8}$/.test(barcode)) return 'EAN8';
  return 'CODE128';
}

/**
 * Formate un code-barres pour l'affichage (espaces tous les 4 caractères)
 */
export function formatBarcodeDisplay(barcode: string): string {
  return barcode.replace(/(.{4})/g, '$1 ').trim();
}
