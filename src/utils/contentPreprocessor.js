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

/**
 * Convert LaTeX bracket delimiters to remark-math dollar-sign syntax.
 *   \[ ... \]  →  $$ ... $$   (display math)
 *   \( ... \)  →  $ ... $     (inline math)
 */
function convertLatexDelimiters(text) {
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$1$$')
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, '$$1$')
  return text
}

export function preprocessContent(text) {
  if (!text) return text

  let processed = text

  // Convert LaTeX \[...\] / \(...\) to remark-math $$...$$ / $...$
  processed = convertLatexDelimiters(processed)

  // Fix malformed delimiters
  processed = fixMalformedDelimiters(processed)

  return processed
}
