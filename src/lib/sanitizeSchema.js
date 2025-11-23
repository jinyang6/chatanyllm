import { defaultSchema } from 'rehype-sanitize'

// Minimal security schema - blocks only the most dangerous elements
// Allows most HTML for LLM creativity while preventing XSS attacks
export const minimalSanitizeSchema = {
  ...defaultSchema,

  // Allow all default tags EXCEPT the dangerous ones
  tagNames: [
    ...(defaultSchema.tagNames || []),
    // Explicitly allow common tags that might not be in default
    'div', 'span', 'section', 'article', 'header', 'footer', 'nav', 'aside',
    'form', 'input', 'button', 'select', 'textarea', 'label',
    'video', 'audio', 'source', 'track',
    'svg', 'path', 'circle', 'rect', 'line', 'polygon',
    'details', 'summary', 'dialog',
    // KaTeX math rendering tags
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac',
    'mtext', 'annotation', 'annotation-xml',
  ].filter(tag =>
    // Block these dangerous tags
    !['script', 'iframe', 'object', 'embed', 'link', 'base', 'meta'].includes(tag)
  ),

  attributes: {
    ...defaultSchema.attributes,
    // Allow className and style on ALL elements
    '*': [
      ...(defaultSchema.attributes['*'] || []),
      'className',
      'style',
      'id',
      'title',
      'role',
      'aria-label',
      'aria-hidden',
      'data-*'  // Allow data attributes
    ].filter(attr =>
      // Block event handlers
      !attr.startsWith('on')
    ),
    // Allow all standard attributes on specific elements
    img: ['src', 'alt', 'width', 'height', 'loading', 'crossorigin'],
    a: ['href', 'target', 'rel', 'download'],
    video: ['src', 'controls', 'autoplay', 'loop', 'muted', 'poster', 'width', 'height'],
    audio: ['src', 'controls', 'autoplay', 'loop', 'muted'],
    source: ['src', 'type', 'media'],
    input: ['type', 'name', 'value', 'placeholder', 'disabled', 'readonly', 'checked', 'min', 'max', 'step'],
    button: ['type', 'disabled'],
    form: ['action', 'method', 'target'],
    select: ['name', 'disabled', 'multiple'],
    textarea: ['name', 'placeholder', 'disabled', 'readonly', 'rows', 'cols'],
    label: ['for'],
    svg: ['viewBox', 'xmlns', 'width', 'height', 'fill', 'stroke'],
    path: ['d', 'fill', 'stroke', 'stroke-width'],
    circle: ['cx', 'cy', 'r', 'fill', 'stroke'],
    rect: ['x', 'y', 'width', 'height', 'fill', 'stroke'],
    // KaTeX math attributes
    math: ['xmlns', 'display'],
    semantics: [],
    mrow: [],
    mi: ['mathvariant'],
    mo: ['stretchy', 'symmetric', 'lspace', 'rspace'],
    mn: [],
    msup: [],
    msub: [],
    mfrac: ['linethickness'],
    mtext: [],
    annotation: ['encoding'],
    'annotation-xml': ['encoding'],
  },

  // Strip dangerous event handlers
  clobberPrefix: 'user-',
  clobber: ['name', 'id'],

  // Allow http, https, data URLs, mailto, etc.
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https', 'data'],
    href: ['http', 'https', 'mailto', 'tel', 'sms', 'data'],
    action: ['http', 'https'],
  }
}
