import { Search, Filter, Camera } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFilter?: () => void;
  showFilter?: boolean;
  showCamera?: boolean;
  onCameraCapture?: (file: File) => void;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Rechercher des produits, services...",
  onFilter,
  showFilter = false,
  showCamera = false,
  onCameraCapture
}: SearchBarProps) {
  const { t } = useTranslation();
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCameraCapture) {
      onCameraCapture(file);
    }
    // Reset input pour permettre de reprendre une photo
    e.target.value = '';
  };

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-4 h-11"
        />
      </div>

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
            className="h-11 w-11 shrink-0 border-primary/30 hover:bg-primary/10"
            title="Recherche par photo"
          >
            <Camera className="w-5 h-5 text-primary" />
          </Button>
        </>
      )}

      {showFilter && (
        <Button
          variant="outline"
          size="icon"
          onClick={onFilter}
          className="h-11 w-11 shrink-0"
        >
          <Filter className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}