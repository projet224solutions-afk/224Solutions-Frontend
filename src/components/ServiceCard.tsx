import { Star, Clock, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ServiceCardProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  provider: string;
  rating: number;
  reviewCount: number;
  distance?: string;
  estimatedTime?: string;
  price?: string;
  isAvailable?: boolean;
  onBook?: () => void;
}

export default function ServiceCard({
  icon,
  title,
  description,
  provider,
  rating,
  reviewCount,
  distance,
  estimatedTime,
  price,
  isAvailable = true,
  onBook
}: ServiceCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-elegant transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-livreur-accent rounded-lg shrink-0">
            {icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-foreground">{title}</h3>
              {!isAvailable && (
                <Badge variant="secondary">Indisponible</Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
              {description}
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
              <div className="flex items-center">
                <Star className="w-3 h-3 fill-[#ff4000] text-[#ff4000] mr-1" />
                <span>{rating} ({reviewCount})</span>
              </div>

              {distance && (
                <div className="flex items-center">
                  <MapPin className="w-3 h-3 mr-1" />
                  <span>{distance}</span>
                </div>
              )}

              {estimatedTime && (
                <div className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>{estimatedTime}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{provider}</p>
                {price && (
                  <p className="font-semibold text-livreur-primary">{price}</p>
                )}
              </div>

              <Button
                onClick={onBook}
                disabled={!isAvailable}
                size="sm"
                className="bg-livreur-primary hover:bg-livreur-primary/85 shadow-lg shadow-livreur-primary/40"
              >
                Réserver
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}