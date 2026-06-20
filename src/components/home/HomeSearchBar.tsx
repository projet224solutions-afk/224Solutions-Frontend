/**
 * HOME SEARCH BAR - Ultra Professional Design
 * 224Solutions - Premium Search Experience
 * Floating design with subtle animations
 * Search submits to marketplace with query parameter
 */

import { useState, useRef } from 'react';
import { Search, Filter, X, Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface HomeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  onFilter?: () => void;
  showFilter?: boolean;
  showCamera?: boolean;
  onCameraCapture?: (file: File) => void;
  className?: string;
}

export function HomeSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  onFilter,
  showFilter = true,
  showCamera = false,
  onCameraCapture,
  className,
}: HomeSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const displayPlaceholder = placeholder || t('home.searchPlaceholder');

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCameraCapture) {
      onCameraCapture(file);
    }
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      onSubmit();
    }
  };

  return (
    <div className={cn('px-4 pb-4 md:px-6', className)}>
      <div
        className={cn(
          'relative flex items-center gap-2 transition-all duration-300',
          isFocused && 'scale-[1.01]'
        )}
      >
        {/* Search Input Container */}
        <div
          className={cn(
            'relative flex-1 rounded-2xl transition-all duration-300',
            'bg-muted/60 border border-border/60',
            'hover:bg-muted/80 hover:border-border',
            isFocused && 'bg-card border-primary/40 shadow-lg ring-2 ring-primary/15'
          )}
        >
          <Search
            className={cn(
              'absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors duration-200',
              isFocused ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={displayPlaceholder}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              'pl-12 pr-12 h-12 md:h-14 rounded-2xl border-0 bg-transparent',
              'text-base placeholder:text-muted-foreground/70',
              'focus-visible:ring-0 focus-visible:ring-offset-0'
            )}
          />

          {/* Clear button */}
          {value && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 h-7 w-7 rounded-full hover:bg-muted"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>

        {/* Camera Button */}
        {showCamera && (
          <>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCameraClick}
              className={cn(
                'h-12 w-12 md:h-14 md:w-14 rounded-2xl shrink-0',
                'border-primary/30 bg-card hover:bg-primary hover:text-primary-foreground',
                'transition-all duration-300 hover:scale-105 hover:shadow-lg'
              )}
              title={t('home.searchByPhoto') || 'Recherche par photo'}
            >
              <Camera className="w-5 h-5 text-primary" />
            </Button>
          </>
        )}

        {/* Filter Button */}
        {showFilter && (
          <Button
            variant="outline"
            size="icon"
            onClick={onFilter}
            className={cn(
              'h-12 w-12 md:h-14 md:w-14 rounded-2xl shrink-0',
              'border-border/50 bg-card hover:bg-primary hover:text-primary-foreground',
              'transition-all duration-300 hover:scale-105 hover:shadow-lg'
            )}
            title={t('home.filter') || 'Filtrer'}
          >
            <Filter className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default HomeSearchBar;
