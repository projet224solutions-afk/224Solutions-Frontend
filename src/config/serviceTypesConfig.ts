/**
 * CONFIGURATION CENTRALISÉE DES TYPES DE SERVICES
 * Source unique de vérité pour tous les modules, formulaires et pages
 * Synchronisé avec la table service_types de la base de données
 */

export interface ServiceTypeConfig {
  // Code DB officiel (doit correspondre à service_types.code)
  code: string;
  // Nom d'affichage
  name: string;
  // Catégorie (correspond à service_types.category)
  category: string;
  // Icône emoji pour l'UI
  icon: string;
  // Description courte
  description: string;
  // Icône Lucide (correspond à service_types.icon)
  lucideIcon: string;
  // Section dans le formulaire d'inscription
  section: 'proximity' | 'professional' | 'digital';
  // Codes legacy qui doivent mapper vers ce service
  legacyCodes: string[];
  // Visible dans le formulaire d'inscription vendeur
  showInVendorSignup: boolean;
  // Visible dans la section "Services de proximité"
  showInProximity: boolean;
}

/**
 * Liste complète des types de services synchronisée avec la DB
 * IDs DB réels:
 * - restaurant: 4aa11ff0-946e-4bc6-9c6a-af73e388868d
 * - beaute: cdc71e4e-27ce-4faa-b770-bb8d8a7394d9
 * - ecommerce: 6ec517c9-fc1f-4e59-9048-023080c17667
 * - reparation: 281fe1c5-5fc4-48f9-b01d-608721cebee2
 * - location: d43a4bd5-b322-4e5a-a3f7-f53325247c18
 * - menage: 3e8ce989-0b76-4cd4-9f55-1f3b70efecec
 * - livraison: 76d5b1f9-39f4-4865-9770-3302f822438a
 * - media: f91f8aa4-0653-4707-8378-0d8ea4def99a
 * - education: ec96223d-a50b-4320-a870-d36747f252a6
 * - sante: 3ce16e66-fb56-47a5-831a-ca879e71cdda
 * - voyage: 66e39dea-84c6-4cab-b357-8adb898d0e52
 * - freelance: 6f22da0d-f671-4f3d-978c-c345cd8118d2
 * - construction: 71694b23-a121-4d57-9c21-36dde31fde3f
 * - agriculture: 22908237-3cc7-481f-933f-c88fd90d6a99
 * - informatique: e058e290-cfd5-45c2-819a-ea35eece604f
 * - vtc: 65bda8bc-83e1-48c7-8499-69e8ac68092f
 */
