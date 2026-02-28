/**
 * Content preprocessing utilities for LLM output
 * Handles non-standard math/LaTeX delimiters from various LLM providers
 */

const MATH_INDICATORS = [
  '\\frac', '\\lim', '\\sum', '\\int', '\\sqrt',
  '\\sin', '\\cos', '\\tan', '\\log', '\\ln', '\\exp',
  '\\partial', '\\nabla', '\\infty',
  '\\alpha', '\\beta', '\\gamma', '\\delta',
  '\\theta', '\\lambda', '\\mu', '\\phi', '\\omega',
  '\\pi', '\\sigma', '\\tau', '\\epsilon', '\\eta',
  '\\displaystyle', '\\text', '\\mathrm', '\\mathbf',
  '\\big', '\\Big', '\\bigl', '\\bigr',
  '\\begin', '\\end', 'aligned', 'cases', 'matrix', 'vmatrix',
  '\\[', '\\]',
  '^{', '_{'
]

const ASCIIMATH_INDICATORS = [
  'sqrt', 'sum', 'prod', 'int', 'lim',
  'sin', 'cos', 'tan', 'log', 'ln', 'exp',
  'frac', 'root', 'text', 'bb', 'bbb',
  '->', '|->', '<-', '<=', '>=', '!=',
  'infinity', 'alpha', 'beta', 'gamma', 'delta',
  'theta', 'lambda', 'mu', 'phi', 'omega',
  'pi', 'sigma', 'tau', 'epsilon'
]

function isLikelyMath(content) {
  return MATH_INDICATORS.some(indicator => content.includes(indicator))
}

function isAsciiMath(content) {
  return ASCIIMATH_INDICATORS.some(indicator => content.includes(indicator))
}

function convertAsciiMath(text) {
  let result = text
  
  result = result.replace(/\broot(\d+)\s*of\s*([^|]+)\s*\|/g, '\\sqrt[$1]{$2}')
  result = result.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
  result = result.replace(/sqrt\[(\d+)\]\(([^)]+)\)/g, '\\sqrt[$1]{$2}')
  
  result = result.replace(/\bsum_\{([^}]+)\}\^\{([^}]+)\}/g, '\\sum_{$1}^{$2}')
  result = result.replace(/\bsum_\{([^}]+)\}/g, '\\sum_{$1}')
  result = result.replace(/\bsum\^(\w+)/g, '\\sum^{$1}')
  result = result.replace(/\bsum\b/g, '\\sum')
  
  result = result.replace(/\bprod_\{([^}]+)\}\^\{([^}]+)\}/g, '\\prod_{$1}^{$2}')
  result = result.replace(/\bprod_\{([^}]+)\}/g, '\\prod_{$1}')
  result = result.replace(/\bprod\^(\w+)/g, '\\prod^{$1}')
  result = result.replace(/\bprod\b/g, '\\prod')
  
  result = result.replace(/\bint_\{([^}]+)\}\^\{([^}]+)\}/g, '\\int_{$1}^{$2}')
  result = result.replace(/\bint_\{([^}]+)\}/g, '\\int_{$1}')
  result = result.replace(/\bint\b/g, '\\int')
  
  result = result.replace(/\blim_\{([^}]+)\}/g, '\\lim_{$1}')
  result = result.replace(/\blim\b/g, '\\lim')
  
  result = result.replace(/\bfrac\{([^}]+)\}\{([^}]+)\}/g, '\\frac{$1}{$2}')
  
  result = result.replace(/\^(\d+)/g, '^{$1}')
  result = result.replace(/_(\w+)/g, '_{$1}')
  
  result = result.replace(/\b->\b/g, '\\to ')
  result = result.replace(/\|->/g, '\\mapsto ')
  result = result.replace(/<=/g, '\\leq ')
  result = result.replace(/>=/g, '\\geq ')
  result = result.replace(/!=/g, '\\neq ')
  
  result = result.replace(/\binfinity\b/g, '\\infty')
  
  result = result.replace(/\btext\{([^}]+)\}/g, '\\text{$1}')
  result = result.replace(/\bbb\s+(\w)/g, '\\mathbb{$1}')
  
  const greekLetters = {
    'alpha': '\\alpha', 'beta': '\\beta', 'gamma': '\\gamma',
    'delta': '\\delta', 'theta': '\\theta', 'lambda': '\\lambda',
    'mu': '\\mu', 'phi': '\\phi', 'omega': '\\omega',
    'pi': '\\pi', 'sigma': '\\sigma', 'tau': '\\tau',
    'epsilon': '\\epsilon', 'eta': '\\eta'
  }
  for (const [eng, latex] of Object.entries(greekLetters)) {
    result = result.replace(new RegExp(`\\b${eng}\\b`, 'g'), latex)
  }
  
  result = result.replace(/\bsin\b/g, '\\sin')
  result = result.replace(/\bcos\b/g, '\\cos')
  result = result.replace(/\btan\b/g, '\\tan')
  result = result.replace(/\blog\b/g, '\\log')
  result = result.replace(/\bln\b/g, '\\ln')
  result = result.replace(/\bexp\b/g, '\\exp')
  
  return result
}

