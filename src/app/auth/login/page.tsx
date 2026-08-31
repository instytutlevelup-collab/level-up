'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async () => {
    setError('')
    setResetMessage('')
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

  const handleResetPassword = async () => {
    if (!email) {
      setError("Wpisz swój adres e-mail powyżej, aby zresetować hasło.")
      setResetMessage("")
      return
    }
    try {
      await sendPasswordResetEmail(auth, email)
      setResetMessage("Link do resetu hasła został wysłany! Sprawdź swoją skrzynkę (i folder SPAM).")
      setError("")
    } catch (err) {
      console.error(err)
      setError("Błąd. Sprawdź, czy wpisany adres e-mail jest poprawny i czy posiadasz u nas konto.")
      setResetMessage("")
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
              onChange={e => {
                setEmail(e.target.value)
                setError('')
                setResetMessage('')
              }}
            />
          </div>

          <div>
            <label className="block mb-1">Hasło</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            
            <div className="flex justify-end mt-1 mb-2">
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-sm text-gray-500 hover:text-gray-800 underline transition-colors"
              >
                Nie pamiętam hasła
              </button>
            </div>
            {resetMessage && <p className="text-green-600 text-sm mt-2">{resetMessage}</p>}
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
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