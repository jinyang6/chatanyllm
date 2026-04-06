/**
 * Content preprocessing utilities for LLM output
 * Handles standard LaTeX/markdown delimiters
 */

/**
 * Fix malformed triple dollar signs (e.g., $$...$$$ → $$...$$)
 * Standard markdown/LaTeX only uses $ or $$ for math delimiters
 */
function fixMalformedDelimiters(text) {
  // Fix triple/quadruple $ at end: $$content$$$ → $$content$$
  return text.replace(/(\$\$[^$]*)\$+$/g, '$1')
}

export function preprocessContent(text) {
  if (!text) return text

  let processed = text

  // Fix malformed delimiters
  processed = fixMalformedDelimiters(processed)

  return processed
}
