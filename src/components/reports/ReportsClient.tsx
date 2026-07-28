'use client'

import { fmt } from '@/lib/utils/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

const GOLD   = '#D4A017'
const BLACK  = '#1A1A1A'
const GREEN  = '#2ECC71'
const BLUE   = '#2980B9'
const RED    = '#E74C3C'
const PURPLE = '#8E44AD'

const PIE_COLORS = [GOLD, BLUE, GREEN, PURPLE, RED, '#E67E22', '#1ABC9C']

interface Deal {
  id: string; stage: string; loan_program: string
  loan_amount?: number; lead_source?: string
  created_at: string; close_date_actual?: string; funded_amount?: number
}
interface Comm { id: string; type: string; direction?: string; created_at: string }
interface AdCampaign {
  id: string; platform: string; campaign_name?: string
  spend?: number; clicks?: number; leads?: number; deals_funded?: number; revenue?: number
}

export default function ReportsClient({
  deals, contacts, comms, adCampaigns,
}: {
  deals: Deal[]
  contacts: Array<{ id: string; lead_source?: string; created_at: string }>
  comms: Comm[]
  adCampaigns: AdCampaign[]
}) {
  // ── Computed metrics ────────────────────────────────────
  const totalContacts = contacts.length
  const totalDeals    = deals.length
  const fundedDeals   = deals.filter((d) => d.stage === 'funded')
  const totalRevenue  = fundedDeals.reduce((s, d) => s + (d.funded_amount ?? d.loan_amount ?? 0), 0)
  const convRate      = totalDeals > 0 ? (fundedDeals.length / totalDeals * 100).toFixed(1) : '0'
  const pipelineValue = deals
    .filter((d) => d.stage === 'in_progress')
    .reduce((s, d) => s + (d.loan_amount ?? 0), 0)

  // Leads by source
  const bySource: Record<string, number> = {}
  contacts.forEach((c) => {
    const src = c.lead_source ?? 'direct'
    bySource[src] = (bySource[src] ?? 0) + 1
  })
  const sourceData = Object.entries(bySource)
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    .sort((a, b) => b.value - a.value)

  // Deals by program
  const byProgram: Record<string, number> = {}
  deals.forEach((d) => { byProgram[d.loan_program] = (byProgram[d.loan_program] ?? 0) + 1 })
  const programData = Object.entries(byProgram)
    .map(([name, value]) => ({ name: fmt.loanProgram(name), value }))

  // Pipeline by stage
  const stageOrder = ['new_inquiry', 'contacted', 'just_searching', 'dead_lead', 'in_progress', 'funded']
  const stageData  = stageOrder.map((s) => ({
    name: fmt.stage(s),
    count: deals.filter((d) => d.stage === s).length,
    value: deals.filter((d) => d.stage === s).reduce((sum, d) => sum + (d.loan_amount ?? 0), 0) / 1000,
  }))

  // Ad ROI
  const totalAdSpend = adCampaigns.reduce((s, c) => s + (c.spend ?? 0), 0)
  const totalAdLeads = adCampaigns.reduce((s, c) => s + (c.leads ?? 0), 0)
  const totalAdFunded = adCampaigns.reduce((s, c) => s + (c.deals_funded ?? 0), 0)
  const costPerLead  = totalAdLeads > 0 ? totalAdSpend / totalAdLeads : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-800">Reports &amp; Analytics</h1>
        <p className="text-gray-500 text-sm">Your complete business performance overview</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Contacts',   value: totalContacts,               color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Pipeline Value',   value: fmt.currency(pipelineValue), color: 'text-gold-600',   bg: 'bg-gold-50'   },
          { label: 'Loans Funded',     value: fundedDeals.length,          color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Total Revenue',    value: fmt.currency(totalRevenue),  color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Conversion Rate',  value: `${convRate}%`,              color: 'text-dark-800',   bg: 'bg-gray-50'   },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-2xl border border-gray-100 p-4 text-center`}>
            <div className={`text-2xl font-black ${k.color}`}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Pipeline by Stage */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-dark-800 mb-4">Pipeline by Stage</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stageData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v} deals`, 'Count']} />
              <Bar dataKey="count" fill={GOLD} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leads by Source */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-dark-800 mb-4">Leads by Source</h2>
          {sourceData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" nameKey="name">
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {sourceData.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs capitalize text-gray-600">{s.name}</span>
                    </div>
                    <span className="text-xs font-bold text-dark-800">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">No data yet — leads will populate as they come in</div>
          )}
        </div>

        {/* Loan Programs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-dark-800 mb-4">Deals by Loan Program</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={programData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="value" fill={BLACK} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ad ROI */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-dark-800 mb-1">Advertising ROI</h2>
          <p className="text-xs text-gray-400 mb-4">Meta + Google combined</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Total Ad Spend',   value: fmt.currency(totalAdSpend) },
              { label: 'Leads Generated',  value: totalAdLeads },
              { label: 'Cost Per Lead',    value: fmt.currency(costPerLead) },
              { label: 'Deals Funded',     value: totalAdFunded },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-lg font-black text-dark-800">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
          {adCampaigns.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-gray-400 pb-2 font-medium">Campaign</th>
                  <th className="text-right text-gray-400 pb-2 font-medium">Spend</th>
                  <th className="text-right text-gray-400 pb-2 font-medium">Leads</th>
                </tr>
              </thead>
              <tbody>
                {adCampaigns.slice(0, 5).map((c) => (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700 truncate max-w-[140px]">{c.campaign_name ?? 'Campaign'}</td>
                    <td className="py-2 text-right font-medium">{fmt.currency(c.spend)}</td>
                    <td className="py-2 text-right font-medium">{c.leads ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-xs text-gray-400 py-2">Connect Meta &amp; Google Ads in Settings to see campaign data</div>
          )}
        </div>
      </div>
    </div>
  )
}
