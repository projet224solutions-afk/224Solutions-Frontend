/**
 * 🔍 SEO Head Component - Dynamic meta tags for pages
 * Uses react-helmet-async for SSR-compatible meta tag management
 */

import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
  price?: number;
  currency?: string;
}

const SITE_NAME = '224Solutions';
const DEFAULT_DESCRIPTION = 'Réservez un taxi, commandez vos repas, faites vos achats en ligne. La super-app tout-en-un de la Guinée.';
const DEFAULT_IMAGE = 'https://224solution.net/icon-512.png';

export default function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  price,
  currency = 'GNF'
}: SEOHeadProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  // Ensure image URL is absolute
  const safeImage = image || DEFAULT_IMAGE;
  const absoluteImage = safeImage.startsWith('http')
    ? safeImage
    : `https://224solution.net${safeImage.startsWith('/') ? '' : '/'}${safeImage}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      {currentUrl && <meta property="og:url" content={currentUrl} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />

      {/* Product specific */}
      {type === 'product' && price && (
        <>
          <meta property="product:price:amount" content={price.toString()} />
          <meta property="product:price:currency" content={currency} />
        </>
      )}

      <link rel="canonical" href={currentUrl} />
    </Helmet>
  );
}
