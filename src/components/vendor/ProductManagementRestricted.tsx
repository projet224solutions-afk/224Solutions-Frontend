import ProductManagement from './ProductManagement';
import { RestrictedFeatureWrapper } from './RestrictedFeatureWrapper';

export function ProductManagementRestricted() {
  return (
    <RestrictedFeatureWrapper
      feature="products"
      fallbackMessage="Création de nouveaux produits désactivée"
    >
      <ProductManagement />
    </RestrictedFeatureWrapper>
  );
}
