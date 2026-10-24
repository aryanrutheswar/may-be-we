// ============================================================================
// MaybeWe — Static HTML SEO & Meta Tag Injector
// Injects canonical URLs, Open Graph, Twitter Cards, Schema.org JSON-LD,
// and semantic accessibility tags into dist/index.html after web build.
// ============================================================================

const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '../dist');
const indexPath = path.join(distPath, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.log('[inject-seo] dist/index.html not found, skipping injection.');
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');

const title = 'MaybeWe — Curated Solo Traveler Matching & Trip Discovery in India';
const description = 'MaybeWe connects verified solo travelers across India through smart date-overlap trip matching, curated local spots, and safe travel circles.';
const siteUrl = 'https://maybewe.com';
const ogImage = `${siteUrl}/og-image.png`;

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'MaybeWe',
      description: description,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteUrl}/discovery?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'MaybeWe',
      url: siteUrl,
      logo: `${siteUrl}/apple-touch-icon.png`,
      description: 'Curated solo traveler matching and trip discovery platform localized for India.',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#app`,
      name: 'MaybeWe',
      applicationCategory: 'TravelApplication',
      operatingSystem: 'Web, iOS, Android',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
      },
    },
  ],
};

const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="keywords" content="solo travel India, traveler matching, travel companion, curated destinations India, solo trips Goa Manali Jaipur, travel safety verified, safe travel community" />
    <meta name="author" content="MaybeWe" />
    <meta name="theme-color" content="#FFFDFC" />
    <meta name="color-scheme" content="light" />

    <!-- Canonical URL -->
    <link rel="canonical" href="${siteUrl}/" />

    <!-- Icons & Manifest -->
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" />

    <!-- Open Graph (Facebook, LinkedIn) -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${siteUrl}/" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:site_name" content="MaybeWe" />
    <meta property="og:locale" content="en_IN" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${siteUrl}/" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />

    <!-- Schema.org JSON-LD Structured Data -->
    <script type="application/ld+json">
${JSON.stringify(structuredData, null, 2)}
    </script>
`;

// Replace existing title and icon tags with full suite
html = html.replace(/<title>.*?<\/title>/i, '');
html = html.replace(/<link rel="icon" href="\/favicon.ico"\/>/i, '');
html = html.replace('</head>', `${metaTags}\n  </head>`);

// Add semantic accessible primary H1 and breadcrumbs inside #root for crawlers before JS mounts
const semanticFallback = `
    <div id="root">
      <header style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">
        <h1>MaybeWe — Curated Solo Traveler Matching & Trip Discovery in India</h1>
        <p>${description}</p>
        <nav aria-label="Primary Navigation">
          <a href="/">Home</a>
          <a href="/discovery">Explore Destinations</a>
          <a href="/trips">Plan Trips</a>
          <a href="/matches">Find Matches</a>
          <a href="/guidelines">Community Guidelines</a>
        </nav>
      </header>
    </div>
`;

html = html.replace('<div id="root"></div>', semanticFallback);

fs.writeFileSync(indexPath, html, 'utf8');
console.log('[inject-seo] Successfully injected SEO, Open Graph, and Structured Data into dist/index.html');
