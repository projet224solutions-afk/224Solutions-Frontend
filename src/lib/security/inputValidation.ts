import { z } from 'zod';

/**
 * Schémas de validation Zod pour tous les inputs critiques
 */

// Validation des données utilisateur
export const userSchema = z.object({
  email: z.string().email({ message: "Email invalide" }).max(255),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, { message: "Numéro de téléphone invalide" }).optional(),
  first_name: z.string().trim().min(1, { message: "Prénom requis" }).max(100),
  last_name: z.string().trim().min(1, { message: "Nom requis" }).max(100),
  password: z.string().min(8, { message: "Mot de passe trop court" }).max(100),
});

// Validation des transactions financières
export const transactionSchema = z.object({
  amount: z.number()
    .positive({ message: "Montant doit être positif" })
    .max(100_000_000, { message: "Montant trop élevé" }),
  currency: z.enum(['GNF', 'USD', 'EUR'], { message: "Devise invalide" }),
  recipient_id: z.string().uuid({ message: "ID destinataire invalide" }),
  description: z.string().trim().max(500).optional(),
});

// Validation des produits
export const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  price: z.number().positive().max(1_000_000_000),
  sku: z.string().trim().max(100).optional(),
  category_id: z.string().uuid().optional(),
});

// Validation des commandes
export const orderSchema = z.object({
  customer_id: z.string().uuid(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive().max(1000),
    price: z.number().positive()
  })).min(1).max(100),
  shipping_address: z.object({
    street: z.string().trim().max(200),
    city: z.string().trim().max(100),
    postal_code: z.string().trim().max(20).optional(),
    country: z.string().trim().max(100),
  }),
  payment_method: z.enum(['wallet', 'card', 'cash_on_delivery']),
});

// Validation des cartes virtuelles
export const virtualCardSchema = z.object({
  card_type: z.enum(['visa', 'mastercard']),
  initial_balance: z.number().positive().max(10_000_000),
  pin: z.string().regex(/^\d{4}$/, { message: "PIN must be 4 digits" }),
});

// Validation des messages
export const messageSchema = z.object({
  content: z.string().trim().min(1).max(10000),
  conversation_id: z.string().uuid(),
  attachments: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['image', 'video', 'document', 'audio']),
    size: z.number().max(50_000_000) // 50MB max
  })).max(10).optional(),
});

// Validation des identifiants personnalisés
export const customIdSchema = z.string()
  .regex(/^[A-Z]{3}\d{4}$/, { message: "Format invalide (ex: ABC1234)" });

/**
 * Fonction helper pour valider et nettoyer les données
 */
export function validateAndSanitize<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errors}`);
    }
    throw error;
  }
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHTML(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Validation des URL pour éviter les attaques
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Limitation de la longueur des strings
 */
export function truncateString(str: string, maxLength: number): string {
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}
