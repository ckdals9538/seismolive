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

const GREEK_AND_TEX_REPLACEMENTS = [
  [/\\left\(/g, '('],
  [/\\right\)/g, ')'],
  [/\\frac\{2\}\{3\}/g, '⅔'],
  [/\\frac\{7\}\{16\}/g, '7/16'],
  [/\\sqrt\{([^}]+)\}/g, '√($1)'],
  [/\\text\{([^}]+)\}/g, '$1'],
  [/\\mathcal\{R\}/g, 'R'],
  [/\\chi/g, 'χ'],
  [/\\approx/g, '≈'],
  [/\\propto/g, '∝'],
  [/\\le/g, '≤'],
  [/\\ge/g, '≥'],
  [/\\sim/g, '~'],
  [/\\times/g, '×'],
  [/\\Delta/g, 'Δ'],
  [/\\Omega/g, 'Ω'],
  [/\\sigma/g, 'σ'],
  [/\\gamma/g, 'γ'],
  [/\\theta/g, 'θ'],
  [/\\phi/g, 'φ'],
  [/\\rho/g, 'ρ'],
  [/\\pi/g, 'π'],
  [/\\exp/g, 'exp'],
  [/\\cos/g, 'cos'],
  [/\\sin/g, 'sin'],
  [/\\tan/g, 'tan'],
  [/\\log_\{?10\}?/g, 'log₁₀'],
  [/\\(?:quad|;|,| )+/g, ' ']
];

/**
 * Converts archival/scientific LaTeX strings into clean, XSS-safe Unicode + HTML
 * subscript/superscript typography so raw backslashes never render verbatim in DOM.
 */
export function formatReadableMathHtml(value) {
  let s = escapeHtml(value);
  if (!s) return '';
  for (const [pattern, replacement] of GREEK_AND_TEX_REPLACEMENTS) {
    s = s.replace(pattern, replacement);
  }
  // Apply two fraction passes for nested denominator/numerator expressions.
  for (let i = 0; i < 2; i++) {
    s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
  }
  s = s
    .replace(/\^2\b|\^\{2\}/g, '²')
    .replace(/\^3\b|\^\{3\}/g, '³')
    .replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>')
    .replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>')
    .replace(/\b([A-Za-zΩχ])_0\b/g, '$1₀')
    .replace(/\b([A-Za-z])_([A-Za-z0-9]{1,2})\b/g, '$1<sub>$2</sub>')
    .replace(/\\/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s;
}
