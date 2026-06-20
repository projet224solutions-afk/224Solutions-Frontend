/**
 * CONFIGURATION DES FONCTIONNALITÉS D'ABONNEMENT PAR TYPE DE SERVICE
 * Chaque service a des features spécifiques à son industrie
 * Synchronisé avec serviceTypesConfig.ts
 */

export interface ServicePlanFeatureSet {
  free: string[];
  basic: string[];
  pro: string[];
  premium: string[];
}

/**
 * Features d'abonnement spécifiques par code de service
 */
export const SERVICE_SUBSCRIPTION_FEATURES: Record<string, ServicePlanFeatureSet> = {
  // ===== RESTAURANT =====
  restaurant: {
    free: [
      'Menu digital (6 plats max)',
      'Commandes sur place',
      '10 réservations/mois',
      'Notifications email',
    ],
    basic: [
      'Menu illimité (15 plats)',
      'Commandes sur place + à emporter',
      '50 réservations/mois',
      'Gestion de 3 tables',
      'Analytics des ventes de base',
      'Notifications push',
    ],
    pro: [
      'Menu illimité + variantes',
      'POS (Point de Vente) intégré',
      'Commandes livraison + sur place + emporter',
      'Réservations illimitées',
      'Gestion complète des tables (10 max)',
      'Gestion du personnel (10 employés)',
      'Analytics avancés par type de commande',
      'SMS aux clients',
      'Promotions & happy hours',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Tables illimitées + plan de salle',
      'Personnel illimité',
      'API de commande externe',
      'Branding personnalisé sur le menu digital',
      'Rapports financiers détaillés',
      'Multi-établissements',
      'Support prioritaire 24/7',
    ],
  },

  // ===== BEAUTÉ & BIEN-ÊTRE =====
  beaute: {
    free: [
      'Profil salon avec photos',
      '6 prestations max',
      '10 rendez-vous/mois',
      '1 employé(e)',
    ],
    basic: [
      '15 prestations',
      '50 rendez-vous/mois',
      '3 membres du personnel',
      'Agenda en ligne',
      'Rappels clients par email',
      'Historique des rendez-vous',
    ],
    pro: [
      'Prestations illimitées (50 max)',
      'Rendez-vous illimités',
      '10 membres du personnel',
      'Planning multi-employés',
      'SMS de rappel automatiques',
      'Gestion de la caisse',
      'Fidélité clients',
      'Analytics des prestations populaires',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Personnel illimité',
      'Réservation en ligne 24/7',
      'API intégration calendrier externe',
      'Branding personnalisé',
      'Rapports de performance par employé',
      'Multi-salons',
      'Support dédié 24/7',
    ],
  },

  // ===== VTC / TRANSPORT =====
  vtc: {
    free: [
      'Profil chauffeur',
      '4 types de véhicules',
      '10 courses/mois',
      'Tarification de base',
    ],
    basic: [
      '50 courses/mois',
      'Réservation instantanée + planifiée',
      'Historique des courses',
      'Gestion de 3 véhicules',
      'Calcul automatique des tarifs',
      'Notifications client',
    ],
    pro: [
      'Courses illimitées',
      'Flotte jusqu\'à 10 véhicules',
      'Suivi GPS en temps réel',
      'SMS au client avec ETA',
      'Analytics des zones populaires',
      'Gestion des chauffeurs',
      'Facturation automatique',
      'Tarifs dynamiques',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Flotte illimitée',
      'API de réservation externe',
      'Intégration cartographique avancée',
      'Rapports de rentabilité par véhicule',
      'Multi-agences',
      'Support prioritaire 24/7',
      'Branding application personnalisé',
    ],
  },

  // ===== RÉPARATION =====
  reparation: {
    free: [
      '5 catégories de réparation',
      '10 demandes/mois',
      'Devis manuels',
      'Profil basique',
    ],
    basic: [
      '50 demandes/mois',
      'Devis automatisés',
      'Suivi des interventions',
      'Historique client',
      'Gestion de 3 techniciens',
      'Notifications email/push',
    ],
    pro: [
      'Demandes illimitées',
      '10 techniciens',
      'Planning d\'interventions',
      'Gestion du stock de pièces',
      'Garantie & suivi post-réparation',
      'SMS de suivi au client',
      'Analytics par catégorie',
      'Facturation automatique',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Techniciens illimités',
      'API de demande externe',
      'Multi-ateliers',
      'Rapports de productivité',
      'Gestion des garanties avancée',
      'Support prioritaire 24/7',
      'Branding personnalisé',
    ],
  },

  // ===== MÉNAGE & ENTRETIEN =====
  menage: {
    free: [
      '4 services de nettoyage',
      '10 réservations/mois',
      '1 agent de nettoyage',
      'Planning de base',
    ],
    basic: [
      '6 services',
      '50 réservations/mois',
      '3 agents',
      'Contrats récurrents',
      'Rappels automatiques',
      'Historique des interventions',
    ],
    pro: [
      'Services illimités',
      'Réservations illimitées',
      '10 agents',
      'Contrats récurrents avec remises',
      'SMS de confirmation',
      'Analytics des zones couvertes',
      'Facturation automatique',
      'Gestion du matériel',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Agents illimités',
      'API de réservation externe',
      'Multi-zones géographiques',
      'Rapports de qualité & satisfaction',
      'Support dédié 24/7',
      'Branding personnalisé',
      'CRM client avancé',
    ],
  },

  // ===== INFORMATIQUE / TECH =====
  informatique: {
    free: [
      '3 projets actifs max',
      'Portfolio basique',
      'Devis manuels',
      'Profil développeur',
    ],
    basic: [
      '10 projets actifs',
      'Portfolio amélioré',
      '15 devis/mois',
      'Suivi de progression',
      'Gestion des paiements par étapes',
      'Notifications client',
    ],
    pro: [
      'Projets illimités (50 max)',
      'Devis illimités',
      'Gestion d\'équipe (10 développeurs)',
      'Suivi des heures travaillées',
      'Analytics de rentabilité',
      'Facturation automatique',
      'CRM clients',
      'Intégration Git',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Équipe illimitée',
      'API de suivi de projet externe',
      'Multi-agences',
      'Rapports de performance',
      'Support prioritaire 24/7',
      'Branding portfolio personnalisé',
      'CI/CD intégré',
    ],
  },

  // ===== LIVRAISON / COURSIER =====
  livraison: {
    free: [
      '10 livraisons/mois',
      '2 livreurs max',
      'Suivi basique',
      'Numéro de tracking',
    ],
    basic: [
      '50 livraisons/mois',
      '5 livreurs',
      'Types de colis multiples',
      'Suivi en temps réel',
      'Notifications client',
      'Historique complet',
    ],
    pro: [
      'Livraisons illimitées',
      '15 livreurs',
      'Attribution automatique',
      'Optimisation des itinéraires',
      'SMS de suivi',
      'Analytics de performance',
      'Facturation automatique',
      'Zones de livraison personnalisées',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Livreurs illimités',
      'API de livraison externe',
      'Multi-dépôts',
      'Rapports de rentabilité',
      'Support prioritaire 24/7',
      'Branding personnalisé',
      'Intégration e-commerce',
    ],
  },

  // ===== E-COMMERCE / BOUTIQUE =====
  ecommerce: {
    free: [
      '6 produits max',
      'Vitrine en ligne basique',
      '10 commandes/mois',
      'Paiement cash uniquement',
    ],
    basic: [
      '15 produits',
      '50 commandes/mois',
      'Gestion du stock',
      'Paiement mobile (Orange/MTN)',
      'Notifications de commande',
      'Catégories de produits',
    ],
    pro: [
      '50 produits',
      'Commandes illimitées',
      'Variantes de produits (taille, couleur)',
      'Promotions & codes promo',
      'Analytics des ventes',
      'SMS de suivi commande',
      'Gestion multi-entrepôts',
      'Listing prioritaire marketplace',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Produits illimités',
      'API e-commerce externe',
      'Branding boutique personnalisé',
      'Rapports financiers détaillés',
      'Multi-boutiques',
      'Support prioritaire 24/7',
      'Intégration livraison avancée',
    ],
  },

  // ===== SPORT & FITNESS =====
  sport: {
    free: [
      '20 membres max',
      '2 cours/semaine',
      'Check-in basique',
      'Profil salle de sport',
    ],
    basic: [
      '100 membres',
      '50 cours/mois',
      '3 instructeurs',
      'Planning des cours',
      'Abonnements membres',
      'Rappels automatiques',
    ],
    pro: [
      'Membres illimités (500 max)',
      'Cours illimités',
      '10 instructeurs',
      'Planning multi-salles',
      'Suivi des check-ins',
      'SMS de rappel',
      'Analytics de fréquentation',
      'Gestion de l\'équipement',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Membres & instructeurs illimités',
      'Application mobile personnalisée',
      'API de réservation externe',
      'Rapports de performance par membre',
      'Multi-centres',
      'Support prioritaire 24/7',
      'Programme de nutrition intégré',
    ],
  },

  // ===== IMMOBILIER =====
  location: {
    free: [
      '5 biens max',
      'Fiches de biens basiques',
      '10 visites/mois',
      'Profil agent immobilier',
    ],
    basic: [
      '15 biens',
      '50 visites/mois',
      'Recherche avancée (filtres)',
      'Galerie photos HD',
      'Historique des visites',
      'Notifications prospects',
    ],
    pro: [
      '50 biens',
      'Visites illimitées',
      'Carte interactive des biens',
      'CRM prospects avancé',
      'Estimation de prix IA',
      'SMS de relance',
      'Analytics de performance',
      'Listing prioritaire',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Biens illimités',
      'API immobilière externe',
      'Visite virtuelle 360°',
      'Rapports de marché',
      'Multi-agences',
      'Support prioritaire 24/7',
      'Branding agence personnalisé',
    ],
  },

  // ===== PHOTO & VIDÉO =====
  media: {
    free: [
      '6 projets portfolio',
      '10 réservations/mois',
      'Galerie basique',
      'Profil photographe',
    ],
    basic: [
      '15 projets portfolio',
      '50 réservations/mois',
      'Galerie HD avec catégories',
      'Devis automatisés',
      'Calendrier de disponibilité',
      'Notifications client',
    ],
    pro: [
      'Portfolio illimité (50 projets)',
      'Réservations illimitées',
      'Galerie client privée',
      'Livraison fichiers HD en ligne',
      'Analytics des prestations',
      'SMS de rappel shooting',
      'Facturation automatique',
      'Contrats & licences',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Stockage illimité',
      'API de réservation externe',
      'Branding portfolio personnalisé',
      'Rapports financiers',
      'Multi-studios',
      'Support dédié 24/7',
      'Streaming vidéo intégré',
    ],
  },

  // ===== CONSTRUCTION & BTP =====
  construction: {
    free: [
      '2 projets de chantier',
      '5 professionnels max',
      'Devis basiques',
      'Suivi de progression',
    ],
    basic: [
      '10 projets',
      '15 professionnels',
      '50 devis/mois',
      'Matériaux & inventaire',
      'Planning de chantier',
      'Rapports journaliers',
    ],
    pro: [
      '50 projets',
      '50 professionnels',
      'Devis illimités',
      'Gestion budgétaire avancée',
      'Suivi des tâches par chantier',
      'SMS de coordination équipe',
      'Analytics de rentabilité',
      'Photos de chantier avec historique',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Projets & professionnels illimités',
      'API de suivi de chantier externe',
      'Plans et CAO intégrés',
      'Rapports de conformité',
      'Multi-entreprises',
      'Support prioritaire 24/7',
      'Gestion des sous-traitants',
    ],
  },

  // ===== AGRICULTURE =====
  agriculture: {
    free: [
      '6 produits agricoles',
      '10 commandes/mois',
      'Catalogue de base',
      'Profil producteur',
    ],
    basic: [
      '15 produits',
      '50 commandes/mois',
      'Catégories (fruits, viandes, céréales…)',
      'Gestion du stock saisonnier',
      'Calendrier de récolte',
      'Notifications commande',
    ],
    pro: [
      '50 produits',
      'Commandes illimitées',
      'Vente directe + gros',
      'Traçabilité des lots',
      'Analytics des ventes par saison',
      'SMS de livraison',
      'Facturation automatique',
      'Listing prioritaire marché local',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Produits illimités',
      'API d\'approvisionnement externe',
      'Rapports météo & prévisions',
      'Multi-exploitations',
      'Support prioritaire 24/7',
      'Branding producteur',
      'Certificat bio intégré',
    ],
  },

  // ===== FREELANCE / ADMINISTRATIF =====
  freelance: {
    free: [
      '3 missions actives',
      'Profil freelance',
      'Devis manuels',
      'Suivi basique des heures',
    ],
    basic: [
      '10 missions actives',
      '15 devis/mois',
      'Suivi des heures & tâches',
      'Facturation simple',
      'CRM clients (50 contacts)',
      'Notifications email',
    ],
    pro: [
      '50 missions',
      'Devis illimités',
      'Contrats & signatures',
      'Comptabilité de base',
      'Relances de paiement auto',
      'SMS de suivi mission',
      'Analytics de rentabilité',
      'Multi-services (secrétariat, compta, RH)',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Missions illimitées',
      'API de gestion externe',
      'Rapports fiscaux',
      'Multi-collaborateurs',
      'Support prioritaire 24/7',
      'Branding cabinet personnalisé',
      'Intégration bancaire',
    ],
  },

  // ===== SANTÉ & BIEN-ÊTRE =====
  sante: {
    free: [
      '6 médicaments/produits',
      '10 ventes/mois',
      'Inventaire de base',
      'Profil pharmacie',
    ],
    basic: [
      '15 produits',
      '50 ventes/mois',
      'Gestion du stock avec alertes',
      'Historique client',
      'Suivi des ordonnances',
      'Notifications expiration',
    ],
    pro: [
      '50 produits',
      'Ventes illimitées',
      'Gestion des ordonnances complète',
      'Fichier patients avancé',
      'Interactions médicamenteuses',
      'SMS de rappel prescription',
      'Analytics des ventes par catégorie',
      'Inventaire multi-zones',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Produits illimités',
      'API de commande externe',
      'Téléconsultation intégrée',
      'Rapports réglementaires',
      'Multi-officines',
      'Support prioritaire 24/7',
      'Intégration mutuelles',
    ],
  },

  // ===== MAISON & DÉCO =====
  maison: {
    free: [
      '6 articles max',
      '10 commandes/mois',
      'Catalogue basique',
      'Profil décorateur',
    ],
    basic: [
      '15 articles',
      '50 commandes/mois',
      'Catégories (meubles, éclairage, déco…)',
      'Gestion du stock',
      'Photos HD des produits',
      'Notifications commande',
    ],
    pro: [
      '50 articles',
      'Commandes illimitées',
      'Configurateur de pièce',
      'Devis de décoration',
      'Analytics des ventes',
      'SMS de livraison',
      'Facturation automatique',
      'Listing prioritaire',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Articles illimités',
      'API de catalogue externe',
      'Rendu 3D des intérieurs',
      'Multi-showrooms',
      'Support prioritaire 24/7',
      'Branding showroom personnalisé',
      'Intégration logistique',
    ],
  },

  // ===== ÉDUCATION / FORMATION =====
  education: {
    free: [
      '2 cours actifs',
      '10 étudiants/mois',
      'Planning basique',
      'Profil formateur',
    ],
    basic: [
      '10 cours',
      '50 étudiants/mois',
      'Inscription en ligne',
      'Documents de cours',
      'Suivi de présence',
      'Certificats de base',
    ],
    pro: [
      '50 cours',
      'Étudiants illimités',
      'Quiz & évaluations',
      'Vidéo à la demande',
      'Analytics de progression',
      'SMS de rappel cours',
      'Facturation des formations',
      'Forum de discussion',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Cours illimités',
      'API d\'inscription externe',
      'LMS intégré complet',
      'Multi-centres de formation',
      'Support dédié 24/7',
      'Branding école personnalisé',
      'Certification accréditée',
    ],
  },

  // ===== VOYAGE / TOURISME =====
  voyage: {
    free: [
      '5 offres/destinations',
      '10 réservations/mois',
      'Catalogue de base',
      'Profil agence',
    ],
    basic: [
      '15 offres',
      '50 réservations/mois',
      'Billets d\'avion basiques',
      'Réservation d\'hôtels',
      'Historique voyageurs',
      'Notifications de réservation',
    ],
    pro: [
      '50 offres',
      'Réservations illimitées',
      'Packages tout compris',
      'Assurance voyage intégrée',
      'Analytics de vente par destination',
      'SMS de rappel voyage',
      'Facturation automatique',
      'Programme fidélité',
    ],
    premium: [
      'Tout le plan Pro inclus',
      'Offres illimitées',
      'API de réservation GDS',
      'Multi-agences',
      'Rapports financiers avancés',
      'Support prioritaire 24/7',
      'Branding agence personnalisé',
      'Intégration compagnies aériennes',
    ],
  },
};

/**
 * Obtenir les features d'un plan pour un type de service
 */
export function getServicePlanFeatures(
  serviceCode: string,
  planName: string
): string[] {
  const features = SERVICE_SUBSCRIPTION_FEATURES[serviceCode];
  if (!features) {
    // Fallback générique
    return SERVICE_SUBSCRIPTION_FEATURES['ecommerce']?.[planName as keyof ServicePlanFeatureSet] || [];
  }
  return features[planName as keyof ServicePlanFeatureSet] || [];
}

/**
 * Obtenir toutes les features par plan pour un service
 */
export function getAllPlanFeaturesForService(
  serviceCode: string
): ServicePlanFeatureSet {
  return SERVICE_SUBSCRIPTION_FEATURES[serviceCode] || SERVICE_SUBSCRIPTION_FEATURES['ecommerce'];
}
