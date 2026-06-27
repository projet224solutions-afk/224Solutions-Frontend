/**
 * Widget de Communication Flottant - 224SOLUTIONS
 * Widget réutilisable pour toutes les interfaces
 * Optimisé pour éviter les problèmes INP (Interaction to Next Paint)
 */

import { useNavigate } from 'react-router-dom';
import { useUniversalCommunication } from '@/hooks/useUniversalCommunication';
import { useAuth } from '@/hooks/useAuth';

interface CommunicationWidgetProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showNotifications?: boolean;
}

export default function CommunicationWidget({
  position = 'bottom-right',
  showNotifications = true
}: CommunicationWidgetProps) {
  const { user } = useAuth();
  const { stats } = useUniversalCommunication();
  const _navigate = useNavigate();
  const _unreadCount = stats?.unreadCount || 0;
  const _notificationCount = stats?.notificationCount || 0;

  if (!user) return null;

  const _positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  // Widget désactivé
  return null;
}
