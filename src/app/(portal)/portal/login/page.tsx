'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'

export default function PortalLoginPage() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode]       = useState<'login' | 'request'>('login')
  const [sent, setSent]       = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/portal/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/portal')
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Login failed')
    }
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/portal/auth/request-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (res.ok) setSent(true)
    else toast.error('Request failed — please try again')
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block bg-dark-800 rounded-2xl p-4 mb-4">
            <div className="text-gold-500 font-black text-3xl tracking-tight">AL</div>
            <div className="text-white text-xs font-medium tracking-widest mt-0.5">LENDING</div>
          </div>
          <h1 className="text-2xl font-black text-white">Borrower Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Asset Lift Lending — Track your loan application</p>
        </div>

        <div className="bg-dark-800 rounded-3xl border border-dark-700 p-8">
          {/* Tab toggle */}
          <div className="flex gap-1 bg-dark-900 rounded-xl p-1 mb-6">
            {(['login', 'request'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                  ${mode === m ? 'bg-gold-500 text-dark-800' : 'text-gray-400 hover:text-white'}`}>
                {m === 'login' ? 'Sign In' : 'Request Access'}
              </button>
            ))}
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gold-500 text-sm"
                  placeholder="your@email.com" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gold-500 text-sm"
                  placeholder="••••••••" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-black py-3 rounded-xl text-sm mt-2 transition-colors">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <>
              {sent ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">✉️</div>
                  <h3 className="text-white font-bold mb-2">Check your email</h3>
                  <p className="text-gray-400 text-sm">We've sent login instructions to <strong className="text-white">{email}</strong></p>
                </div>
              ) : (
                <form onSubmit={handleRequest} className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    Don't have an account? Enter your email and we'll send you access to track your loan application.
                  </p>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Email Address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gold-500 text-sm"
                      placeholder="your@email.com" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800 font-black py-3 rounded-xl text-sm mt-2 transition-colors">
                    {loading ? 'Sending…' : 'Request Access'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center text-gray-400 text-sm mt-6">
          New borrower?{' '}
          <a href="/portal/signup" className="text-gold-500 hover:underline font-medium">Apply now →</a>
        </p>
        <p className="text-center text-gray-600 text-xs mt-3">
          Broker partner?{' '}
          <a href="/broker/login" className="text-gray-400 hover:text-gray-300">Broker login</a>
        </p>
      </div>
    </div>
  )
}
