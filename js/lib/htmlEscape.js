// ============================================================================
// SEISMOLIVE v4.0 — Minimal DOM XSS Escaping & URL Sanitization Helpers
// ============================================================================

const HTML_ESCAPE_MAP = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;'
});

/**
 * Safely escape arbitrary external/catalog strings before HTML template interpolation.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, ch => HTML_ESCAPE_MAP[ch] || ch);
}

/**
 * Permit only explicit http:/https: URLs for rendered anchor tags.
 */
export function sanitizeExternalHref(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}
