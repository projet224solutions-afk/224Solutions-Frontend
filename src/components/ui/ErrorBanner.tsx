import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorBannerProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function ErrorBanner({ title = "Erreur", message, actionLabel, onAction, className }: ErrorBannerProps) {
  return (
    <div className={cn("mb-3 rounded-md border border-orange-200 bg-orange-50 p-3 text-[#ff4000]", className)}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-sm opacity-90">{message}</div>
        </div>
        {actionLabel && onAction && (
          <button onClick={onAction} className="text-sm font-medium underline underline-offset-2">{actionLabel}</button>
        )}
      </div>
    </div>
  );
}
