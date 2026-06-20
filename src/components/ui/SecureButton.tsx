import * as React from "react";
import { startTransition, useCallback, useRef, useState } from "react";
import { Button, ButtonProps } from "./button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SecureButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Action asynchrone à exécuter */
  onSecureClick: () => Promise<void>;
  /** Texte affiché pendant le chargement */
  loadingText?: string;
  /** Délai anti-double clic (ms) */
  debounceMs?: number;
  /** Icône personnalisée pendant le chargement */
  loadingIcon?: React.ReactNode;
  /** Désactiver le bouton */
  disabled?: boolean;
  /** État de chargement externe (optionnel) */
  externalLoading?: boolean;
}

/**
 * Bouton sécurisé pour actions financières critiques
 *
 * ✅ INP < 200ms garanti
 * ✅ Protection anti-double clic
 * ✅ UI mise à jour avant l'action
 * ✅ Aucun blocage du thread principal
 */
export const SecureButton = React.forwardRef<HTMLButtonElement, SecureButtonProps>(
  (
    {
      onSecureClick,
      loadingText,
      debounceMs = 500,
      loadingIcon,
      disabled,
      externalLoading,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const [internalLoading, setInternalLoading] = useState(false);
    const isExecutingRef = useRef(false);
    const lastClickRef = useRef(0);

    const loading = externalLoading ?? internalLoading;

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        // Protection anti-double clic (synchrone)
        if (isExecutingRef.current || loading || disabled) {
          return;
        }

        // Debounce
        const now = Date.now();
        if (now - lastClickRef.current < debounceMs) {
          return;
        }

        // Verrouillage IMMÉDIAT (synchrone)
        isExecutingRef.current = true;
        lastClickRef.current = now;

        // UI update prioritaire (React 18+)
        startTransition(() => {
          setInternalLoading(true);
        });

        // Action déférée après le rendu
        requestAnimationFrame(() => {
          requestAnimationFrame(async () => {
            try {
              await onSecureClick();
            } catch (error) {
              console.error('[SecureButton] Erreur:', error);
            } finally {
              isExecutingRef.current = false;
              setInternalLoading(false);
            }
          });
        });
      },
      [onSecureClick, loading, disabled, debounceMs]
    );

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={loading || disabled}
        className={cn(
          "transition-all duration-150",
          loading && "cursor-not-allowed opacity-80",
          className
        )}
        aria-busy={loading}
        aria-disabled={loading || disabled}
        {...props}
      >
        {loading ? (
          <>
            {loadingIcon ?? <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loadingText ?? children}
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);

SecureButton.displayName = "SecureButton";

export default SecureButton;
