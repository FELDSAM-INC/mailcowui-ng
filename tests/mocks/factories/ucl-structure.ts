// Mock of the pinned API's UclStructureChecker, never used by product code.
export function checkUcl(content: string): { line: number; construct: string } | null {
  const stack: { char: string; line: number }[] = []
  let line = 1
  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    if (char === '\n') {
      line++
      continue
    }
    if (char === '#') {
      while (i < content.length && content[i] !== '\n') i++
      if (i < content.length) line++
      continue
    }
    if (content.slice(i, i + 2) === '/*') {
      i += 2
      while (i < content.length && content.slice(i, i + 2) !== '*/') {
        if (content[i] === '\n') line++
        i++
      }
      i++
      continue
    }
    const heredoc = /^<<([A-Z][A-Z0-9_]*)\n/.exec(content.slice(i))
    if (heredoc) {
      const start = line
      i += heredoc[0].length
      line++
      let closed = false
      while (i < content.length) {
        const end = content.indexOf('\n', i)
        const text = content.slice(i, end < 0 ? content.length : end)
        if (text === heredoc[1]) {
          i = end < 0 ? content.length : end
          if (end >= 0) line++
          closed = true
          break
        }
        if (end < 0) break
        i = end + 1
        line++
      }
      if (!closed) return { line: start, construct: 'unclosedString' }
      continue
    }
    if (char === '"' || char === "'") {
      const start = line
      let closed = false
      for (i++; i < content.length; i++) {
        if (content[i] === '\n') line++
        if (content[i] === '\\') {
          i++
          if (content[i] === '\n') line++
          continue
        }
        if (content[i] === char) {
          closed = true
          break
        }
      }
      if (!closed) return { line: start, construct: 'unclosedString' }
      continue
    }
    if (char === '{' || char === '[') stack.push({ char, line })
    if (char === '}' || char === ']') {
      const opener = stack.pop()
      if (opener?.char !== (char === '}' ? '{' : '['))
        return { line, construct: char === '}' ? 'unexpectedBrace' : 'unexpectedBracket' }
    }
  }
  const last = stack.pop()
  return last
    ? { line: last.line, construct: last.char === '{' ? 'unclosedBrace' : 'unclosedBracket' }
    : null
}
