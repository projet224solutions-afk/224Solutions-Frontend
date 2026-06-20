import { z } from 'zod';

// Phone validation for Guinea numbers
const GUINEA_PHONE_REGEX = /^(?:\+224|00224)?[0-9]{8,9}$/;

export const contractFormSchema = z.object({
  contractType: z.string()
    .min(1, 'Veuillez sélectionner un type de contrat')
    .refine(
      (val) => ['vente', 'livraison', 'prestation', 'agent', 'partenariat'].includes(val),
      'Type de contrat invalide'
    ),
  clientName: z.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100, 'Le nom ne doit pas dépasser 100 caractères')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Le nom ne peut contenir que des lettres'),
  clientPhone: z.string()
    .min(8, 'Le numéro doit contenir au moins 8 chiffres')
    .regex(GUINEA_PHONE_REGEX, 'Numéro invalide (format: +224XXXXXXXXX ou XXXXXXXXX)'),
  clientAddress: z.string()
    .min(3, 'L\'adresse doit contenir au moins 3 caractères')
    .max(200, 'L\'adresse ne doit pas dépasser 200 caractères'),
});

export type ContractFormData = z.infer<typeof contractFormSchema>;
