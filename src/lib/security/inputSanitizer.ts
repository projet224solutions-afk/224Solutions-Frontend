/**
 * Système de validation et sanitization des inputs
 * Protection contre XSS, SQL Injection, NoSQL Injection
 */

import DOMPurify from 'dompurify';

/**
 * Nettoyer HTML pour prévenir XSS
 */
export const sanitizeHTML = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false
  });
};

/**
 * Échapper caractères SQL dangereux
 */
export const escapeSQLString = (input: string): string => {
  return input
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x00/g, '\\0')
    .replace(/\x1a/g, '\\Z');
};

/**
 * Valider email strict
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Valider numéro de téléphone guinéen
 */
export const isValidGuineanPhone = (phone: string): boolean => {
  // Format: +224XXXXXXXXX ou 00224XXXXXXXXX ou XXXXXXXXX (9 chiffres)
  const cleanPhone = phone.replace(/[\s\-()]/g, '');
  const patterns = [
    /^\+224[0-9]{9}$/,      // +224XXXXXXXXX
    /^00224[0-9]{9}$/,      // 00224XXXXXXXXX
    /^224[0-9]{9}$/,        // 224XXXXXXXXX
    /^[0-9]{9}$/            // XXXXXXXXX
  ];

  return patterns.some(pattern => pattern.test(cleanPhone));
};

/**
 * Nettoyer input pour prévenir NoSQL injection
 */
export const sanitizeNoSQLInput = (input: any): any => {
  if (typeof input === 'string') {
    // Supprimer opérateurs MongoDB dangereux
    return input.replace(/\$\w+/g, '');
  }

  if (typeof input === 'object' && input !== null) {
    const cleaned: any = {};
    for (const key in input) {
      // Bloquer clés commençant par $ (opérateurs MongoDB)
      if (!key.startsWith('$')) {
        cleaned[key] = sanitizeNoSQLInput(input[key]);
      }
    }
    return cleaned;
  }

  return input;
};

/**
 * Valider et nettoyer un nom (prénom/nom)
 */
export const sanitizeName = (name: string): string => {
  return name
    .trim()
    .replace(/[<>\"'&]/g, '') // Supprimer caractères HTML dangereux
    .replace(/\s+/g, ' ')      // Normaliser espaces
    .substring(0, 50);          // Limiter longueur
};

/**
 * Valider montant financier
 */
export const isValidAmount = (amount: number): boolean => {
  return (
    typeof amount === 'number' &&
    !isNaN(amount) &&
    isFinite(amount) &&
    amount >= 0 &&
    amount <= 100000000 && // 100 millions max
    Number.isInteger(amount * 100) // Max 2 décimales
  );
};

/**
 * Valider commission (0-50%)
 */
export const isValidCommission = (commission: number): boolean => {
  return (
    typeof commission === 'number' &&
    !isNaN(commission) &&
    commission >= 0 &&
    commission <= 50
  );
};

/**
 * Détecter payload malveillant dans URL
 */
export const isURLSafe = (url: string): boolean => {
  try {
    const parsed = new URL(url);

    // Bloquer javascript:, data:, file:
    const dangerousProtocols = ['javascript:', 'data:', 'file:', 'vbscript:'];
    if (dangerousProtocols.some(proto => parsed.protocol === proto)) {
      return false;
    }

    // Autoriser uniquement http(s)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Valider identifiant agent/bureau (format strict)
 */
export const isValidIdentifier = (identifier: string): boolean => {
  // Email OU téléphone guinéen
  return isValidEmail(identifier) || isValidGuineanPhone(identifier);
};

/**
 * Nettoyer objet complet de manière récursive
 */
export const deepSanitize = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeHTML(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSanitize);
  }

  if (typeof obj === 'object' && obj !== null) {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cleaned[key] = deepSanitize(obj[key]);
      }
    }
    return cleaned;
  }

  return obj;
};

/**
 * Valider password strength
 */
export const validatePasswordStrength = (password: string): {
  valid: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  // Longueur minimale
  if (password.length < 8) {
    feedback.push('Minimum 8 caractères requis');
  } else {
    score += 1;
  }

  // Majuscules
  if (!/[A-Z]/.test(password)) {
    feedback.push('Ajouter au moins une majuscule');
  } else {
    score += 1;
  }

  // Minuscules
  if (!/[a-z]/.test(password)) {
    feedback.push('Ajouter au moins une minuscule');
  } else {
    score += 1;
  }

  // Chiffres
  if (!/[0-9]/.test(password)) {
    feedback.push('Ajouter au moins un chiffre');
  } else {
    score += 1;
  }

  // Caractères spéciaux
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('Ajouter au moins un caractère spécial');
  } else {
    score += 1;
  }

  // Pas de patterns communs
  const commonPatterns = ['123456', 'password', 'azerty', 'qwerty', '111111', 'abc123'];
  if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    feedback.push('Éviter les mots de passe courants');
    score -= 1;
  }

  const valid = score >= 4 && password.length >= 8;

  return {
    valid,
    score: Math.max(0, Math.min(5, score)),
    feedback
  };
};
