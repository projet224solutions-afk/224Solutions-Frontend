import { z } from 'zod';

/**
 * SCHÉMAS DE VALIDATION ZOD - Sécurité renforcée
 */

// Validation des montants financiers
export const amountSchema = z.number()
  .positive({ message: "Le montant doit être positif" })
  .max(100000000, { message: "Montant trop élevé" })
  .finite();

// Validation des IDs
export const uuidSchema = z.string().uuid({ message: "ID invalide" });

// Validation des codes personnalisés
export const customIdSchema = z.string()
  .min(3, { message: "Code trop court" })
  .max(20, { message: "Code trop long" })
  .regex(/^[A-Z0-9]+$/, { message: "Code invalide (lettres majuscules et chiffres uniquement)" });

// Validation des commentaires/messages
export const textSchema = z.string()
  .trim()
  .min(1, { message: "Ce champ ne peut pas être vide" })
  .max(1000, { message: "Texte trop long (max 1000 caractères)" });

// Validation des noms
export const nameSchema = z.string()
  .trim()
  .min(2, { message: "Nom trop court" })
  .max(100, { message: "Nom trop long" })
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, { message: "Caractères invalides dans le nom" });

// Validation des emails
export const emailSchema = z.string()
  .trim()
  .email({ message: "Email invalide" })
  .max(255);

// Validation des numéros de téléphone
export const phoneSchema = z.string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, { message: "Numéro de téléphone invalide" });

// Validation des URLs
export const urlSchema = z.string()
  .trim()
  .url({ message: "URL invalide" })
  .max(2000);

// Schéma de validation pour les transferts wallet
export const walletTransferSchema = z.object({
  recipient_id: z.union([uuidSchema, customIdSchema]),
  amount: amountSchema,
  description: textSchema.optional(),
});

// Schéma de validation pour les cartes virtuelles
export const virtualCardSchema = z.object({
  amount: amountSchema,
  card_name: nameSchema,
  purpose: textSchema.optional(),
});

// Schéma de validation pour les avis produits
export const productReviewSchema = z.object({
  product_id: uuidSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(100),
  comment: textSchema,
  verified_purchase: z.boolean(),
});

// Schéma de validation pour les adresses
export const addressSchema = z.object({
  street: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(100),
  postal_code: z.string().trim().min(2).max(20),
  country: z.string().trim().min(2).max(100),
  phone: phoneSchema,
});

/**
 * Utilitaire de validation avec messages d'erreur personnalisés
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: string[]
} {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(err => err.message);
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation error'] };
  }
}
