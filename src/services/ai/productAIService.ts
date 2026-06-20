/**
 * 🤖 SERVICE IA COMPLET POUR PRODUITS VENDEURS
 *
 * Fonctionnalités:
 * 1. Détection automatique type de produit
 * 2. Catégorisation intelligente
 * 3. Génération image réaliste
 * 4. Description professionnelle enrichie
 * 5. Tags automatiques
 * 6. Extraction caractéristiques
 */

import { supabase } from "@/integrations/supabase/client";

// ============================================
// TYPES ET INTERFACES
// ============================================

export interface ProductAnalysis {
  // Détection
  detectedType: string;
  category: string;
  subcategory?: string;

  // Caractéristiques extraites
  characteristics: {
    brand?: string;
    model?: string;
    color?: string;
    size?: string;
    capacity?: string;
    power?: string;
    material?: string;
    condition?: 'new' | 'used' | 'refurbished';
  };

  // Description enrichie
  enrichedDescription: {
    commercial: string;
    keyPoints: string[];
    technicalSpecs: Record<string, string>;
    packageContent?: string[];
    warranty?: string;
  };

  // Image et tags
  generatedImageUrl?: string;
  autoTags: string[];

  // Métadonnées
  confidence: number;
  language: 'fr' | 'en';
}

export interface ProductInput {
  name: string;
  description: string;
  price?: number;
  userId: string;
}

// ============================================
// CATÉGORIES PRINCIPALES
// ============================================

const CATEGORIES_MAP = {
  'electronique': [
    'téléphone', 'smartphone', 'iphone', 'samsung', 'huawei', 'xiaomi', 'oppo', 'tecno', 'infinix',
    'tablette', 'ipad', 'écouteurs', 'airpods', 'casque', 'power bank', 'chargeur', 'câble',
    'montre connectée', 'smartwatch', 'apple watch', 'bracelet connecté'
  ],
  'electromenager': [
    'marmite électrique', 'cuiseur', 'rice cooker', 'mixeur', 'blender', 'friteuse',
    'machine à laver', 'réfrigérateur', 'congélateur', 'climatiseur', 'ventilateur',
    'fer à repasser', 'micro-onde', 'four', 'bouilloire', 'cafetière', 'grille-pain'
  ],
  'informatique': [
    'ordinateur', 'laptop', 'pc', 'macbook', 'dell', 'hp', 'lenovo', 'asus',
    'clavier', 'souris', 'écran', 'moniteur', 'imprimante', 'scanner', 'webcam',
    'disque dur', 'ssd', 'ram', 'processeur', 'carte graphique'
  ],
  'mode': [
    'chaussure', 'basket', 'sneakers', 'sandales', 'bottes',
    't-shirt', 'chemise', 'pantalon', 'jean', 'robe', 'jupe',
    'veste', 'manteau', 'pull', 'sweat', 'hoodie',
    'sac', 'sac à main', 'portefeuille', 'ceinture', 'lunettes'
  ],
  'beaute': [
    'parfum', 'eau de toilette', 'eau de parfum', 'cologne',
    'crème', 'lotion', 'sérum', 'masque', 'démaquillant',
    'maquillage', 'rouge à lèvres', 'fond de teint', 'mascara',
    'shampoing', 'après-shampoing', 'gel douche', 'savon'
  ],
  'maison': [
    'meuble', 'table', 'chaise', 'lit', 'armoire', 'canapé',
    'décoration', 'lampe', 'luminaire', 'rideau', 'tapis',
    'vaisselle', 'assiette', 'verre', 'couverts', 'casserole'
  ],
  'sport': [
    'vélo', 'trottinette', 'skateboard', 'rollers',
    'ballon', 'football', 'basketball', 'volleyball',
    'haltère', 'poids', 'tapis de yoga', 'corde à sauter',
    'vêtement de sport', 'short', 'legging', 'brassière'
  ],
  'auto_moto': [
    'pneu', 'batterie', 'huile moteur', 'filtre',
    'casque moto', 'gants moto', 'blouson moto',
    'accessoire auto', 'tapis auto', 'housse siège'
  ]
};

// ============================================
// FONCTION PRINCIPALE: ANALYSE COMPLÈTE
// ============================================

export class ProductAIService {

  /**
   * 🎯 ANALYSE COMPLÈTE DU PRODUIT
   */
  static async analyzeProduct(input: ProductInput): Promise<ProductAnalysis> {
    try {
      const text = `${input.name} ${input.description}`.toLowerCase();

      // 1. Détection type et catégorie
      const category = this.detectCategory(text);
      const detectedType = this.detectProductType(text, category);

      // 2. Extraction caractéristiques
      const characteristics = this.extractCharacteristics(text);

      // 3. Génération description professionnelle
      const enrichedDescription = await this.generateProfessionalDescription(
        input.name,
        input.description,
        category,
        characteristics
      );

      // 4. Génération tags automatiques
      const autoTags = this.generateTags(input.name, input.description, category, characteristics);

      // 5. Génération image (optionnel)
      let generatedImageUrl: string | undefined;
      try {
        generatedImageUrl = await this.generateProductImage(
          input.name,
          input.description,
          category
        );
      } catch (error) {
        console.warn('⚠️ Génération image échouée:', error);
      }

      return {
        detectedType,
        category,
        characteristics,
        enrichedDescription,
        generatedImageUrl,
        autoTags,
        confidence: 0.85,
        language: 'fr'
      };

    } catch (error) {
      console.error('❌ Erreur analyse IA produit:', error);
      throw new Error('Échec de l\'analyse IA du produit');
    }
  }