export const SERVICE_TYPES_CONFIG: ServiceTypeConfig[] = [
  // ===== SERVICES DE PROXIMITÉ POPULAIRES =====
  {
    code: 'restaurant',
    name: 'Restaurant / Alimentation',
    category: 'Alimentation',
    icon: '🍽️',
    description: 'Cuisine & plats',
    lucideIcon: 'Utensils',
    section: 'proximity',
    legacyCodes: ['food', 'restauration', 'alimentation'],
    showInVendorSignup: true,
    showInProximity: true,
  },
  {
    code: 'beaute',
    name: 'Beauté & Bien-être',
    category: 'Beauté',
    icon: '💇',
    description: 'Soins & styling',
    lucideIcon: 'Scissors',
    section: 'proximity',
    legacyCodes: ['salon_coiffure', 'beauty', 'coiffure', 'coiff', 'spa'],
    showInVendorSignup: true,
    showInProximity: true,
  },
  {
    code: 'vtc',
    name: 'VTC / Transport',
    category: 'Transport',
    icon: '🚗',
    description: 'Véhicules privés',
    lucideIcon: 'Car',
    section: 'proximity',
    legacyCodes: ['taxi', 'transport_prive', 'chauffeur'],
    showInVendorSignup: true,
    showInProximity: true,
  },
  {
    code: 'reparation',
    name: 'Réparation / Mécanique',
    category: 'Réparation',
    icon: '🔧',
    description: 'Électro & mécanique',
    lucideIcon: 'Car',
    section: 'proximity',
    legacyCodes: ['garage_auto', 'repair', 'mecanique', 'electronique'],
    showInVendorSignup: true,
    showInProximity: true,
  },
  {
    code: 'menage',
    name: 'Ménage & Entretien',
    category: 'Services',
    icon: '✨',
    description: 'Nettoyage & pressing',
    lucideIcon: 'Sparkles',
    section: 'proximity',
    legacyCodes: ['nettoyage', 'cleaning', 'pressing', 'entretien'],
    showInVendorSignup: true,
    showInProximity: true,
  },
  {
    code: 'informatique',
    name: 'Informatique / Tech',
    category: 'Technologie',
    icon: '💻',
    description: 'Tech & dépannage',
    lucideIcon: 'Laptop',
    section: 'proximity',
    legacyCodes: ['tech', 'computer', 'depannage_info'],
    showInVendorSignup: true,
    showInProximity: true,
  },
  {
    code: 'livraison',
    name: 'Livraison / Coursier',
    category: 'Transport',
    icon: '🚚',
    description: 'Courses & livraison',
    lucideIcon: 'Truck',
    section: 'proximity',
    legacyCodes: ['delivery', 'coursier', 'express'],
    showInVendorSignup: true,
    showInProximity: true,
  },
  {
    code: 'ecommerce',
    name: 'Boutique / E-commerce',
    category: 'Commerce',
    icon: '🛍️',
    description: 'Vente de produits',
    lucideIcon: 'ShoppingBag',
    section: 'proximity',
    legacyCodes: ['boutique', 'retail', 'wholesale', 'mixed', 'shop', 'commerce'],
    showInVendorSignup: true,
    showInProximity: true,
  },

  // ===== SERVICES PROFESSIONNELS =====
  // Synchronisés avec Auth.tsx "Services Professionnels"
  {
    code: 'sport',
    name: 'Sport & Fitness',
    category: 'Sport',
    icon: '🏋️',
    description: 'Coaching & salles',
    lucideIcon: 'Dumbbell',
    section: 'professional',
    legacyCodes: ['fitness', 'gym', 'coaching_sport'],
    showInVendorSignup: true,
    showInProximity: false,
  },
  {
    code: 'location',
    name: 'Immobilier',
    category: 'Immobilier',
    icon: '🏢',
    description: 'Location & vente',
    lucideIcon: 'Building2',
    section: 'professional',
    legacyCodes: ['immobilier', 'real_estate', 'housing'],
    showInVendorSignup: true,
    showInProximity: false,
  },
  {
    code: 'media',
    name: 'Photo & Vidéo',
    category: 'Média',
    icon: '📸',
    description: 'Événements & créations',
    lucideIcon: 'Camera',
    section: 'professional',
    legacyCodes: ['photographe', 'photo', 'video', 'videaste', 'creation'],
    showInVendorSignup: true,
    showInProximity: false,
  },
  {
    code: 'construction',
    name: 'Construction & BTP',
    category: 'Construction',
    icon: '🏗️',
    description: 'Bâtiment & travaux',
    lucideIcon: 'HardHat',
    section: 'professional',
    legacyCodes: ['btp', 'building', 'batiment'],
    showInVendorSignup: true,
    showInProximity: false,
  },
  {
    code: 'agriculture',
    name: 'Agriculture',
    category: 'Agriculture',
    icon: '🌾',
    description: 'Produits locaux',
    lucideIcon: 'Tractor',
    section: 'professional',
    legacyCodes: ['farming', 'agricole', 'ferme'],
    showInVendorSignup: true,
    showInProximity: false,
  },
  {
    code: 'freelance',
    name: 'Administratif',
    category: 'Professionnel',
    icon: '💼',
    description: 'Secrétariat & conseil',
    lucideIcon: 'Briefcase',
    section: 'professional',
    legacyCodes: ['services_pro', 'admin', 'secretariat', 'consulting'],
    showInVendorSignup: true,
    showInProximity: false,
  },
  {
    code: 'sante',
    name: 'Santé & Bien-être',
    category: 'Santé',
    icon: '💊',
    description: 'Pharmacie & soins',
    lucideIcon: 'Heart',
    section: 'professional',
    // 'pharmacie'/'pharma' retirés : la pharmacie est un type à part entière (code 'pharmacie'),
    // ne doit plus être résolue vers 'sante'.
    legacyCodes: ['health', 'medical'],
    showInVendorSignup: true,
    showInProximity: false,
  },
  {
    code: 'maison',
    name: 'Maison & Déco',
    category: 'Maison',
    icon: '🏠',
    description: 'Intérieur & déco',
    lucideIcon: 'Home',
    section: 'professional',
    legacyCodes: ['home_decor', 'decoration', 'interieur', 'ameublement'],
    showInVendorSignup: true,
    showInProximity: false,
  },
  {
    // Service à part entière (≠ 'sante' générique) : ordonnance scannée → validation pharmacien.
    // service_type DB id : b8f7e6d5-c4a3-4b21-9e0f-1a2b3c4d5e6f
    code: 'pharmacie',
    name: 'Pharmacie',
    category: 'Santé',
    icon: '💊',
    description: 'Ordonnances & médicaments',
    lucideIcon: 'Pill',
    section: 'professional',
    legacyCodes: ['pharmacy', 'officine'],
    showInVendorSignup: true,
    // Pas d'onglet séparé dans Proximité : la pharmacie relève de « Santé & Bien-être »
    // et possède déjà sa page de découverte dédiée (/pharmacie).
    showInProximity: false,
  },
  {
    // Sous-type du domaine Santé (consultations, analyses) — proposé sous « Santé & Bien-être ».
    code: 'clinique',
    name: 'Clinique',
    category: 'Santé',
    icon: '🏥',
    description: 'Consultations & analyses',
    lucideIcon: 'Building2',
    section: 'professional',
    legacyCodes: ['clinic', 'cabinet_medical', 'centre_sante'],
    showInVendorSignup: true,
    showInProximity: false,
  },
  // Services non affichés dans le formulaire inscription (mais existants)
  {
    code: 'education',
    name: 'Formation',
    category: 'Éducation',
    icon: '🎓',
    description: 'Cours et coaching',
    lucideIcon: 'GraduationCap',
    section: 'digital',
    legacyCodes: ['formation', 'teaching', 'cours', 'school'],
    showInVendorSignup: false,
    showInProximity: false,
  },
  {
    code: 'voyage',
    name: 'Voyage / Tourisme',
    category: 'Tourisme',
    icon: '✈️',
    description: 'Agence et billetterie',
    lucideIcon: 'Plane',
    section: 'professional',
    legacyCodes: ['tourism', 'travel', 'agence_voyage'],
    showInVendorSignup: false,
    showInProximity: false,
  },
  // ===== ARTISANS DU BÂTIMENT =====
  {
    code: 'plomberie',
    name: 'Plomberie',
    category: 'Bâtiment',
    icon: '🔧',
    description: 'Plombier / Chauffagiste',
    lucideIcon: 'Wrench',
    section: 'proximity',
    legacyCodes: ['plombier', 'plumbing', 'chauffagiste'],
    showInVendorSignup: true,
    showInProximity: true,
  },
  {
    code: 'vitrerie',
    name: 'Vitrerie',
    category: 'Bâtiment',
    icon: '🪟',
    description: 'Vitrier / Miroitier',
    lucideIcon: 'Square',
    section: 'proximity',
    legacyCodes: ['vitrier', 'glazier', 'miroitier'],
    showInVendorSignup: true,
    showInProximity: true,
  },
  {
    code: 'menuiserie',
    name: 'Menuiserie',
    category: 'Bâtiment',
    icon: '🪚',
    description: 'Menuisier / Ébéniste',
    lucideIcon: 'Hammer',
    section: 'proximity',
    legacyCodes: ['menuisier', 'carpenter', 'ebeniste'],
    showInVendorSignup: true,
    showInProximity: true,
  },
  {
    code: 'soudure',
    name: 'Soudure / Métallerie',
    category: 'Bâtiment',
    icon: '🔥',
    description: 'Soudeur / Métallier',
    lucideIcon: 'Flame',
    section: 'proximity',
    legacyCodes: ['soudeur', 'welder', 'metallier', 'ferronnier'],
    showInVendorSignup: true,
    showInProximity: true,
  },
];

