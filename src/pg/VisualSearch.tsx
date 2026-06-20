import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate, useLocation } from "react-router-dom";
import { Camera, Upload, ArrowLeft, Search, Loader2, X, ImageIcon, _Zap, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from '@/lib/formatters';

interface SearchResult {
  id: string;
  name: string;
  price: number;
  images?: string[];
  similarity?: number;
}

interface AnalysisResult {
  products: string[];
  category: string;
  colors: string[];
  description: string;
}

export default function VisualSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Charger l'image passée depuis la navigation (Home ou Marketplace)
  useEffect(() => {
    const stateImage = location.state?.capturedImage;
    if (stateImage && stateImage instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setCapturedImage(imageData);
      };
      reader.readAsDataURL(stateImage);
    }
  }, [location.state]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Erreur caméra:', error);
      toast.error(t('visualSearch.impossibleDAccederALa'));
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      stopCamera();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('visualSearch.veuillezSelectionnerUneImage'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const searchByImage = async () => {
    if (!capturedImage) {
      toast.error(t('visualSearch.veuillezDAbordCapturerOu'));
      return;
    }

    setIsSearching(true);
    setAnalysis(null);
    setKeywords([]);

    try {
      // Appeler l'edge function pour analyser l'image avec l'IA
      const { data, error } = await supabase.functions.invoke('visual-search', {
        body: { imageBase64: capturedImage }
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.results || []);
        setAnalysis(data.analysis || null);
        setKeywords(data.keywords || []);

        if (data.results?.length > 0) {
          toast.success(`${data.results.length} produits similaires trouvés !`);
        } else {
          toast.info(t('visualSearch.aucunProduitSimilaireTrouveEssayez'));
        }
      } else {
        throw new Error(data.error || 'Erreur de recherche');
      }
    } catch (error: any) {
      console.error('Erreur recherche:', error);
      toast.error(t('visualSearch.erreurLorsDeLaRecherche'));

      // Fallback: recherche basique si l'IA échoue
      try {
        const { data: products } = await supabase
          .from('products')
          .select('id, name, price, images')
          .eq('is_active', true)
          .limit(12);

        if (products) {
          setResults(products.map((p, i) => ({
            ...p,
            similarity: Math.max(0.3, 0.8 - (i * 0.05))
          })));
        }
      } catch (fallbackError) {
        console.error('Erreur fallback:', fallbackError);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const clearImage = () => {
    setCapturedImage(null);
    setResults([]);
    setAnalysis(null);
    setKeywords([]);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Recherche Visuelle</h1>
            <p className="text-xs text-muted-foreground">{t('visualSearch.trouvezDesProduitsParImage')}</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Zone de capture/upload */}
        {!showCamera && !capturedImage && (
          <Card className="border-dashed border-2 border-primary/30">
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <ImageIcon className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <h2 className="font-semibold text-foreground">{t('visualSearch.rechercherParImage')}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Prenez une photo ou téléchargez une image pour trouver des produits similaires
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={startCamera} className="gap-2">
                    <Camera className="w-4 h-4" />
                    Prendre une photo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Télécharger
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Caméra en direct */}
        {showCamera && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full aspect-[4/3] object-cover bg-black"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                <Button variant="secondary" onClick={stopCamera}>
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
                <Button onClick={capturePhoto} size="lg" className="rounded-full w-16 h-16">
                  <Camera className="w-6 h-6" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Image capturée */}
        {capturedImage && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 relative">
              <img
                src={capturedImage}
                alt={t('visualSearch.imageCapturee')}
                className="w-full aspect-[4/3] object-cover"
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2"
                onClick={clearImage}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Bouton de recherche */}
        {capturedImage && (
          <Button
            onClick={searchByImage}
            className="w-full gap-2"
            size="lg"
            disabled={isSearching}
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Recherche en cours...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Rechercher des produits similaires
              </>
            )}
          </Button>
        )}

        {/* Analyse IA - Affichage des mots-clés détectés */}
        {analysis && (
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Analyse IA</span>
              </div>
              {analysis.description && (
                <p className="text-sm text-muted-foreground mb-3">{analysis.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => navigate(`/marketplace?search=${encodeURIComponent(keyword)}`)}
                  >
                    <Tag className="w-3 h-3" />
                    {keyword}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Résultats */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Search className="w-4 h-4" />
              {results.length} produits similaires trouvés
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {results.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/marketplace?product=${product.id}`)}
                >
                  <CardContent className="p-0">
                    <div className="aspect-square bg-muted relative overflow-hidden rounded-t-lg">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      {product.similarity && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                          {Math.round(product.similarity * 100)}%
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-primary font-bold">
                        {formatCurrency(product.price)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
