import React, {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const SPLINE_SCENE_URL =
  'https://prod.spline.design/h5xspcRA7yF54Tzy/scene.splinecode';

const LazySpline = lazy(() => import('@splinetool/react-spline'));

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mediaQuery.matches);

    update();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  return prefersReducedMotion;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    update();
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('resize', update);
    };
  }, [breakpoint]);

  return isMobile;
}

function useLowEndDevice() {
  const [isLowEnd, setIsLowEnd] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const cores = navigator.hardwareConcurrency || 4;

    if ((typeof memory === 'number' && memory <= 4) || cores <= 4) {
      setIsLowEnd(true);
    }
  }, []);

  return isLowEnd;
}

function useInView<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, options);

    observer.observe(node);

    return () => observer.disconnect();
  }, [options]);

  return { ref, inView };
}

function SplineFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-indigo-500/10" />
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.14),transparent_42%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/65 to-background" />
    </div>
  );
}

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class SplineErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[HeroSection/Spline] render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function SplineCanvas({ scene }: { scene: string }) {
  return (
    <div className="absolute inset-0 h-full w-full opacity-30 sm:opacity-40 lg:opacity-50">
      <LazySpline scene={scene} />
    </div>
  );
}

function SplineBackground({
  scene = SPLINE_SCENE_URL,
  enableOnMobile = false,
  mobileBreakpoint = 768,
}: {
  scene?: string;
  enableOnMobile?: boolean;
  mobileBreakpoint?: number;
}) {
  const isClient = useIsClient();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile(mobileBreakpoint);
  const isLowEndDevice = useLowEndDevice();
  const { ref, inView } = useInView<HTMLDivElement>({
    rootMargin: '200px 0px',
    threshold: 0.05,
  });

  const shouldDisableSpline = useMemo(() => {
    if (!isClient) return true;
    if (prefersReducedMotion) return true;
    if (isLowEndDevice) return true;
    if (!enableOnMobile && isMobile) return true;
    return false;
  }, [enableOnMobile, isClient, isLowEndDevice, isMobile, prefersReducedMotion]);

  const shouldRenderSpline = !shouldDisableSpline && inView;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {shouldRenderSpline ? (
        <SplineErrorBoundary fallback={<SplineFallback />}>
          <Suspense fallback={<SplineFallback />}>
            <SplineCanvas scene={scene} />
          </Suspense>
        </SplineErrorBoundary>
      ) : (
        <SplineFallback />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <SplineBackground />

      <div className="relative z-10">
        <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center rounded-full border border-primary/20 bg-background/70 px-4 py-2 text-sm font-medium backdrop-blur">
              Votre badge ici
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Votre titre principal ici
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Votre sous-titre ici. Le contenu reste lisible, cliquable et stable,
              même si l’animation Spline ne charge pas.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow transition hover:opacity-90">
                Action principale
              </button>

              <button className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-border bg-background/80 px-6 py-3 font-semibold backdrop-blur transition hover:bg-background">
                Action secondaire
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
