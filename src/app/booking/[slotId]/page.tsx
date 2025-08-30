'use client'

import { useState, useEffect } from "react"
import { doc, getDoc } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { useRouter } from "next/navigation"

interface UserData {
  id: string;
  accountType?: "parent" | "student" | "tutor" | "admin";
  firstName?: string;
  lastName?: string;
  email?: string;
  linkedAccounts?: UserData[];
  [key: string]: unknown;
}

export default function TutorAvailabilityPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<UserData | null>(null)

  // Removed buffer states

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/auth/login")
        return
      }
      const userDoc = await getDoc(doc(db, "users", user.uid))
      if (!userDoc.exists()) {
        router.push("/auth/login")
        return
      }

      const userData: UserData = { id: user.uid, ...(userDoc.data() as Partial<UserData>) };
      setCurrentUser(userData)

      // Removed buffer state setters

    })
    return () => unsubscribe()
  }, [router])

  const handleSaveAvailability = async () => {
    if (!currentUser) return

    // Minimal update or comment out if no fields to update
    // For example, here we do nothing or update linkedAccounts if needed
    // await updateDoc(doc(db, "users", currentUser.id), {
    //   linkedAccounts: linkedChildren
    // })

    alert("Zapisano dostępność i bufory czasowe.")
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Dostępność korepetytora</h1>

      {/* Removed buffer input sections */}

      {/* Example select for time slots using new logic */}
      <div className="mt-4">
        <label>Wybierz godzinę zajęć</label>
        <select value={""} onChange={() => {}} className="w-full border rounded px-2 py-1">
          <option value="">Wybierz godzinę</option>
          {/* No options since tutors and tutorId are removed */}
        </select>
      </div>

      <button
        onClick={handleSaveAvailability}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Zapisz dostępność
      </button>
    </div>
  )
}