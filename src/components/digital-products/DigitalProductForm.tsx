/**
 * Formulaire unifié de création de produit numérique
 * Version professionnelle avec distinction claire Direct vs Affiliation
 * Upload vers Google Cloud Storage
 * Inspiré de ClickBank, Gumroad, Teachable
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileText,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
  Video,
  Sparkles,
  ChevronRight,
  Tag,
  Download,
  Trash2,
  File,
  AlertCircle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { VideoUploadPreview } from '@/components/ui/video-upload-preview';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import type { DigitalProduct } from '@/hooks/useDigitalProducts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Import des composants professionnels
import { SalesModeSelector, type SalesMode } from './SalesModeSelector';
import { AffiliateForm, type AffiliateFormData } from './AffiliateForm';
import { DirectSaleForm, type DirectSaleFormData } from './DirectSaleForm';

type ProductCategory = 'dropshipping' | 'voyage' | 'logiciel' | 'formation' | 'livre' | 'custom' | 'ai' | 'physique_affilie';

interface DigitalProductFormProps {
  category: ProductCategory;
  onBack: () => void;
  onSuccess: () => void;
  mode?: 'create' | 'edit';
  initialProduct?: DigitalProduct;
}

interface TrainingLessonDraft {
  title: string;
  durationMinutes: string;
}

interface TrainingProductDraft {
  instructorName: string;
  level: 'debutant' | 'intermediaire' | 'avance';
  estimatedHours: string;
  targetAudience: string;
  learningGoals: string;
  lessons: TrainingLessonDraft[];
}

const DEFAULT_TRAINING_DRAFT: TrainingProductDraft = {
  instructorName: '',
  level: 'debutant',
  estimatedHours: '',
  targetAudience: '',
  learningGoals: '',
  lessons: [
    { title: '', durationMinutes: '' },
    { title: '', durationMinutes: '' },
    { title: '', durationMinutes: '' },
  ],
};

const categoryConfig: Record<ProductCategory, {
  title: string;
  description: string;
  icon: string;
  defaultMode: SalesMode;
  allowDirectSale: boolean;
  allowAffiliate: boolean;
}> = {
  dropshipping: {
    title: 'Produit Dropshipping',
    description: 'Importez un produit depuis Amazon, AliExpress ou Alibaba',
    icon: '📦',
    defaultMode: 'affiliate',
    allowDirectSale: false,
    allowAffiliate: true
  },
  voyage: {
    title: 'Voyage & Billetterie',
    description: 'Vols, hôtels, locations - en affiliation ou propres services',
    icon: '✈️',
    defaultMode: 'affiliate',
    allowDirectSale: true,
    allowAffiliate: true
  },
  logiciel: {
    title: 'Logiciel & SaaS',
    description: 'Vendez votre logiciel ou promouvez en affiliation',
    icon: '💻',
    defaultMode: 'affiliate',
    allowDirectSale: true,
    allowAffiliate: true
  },
  formation: {
    title: 'Formation & Coaching',
    description: 'Créez et vendez vos propres formations',
    icon: '🎓',
    defaultMode: 'direct',
    allowDirectSale: true,
    allowAffiliate: true
  },
  livre: {
    title: 'Livre & eBook',
    description: 'Vendez vos eBooks ou promouvez en affiliation',
    icon: '📚',
    defaultMode: 'direct',
    allowDirectSale: true,
    allowAffiliate: true
  },
  custom: {
    title: 'Produit Numérique',
    description: 'Templates, scripts, designs, services...',
    icon: '✨',
    defaultMode: 'direct',
    allowDirectSale: true,
    allowAffiliate: false
  },
  ai: {
    title: 'Outil IA',
    description: 'Solutions et services d\'intelligence artificielle',
    icon: '🤖',
    defaultMode: 'affiliate',
    allowDirectSale: true,
    allowAffiliate: true
  },
  physique_affilie: {
    title: 'Produit Physique Affilié',
    description: 'Vendez des produits physiques en affiliation (Amazon, AliExpress...)',
    icon: '🛍️',
    defaultMode: 'affiliate',
    allowDirectSale: false,
    allowAffiliate: true
  }
};

type FormStep = 'mode' | 'details' | 'pricing' | 'media' | 'review';

export function DigitalProductForm({ category, onBack, onSuccess, mode = 'create', initialProduct }: DigitalProductFormProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const navigate = useNavigate();
  const { user } = useAuth();
  const config = categoryConfig[category];

  // Hook pour upload vers GCS
  const { uploadFile: uploadToGCS } = useStorageUpload();

  // Pour physique_affilie, on saute l'étape mode car seule l'affiliation est disponible
  const initialStep: FormStep = category === 'physique_affilie' ? 'details' : 'mode';

  const [currentStep, setCurrentStep] = useState<FormStep>(initialStep);
  const [loading, setLoading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);

  const isEdit = mode === 'edit' && !!initialProduct?.id;

  // Fonction pour générer la description par IA
  const handleGenerateDescription = async () => {
    if (!baseData.title.trim()) {
      toast.error(t('digitalProductForm.veuillezDAbordSaisirUn'));
      return;
    }

    const deriveShortDescription = (text: string) => {
      const cleaned = (text || '').replace(/\s+/g, ' ').trim();
      if (!cleaned) return '';
      const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
      const words = firstSentence.split(' ').filter(Boolean).slice(0, 15).join(' ');
      if (!words) return '';
      return /[.!?]$/.test(words) ? words : `${words}.`;
    };

    setGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-description', {
        body: {
          name: baseData.title,
          category: category,
          productType: baseData.productType
        }
      });

      if (error) throw error;


      const nextDescription = (data?.description ?? '').toString();
      const nextShort = (data?.shortDescription ?? data?.short_description ?? '').toString().trim();

      if (!nextDescription.trim()) {
        throw new Error('Aucune description générée');
      }

      setBaseData(prev => ({
        ...prev,
        description: nextDescription,
        shortDescription: nextShort || deriveShortDescription(nextDescription) || prev.shortDescription,
      }));

      toast.success(t('digitalProductForm.descriptionGenereeAvecSucces'));
    } catch (error) {
      toast.error(t('digitalProductForm.erreurLorsDeLaGeneration'));
    } finally {
      setGeneratingDescription(false);
    }
  };
  // Mode de vente
  const [salesMode, setSalesMode] = useState<SalesMode>(() => {
    if (isEdit && initialProduct?.product_mode) return initialProduct.product_mode;
    return config.defaultMode;
  });
  const productTypes: Record<ProductCategory, { value: string; label: string }[]> = {
    logiciel: [
      { value: 'logiciel_montage', label: 'Logiciel de montage vidéo' },
      { value: 'antivirus', label: 'Antivirus / Sécurité' },
      { value: 'vpn', label: 'VPN' },
      { value: 'saas', label: 'SaaS / Application en ligne' },
      { value: 'plugin', label: 'Plugin / Extension' },
      { value: 'theme', label: 'Thème / Template' },
      { value: 'autre_logiciel', label: 'Autre logiciel' }
    ],
    voyage: [
      { value: 'reservation_hotel', label: 'Réservation hôtel' },
      { value: 'billet_avion', label: 'Billet d\'avion' },
      { value: 'location_voiture', label: 'Location de voiture' },
      { value: 'croisiere', label: 'Croisière' },
      { value: 'excursion', label: 'Excursion / Visite guidée' },
      { value: 'assurance_voyage', label: 'Assurance voyage' },
      { value: 'autre_voyage', label: 'Autre service voyage' }
    ],
    formation: [
      { value: 'formation_video', label: 'Formation vidéo' },
      { value: 'cours_en_ligne', label: 'Cours en ligne' },
      { value: 'coaching', label: 'Coaching / Mentorat' },
      { value: 'masterclass', label: 'Masterclass' },
      { value: 'certification', label: 'Certification' },
      { value: 'webinaire', label: 'Webinaire' },
      { value: 'autre_formation', label: 'Autre formation' }
    ],
    livre: [
      { value: 'ebook', label: 'eBook' },
      { value: 'audiobook', label: 'Livre audio' },
      { value: 'guide_pdf', label: 'Guide PDF' },
      { value: 'rapport', label: 'Rapport / Étude' },
      { value: 'magazine', label: 'Magazine numérique' },
      { value: 'autre_livre', label: 'Autre publication' }
    ],
    dropshipping: [
      { value: 'produit_aliexpress', label: 'Produit AliExpress' },
      { value: 'produit_amazon', label: 'Produit Amazon' },
      { value: 'produit_alibaba', label: 'Produit Alibaba' },
      { value: 'autre_dropship', label: 'Autre produit dropshipping' }
    ],
    custom: [
      { value: 'template', label: 'Template / Modèle' },
      { value: 'graphisme', label: 'Graphisme / Design' },
      { value: 'musique', label: 'Musique / Audio' },
      { value: 'video', label: 'Vidéo / Animation' },
      { value: 'script', label: 'Script / Code' },
      { value: 'service_digital', label: 'Service numérique' },
      { value: 'autre_custom', label: 'Autre produit numérique' }
    ],
    ai: [
      { value: 'outil_ia', label: 'Outil IA' },
      { value: 'chatbot', label: 'Chatbot IA' },
      { value: 'api_ia', label: 'API IA' },
      { value: 'modele_ia', label: 'Modèle IA' },
      { value: 'prompt', label: 'Pack de prompts' },
      { value: 'autre_ia', label: 'Autre solution IA' }
    ],
    physique_affilie: [
      { value: 'produit_amazon', label: 'Produit Amazon' },
      { value: 'produit_aliexpress', label: 'Produit AliExpress' },
      { value: 'produit_alibaba', label: 'Produit Alibaba' },
      { value: 'electronique', label: 'Électronique' },
      { value: 'mode_vetements', label: 'Mode & Vêtements' },
      { value: 'maison_jardin', label: 'Maison & Jardin' },
      { value: 'beaute_sante', label: 'Beauté & Santé' },
      { value: 'sport_loisirs', label: 'Sport & Loisirs' },
      { value: 'autre_physique', label: 'Autre produit physique' }
    ]
  };

  // Données de base
  const [baseData, setBaseData] = useState(() => ({
    title: initialProduct?.title || '',
    description: initialProduct?.description || '',
    shortDescription: initialProduct?.short_description || '',
    tags: (initialProduct?.tags || []).join(', '),
    productType: initialProduct?.product_type || '',
    publishImmediately: initialProduct ? initialProduct.status === 'published' : true
  }));

  const [trainingData, setTrainingData] = useState<TrainingProductDraft>(() => {
    const metadata = (initialProduct as any)?.metadata as any;
    const training = metadata?.training;

    if (!training) {
      return DEFAULT_TRAINING_DRAFT;
    }

    const lessons = Array.isArray(training.lessons) && training.lessons.length > 0
      ? training.lessons.map((lesson: any) => ({
        title: lesson?.title || '',
        durationMinutes: lesson?.durationMinutes ? String(lesson.durationMinutes) : '',
      }))
      : DEFAULT_TRAINING_DRAFT.lessons;

    return {
      instructorName: training.instructorName || '',
      level: training.level || 'debutant',
      estimatedHours: training.estimatedHours ? String(training.estimatedHours) : '',
      targetAudience: training.targetAudience || '',
      learningGoals: Array.isArray(training.learningGoals)
        ? training.learningGoals.join('\n')
        : (training.learningGoals || ''),
      lessons,
    };
  });

  // Données d'affiliation
  const [affiliateData, setAffiliateData] = useState<AffiliateFormData>(() => ({
    affiliateUrl: initialProduct?.affiliate_url || '',
    affiliatePlatform: initialProduct?.affiliate_platform || '',
    affiliateNetwork: 'direct',
    commissionRate: initialProduct?.commission_rate ? String(initialProduct.commission_rate) : '',
    commissionType: 'percentage',
    cookieDuration: '30d',
    payoutThreshold: '',
    trackingId: '',
    displayPrice: initialProduct?.price ? String(initialProduct.price) : '',
    displayCurrency: initialProduct?.currency || 'USD'
  }));

  // Données de vente directe
  const [directData, setDirectData] = useState<DirectSaleFormData>(() => ({
    price: initialProduct?.price ? String(initialProduct.price) : '',
    originalPrice: initialProduct?.original_price ? String(initialProduct.original_price) : '',
    currency: initialProduct?.currency || 'GNF',
    pricingType: (initialProduct?.pricing_type as DirectSaleFormData['pricingType']) || 'one_time',
    subscriptionInterval: (initialProduct?.subscription_interval as DirectSaleFormData['subscriptionInterval']) || 'monthly',
    minimumPrice: '',
    suggestedPrice: '',
    allowRefunds: true,
    refundPeriod: '30',
    limitedQuantity: false,
    maxQuantity: '',
    requireEmail: true,
    instantDelivery: true,
    accessDuration: (initialProduct?.access_duration as DirectSaleFormData['accessDuration']) || 'lifetime',
    affiliateEnabled: (initialProduct as any)?.affiliate_enabled || false,
    affiliateCommissionRate: (initialProduct as any)?.affiliate_commission_rate
      ? String((initialProduct as any).affiliate_commission_rate)
      : ''
  }));

  // Médias
  const [images, setImages] = useState<string[]>(() => initialProduct?.images || []);
  const [deliverableFiles, setDeliverableFiles] = useState<string[]>(() => initialProduct?.file_urls || []);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(() => initialProduct?.video_url || null);

  // Synchroniser les valeurs quand on ouvre l'édition depuis la liste
  useEffect(() => {
    if (!isEdit || !initialProduct) return;

    setSalesMode(initialProduct.product_mode);
    setBaseData({
      title: initialProduct.title || '',
      description: initialProduct.description || '',
      shortDescription: initialProduct.short_description || '',
      tags: (initialProduct.tags || []).join(', '),
      productType: initialProduct.product_type || '',
      publishImmediately: initialProduct.status === 'published',
    });

    const metadata = (initialProduct as any)?.metadata as any;
    const training = metadata?.training;
    if (training) {
      setTrainingData({
        instructorName: training.instructorName || '',
        level: training.level || 'debutant',
        estimatedHours: training.estimatedHours ? String(training.estimatedHours) : '',
        targetAudience: training.targetAudience || '',
        learningGoals: Array.isArray(training.learningGoals)
          ? training.learningGoals.join('\n')
          : (training.learningGoals || ''),
        lessons: Array.isArray(training.lessons) && training.lessons.length > 0
          ? training.lessons.map((lesson: any) => ({
            title: lesson?.title || '',
            durationMinutes: lesson?.durationMinutes ? String(lesson.durationMinutes) : '',
          }))
          : DEFAULT_TRAINING_DRAFT.lessons,
      });
    } else {
      setTrainingData(DEFAULT_TRAINING_DRAFT);
    }

    setAffiliateData((prev) => ({
      ...prev,
      affiliateUrl: initialProduct.affiliate_url || '',
      affiliatePlatform: initialProduct.affiliate_platform || '',
      commissionRate: initialProduct.commission_rate ? String(initialProduct.commission_rate) : '',
      displayPrice: initialProduct.price ? String(initialProduct.price) : '',
      displayCurrency: initialProduct.currency || 'USD',
    }));

    setDirectData((prev) => ({
      ...prev,
      price: initialProduct.price ? String(initialProduct.price) : '',
      originalPrice: initialProduct.original_price ? String(initialProduct.original_price) : '',
      currency: initialProduct.currency || 'GNF',
      pricingType: (initialProduct.pricing_type as DirectSaleFormData['pricingType']) || prev.pricingType,
      subscriptionInterval: (initialProduct.subscription_interval as DirectSaleFormData['subscriptionInterval']) || prev.subscriptionInterval,
      accessDuration: (initialProduct.access_duration as DirectSaleFormData['accessDuration']) || prev.accessDuration,
      affiliateEnabled: (initialProduct as any).affiliate_enabled ?? prev.affiliateEnabled,
      affiliateCommissionRate: (initialProduct as any).affiliate_commission_rate != null
        ? String((initialProduct as any).affiliate_commission_rate)
        : prev.affiliateCommissionRate,
    }));

    setImages(initialProduct.images || []);
    setDeliverableFiles(initialProduct.file_urls || []);
    setVideoPreviewUrl(initialProduct.video_url || null);
    setVideoFile(null);
  }, [isEdit, initialProduct]);

  // Pour physique_affilie, on n'inclut pas l'étape "mode" car seule l'affiliation est disponible
  const steps: { id: FormStep; label: string }[] = category === 'physique_affilie'
    ? [
      { id: 'details', label: 'Détails' },
      { id: 'pricing', label: 'Affiliation' },
      { id: 'media', label: 'Médias' },
      { id: 'review', label: 'Validation' }
    ]
    : [
      { id: 'mode', label: 'Mode' },
      { id: 'details', label: 'Détails' },
      { id: 'pricing', label: salesMode === 'affiliate' ? 'Affiliation' : 'Prix' },
      { id: 'media', label: 'Médias' },
      { id: 'review', label: 'Validation' }
    ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {

      const uploadResult = await uploadToGCS(file, {
        folder: 'products',
        subfolder: user.id,
      });

      if (uploadResult.success && uploadResult.publicUrl) {
        uploadedUrls.push(uploadResult.publicUrl);
      }
    }

    setImages(prev => [...prev, ...uploadedUrls]);
  };

  const handleDeliverableFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploadingFiles(true);
    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {

      try {
        // Use digital-products bucket with Supabase fallback preferred for reliability
        const uploadResult = await uploadToGCS(file, {
          folder: 'digital-products',
          subfolder: `${user.id}/deliverables`,
          preferSupabase: true, // Force Supabase Storage for reliability
        });

        if (uploadResult.success && uploadResult.publicUrl) {
          uploadedUrls.push(uploadResult.publicUrl);
        } else {
          console.error('[DigitalProductForm] Upload failed for file');
          toast.error(`Erreur upload: ${file.name} - ${uploadResult.error || 'Échec inconnu'}`);
        }
      } catch (err: any) {
        console.error('[DigitalProductForm] Upload exception');
        toast.error(`Erreur upload: ${file.name}`);
      }
    }

    if (uploadedUrls.length > 0) {
      setDeliverableFiles(prev => [...prev, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} fichier(s) ajouté(s) avec succès`);
    } else if (files.length > 0) {
      toast.error(t('digitalProductForm.aucunFichierNAPu'));
    }
    setUploadingFiles(false);
    // Reset input pour permettre de re-sélectionner le même fichier
    e.target.value = '';
  };

  const handleVideoSelect = (file: File | null, url: string | null) => {
    setVideoFile(file);
    setVideoPreviewUrl(url);
  };

  const updateTrainingLesson = (index: number, field: keyof TrainingLessonDraft, value: string) => {
    setTrainingData((prev) => ({
      ...prev,
      lessons: prev.lessons.map((lesson, lessonIndex) =>
        lessonIndex === index ? { ...lesson, [field]: value } : lesson
      ),
    }));
  };

  const addTrainingLesson = () => {
    setTrainingData((prev) => ({
      ...prev,
      lessons: [...prev.lessons, { title: '', durationMinutes: '' }],
    }));
  };

  const removeTrainingLesson = (index: number) => {
    setTrainingData((prev) => ({
      ...prev,
      lessons: prev.lessons.filter((_, lessonIndex) => lessonIndex !== index),
    }));
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    } else {
      onBack();
    }
  };

  const validateStep = (): boolean => {
    switch (currentStep) {
      case 'mode':
        return true;
      case 'details':
        if (!baseData.title.trim()) {
          toast.error(t('digitalProductForm.leTitreEstObligatoire'));
          return false;
        }

        if (category === 'formation') {
          const filledLessons = trainingData.lessons.filter((lesson) => lesson.title.trim().length > 0);
          const hasInvalidLessonDuration = filledLessons.some((lesson) => {
            const lessonDuration = parseInt(lesson.durationMinutes || '0', 10);
            return Number.isNaN(lessonDuration) || lessonDuration <= 0 || lessonDuration > 60;
          });

          if (!trainingData.instructorName.trim()) {
            toast.error(t('digitalProductForm.leNomDuFormateurEst'));
            return false;
          }

          if (filledLessons.length === 0) {
            toast.error(t('digitalProductForm.ajoutezAuMoinsUnCours'));
            return false;
          }

          if (hasInvalidLessonDuration) {
            toast.error(t('digitalProductForm.chaqueCoursDoitDurerEntre'));
            return false;
          }
        }

        return true;
      case 'pricing':
        if (salesMode === 'affiliate') {
          if (!affiliateData.affiliateUrl) {
            toast.error(t('digitalProductForm.leLienDAffiliationEst'));
            return false;
          }
        } else {
          const parsedPrice = parseFloat(directData.price);
          if (!directData.price || isNaN(parsedPrice) || parsedPrice <= 0) {
            toast.error(t('digitalProductForm.lePrixEstObligatoire'));
            return false;
          }
        }
        return true;
      case 'media': {
        const hasDeliverableContent =
          deliverableFiles.length > 0 || !!videoFile || !!videoPreviewUrl;

        if (salesMode === 'direct' && !hasDeliverableContent) {
          toast.error(t('digitalProductForm.ajoutezUnFichierLivrableOu'));
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (uploadingFiles || uploadingVideo) {
      toast.error(t('digitalProductForm.veuillezAttendreLaFinDes'));
      return;
    }

    setLoading(true);
    try {
      // Récupérer le vendor_id
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      // Upload de la vidéo si présente
      let videoUrl: string | null = isEdit ? (initialProduct?.video_url || null) : null;
      if (videoFile) {
        setUploadingVideo(true);

        const uploadResult = await uploadToGCS(videoFile, {
          folder: 'videos',
          subfolder: user.id,
        });

        if (uploadResult.success && uploadResult.publicUrl) {
          videoUrl = uploadResult.publicUrl;
        }
        setUploadingVideo(false);
      }

      // Compatibilité: si aucun fichier livrable n'est ajouté mais qu'une vidéo existe,
      // on utilise la vidéo comme livrable principal (cas fréquent pour les produits vidéo).
      const finalDeliverableFiles = salesMode === 'direct'
        ? (deliverableFiles.length > 0 ? deliverableFiles : (videoUrl ? [videoUrl] : []))
        : [];

      if (salesMode === 'direct' && finalDeliverableFiles.length === 0) {
        toast.error(t('digitalProductForm.aucunFichierLivrableDetecte'));
        return;
      }

      // Construction des données selon le mode
      const productData: any = {
        merchant_id: user.id,
        vendor_id: vendor?.id || null,
        title: baseData.title.trim(),
        description: baseData.description.trim(),
        short_description: baseData.shortDescription.trim(),
        images: images,
        file_urls: finalDeliverableFiles,
        video_url: videoUrl,
        category: category,
        product_type: baseData.productType || null,
        product_mode: salesMode,
        tags: baseData.tags.split(',').map(t => t.trim()).filter(Boolean),
        status: baseData.publishImmediately ? 'published' : 'draft',
        published_at: baseData.publishImmediately
          ? (isEdit ? (initialProduct?.published_at || new Date().toISOString()) : new Date().toISOString())
          : null
      };

      if (category === 'formation') {
        const normalizedLessons = trainingData.lessons
          .filter((lesson) => lesson.title.trim().length > 0)
          .map((lesson, index) => ({
            order: index + 1,
            title: lesson.title.trim(),
            durationMinutes: Math.min(60, Math.max(1, parseInt(lesson.durationMinutes || '0', 10) || 0)),
          }));

        productData.metadata = {
          ...(((initialProduct as any)?.metadata as any) || {}),
          training: {
            instructorName: trainingData.instructorName.trim(),
            level: trainingData.level,
            estimatedHours: trainingData.estimatedHours ? parseFloat(trainingData.estimatedHours) : null,
            targetAudience: trainingData.targetAudience.trim(),
            learningGoals: trainingData.learningGoals
              .split('\n')
              .map((goal) => goal.trim())
              .filter(Boolean),
            lessons: normalizedLessons,
            videoMaxMinutes: 60,
          },
        };
      }

      if (salesMode === 'affiliate') {
        productData.affiliate_url = affiliateData.affiliateUrl;
        productData.affiliate_platform = affiliateData.affiliatePlatform || affiliateData.affiliateNetwork;
        productData.commission_rate = affiliateData.commissionRate ? parseFloat(affiliateData.commissionRate) : 0;
        productData.price = affiliateData.displayPrice ? parseFloat(affiliateData.displayPrice) : 0;
        productData.currency = affiliateData.displayCurrency || 'USD';
        productData.original_price = null;
      } else {
        productData.price = parseFloat(directData.price);
        productData.original_price = directData.originalPrice ? parseFloat(directData.originalPrice) : null;
        productData.currency = directData.currency;
        productData.commission_rate = 0;
        productData.affiliate_url = null;
        productData.affiliate_platform = null;
        // Save pricing type & subscription interval
        productData.pricing_type = directData.pricingType || 'one_time';
        productData.subscription_interval = directData.pricingType === 'subscription' ? directData.subscriptionInterval : null;
        productData.access_duration = directData.accessDuration || 'lifetime';
        // Affiliation (programme interne) — produits numériques en vente directe uniquement.
        productData.affiliate_enabled = directData.affiliateEnabled || false;
        productData.affiliate_commission_rate = directData.affiliateEnabled && directData.affiliateCommissionRate
          ? parseFloat(directData.affiliateCommissionRate)
          : 0;
      }

      if (isEdit) {
        const updateData = { ...productData };
        delete updateData.merchant_id;
        delete updateData.vendor_id;

        const { error } = await supabase
          .from('digital_products')
          .update(updateData)
          .eq('id', initialProduct!.id);

        if (error) throw error;
        toast.success(t('digitalProductForm.produitMisAJourAvec'));
      } else {
        const { error } = await supabase
          .from('digital_products')
          .insert(productData);

        if (error) throw error;

        toast.success(salesMode === 'affiliate'
          ? 'Produit affilié créé avec succès!'
          : 'Produit en vente directe créé!'
        );
      }

      onSuccess();
    } catch (error) {
      console.error('Erreur création/édition produit:', error);
      toast.error(isEdit ? 'Erreur lors de la modification du produit' : 'Erreur lors de la création du produit');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {

    switch (currentStep) {
      case 'mode':
        return (
          <SalesModeSelector
            value={salesMode}
            onChange={(mode) => {
              setSalesMode(mode);
            }}
            disabled={!config.allowDirectSale && !config.allowAffiliate}
            hideDirectSale={category === 'physique_affilie'}
          />
        );

      case 'details':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Informations du produit
                </CardTitle>
                <CardDescription className="text-xs">
                  {salesMode === 'affiliate'
                    ? 'Décrivez le produit partenaire que vous promouvez'
                    : 'Présentez votre produit aux acheteurs potentiels'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">
                    Titre du produit <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={baseData.title}
                    onChange={(e) => setBaseData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={salesMode === 'affiliate'
                      ? "Ex: Formation Marketing Digital - Systeme.io"
                      : "Ex: Ma Formation Complète React.js"
                    }
                    className="mt-1.5"
                  />
                </div>

                {/* Type de produit - Select professionnel */}
                <div>
                  <Label htmlFor="productType" className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5" />
                    Type de produit
                  </Label>
                  <Select
                    value={baseData.productType}
                    onValueChange={(value) => setBaseData(prev => ({ ...prev, productType: value }))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder={t('digitalProductForm.selectionnezUnTypeDeProduit')} />
                    </SelectTrigger>
                    <SelectContent>
                      {productTypes[category]?.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Catégorisez votre produit pour une meilleure visibilité
                  </p>
                </div>

                <div>
                  <Label htmlFor="shortDescription">Description courte</Label>
                  <Input
                    id="shortDescription"
                    value={baseData.shortDescription}
                    onChange={(e) => setBaseData(prev => ({ ...prev, shortDescription: e.target.value }))}
                    placeholder={t('digitalProductForm.resumeAccrocheurEnUnePhrase')}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description">{t('digitalProductForm.descriptionComplete')}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateDescription}
                      disabled={generatingDescription || !baseData.title.trim()}
                      className="h-7 text-xs gap-1.5"
                    >
                      {generatingDescription ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Générer par IA
                    </Button>
                  </div>
                  <Textarea
                    id="description"
                    value={baseData.description}
                    onChange={(e) => setBaseData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={salesMode === 'affiliate'
                      ? "Décrivez les avantages du produit et pourquoi vos visiteurs devraient l'acheter..."
                      : "Décrivez votre produit en détail : ce qu'il contient, ses bénéfices..."
                    }
                    rows={5}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="tags">{t('digitalProductForm.tagsSeparesParDesVirgules')}</Label>
                  <Input
                    id="tags"
                    value={baseData.tags}
                    onChange={(e) => setBaseData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="marketing, formation, business, affiliation"
                    className="mt-1.5"
                  />
                </div>

                {category === 'formation' && (
                  <Card className="rounded-[24px] border-[#dce8fb] bg-[linear-gradient(180deg,#f9fbff_0%,#f3f8ff_100%)] shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Architecture de la formation
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Structurez votre offre comme une academie premium: positionnement, objectifs d'apprentissage et decoupage par cours.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="training-instructor">{t('digitalProductForm.nomDuFormateur')}</Label>
                          <Input
                            id="training-instructor"
                            value={trainingData.instructorName}
                            onChange={(e) => setTrainingData((prev) => ({ ...prev, instructorName: e.target.value }))}
                            placeholder="Ex: Mariama Diallo"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label>Niveau cible</Label>
                          <Select
                            value={trainingData.level}
                            onValueChange={(value) => setTrainingData((prev) => ({ ...prev, level: value as TrainingProductDraft['level'] }))}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue placeholder={t('digitalProductForm.choisirUnNiveau')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="debutant">Debutant</SelectItem>
                              <SelectItem value="intermediaire">Intermediaire</SelectItem>
                              <SelectItem value="avance">Avance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="training-hours">Duree totale estimee (heures)</Label>
                          <Input
                            id="training-hours"
                            type="number"
                            min="1"
                            step="0.5"
                            value={trainingData.estimatedHours}
                            onChange={(e) => setTrainingData((prev) => ({ ...prev, estimatedHours: e.target.value }))}
                            placeholder="Ex: 8"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label htmlFor="training-audience">Audience cible</Label>
                          <Input
                            id="training-audience"
                            value={trainingData.targetAudience}
                            onChange={(e) => setTrainingData((prev) => ({ ...prev, targetAudience: e.target.value }))}
                            placeholder={t('digitalProductForm.exDebutantsQuiVeulentLancer')}
                            className="mt-1.5"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="training-goals">Ce que l'apprenant va maitriser</Label>
                        <Textarea
                          id="training-goals"
                          rows={4}
                          value={trainingData.learningGoals}
                          onChange={(e) => setTrainingData((prev) => ({ ...prev, learningGoals: e.target.value }))}
                          placeholder={"Ex:\n- Comprendre la strategie\n- Construire une offre\n- Mettre en ligne un tunnel"}
                          className="mt-1.5"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <Label>Decoupage par cours</Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Chaque video de cours est plafonnee a 60 minutes pour garder un format premium, digestible et compatible mobile.
                            </p>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={addTrainingLesson}>
                            Ajouter un cours
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {trainingData.lessons.map((lesson, index) => (
                            <div key={`lesson-${index}`} className="grid gap-3 rounded-2xl border border-[#dbe7fa] bg-white p-3 sm:grid-cols-[1fr_140px_auto]">
                              <div>
                                <Label htmlFor={`lesson-title-${index}`}>Cours {index + 1}</Label>
                                <Input
                                  id={`lesson-title-${index}`}
                                  value={lesson.title}
                                  onChange={(e) => updateTrainingLesson(index, 'title', e.target.value)}
                                  placeholder="Ex: Installer son environnement"
                                  className="mt-1.5"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`lesson-duration-${index}`}>Duree (min)</Label>
                                <Input
                                  id={`lesson-duration-${index}`}
                                  type="number"
                                  min="1"
                                  max="60"
                                  value={lesson.durationMinutes}
                                  onChange={(e) => updateTrainingLesson(index, 'durationMinutes', e.target.value)}
                                  placeholder="45"
                                  className="mt-1.5"
                                />
                              </div>
                              <div className="flex items-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeTrainingLesson(index)}
                                  disabled={trainingData.lessons.length <= 1}
                                  className="h-10 w-10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'pricing':
        return salesMode === 'affiliate' ? (
          <AffiliateForm
            data={affiliateData}
            onChange={(updates) => setAffiliateData(prev => ({ ...prev, ...updates }))}
          />
        ) : (
          <DirectSaleForm
            data={directData}
            onChange={(updates) => setDirectData(prev => ({ ...prev, ...updates }))}
          />
        );

      case 'media':
        return (
          <div className="space-y-4">
            {/* Images */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  Images du produit
                </CardTitle>
                <CardDescription className="text-xs">
                  Ajoutez des images attractives pour présenter le produit
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {images.map((img, i) => (
                        <div key={i} className="relative shrink-0">
                          <img
                            src={img}
                            alt={`Image ${i + 1}`}
                            className="w-24 h-24 object-cover rounded-lg border border-border"
                          />
                          <button
                            onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Cliquez pour ajouter des images
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      PNG, JPG jusqu'à 5MB
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Fichiers livrables (vente directe uniquement) */}
            {salesMode === 'direct' && (
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Download className="w-4 h-4 text-primary" />
                    Fichiers à livrer à l'acheteur
                    <Badge variant="default" className="text-[10px]">Important</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Les fichiers que l'acheteur pourra télécharger après le paiement (PDF, ZIP, MP3, vidéo, etc.)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {deliverableFiles.length > 0 && (
                      <div className="space-y-2">
                        {deliverableFiles.map((url, i) => {
                          const fileName = (() => {
                            try {
                              const parts = url.split('/');
                              return decodeURIComponent(parts[parts.length - 1].split('?')[0]);
                            } catch { return `Fichier ${i + 1}`; }
                          })();
                          return (
                            <div key={i} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg border border-border">
                              <div className="flex items-center gap-2 min-w-0">
                                <File className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-sm truncate">{fileName}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setDeliverableFiles(prev => prev.filter((_, idx) => idx !== i))}
                                className="p-1 text-destructive hover:bg-destructive/10 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <label className={cn(
                      "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                      uploadingFiles ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/50"
                    )}>
                      {uploadingFiles ? (
                        <>
                          <Loader2 className="w-8 h-8 text-primary mb-2 animate-spin" />
                          <span className="text-sm text-primary font-medium">Upload en cours...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">
                            Ajoutez vos fichiers téléchargeables
                          </span>
                          <span className="text-xs text-muted-foreground mt-1">
                            Tous types de fichiers, y compris logiciels et installateurs (jusqu'à 5 Go)
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        multiple
                        onChange={handleDeliverableFileUpload}
                        className="hidden"
                        disabled={uploadingFiles}
                      />
                    </label>
                    {deliverableFiles.length === 0 && (
                      <p className="text-xs text-destructive flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Sans fichier, l'acheteur ne recevra rien après le paiement
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Vidéo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Video className="w-4 h-4 text-primary" />
                  Vidéo de présentation
                  <Badge variant="outline" className="text-[10px]">Optionnel</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VideoUploadPreview
                  maxDuration={category === 'formation' ? 3600 : 120}
                  maxSizeMB={category === 'formation' ? 1024 : 120}
                  onVideoSelect={handleVideoSelect}
                  currentVideoUrl={videoPreviewUrl}
                  label=""
                  helpText={category === 'formation'
                    ? "Ajoutez une vraie lecon ou bande-annonce de formation. Chaque video peut durer jusqu'a 1 heure."
                    : "Ajoutez une video de presentation courte pour mieux convertir sur mobile."}
                />
              </CardContent>
            </Card>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Résumé de votre produit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mode */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <Badge variant={salesMode === 'affiliate' ? 'secondary' : 'default'}>
                    {salesMode === 'affiliate' ? '🔗 Affiliation' : '💰 Vente directe'}
                  </Badge>
                </div>

                {/* Titre */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Titre</span>
                  <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                    {baseData.title || 'Non défini'}
                  </span>
                </div>

                {/* Prix ou Commission */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">
                    {salesMode === 'affiliate' ? 'Commission' : 'Prix'}
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {salesMode === 'affiliate'
                      ? `${affiliateData.commissionRate || '0'}%`
                      : fc(parseFloat(directData.price || '0'))
                    }
                  </span>
                </div>

                {/* Images */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Images</span>
                  <span className="text-sm text-foreground">
                    {images.length} image(s)
                  </span>
                </div>

                {/* Fichiers livrables */}
                {salesMode === 'direct' && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Fichiers livrables</span>
                    <span className={cn("text-sm font-medium", deliverableFiles.length === 0 ? "text-destructive" : "text-foreground")}>
                      {deliverableFiles.length === 0 ? '⚠️ Aucun fichier' : `${deliverableFiles.length} fichier(s)`}
                    </span>
                  </div>
                )}

                {/* Catégorie */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">{t('digitalProductForm.categorie')}</span>
                  <span className="text-sm text-foreground">
                    {config.icon} {config.title}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Publication */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">{t('digitalProductForm.publierImmediatement')}</p>
                    <p className="text-xs text-muted-foreground">
                      Le produit sera visible sur le marketplace
                    </p>
                  </div>
                  <Switch
                    checked={baseData.publishImmediately}
                    onCheckedChange={(v) => setBaseData(prev => ({ ...prev, publishImmediately: v }))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(4,67,158,0.10),_transparent_25%),linear-gradient(180deg,_#ffffff_0%,_#f8fbff_60%,_#ffffff_100%)] pb-[calc(10rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#dce7fb] bg-white/92 backdrop-blur-xl shadow-[0_10px_30px_rgba(4,67,158,0.06)]">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-11 w-11 shrink-0 rounded-2xl border border-[#dbe6fb] bg-white text-[#04439e] hover:bg-[#f5f9ff]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#04439e]/10 text-lg">{config.icon}</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-semibold text-[#0b1b33] sm:text-2xl">{config.title}</h1>
                    <Badge className="border-0 bg-[#ff4000]/12 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff4000] shadow-none">
                      {isEdit ? 'Édition' : 'Création'}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500">{config.description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="px-4 pb-4 sm:px-6">
          <div className="grid gap-3 md:grid-cols-5">
            {steps.map((step, idx) => (
              <div key={step.id} className={cn(
                'rounded-2xl border px-3 py-3 transition-all',
                idx === currentStepIndex
                  ? 'border-[#cfe0fb] bg-[#f5f9ff] shadow-[0_12px_28px_rgba(4,67,158,0.06)]'
                  : idx < currentStepIndex
                    ? 'border-[#ffe0d6] bg-[#fff5f1]'
                    : 'border-[#edf2fb] bg-white'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                    idx === currentStepIndex
                      ? 'bg-[#04439e] text-white'
                      : idx < currentStepIndex
                        ? 'bg-[#ff4000] text-white'
                        : 'bg-[#eef3fd] text-[#6f89b7]'
                  )}>
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f89b7]">Étape {idx + 1}</p>
                    <p className={cn('text-sm font-medium', idx <= currentStepIndex ? 'text-[#0b1b33]' : 'text-slate-500')}>
                      {step.label}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5 sm:px-6">
        {renderStepContent()}
      </div>

      {/* Footer Actions (placé au-dessus du QuickFooter global) */}
      <div className="fixed left-0 right-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] border-t border-[#dce7fb] bg-white/95 p-4 backdrop-blur-xl z-[90]">
        {currentStep === 'review' ? (
          <Button
            onClick={handleSubmit}
            disabled={loading || uploadingVideo}
            className="w-full h-12 rounded-2xl bg-[#ff4000] text-sm font-semibold text-white shadow-[0_16px_32px_rgba(255,64,0,0.22)] hover:bg-[#e53900]"
          >
            {loading || uploadingVideo ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploadingVideo ? 'Upload vidéo...' : 'Création en cours...'}
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {baseData.publishImmediately ? 'Créer et publier' : 'Enregistrer comme brouillon'}
              </>
            )}
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              className="h-12 flex-1 rounded-2xl border-[#d7e3f9] bg-white font-semibold text-[#04439e] hover:bg-[#f7fbff]"
            >
              Retour
            </Button>
            <Button
              onClick={() => {
                if (validateStep()) handleNext();
              }}
              className="h-12 flex-1 rounded-2xl bg-[#04439e] font-semibold text-white shadow-[0_16px_32px_rgba(4,67,158,0.20)] hover:bg-[#03347a]"
            >
              Continuer
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
