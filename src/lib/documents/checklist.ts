/**
 * The borrower document checklist.
 *
 * The standard items every deal starts with, plus whatever the lender adds for
 * a particular deal. One definition serves the CRM deal page, the borrower
 * portal, and the broker view, so a document requested in one is visible in all.
 */

export type ChecklistKind = 'upload' | 'ssn' | 'contact_quote' | 'payment'

export interface ChecklistItem {
  key: string
  label: string
  kind: ChecklistKind
  custom?: boolean
}

export const STANDARD_DOC_TYPES: ChecklistItem[] = [
  { key: 'government_id',        label: 'Government-Issued ID',           kind: 'upload' },
  { key: 'ssn',                  label: 'Social Security Number',         kind: 'ssn' },
  { key: 'bank_statement',       label: 'Recent Bank Statement',          kind: 'upload' },
  { key: 'purchase_contract',    label: 'Signed Purchase Contract',       kind: 'upload' },
  { key: 'llc_documents',        label: 'LLC Documents',                  kind: 'upload' },
  { key: 'scope_of_work',        label: 'Scope of Work',                  kind: 'upload' },
  { key: 'reo_experience',       label: 'REO Experience Form',            kind: 'upload' },
  { key: 'title_company_info',   label: 'Title Company Contact & Quote',  kind: 'contact_quote' },
  { key: 'insurance_agent_info', label: 'Insurance Agent Contact & Quote', kind: 'contact_quote' },
  { key: 'appraisal_payment',    label: 'Appraisal Payment',              kind: 'payment' },
]

export interface DocumentRequirementRow {
  id?: string
  key: string
  label: string
  sort_order?: number | null
}

/** Turns a free-text label into a stable key, e.g. "2023 Tax Return" -> "custom_2023_tax_return". */
export function toRequirementKey(label: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
  return slug ? `custom_${slug}` : ''
}

/** Standard items first, then the lender's additions in the order they were added. */
export function buildChecklist(custom: DocumentRequirementRow[] = []): ChecklistItem[] {
  const standardKeys = new Set(STANDARD_DOC_TYPES.map((d) => d.key))
  const extras = [...custom]
    .filter((row) => row.key && row.label && !standardKeys.has(row.key))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map<ChecklistItem>((row) => ({ key: row.key, label: row.label, kind: 'upload', custom: true }))

  return [...STANDARD_DOC_TYPES, ...extras]
}
