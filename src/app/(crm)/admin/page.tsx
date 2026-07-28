'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState<{ imported: number; skipped: number; errors: number; total: number } | null>(null)
  const [preview, setPreview]       = useState<Record<string, string>[] | null>(null)
  const [pasteData, setPasteData]   = useState('')
  const [mode, setMode]             = useState<'csv' | 'paste'>('csv')

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows  = parseCSV(text)
      setPreview(rows.slice(0, 5))
      handleImport(rows)
    }
    reader.readAsText(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  })

  async function handleImport(contacts: Record<string, string>[]) {
    setImporting(true)
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts }),
    })
    const data = await res.json()
    setResult(data)
    setImporting(false)
    if (res.ok) toast.success(`Imported ${data.imported} contacts!`)
    else toast.error('Import failed')
  }

  async function handlePasteImport() {
    const rows = parseCSV(pasteData)
    if (!rows.length) return toast.error('No data to import')
    await handleImport(rows)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-dark-800">Import / Admin</h1>
        <p className="text-gray-500 text-sm">Import your GoHighLevel contacts and manage your CRM data</p>
      </div>

      {/* GHL Import */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold text-dark-800">GoHighLevel Contact Import</h2>
          <p className="text-sm text-gray-500 mt-1">
            Export your contacts from GHL (Contacts → Export → CSV) and upload here. All contacts, pipeline stages, tags, and notes are mapped automatically.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['csv', 'paste'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-base
                  ${mode === m ? 'bg-gold-500 border-gold-500 text-dark-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gold-300'}`}>
                {m === 'csv' ? '📁 Upload CSV' : '📋 Paste Data'}
              </button>
            ))}
          </div>

          {mode === 'csv' && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-base
                ${isDragActive ? 'border-gold-500 bg-gold-50' : 'border-gray-200 hover:border-gold-300 hover:bg-gray-50'}`}
            >
              <input {...getInputProps()} />
              <Upload size={32} className="mx-auto text-gray-300 mb-3" />
              <div className="font-medium text-gray-700">
                {isDragActive ? 'Drop your GHL CSV here…' : 'Drag & drop your GHL export CSV'}
              </div>
              <div className="text-sm text-gray-400 mt-1">or click to browse — .csv files only</div>
            </div>
          )}

          {mode === 'paste' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Paste your CSV data below (including header row). Works with GHL's copy-all from the contacts table.</p>
              <textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder="First Name,Last Name,Email,Phone,Tags,Notes&#10;John,Smith,john@example.com,5551234567,investor,Great lead"
                rows={8}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-gold-500 resize-none"
              />
              <button
                onClick={handlePasteImport}
                disabled={importing || !pasteData.trim()}
                className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-bold px-5 py-2.5 rounded-xl text-sm transition-base"
              >
                {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {importing ? 'Importing…' : 'Import Contacts'}
              </button>
            </div>
          )}

          {importing && (
            <div className="flex items-center gap-3 bg-gold-50 border border-gold-200 rounded-xl p-4">
              <Loader2 size={20} className="text-gold-500 animate-spin" />
              <div>
                <div className="font-medium text-dark-800">Importing contacts…</div>
                <div className="text-xs text-gray-500">Creating contacts, deals, and triggering automations</div>
              </div>
            </div>
          )}

          {result && !importing && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={18} className="text-green-500" />
                <span className="font-bold text-green-700">Import Complete</span>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  { label: 'Total Rows', value: result.total,    color: 'text-dark-800' },
                  { label: 'Imported',   value: result.imported, color: 'text-green-600' },
                  { label: 'Skipped',    value: result.skipped,  color: 'text-yellow-600' },
                  { label: 'Errors',     value: result.errors,   color: 'text-red-600' },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-xl p-3 border border-green-100">
                    <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>
              {result.skipped > 0 && (
                <p className="text-xs text-gray-500 mt-3">
                  {result.skipped} contacts were skipped because they already exist (matched by email).
                </p>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">How to export from GoHighLevel</div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>1. Log into GHL → Contacts → click Export (top right)</div>
              <div>2. Select All Contacts → Export as CSV</div>
              <div>3. Upload that file above — all fields are auto-mapped</div>
              <div>4. After import is verified, cancel GHL and cancel Gennie Rocket subscription</div>
            </div>
          </div>
        </div>
      </div>

      {/* Phone Number Port Status */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-dark-800 mb-4">Phone Number Port Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <div className="text-sm font-medium text-dark-800">Business Number (GHL → Twilio)</div>
              <div className="text-xs text-gray-500">Port request submitted through Twilio — takes 2-5 business days</div>
            </div>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-bold">Pending Port</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <div className="text-sm font-medium text-dark-800">Cell Phone Forwarding</div>
              <div className="text-xs text-gray-500">Configured in .env — calls to business number forward to your cell</div>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">Active ✓</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div>
              <div className="text-sm font-medium text-dark-800">WhatsApp Business</div>
              <div className="text-xs text-gray-500">Connected via Twilio API to your existing Business number</div>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">Active ✓</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function parseCSV(text: string): Record<string, string>[] {
  const lines   = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const vals: Record<string, string> = {}
    const cols = line.split(',')
    headers.forEach((h, i) => { vals[h] = (cols[i] ?? '').trim().replace(/^"|"$/g, '') })
    return vals
  }).filter((r) => Object.values(r).some(Boolean))
}