  /**
   * 📦 DÉTECTION CATÉGORIE PRINCIPALE
   */
  private static detectCategory(text: string): string {
    let bestMatch = 'autre';
    let maxScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORIES_MAP)) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += keyword.length; // Mots plus longs = plus spécifiques
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestMatch = category;
      }
    }

    return bestMatch;
  }

  /**
   * 🔍 DÉTECTION TYPE PRÉCIS
   */
  private static detectProductType(text: string, category: string): string {
    const keywords = CATEGORIES_MAP[category as keyof typeof CATEGORIES_MAP] || [];

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return keyword;
      }
    }

    return category;
  }

  /**
   * ⚙️ EXTRACTION CARACTÉRISTIQUES
   */
  private static extractCharacteristics(text: string): ProductAnalysis['characteristics'] {
    const chars: ProductAnalysis['characteristics'] = {};

    // Marques téléphones
    const phoneBrands = ['iphone', 'samsung', 'huawei', 'xiaomi', 'oppo', 'tecno', 'infinix', 'realme'];
    for (const brand of phoneBrands) {
      if (text.includes(brand)) {
        chars.brand = brand.charAt(0).toUpperCase() + brand.slice(1);
        break;
      }
    }

    // Modèle
    const modelMatch = text.match(/\b([a-z]\d+|pro|max|plus|ultra|note|redmi)\b/gi);
    if (modelMatch) {
      chars.model = modelMatch.join(' ');
    }

    // Couleur
    const colors = ['noir', 'blanc', 'rouge', 'bleu', 'vert', 'rose', 'gris', 'silver', 'gold', 'purple'];
    for (const color of colors) {
      if (text.includes(color)) {
        chars.color = color;
        break;
      }
    }

    // Capacité (Go, GB, L, ml)
    const capacityMatch = text.match(/(\d+)\s*(go|gb|l|ml|litre|litres)/i);
    if (capacityMatch) {
      chars.capacity = `${capacityMatch[1]}${capacityMatch[2].toUpperCase()}`;
    }

    // Puissance (W, mAh)
    const powerMatch = text.match(/(\d+)\s*(w|watt|watts|mah)/i);
    if (powerMatch) {
      chars.power = `${powerMatch[1]}${powerMatch[2].toUpperCase()}`;
    }

    // Matériau
    const materials = ['inox', 'acier', 'plastique', 'verre', 'bois', 'cuir', 'tissu', 'métal'];
    for (const material of materials) {
      if (text.includes(material)) {
        chars.material = material;
        break;
      }
    }

    // État
    if (text.includes('neuf') || text.includes('nouveau')) {
      chars.condition = 'new';
    } else if (text.includes('occasion') || text.includes('utilisé') || text.includes('propre')) {
      chars.condition = 'used';
    } else if (text.includes('reconditionné')) {
      chars.condition = 'refurbished';
    }

    return chars;
  }

  /**
   * 📝 GÉNÉRATION DESCRIPTION PROFESSIONNELLE
   */
  private static async generateProfessionalDescription(
    name: string,
    description: string,
    category: string,
    characteristics: ProductAnalysis['characteristics']
  ): Promise<ProductAnalysis['enrichedDescription']> {

    // Appel Edge Function Supabase pour génération IA
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-description', {
        body: {
          name,
          description,
          category,
          characteristics
        }
      });

      if (error) throw error;

      return data;

    } catch (error) {
      console.warn('⚠️ IA génération indisponible, fallback manuel:', error);

      // Fallback: génération basique
      return this.generateBasicDescription(name, description, category, characteristics);
    }
  }

  /**
   * 📝 FALLBACK: Description basique
   */
  private static generateBasicDescription(
    name: string,
    description: string,
    category: string,
    characteristics: ProductAnalysis['characteristics']
  ): ProductAnalysis['enrichedDescription'] {

    const { brand, model, capacity, power, material, color, condition } = characteristics;

    // Description commerciale
    let commercial = `Découvrez ${name}`;

    if (brand) commercial += ` de la marque ${brand}`;
    if (model) commercial += ` ${model}`;
    if (condition === 'new') commercial += ', tout neuf et sous garantie';
    if (condition === 'used') commercial += ', en excellent état';

    commercial += '. ';

    if (category === 'electronique') {
      commercial += 'Un appareil performant et fiable pour un usage quotidien. ';
    } else if (category === 'electromenager') {
      commercial += 'Un appareil robuste et efficace pour faciliter vos tâches ménagères. ';
    } else if (category === 'mode') {
      commercial += 'Un article tendance et de qualité pour compléter votre style. ';
    }

    commercial += description;

    // Points forts
    const keyPoints: string[] = [];

    if (brand) keyPoints.push(`Marque ${brand} reconnue`);
    if (capacity) keyPoints.push(`Capacité ${capacity}`);
    if (power) keyPoints.push(`Puissance ${power}`);
    if (material) keyPoints.push(`Matériau ${material} de qualité`);
    if (color) keyPoints.push(`Couleur ${color}`);
    if (condition === 'new') keyPoints.push('État neuf');
    if (condition === 'used') keyPoints.push('Excellent état');

    keyPoints.push('Livraison rapide disponible');
    keyPoints.push('Service client réactif');

    // Caractéristiques techniques
    const technicalSpecs: Record<string, string> = {};

    if (brand) technicalSpecs['Marque'] = brand;
    if (model) technicalSpecs['Modèle'] = model;
    if (capacity) technicalSpecs['Capacité'] = capacity;
    if (power) technicalSpecs['Puissance'] = power;
    if (material) technicalSpecs['Matériau'] = material;
    if (color) technicalSpecs['Couleur'] = color;
    if (condition) {
      technicalSpecs['État'] = condition === 'new' ? 'Neuf' : condition === 'used' ? 'Occasion' : 'Reconditionné';
    }

    // Contenu du paquet
    const packageContent = [
      name,
      'Manuel d\'utilisation',
      'Garantie constructeur'
    ];

    if (category === 'electronique') {
      packageContent.push('Câble de charge', 'Adaptateur secteur');
    }

    return {
      commercial,
      keyPoints,
      technicalSpecs,
      packageContent,
      warranty: condition === 'new' ? 'Garantie constructeur 12 mois' : 'Garantie vendeur 3 mois'
    };
  }

  /**
   * 🏷️ GÉNÉRATION TAGS AUTOMATIQUES
   */
  private static generateTags(
    name: string,
    description: string,
    category: string,
    characteristics: ProductAnalysis['characteristics']
  ): string[] {
    const tags = new Set<string>();

    // Catégorie
    tags.add(category);

    // Caractéristiques
    if (characteristics.brand) tags.add(characteristics.brand);
    if (characteristics.model) tags.add(characteristics.model);
    if (characteristics.color) tags.add(characteristics.color);
    if (characteristics.condition) {
      tags.add(characteristics.condition === 'new' ? 'neuf' : 'occasion');
    }

    // Mots-clés du nom
    const nameWords = name.toLowerCase().split(/\s+/);
    nameWords.forEach(word => {
      if (word.length > 3) tags.add(word);
    });

    // Tags spécifiques par catégorie
    if (category === 'electronique') {
      tags.add('high-tech');
      tags.add('électronique');
    } else if (category === 'electromenager') {
      tags.add('cuisine');
      tags.add('maison');
    } else if (category === 'mode') {
      tags.add('fashion');
      tags.add('style');
    }

    return Array.from(tags).slice(0, 10);
  }

  /**
   * 🎨 GÉNÉRATION IMAGE IA
   */
  private static async generateProductImage(
    name: string,
    description: string,
    category: string
  ): Promise<string | undefined> {

    try {
      // Appel Edge Function pour génération image
      const { data, error } = await supabase.functions.invoke('generate-product-image', {
        body: {
          name,
          description,
          category,
          style: 'realistic', // realistic | studio | 3d
          background: 'white' // white | transparent | scene
        }
      });

      if (error) throw error;

      return data.imageUrl;

    } catch (error) {
      console.warn('⚠️ Génération image échouée:', error);
      return undefined;
    }
  }

  /**
   * 🔄 ENRICHIR PRODUIT EXISTANT
   */
  static async enrichExistingProduct(productId: string): Promise<ProductAnalysis> {
    try {
      // Récupérer produit
      const { data: product, error } = await supabase
        .from('products')
        .select('name, description, vendor_id')
        .eq('id', productId)
        .single();

      if (error || !product) {
        throw new Error('Produit non trouvé');
      }

      // Analyser
      const analysis = await this.analyzeProduct({
        name: product.name,
        description: product.description || '',
        userId: product.vendor_id
      });

      // Mettre à jour le produit
      const { error: updateError } = await supabase
        .from('products')
        .update({
          category: analysis.category,
          tags: analysis.autoTags,
          ai_generated_description: analysis.enrichedDescription.commercial,
          ai_characteristics: analysis.characteristics,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (updateError) {
        console.error('❌ Erreur mise à jour produit:', updateError);
      }

      return analysis;

    } catch (error) {
      console.error('❌ Erreur enrichissement produit:', error);
      throw error;
    }
  }
}

export default ProductAIService;
