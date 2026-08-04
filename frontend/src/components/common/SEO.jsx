import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

const SITE_NAME = 'Edupla';
const SITE_URL = 'https://edupla.vercel.app'; // TODO: replace with your real production domain
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`; // TODO: add a real 1200x630 image at public/og-image.png

/**
 * Drop this at the top of any PUBLIC page (Landing, Login, future marketing
 * pages) to control that page's <title>, meta description, canonical URL,
 * Open Graph / Twitter tags, and hreflang alternates.
 *
 * Do NOT add this to authenticated app pages (dashboards, etc.) — those are
 * blocked in robots.txt and should not be optimized for search engines.
 */
export default function SEO({
  title,
  description,
  path = '/',
  noindex = false,
  jsonLd = null,
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';
  const canonical = `${SITE_URL}${path}`;
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — School Management & Online Assessment Platform`;

  return (
    <Helmet htmlAttributes={{ lang }}>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* NOTE: no hreflang tags here on purpose. The app currently switches
          language client-side (localStorage) rather than via distinct URLs
          (e.g. /fr/...), so there is no separate crawlable URL per language
          for Google to associate a hreflang alternate with. See the SEO
          write-up for how to add real /fr/ and /rw/ routes later if you
          want French/Kinyarwanda pages to rank on their own. */}

      {/* Open Graph (Facebook, LinkedIn, WhatsApp previews) */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={DEFAULT_OG_IMAGE} />
      <meta property="og:locale" content={lang === 'fr' ? 'fr_FR' : lang === 'rw' ? 'rw_RW' : 'en_US'} />

      {/* Twitter / X card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