function findClosingParen(text, start, openChar = '(', closeChar = ')') {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\' && (text[i + 1] === '[' || text[i + 1] === ']')) {
      i++
      continue
    }
    if (text[i] === openChar) depth++
    else if (text[i] === closeChar) {
      if (depth === 0) return i
      depth--
    }
  }
  return -1
}

function convertBracketDelimiters(text) {
  const result = []
  let i = 0

  while (i < text.length) {
    const canBeMath = i === 0 || /[\s,\n:]/.test(text[i - 1])

    if (text[i] === '[' && canBeMath) {
      const contentStart = i + 1
      const contentEnd = findClosingParen(text, contentStart, '[', ']')

      if (contentEnd > contentStart) {
        let content = text.slice(contentStart, contentEnd)
        const nextChar = text[contentEnd + 1]
        const isEndOfContent = !nextChar || /[\s,\n.\])$]/.test(nextChar)

        if (isAsciiMath(content)) {
          content = convertAsciiMath(content)
        }

        if (isLikelyMath(content) && isEndOfContent) {
          result.push(`$$${content}$$`)
          i = contentEnd + 1
          continue
        }
      }
    }

    result.push(text[i])
    i++
  }

  return result.join('')
}

function convertEscapedDelimiters(text) {
  return text
    .replace(/\\\(([^)]+)\\\)/g, '$$$1$')
    .replace(/\\\[([^\]]+)\\\]/g, '$$$1$$')
}

function convertParenDelimiters(text) {
  const result = []
  let i = 0

  while (i < text.length) {
    const canBeMath = i === 0 || /[\s,:\n\-]/.test(text[i - 1])

    if (text[i] === '(' && canBeMath) {
      const contentStart = i + 1
      const contentEnd = findClosingParen(text, contentStart, '(', ')')

      if (contentEnd > contentStart) {
        let content = text.slice(contentStart, contentEnd)
        const nextChar = text[contentEnd + 1]
        const isEndOfContent = !nextChar || /[\s,.\])$]/.test(nextChar)

        if (isAsciiMath(content)) {
          content = convertAsciiMath(content)
        }

        if (isLikelyMath(content) && isEndOfContent) {
          result.push(`$$${content}$$`)
          i = contentEnd + 1
          continue
        }
      }
    }

    result.push(text[i])
    i++
  }

  return result.join('')
}

function convertBareAsciiMath(text) {
  const mathBlockRegex = /\$([^$]+)\$/g
  return text.replace(mathBlockRegex, (match, content) => {
    if (isAsciiMath(content)) {
      return `$${convertAsciiMath(content)}$`
    }
    return match
  })
}

function convertLatexSpacingCommands(text) {
  return text.replace(/\\\[(\d+)(pt)?\]/g, '\\\\[$1$2]')
}

export function preprocessContent(text) {
  if (!text) return text

  let processed = text

  processed = convertBareAsciiMath(processed)
  processed = convertLatexSpacingCommands(processed)
  processed = convertEscapedDelimiters(processed)
  processed = convertBracketDelimiters(processed)
  processed = convertParenDelimiters(processed)

  return processed
}