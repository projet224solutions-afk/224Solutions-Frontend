/**
 * 🔧 COMPOSANT: INPUT ID PUBLIC
 * Champ de saisie avec validation pour IDs publics
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check } from 'lucide-react';
import { validatePublicId, formatPublicId } from '@/utils/publicIdFormatter';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface PublicIdInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showValidation?: boolean;
}

export function PublicIdInput({
  value,
  onChange,
  label = 'ID Public',
  placeholder = 'ABC1234',
  required = false,
  disabled = false,
  className,
  showValidation = true
}: PublicIdInputProps) {
  const [touched, setTouched] = useState(false);
  const isValid = validatePublicId(value);
  const showError = touched && value && !isValid;
  const showSuccess = touched && isValid;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase().trim();
    onChange(newValue);
  };

  const handleBlur = () => {
    setTouched(true);
    if (value) {
      onChange(formatPublicId(value));
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor="public-id-input">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      <div className="relative">
        <Input
          id="public-id-input"
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={7}
          className={cn(
            'font-mono uppercase tracking-wider pr-10',
            showError && 'border-destructive focus-visible:ring-destructive',
            showSuccess && 'border-[#ff4000] focus-visible:ring-[#ff4000]'
          )}
        />

        {showValidation && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {showError && (
              <AlertCircle className="w-4 h-4 text-destructive" />
            )}
            {showSuccess && (
              <Check className="w-4 h-4 text-[#ff4000]" />
            )}
          </div>
        )}
      </div>

      {showValidation && showError && (
        <p className="text-xs text-destructive">
          Format invalide. Attendu: 3 lettres + 4 chiffres (ex: ABC1234)
        </p>
      )}

      {showValidation && showSuccess && (
        <p className="text-xs text-[#ff4000]">
          Format valide ✓
        </p>
      )}
    </div>
  );
}

export default PublicIdInput;
