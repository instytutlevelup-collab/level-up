'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    accountType: "student",
    school: "",
    classLevel: "",
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!agreedToTerms) {
      setLoading(false)
      setError("Musisz zaakceptować regulamin, aby się zarejestrować.")
      return
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password)
      const user = userCredential.user

      await setDoc(doc(db, "users", user.uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        accountType: formData.accountType,
        subjects: [],
        ...(formData.accountType === "student" && {
          school: formData.school,
          classLevel: formData.classLevel,
          canBook: true,
          canCancel: true,
        }),
        acceptedTerms: true,
        acceptedTermsAt: new Date().toISOString(),
        acceptedPrivacy: true,
        acceptedPrivacyAt: new Date().toISOString(),
      })

      router.push("/auth/login")
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError("Wystąpił nieznany błąd.")
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-6">Rejestracja</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Imię</Label>
            <Input
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
          </div>

          <div>
            <Label>Nazwisko</Label>
            <Input
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              required
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <Label>Hasło</Label>
            <Input
              required
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div>
            <Label>Rola</Label>
            <Select value={formData.accountType} onValueChange={(value) => setFormData({ ...formData, accountType: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Uczeń</SelectItem>
                <SelectItem value="parent">Rodzic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.accountType === "student" && (
            <>
              <div>
                <Label>Szkoła</Label>
                <Select
                  value={formData.school || ""}
                  onValueChange={(value) => {
                    const newClass = ""; // reset klasy przy zmianie szkoły
                    setFormData({ ...formData, school: value, classLevel: newClass });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz szkołę" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="szkoła podstawowa">Szkoła podstawowa</SelectItem>
                    <SelectItem value="liceum">Liceum</SelectItem>
                    <SelectItem value="technikum">Technikum</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Klasa</Label>
                <Select
                  value={formData.classLevel || ""}
                  onValueChange={(value) => setFormData({ ...formData, classLevel: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz klasę" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.school === "szkoła podstawowa" &&
                      Array.from({ length: 8 }, (_, i) => (
                        <SelectItem key={i + 1} value={`Klasa ${i + 1}`}>{`Klasa ${i + 1}`}</SelectItem>
                      ))}
                    {formData.school === "liceum" &&
                      Array.from({ length: 4 }, (_, i) => (
                        <SelectItem key={i + 1} value={`Klasa ${i + 1}`}>{`Klasa ${i + 1}`}</SelectItem>
                      ))}
                    {formData.school === "technikum" &&
                      Array.from({ length: 5 }, (_, i) => (
                        <SelectItem key={i + 1} value={`Klasa ${i + 1}`}>{`Klasa ${i + 1}`}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex items-start gap-2">
            <input
              id="terms"
              type="checkbox"
              required
              checked={agreedToTerms}
              onChange={() => setAgreedToTerms(!agreedToTerms)}
              className="mt-1"
            />
            <label htmlFor="terms" className="text-sm text-gray-700">
              Akceptuję{" "}
              <a href="/terms" target="_blank" className="underline text-blue-600">
                regulamin
              </a>{" "}
              oraz{" "}
              <a href="/privacy" target="_blank" className="underline text-blue-600">
                politykę prywatności i RODO
              </a>
            </label>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Rejestruję..." : "Zarejestruj się"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Masz już konto?{' '}
          <Link href="/auth/login" className="text-blue-600 hover:underline">
            Zaloguj się
          </Link>
        </div>
      </div>
    </div>
  )
}