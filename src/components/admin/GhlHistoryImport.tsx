'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle, Loader2, MessageSquare, Play, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Pulls call and message history out of GoHighLevel.
 *
 * A dry run first, because the only way to know GHL's payload shape for a given
 * account is to look at one. The real import then runs in batches, driven from
 * here, so no single request has to survive a few hundred conversations.
 */

interface BatchResult {
  dryRun: boolean
  total: number
  conversationsProcessed: number
  messagesFound: number
  imported: number
  duplicates: number
  unmatched: number
  unmatchedNames: string[]
  samples: Array<{ contact: string; type: string; direction: string | null; date: string; preview: string }>
  nextCursor?: string
}

interface Totals {
  conversations: number
  messages: number
  imported: number
  duplicates: number
  unmatched: number
}

const EMPTY: Totals = { conversations: 0, messages: 0, imported: 0, duplicates: 0, unmatched: 0 }

export default function GhlHistoryImport() {
  const [connection, setConnection] = useState<{ ok: boolean; message: string; total?: number } | null>(null)
  const [checking, setChecking] = useState(false)
  const [running, setRunning] = useState<'dry' | 'real' | null>(null)
  const [preview, setPreview] = useState<BatchResult | null>(null)
  const [totals, setTotals] = useState<Totals>(EMPTY)
  const [unmatched, setUnmatched] = useState<string[]>([])
  const [done, setDone] = useState(false)

  async function checkConnection() {
    setChecking(true)
    try {
      const res = await fetch('/api/import/ghl')
      const data = await res.json()
      setConnection(res.ok ? data : { ok: false, message: data?.error ?? 'Check failed' })
    } catch {
      setConnection({ ok: false, message: 'Could not reach the CRM.' })
    }
    setChecking(false)
  }

  async function runBatch(dryRun: boolean, cursor?: string): Promise<BatchResult> {
    const res = await fetch('/api/import/ghl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun, cursor, limit: 20 }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error ?? 'Import failed')
    return data
  }

  async function dryRun() {
    setRunning('dry')
    setPreview(null)
    try {
      const result = await runBatch(true)
      setPreview(result)
      toast.success(`Found ${result.messagesFound} messages in the first ${result.conversationsProcessed} conversations`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dry run failed')
    } finally {
      setRunning(null)
    }
  }

  async function importAll() {
    setRunning('real')
    setTotals(EMPTY)
    setUnmatched([])
    setDone(false)

    let cursor: string | undefined
    const running: Totals = { ...EMPTY }
    const missed = new Set<string>()

    try {
      // Batches continue until GHL stops handing back a cursor.
      for (let batch = 0; batch < 200; batch++) {
        const result = await runBatch(false, cursor)

        running.conversations += result.conversationsProcessed
        running.messages += result.messagesFound
        running.imported += result.imported
        running.duplicates += result.duplicates
        running.unmatched += result.unmatched
        result.unmatchedNames.forEach(n => missed.add(n))

        setTotals({ ...running })
        setUnmatched([...missed])

        if (!result.nextCursor) break
        cursor = result.nextCursor
      }

      setDone(true)
      toast.success(`Imported ${running.imported} messages`)
    } catch (err) {
      // Whatever imported before the failure stays put; re-running resumes.
      toast.error(err instanceof Error ? err.message : 'Import stopped')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-dark-800 flex items-center gap-2">
            <MessageSquare size={16} className="text-gold-500" /> Import GoHighLevel history
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Brings past texts, calls and emails onto each contact's timeline, keeping their original dates.
          </p>
        </div>
        <button onClick={checkConnection} disabled={checking}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-dark-800 disabled:opacity-50 flex-shrink-0">
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} /> Check connection
        </button>
      </div>

      {connection && (
        <div className={`flex items-start gap-3 p-3 rounded-xl ${connection.ok ? 'bg-green-50' : 'bg-red-50'}`}>
          {connection.ok
            ? <CheckCircle size={17} className="text-green-600 mt-0.5 flex-shrink-0" />
            : <AlertCircle size={17} className="text-red-600 mt-0.5 flex-shrink-0" />}
          <p className={`text-sm ${connection.ok ? 'text-green-700' : 'text-red-700'}`}>{connection.message}</p>
        </div>
      )}

      {!connection && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
          Needs <code className="font-mono">GHL_API_TOKEN</code> and <code className="font-mono">GHL_LOCATION_ID</code> in
          your environment variables. Press <strong>Check connection</strong> once they are set.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={dryRun} disabled={running !== null}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gold-400 disabled:opacity-50">
          {running === 'dry' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Preview first 20 conversations
        </button>
        <button onClick={importAll} disabled={running !== null || !preview}
          title={preview ? '' : 'Run the preview first'}
          className="flex items-center gap-2 rounded-xl bg-gold-500 hover:bg-gold-400 px-4 py-2 text-sm font-bold text-dark-800 disabled:opacity-50">
          {running === 'real' ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
          {running === 'real' ? 'Importing…' : 'Import everything'}
        </button>
      </div>

      {preview && (
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 text-xs text-gray-600">
            {preview.total.toLocaleString()} conversations in GHL · {preview.messagesFound} messages in the first{' '}
            {preview.conversationsProcessed} · <strong>nothing written yet</strong>
          </div>
          {preview.samples.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="px-4 py-2 font-medium">Contact</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preview.samples.map((s, i) => (
                  <tr key={i} className="text-gray-600">
                    <td className="px-4 py-2">{s.contact || '—'}</td>
                    <td className="px-4 py-2 capitalize">{s.type}{s.direction ? ` · ${s.direction}` : ''}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{new Date(s.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2 truncate max-w-xs">{s.preview || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview.unmatched > 0 && (
            <div className="px-4 py-2.5 text-xs text-yellow-800 bg-yellow-50">
              {preview.unmatched} conversation{preview.unmatched === 1 ? '' : 's'} had no matching contact and will be
              skipped — import your contacts CSV first so there is someone to attach them to.
            </div>
          )}
        </div>
      )}

      {(running === 'real' || done) && (
        <div className="rounded-xl bg-gray-50 p-4 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { label: 'Conversations', value: totals.conversations },
              { label: 'Messages found', value: totals.messages },
              { label: 'Imported', value: totals.imported },
              { label: 'Already there', value: totals.duplicates },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-xl font-bold text-dark-800 tabular-nums">{stat.value.toLocaleString()}</div>
                <div className="text-[11px] text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
          {done && <p className="text-xs text-green-700 text-center">Finished. Open any contact to see their history.</p>}
          {unmatched.length > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">{totals.unmatched} skipped — no matching contact</summary>
              <ul className="mt-2 space-y-0.5 pl-4 list-disc">
                {unmatched.slice(0, 20).map(name => <li key={name}>{name}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
