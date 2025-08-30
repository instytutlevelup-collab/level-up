"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SchoolYearSettings() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchSettings() {
      const docRef = doc(db, "settings", "schoolYear")
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        const data = docSnap.data()
        setStartDate(data.startDate || "")
        setEndDate(data.endDate || "")
      }
      setLoading(false)
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    if (!startDate || !endDate) {
      alert("Proszę podać obie daty.")
      return
    }
    setSaving(true)
    try {
      await setDoc(doc(db, "settings", "schoolYear"), { startDate, endDate })
      alert("Ustawienia zapisane.")
    } catch (error) {
      alert("Błąd podczas zapisywania.")
      console.error(error)
    }
    setSaving(false)
  }

  if (loading) return <p>Ładowanie ustawień...</p>

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="space-y-4">
        <div>
          <Label>Data początku roku szkolnego</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Data końca roku szkolnego</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Zapisuję..." : "Zapisz ustawienia"}
        </Button>
      </div>
    </div>
  )
}