// ===== SERVICES DIGITAUX (extensions) =====
export const DIGITAL_SERVICES: { code: string; name: string; icon: string; description: string }[] = [
  { code: 'digital_logiciel', name: 'Logiciel', icon: '💻', description: 'Antivirus et SaaS' },
  { code: 'dropshipping', name: 'Dropshipping', icon: '📦', description: 'Amazon, AliExpress' },
  { code: 'digital_livre', name: 'Livres', icon: '📚', description: 'eBooks et affiliation' },
];

// ===== HELPER FUNCTIONS =====

/**
 * Obtenir un type de service par son code (officiel ou legacy)
 */
/**
 * Localise un libellé de service (name/category/description) via le dictionnaire i18n.
 * Repli sur le texte FR de la config si la clé n'existe pas (jamais de clé brute affichée).
 * `t` est passé en paramètre (ce fichier n'est pas un composant React).
 */
export function localizeServiceField(
  t: (k: string) => string,
  code: string,
  field: 'name' | 'category' | 'description',
  fallback?: string,
): string {
  const svc = getServiceTypeByCode(code);
  const c = svc?.code || code;
  const key = `serviceType.${c}.${field === 'description' ? 'desc' : field}`;
  const v = t(key);
  if (v && v !== key) return v;
  return fallback || (svc ? (svc as any)[field] : '') || code;
}

export function getServiceTypeByCode(code: string): ServiceTypeConfig | undefined {
  // Chercher par code exact
  const exact = SERVICE_TYPES_CONFIG.find(s => s.code === code);
  if (exact) return exact;

  // Chercher dans les codes legacy
  return SERVICE_TYPES_CONFIG.find(s => s.legacyCodes.includes(code));
}

/**
 * Obtenir le code officiel à partir d'un code (legacy ou officiel)
 */
export function normalizeServiceCode(code: string): string {
  const service = getServiceTypeByCode(code);
  return service?.code || code;
}

/**
 * Liste des services pour le formulaire d'inscription vendeur
 */
export function getVendorSignupServices(): ServiceTypeConfig[] {
  return SERVICE_TYPES_CONFIG.filter(s => s.showInVendorSignup);
}

/**
 * Liste des services par section
 */
export function getServicesBySection(section: 'proximity' | 'professional' | 'digital'): ServiceTypeConfig[] {
  return SERVICE_TYPES_CONFIG.filter(s => s.section === section);
}

/**
 * Liste des services affichés dans "Services de proximité"
 */
export function getProximityServices(): ServiceTypeConfig[] {
  return SERVICE_TYPES_CONFIG.filter(s => s.showInProximity);
}

/**
 * Générer les options pour un select (VENDOR_SERVICE_TYPES compatible)
 */
export function getServiceTypesForSelect(): { value: string; label: string }[] {
  return SERVICE_TYPES_CONFIG.map(s => ({
    value: s.code,
    label: s.name
  }));
}
