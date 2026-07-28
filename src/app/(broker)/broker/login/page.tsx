'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BrokerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/broker/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      router.push('/broker')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#D4A017] rounded-full flex items-center justify-center text-black font-black text-lg">A</div>
            <span className="text-white font-bold text-2xl">Asset Lift Lending</span>
          </div>
          <p className="text-gray-400 text-sm">Broker Partner Portal</p>
        </div>

        <div className="bg-[#111] rounded-2xl border border-gray-800 p-8">
          <h2 className="text-white font-semibold text-lg mb-6">Broker Sign In</h2>

          {error && (
            <div className="mb-5 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Email Address</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                placeholder="you@brokeragefirm.com" />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">Password</label>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4A017]"
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[#D4A017] text-black font-bold py-3 rounded-lg hover:bg-[#E5B828] transition-colors disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            New broker partner?{' '}
            <a href="/broker/signup" className="text-[#D4A017] hover:underline">Apply for access</a>
          </p>
        </div>
      </div>
    </div>
  )
}
