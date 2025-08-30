'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/dashboard')
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Login error:", error)
      alert('Błąd logowania: ' + error.message)
    } else {
      console.error("Login error:", error)
      alert('Wystąpił nieznany błąd logowania.')
    }
  }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-6">Zaloguj się</h1>

        <div className="space-y-4">
          <div>
            <label className="block mb-1">Email</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-1">Hasło</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <Button onClick={handleLogin} className="w-full">
            Zaloguj się
          </Button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          Nie masz jeszcze konta?{' '}
          <Link href="/auth/register" className="text-blue-600 hover:underline">
            Zarejestruj się
          </Link>
        </div>
      </div>
    </div>
  )
}