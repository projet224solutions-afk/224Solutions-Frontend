import {
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Car,
  Dumbbell,
  GraduationCap,
  HardHat,
  Heart,
  Home,
  Laptop,
  LucideIcon,
  Package,
  Plane,
  Scissors,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Store,
  Tractor,
  Truck,
  Utensils,
  Wrench,
  Square,
  Hammer,
  Flame,
} from 'lucide-react';

export interface ServiceVisual {
  image: string;
  accent: string;
  icon: LucideIcon;
  logoImage?: string;
}

const BRAND_BLUE = '#04439e';
const BRAND_ORANGE = '#ff4000';

export const SERVICE_VISUALS: Record<string, ServiceVisual> = {
  agriculture: {
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    icon: Tractor,
    logoImage: '/service-icons-3d/agriculture.png',
  },
  beaute: {
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    icon: Scissors,
    logoImage: '/service-icons-3d/beaute.png',
  },
  construction: {
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    icon: HardHat,
    logoImage: '/service-icons-3d/construction.png',
  },
  plomberie: {
    image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80',
    accent: '#0E6BA8',
    icon: Wrench,
    logoImage: '/service-icons-3d/plomberie.png',
  },
  vitrerie: {
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80',
    accent: '#29A7C4',
    icon: Square,
    logoImage: '/service-icons-3d/vitrerie.png',
  },
  menuiserie: {
    image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80',
    accent: '#B5651D',
    icon: Hammer,
    logoImage: '/service-icons-3d/menuiserie.png',
  },
  soudure: {
    image: 'https://images.unsplash.com/photo-1565952511394-1e3e5f1f2f3d?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    icon: Flame,
    logoImage: '/service-icons-3d/soudure.png',
  },
  education: {
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    icon: GraduationCap,
  },
  ecommerce: {
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
    accent: BRAND_BLUE,
    icon: ShoppingBag,
    logoImage: '/service-icons-3d/boutique.png',
  },
  freelance: {
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    icon: Briefcase,
    logoImage: '/service-icons-3d/freelance.png',
  },
  informatique: {
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    icon: Laptop,
    logoImage: '/service-icons-3d/informatique.png',
  },
  livraison: {
    image: 'https://images.unsplash.com/photo-1648394794449-5dbe63f6a8b5?auto=format&fit=crop&w=800&q=80',
    accent: BRAND_ORANGE,
    icon: Truck,
    logoImage: '/service-icons-3d/livraison.png',
  },
  location: {
    image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    icon: Building2,
    logoImage: '/service-icons-3d/immobilier.png',
  },
  maison: {
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    accent: '#c2410c',
    icon: Home,
    logoImage: '/service-icons-3d/maison.png',
  },
  media: {
    image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    icon: Camera,
    logoImage: '/service-icons-3d/media.png',
  },
  menage: {
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    icon: Sparkles,
    logoImage: '/service-icons-3d/nettoyage.png',
  },
  reparation: {
    image: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    icon: Wrench,
    logoImage: '/service-icons-3d/reparation.png',
  },
  restaurant: {
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    accent: '#e85d04',
    icon: Utensils,
    logoImage: '/service-icons-3d/restaurant.png',
  },
  sante: {
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    icon: Stethoscope,
    logoImage: '/service-icons-3d/sante.png',
  },
  sport: {
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    icon: Dumbbell,
    logoImage: '/service-icons-3d/sport.png',
  },
  vtc: {
    image: 'https://images.unsplash.com/photo-1601979107535-46367552bc25?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    icon: Car,
    logoImage: '/service-icons-3d/vtc.png',
  },
  voyage: {
    image: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    icon: Plane,
  },
  digital_livre: {
    image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    icon: BookOpen,
  },
  digital_logiciel: {
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    icon: Laptop,
  },
  dropshipping: {
    image: 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=800&q=80',
    accent: '#ea580c',
    icon: Package,
  },
};

const FALLBACK_VISUAL: ServiceVisual = {
  image: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=800&q=80',
  accent: BRAND_BLUE,
  icon: Store,
};

export function getServiceVisual(input: {
  code?: string | null;
  name?: string | null;
  category?: string | null;
}): ServiceVisual {
  const code = input.code?.toLowerCase().trim() || '';
  const haystack = `${input.name || ''} ${input.category || ''}`.toLowerCase();

  if (code && SERVICE_VISUALS[code]) return SERVICE_VISUALS[code];
  if (haystack.includes('boutique') || haystack.includes('e-commerce') || haystack.includes('commerce')) return SERVICE_VISUALS.ecommerce;
  if (haystack.includes('éducation') || haystack.includes('education') || haystack.includes('formation')) return SERVICE_VISUALS.education;
  if (haystack.includes('immobilier') || haystack.includes('location')) return SERVICE_VISUALS.location;
  if (haystack.includes('photo') || haystack.includes('vidéo') || haystack.includes('video')) return SERVICE_VISUALS.media;
  if (haystack.includes('santé') || haystack.includes('sante') || haystack.includes('pharmacie')) return SERVICE_VISUALS.sante;
  if (haystack.includes('maison') || haystack.includes('déco') || haystack.includes('deco')) return SERVICE_VISUALS.maison;
  if (haystack.includes('livraison') || haystack.includes('coursier')) return SERVICE_VISUALS.livraison;
  if (haystack.includes('transport') || haystack.includes('vtc') || haystack.includes('taxi')) return SERVICE_VISUALS.vtc;
  if (haystack.includes('restaurant') || haystack.includes('alimentation')) return SERVICE_VISUALS.restaurant;
  if (haystack.includes('beauté') || haystack.includes('beaute') || haystack.includes('coiffure')) return SERVICE_VISUALS.beaute;
  if (haystack.includes('réparation') || haystack.includes('reparation') || haystack.includes('mécanique') || haystack.includes('mecanique')) return SERVICE_VISUALS.reparation;
  if (haystack.includes('nettoyage') || haystack.includes('ménage') || haystack.includes('menage')) return SERVICE_VISUALS.menage;
  if (haystack.includes('informatique') || haystack.includes('tech')) return SERVICE_VISUALS.informatique;
  if (haystack.includes('plomberie') || haystack.includes('plombier') || haystack.includes('sanitaire')) return SERVICE_VISUALS.plomberie;
  if (haystack.includes('vitrerie') || haystack.includes('vitrier') || haystack.includes('vitre')) return SERVICE_VISUALS.vitrerie;
  if (haystack.includes('menuiserie') || haystack.includes('menuisier') || haystack.includes('bois')) return SERVICE_VISUALS.menuiserie;
  if (haystack.includes('soudure') || haystack.includes('soudeur') || haystack.includes('métallerie') || haystack.includes('metallerie') || haystack.includes('ferronnerie')) return SERVICE_VISUALS.soudure;
  if (haystack.includes('construction') || haystack.includes('btp')) return SERVICE_VISUALS.construction;
  if (haystack.includes('agriculture') || haystack.includes('agricole')) return SERVICE_VISUALS.agriculture;
  if (haystack.includes('sport') || haystack.includes('fitness')) return SERVICE_VISUALS.sport;
  if (haystack.includes('voyage') || haystack.includes('tourisme')) return SERVICE_VISUALS.voyage;

  return FALLBACK_VISUAL;
}