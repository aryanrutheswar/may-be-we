// ============================================================================
// MaybeWe — Web SEO, Meta Tags & Structured Data Engine
// Handles dynamic document title, description, canonical links,
// Open Graph metadata, and JSON-LD structured data on Web.
// ============================================================================

import { useEffect } from 'react';
import { Platform } from 'react-native';

const BASE_URL = 'https://maybewe.com';
const DEFAULT_TITLE = 'MaybeWe — Curated Solo Traveler Matching & Trip Discovery';
const DEFAULT_DESCRIPTION =
  'MaybeWe connects verified solo travelers in India through intelligent trip overlap matching, curated local spots, and safe travel circles.';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

/**
 * Updates or creates a <meta> tag with the specified attribute and value.
 */
function setMetaTag(attributeName, attributeValue, contentValue) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  let element = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', contentValue);
}

/**
 * Updates or creates a <link> tag with the specified rel attribute.
 */
function setLinkTag(rel, href) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  let element = document.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

/**
 * Injects or updates JSON-LD structured data into the document head.
 */
export function setStructuredData(id, schemaObject) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const scriptId = `json-ld-${id}`;
  let scriptElement = document.getElementById(scriptId);
  if (!scriptElement) {
    scriptElement = document.createElement('script');
    scriptElement.id = scriptId;
    scriptElement.type = 'application/ld+json';
    document.head.appendChild(scriptElement);
  }
  scriptElement.text = JSON.stringify(schemaObject);
}

/**
 * React hook to set dynamic page title, description, canonical URL, and OG tags on Web.
 *
 * @param {Object} options
 * @param {string} options.title - Page title
 * @param {string} [options.description] - Meta description
 * @param {string} [options.canonicalPath] - Relative path (e.g. '/discovery')
 * @param {string} [options.ogImage] - Absolute image URL
 * @param {Object} [options.structuredData] - Optional JSON-LD object
 */
export function usePageSEO({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath = '/',
  ogImage = DEFAULT_OG_IMAGE,
  structuredData,
} = {}) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    // 1. Title formatting
    const formattedTitle = title
      ? title.includes('MaybeWe')
        ? title
        : `${title} — MaybeWe`
      : DEFAULT_TITLE;

    document.title = formattedTitle;

    // 2. Canonical URL
    const canonicalUrl = `${BASE_URL}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`;
    setLinkTag('canonical', canonicalUrl);

    // 3. Standard Meta Description
    setMetaTag('name', 'description', description);

    // 4. Open Graph Meta Tags
    setMetaTag('property', 'og:title', formattedTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:image', ogImage);
    setMetaTag('property', 'og:type', 'website');
    setMetaTag('property', 'og:site_name', 'MaybeWe');

    // 5. Twitter Card Meta Tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', formattedTitle);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', ogImage);

    // 6. Optional Structured Data
    if (structuredData) {
      setStructuredData(`route-${canonicalPath.replace(/[^a-zA-Z0-9]/g, '-')}`, structuredData);
    }
  }, [title, description, canonicalPath, ogImage, structuredData]);
}

/**
 * Global WebSite and Organization Structured Data
 */
export const MAYBEWE_ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MaybeWe',
  url: BASE_URL,
  logo: `${BASE_URL}/apple-touch-icon.png`,
  description: 'Curated solo traveler matching and trip discovery platform localized for India.',
  sameAs: [],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: `${BASE_URL}/guidelines`,
  },
};

export const MAYBEWE_WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MaybeWe',
  url: BASE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${BASE_URL}/discovery?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export default usePageSEO;
