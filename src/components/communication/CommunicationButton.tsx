/**
 * 💬 BOUTON COMMUNICATION - 224SOLUTIONS
 * Composant professionnel pour initier une conversation
 *
 * Features:
 * - Design accessible et responsive
 * - États visuels clairs (loading, disabled)
 * - Validation des entrées
 * - Intégration avec le hook useCommunicationButton
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCommunicationButton } from '@/hooks/useCommunicationButton';

// ============================================================================
// TYPES
// ============================================================================

export interface CommunicationButtonProps {
  /** ID de l'utilisateur courant */
  userId: string;
  /** ID de l'utilisateur cible */
  targetId: string;
  /** Texte du bouton */
  label?: string;
  /** Message initial à envoyer */
  initialText?: string;
  /** Variante du bouton */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  /** Taille du bouton */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Classes CSS additionnelles */
  className?: string;
  /** Afficher l'icône */
  showIcon?: boolean;
  /** Désactiver le bouton */
  disabled?: boolean;
  /** Rediriger automatiquement */
  autoNavigate?: boolean;
  /** Callback après succès */
  onSuccess?: () => void;
  /** Callback en cas d'erreur */
  onError?: (error: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CommunicationButton({
  userId,
  targetId,
  label = 'Contacter',
  initialText = 'Bonjour',
  variant = 'default',
  size = 'default',
  className,
  showIcon = true,
  disabled = false,
  autoNavigate = true,
  onSuccess,
  onError
}: CommunicationButtonProps) {
  const { isLoading, startConversation } = useCommunicationButton({
    initialMessage: initialText,
    autoNavigate,
    showToasts: true,
    onSuccess: onSuccess ? () => onSuccess() : undefined,
    onError
  });

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!userId || !targetId || disabled || isLoading) {
      return;
    }

    await startConversation(userId, targetId, initialText);
  };

  const isDisabled = disabled || isLoading || !userId || !targetId;

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant={variant}
      size={size}
      className={cn(
        'transition-all duration-200',
        isLoading && 'cursor-wait',
        className
      )}
      aria-busy={isLoading}
      aria-label={isLoading ? 'Envoi en cours...' : label}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
          <span>Envoi...</span>
        </>
      ) : (
        <>
          {showIcon && (
            <MessageSquare className="w-4 h-4 mr-2" aria-hidden="true" />
          )}
          <span>{label}</span>
        </>
      )}
    </Button>
  );
}

// ============================================================================
// VARIANTS
// ============================================================================

/**
 * Version icône seule du bouton
 */
export function CommunicationIconButton({
  userId,
  targetId,
  initialText = 'Bonjour',
  className,
  disabled = false,
  autoNavigate = true,
  onSuccess,
  onError
}: Omit<CommunicationButtonProps, 'label' | 'showIcon' | 'variant' | 'size'>) {
  const { isLoading, startConversation } = useCommunicationButton({
    initialMessage: initialText,
    autoNavigate,
    showToasts: true,
    onSuccess: onSuccess ? () => onSuccess() : undefined,
    onError
  });

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!userId || !targetId || disabled || isLoading) {
      return;
    }

    await startConversation(userId, targetId, initialText);
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isLoading || !userId || !targetId}
      variant="ghost"
      size="icon"
      className={cn('h-9 w-9', className)}
      aria-busy={isLoading}
      aria-label="Envoyer un message"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <MessageSquare className="w-4 h-4" />
      )}
    </Button>
  );
}

/**
 * Version compacte pour les listes
 */
export function CommunicationCompactButton({
  userId,
  targetId,
  initialText = 'Bonjour',
  className,
  disabled = false,
  onSuccess,
  onError
}: Omit<CommunicationButtonProps, 'label' | 'showIcon' | 'variant' | 'size' | 'autoNavigate'>) {
  return (
    <CommunicationButton
      userId={userId}
      targetId={targetId}
      initialText={initialText}
      label="Message"
      variant="outline"
      size="sm"
      showIcon={true}
      disabled={disabled}
      autoNavigate={true}
      className={className}
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}

export default CommunicationButton;
