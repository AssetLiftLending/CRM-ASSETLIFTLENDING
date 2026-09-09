/**
 * CSV parsing for contact imports.
 *
 * Exports from GoHighLevel and the like quote any value containing a comma —
 * "Smith, John", street addresses, tag lists, note text. Splitting a line on
 * commas shifts every column after the first quoted comma, which silently maps
 * names into the wrong fields, and files saved on Windows leave a stray
 * carriage return on the last column of every row.
 */

/** Splits CSV text into rows of raw cells, honouring quotes, escaped quotes and CRLF. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  // Strip a UTF-8 BOM, or the first header name carries an invisible prefix.
  const input = text.replace(/^﻿/, '')

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++ }  // "" is a literal quote
        else inQuotes = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') { inQuotes = true; continue }

    if (char === ',') { row.push(cell); cell = ''; continue }

    if (char === '\r') continue              // CRLF, and stray CR on the last column
    if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }

    cell += char
  }

  // Whatever is left when the file does not end in a newline.
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }

  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Header names compare loosely: "First Name", "first_name" and "FIRSTNAME" are one key. */
export function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[\s_\-.]+/g, '')
}

/** Parses CSV text into row objects keyed by their original header names. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text)
  if (rows.length < 2) return []

  const headers = rows[0].map((h) => h.trim())

  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {}
    headers.forEach((header, i) => {
      if (header) record[header] = (cells[i] ?? '').trim()
    })
    return record
  })
}

/** Reads the first non-empty value among any of the given header spellings. */
export function pick(row: Record<string, string>, ...names: string[]): string {
  const lookup = new Map<string, string>()
  for (const [key, value] of Object.entries(row)) {
    const normal = normalizeHeader(key)
    if (!lookup.has(normal) && String(value ?? '').trim()) {
      lookup.set(normal, String(value).trim())
    }
  }
  for (const name of names) {
    const hit = lookup.get(normalizeHeader(name))
    if (hit) return hit
  }
  return ''
}

export interface ImportedName {
  first: string
  last: string
}

/**
 * Works out a first and last name from whichever columns the export used.
 *
 * Separate name columns win. Otherwise a single full-name column is split on
 * the last space, so "Mary Anne Del Toro" keeps "Del Toro" together as best it
 * can — and "Smith, John" (surname-first, as several CRMs export) is flipped.
 */
export function resolveName(row: Record<string, string>): ImportedName {
  const first = pick(row, 'First Name', 'firstname', 'first', 'given name', 'fname')
  const last = pick(row, 'Last Name', 'lastname', 'last', 'surname', 'family name', 'lname')
  if (first || last) return { first, last }

  const full = pick(row, 'Full Name', 'Contact Name', 'Name', 'Customer Name', 'Client Name', 'display name')
  if (!full) return { first: '', last: '' }

  if (full.includes(',')) {
    const [surname, rest] = full.split(',', 2)
    return { first: (rest ?? '').trim(), last: surname.trim() }
  }

  const parts = full.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}
