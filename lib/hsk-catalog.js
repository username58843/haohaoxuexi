export const HSK_CATALOG_VERSION = '2026-07'

// Query parameters, not custom headers, keep public CDN variants separate.
export function isLegacyCatalogRequest(req) {
  return req.query?.catalog !== HSK_CATALOG_VERSION
}
