import { useTranslation } from "@/hooks/useTranslation";
/**
 * Composant de bulle de message amélioré
 * Supporte: réponse à un message, statut de lecture, suppression
 */

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Reply,
  Trash2,
  Copy,
  MoreVertical,
  X,
} from 'lucide-react';
import { MessageStatusBadge } from './PresenceIndicator';
import type { Message, UserProfile } from '@/types/communication.types';

interface EnhancedMessageBubbleProps {
  message: Message;
  isOwn: boolean;
  sender?: UserProfile;
  replyToMessage?: Message | null;
  onReply?: (message: Message) => void;
  onDelete?: (messageId: string, deleteForEveryone: boolean) => void;
  onCopy?: (content: string) => void;
  showAvatar?: boolean;
  showSenderName?: boolean;
  className?: string;
}

export function EnhancedMessageBubble({
  message,
  isOwn,
  sender,
  replyToMessage,
  onReply,
  onDelete,
  onCopy,
  showAvatar = true,
  showSenderName = false,
  className,
}: EnhancedMessageBubbleProps) {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Gestion du long press pour mobile
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowMenu(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    onCopy?.(message.content);
  };

  const handleDeleteConfirm = () => {
    onDelete?.(message.id, deleteForEveryone);
    setShowDeleteDialog(false);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Message supprimé
  if (message.deleted_at) {
    return (
      <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start', className)}>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 text-muted-foreground italic text-sm">
          <X className="w-4 h-4" />
          <span>{t('enhancedMessageBubble.ceMessageAEteSupprime')}</span>
        </div>
      </div>
    );
  }

  const senderName = sender
    ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || sender.email
    : 'Utilisateur';

  const senderInitials = sender
    ? `${sender.first_name?.[0] || ''}${sender.last_name?.[0] || ''}`.toUpperCase() || sender.email[0].toUpperCase()
    : 'U';

  return (
    <>
      <div
        className={cn(
          'flex gap-2 group',
          isOwn ? 'flex-row-reverse' : 'flex-row',
          className
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Avatar */}
        {showAvatar && !isOwn && (
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={sender?.avatar_url} alt={senderName} />
            <AvatarFallback className="text-xs bg-primary/10">
              {senderInitials}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Contenu du message */}
        <div className={cn('max-w-[85%] sm:max-w-[75%] space-y-1 min-w-0', isOwn ? 'items-end' : 'items-start')}>
          {/* Nom de l'expéditeur */}
          {showSenderName && !isOwn && (
            <span className="text-xs font-medium text-muted-foreground px-1">
              {senderName}
            </span>
          )}

          {/* Message en réponse */}
          {(replyToMessage || message.reply_to) && (
            <div
              className={cn(
                'flex items-start gap-2 px-3 py-2 rounded-lg text-xs border-l-2',
                isOwn
                  ? 'bg-primary/10 border-primary/50 text-primary-foreground/70'
                  : 'bg-muted/50 border-muted-foreground/30'
              )}
            >
              <Reply className="w-3 h-3 flex-shrink-0 mt-0.5 rotate-180" />
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {(replyToMessage || message.reply_to)?.sender?.first_name || 'Utilisateur'}
                </p>
                <p className="truncate opacity-75">
                  {(replyToMessage || message.reply_to)?.content || 'Message supprimé'}
                </p>
              </div>
            </div>
          )}

          {/* Bulle du message */}
          <div
            className={cn(
              'relative px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl overflow-hidden',
              isOwn
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted rounded-bl-md'
            )}
          >
            {/* Menu d'actions */}
            <div
              className={cn(
                'absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity z-10',
                isOwn ? '-left-8' : '-right-8'
              )}
            >
              <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 rounded-full bg-background/80 shadow-sm"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isOwn ? 'start' : 'end'} className="w-48">
                  <DropdownMenuItem onClick={() => onReply?.(message)}>
                    <Reply className="w-4 h-4 mr-2" />
                    Répondre
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopy}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copier
                  </DropdownMenuItem>
                  {isOwn && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setDeleteForEveryone(false);
                          setShowDeleteDialog(true);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer pour moi
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setDeleteForEveryone(true);
                          setShowDeleteDialog(true);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer pour tous
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Contenu */}
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>

            {/* Indicateur de modification */}
            {message.edited_at && (
              <span className="text-[10px] opacity-60 ml-1">{t('enhancedMessageBubble.modifie')}</span>
            )}
          </div>

          {/* Footer: heure et statut */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-1',
              isOwn ? 'justify-end' : 'justify-start'
            )}
          >
            <span className="text-[10px] text-muted-foreground">
              {formatTime(message.created_at)}
            </span>
            {isOwn && (
              <MessageStatusBadge
                status={message.status}
                readAt={message.read_at}
              />
            )}
          </div>
        </div>

        {/* Placeholder pour l'avatar côté droit */}
        {showAvatar && isOwn && <div className="w-8" />}
      </div>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('enhancedMessageBubble.supprimerLeMessage')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteForEveryone
                ? 'Ce message sera supprimé pour tous les participants de la conversation. Cette action est irréversible.'
                : 'Ce message sera supprimé uniquement pour vous. Les autres participants pourront toujours le voir.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('enhancedMessageBubble.annuler')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Barre de réponse à un message
 */
interface ReplyBarProps {
  message: Message;
  onCancel: () => void;
  className?: string;
}

export function ReplyBar({ message, onCancel, className }: ReplyBarProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2 bg-muted/50 border-l-4 border-primary rounded-r-lg',
        className
      )}
    >
      <Reply className="w-4 h-4 text-primary flex-shrink-0 rotate-180" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary">
          Répondre à {message.sender?.first_name || 'Utilisateur'}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {message.content}
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 flex-shrink-0"
        onClick={onCancel}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default EnhancedMessageBubble;
