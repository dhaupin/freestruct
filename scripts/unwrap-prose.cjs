#!/usr/bin/env node
'use strict'

// Unwrap prose in markdown: join lines that belong to one paragraph or one
// list item into a single line. Never touches frontmatter (a `--- ... ---`
// block at the very top of the file), fenced code (``` blocks), INDENTED code
// (4+ leading spaces), table rows (| lines), headings, or blank-line
// boundaries. The point: the 72-column commit-time habit is dead - prose
// flows, and future agents must not re-wrap it.
//
// Frontmatter is only the block at line 1. A bare `---` horizontal rule later
// in the file (labs/TASKS.md has one at line 7) must NOT be read as an opening
// fence, or the whole document after it stops unwrapping.
//
// Indented code is structural: a line indented 4+ spaces (and not a list
// marker, table row, or heading) is verbatim, so a Markdown example block
// (`    packs/public/... -> ...`) survives. Joining those collapsed two code
// lines onto one and corrupted the example.
//
// Usage: node scripts/unwrap-prose.cjs <file.md> [file2.md ...]

const fs = require('fs')

function unwrap(textOrLines) {
  const lines = Array.isArray(textOrLines) ? textOrLines : textOrLines.split('\n')
  const out = []
  let fenced = false
  let inFrontmatter = 0
  let inHtml = false

  const isCodeLines = (ln) => /^\s*```/.test(ln)
  const isTableRow = (ln) => /^\s*\|/.test(ln)
  const isHeading = (ln) => /^#{1,6} /.test(ln)
  const isBlank = (ln) => ln.trim() === ''
  // Indented code: 4+ leading spaces that are not a nested list marker or a
  // table row. Structural (verbatim), so an example block is never joined.
  const isIndentedCode = (ln) => /^ {4,}\S/.test(ln) && !/^ {4,}([-*+] |\d+\. )/.test(ln) && !isTableRow(ln)
  // An HTML block starts at a line whose first non-space char is `<` and runs
  // to the next blank line (the Markdown rule). Verbatim, so a multi-line
  // `<div>`/`<p>` footer is never collapsed onto one line.
  const isHtmlStart = (ln) => /^\s*</.test(ln)

  let buf = null

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]

    // Frontmatter opens only at the first line; a later bare `---` is a rule.
    if (i === 0 && ln.trim() === '---') {
      inFrontmatter = 1
      out.push(ln)
      continue
    }
    if (inFrontmatter === 1) {
      if (ln.trim() === '---') inFrontmatter = 2
      out.push(ln)
      continue
    }

    if (isCodeLines(ln)) {
      fenced = !fenced
      if (buf != null) { out.push(buf); buf = null }
      out.push(ln)
      continue
    }
    if (fenced) { out.push(ln); continue }

    // An HTML block runs verbatim to the next blank line (the Markdown rule).
    if (inHtml) {
      if (isBlank(ln)) {
        inHtml = false
        out.push(ln)
      } else {
        out.push(ln)
      }
      continue
    }

    if (isBlank(ln)) {
      if (buf != null) { out.push(buf); buf = null }
      out.push(ln)
      continue
    }

    // A list item may be indented (nested bullets); its marker, not its
    // column, is what makes it structural. A wrapped continuation line never
    // starts with a marker, so this keeps nested lists intact instead of
    // flattening them into the parent paragraph.
    const listStart = /^\s*([-*+] |\d+\. )/.test(ln)
    const quoteStart = /^>/.test(ln)
    const tableRow = isTableRow(ln)
    const heading = isHeading(ln)

    // HTML blocks only START at a block boundary (buf null): mid-paragraph a
    // `<em>` continuation belongs to the paragraph, not a new block.
    if (isHtmlStart(ln) && buf === null) {
      inHtml = true
      out.push(ln.replace(/\s+$/, ''))
      continue
    }

    if (tableRow || heading) {
      if (buf != null) { out.push(buf); buf = null }
      out.push(ln)
      continue
    }

    if (listStart) {
      if (buf != null) { out.push(buf); buf = null }
      buf = ln.replace(/\s+$/, '')
      continue
    }

    if (quoteStart) {
      if (buf != null) { out.push(buf); buf = null }
      buf = ln.replace(/\s+$/, '')
      continue
    }

    // Indented code only STARTS a block: at the head of a block (buf null) a
    // 4+ space line is verbatim. Mid-block it is a wrapped continuation of the
    // current paragraph or list item, so the join below still applies (a
    // nested bullet's wrapped second line is indented, not code).
    if (isIndentedCode(ln) && buf === null) {
      out.push(ln.replace(/\s+$/, ''))
      continue
    }

    // Continuation line: join into the current buffer.
    if (buf != null) {
      buf = buf.replace(/\s+$/, '') + ' ' + ln.trim()
    } else {
      buf = ln.replace(/\s+$/, '')
    }
  }
  if (buf != null) out.push(buf)
  // Collapse runs of >2 consecutive blank lines down to one.
  const collapsed = []
  let blanks = 0
  for (const ln of out) {
    if (ln.trim() === '') {
      blanks++
      if (blanks > 1) continue
    } else blanks = 0
    collapsed.push(ln)
  }
  return collapsed.join('\n')
}

for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8')
  const unwrapped = unwrap(src)
  fs.writeFileSync(file, unwrapped)
  const before = src.split('\n').filter((l) => l.trim() !== '').length
  const after = unwrapped.split('\n').filter((l) => l.trim() !== '').length
  console.log(`${file}: ${before} non-blank -> ${after} non-blank lines`)
}
