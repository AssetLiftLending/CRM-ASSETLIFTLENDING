'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-dark-800 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, #D4A017 0%, transparent 50%), radial-gradient(circle at 75% 75%, #D4A017 0%, transparent 50%)' }} />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-gold-500 rounded-2xl flex items-center justify-center">
              <span className="text-dark-800 font-black text-xl">AL</span>
            </div>
            <div className="text-left">
              <div className="text-white font-bold text-xl leading-tight">Asset Lift</div>
              <div className="text-gold-500 font-bold text-xl leading-tight">Lending</div>
            </div>
          </div>
          <p className="text-gray-400 text-sm">Sign in to your CRM</p>
        </div>

        {/* Card */}
        <div className="bg-dark-700 border border-dark-500 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@assetliftlending.com"
                required
                className="w-full bg-dark-600 border border-dark-400 text-white rounded-xl px-4 py-3 text-sm
                           focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-dark-600 border border-dark-400 text-white rounded-xl px-4 py-3 text-sm
                           focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-base"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-dark-800
                         font-bold py-3 rounded-xl transition-base text-sm"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-500">
            <p className="text-center text-xs text-gray-500">
              Borrower? <a href="/portal" className="text-gold-400 hover:underline">Access your loan portal →</a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Asset Lift Lending © {new Date().getFullYear()} · All rights reserved
        </p>
      </div>
    </div>
  )
}
