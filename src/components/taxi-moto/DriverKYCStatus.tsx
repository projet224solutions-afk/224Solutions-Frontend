import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";

interface DriverKYCStatusProps {
  isKycValid: boolean;
  onOpenKyc?: () => void;
}

export function DriverKYCStatus({ isKycValid, onOpenKyc }: DriverKYCStatusProps) {
  const { t } = useTranslation();
  if (isKycValid) {
    return <Badge variant="default" className="bg-[#ff4000] text-white">{t('driverKYCStatus.kycVerifie')}</Badge>;
  }
  return (
    <div className="flex items-center gap-2">
      <Badge variant="destructive">KYC requis</Badge>
      {onOpenKyc && (
        <Button size="sm" variant="outline" onClick={onOpenKyc}>{t('driverKYCStatus.completerLeKyc')}</Button>
      )}
    </div>
  );
}
