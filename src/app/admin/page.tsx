// 'use client' musi być na samej górze
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, setDoc, doc, deleteDoc, getDoc, addDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  accountType: string
  subjects?: string[]
  canCancel?: boolean
  linkedAccounts?: { studentId: string; studentName: string }[]
  schoolType?: string
  schoolGrade?: string
  lessonModes?: string[]
}

export default function AdminPage() {
  const router = useRouter()
  // Wszystkie hooki na górze
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [newSubject, setNewSubject] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  const [pendingReviews, setPendingReviews] = useState<any[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)

  // Hook dla auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/auth/login')
        return
      }
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'))
        const userData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User))
          .find(u => u.email === user.email)
        if (!userData || userData.accountType !== 'admin') {
          router.replace('/')
          return
        }
        setLoadingAuth(false)
      } catch {
        router.replace('/')
      }
    })
    return () => unsubscribe()
  }, [router])

  // Inne useEffect dla pobierania danych
  useEffect(() => {
    loadSchoolYearSettings()
    fetchSubjects()
    fetchPendingReviews()
  }, [])

  if (loadingAuth) return <p>Ładowanie...</p>

  // Funkcje async i logika po hookach

  async function loadSchoolYearSettings() {
    try {
      const docRef = doc(db, 'settings', 'schoolYear')
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        const data = docSnap.data()
        setStartDate(data.startDate || '')
        setEndDate(data.endDate || '')
      }
    } catch (error) {
      console.error('Błąd ładowania ustawień roku szkolnego:', error)
    }
  }

  async function saveSchoolYearSettings() {
    setSavingSettings(true)
    try {
      const docRef = doc(db, 'settings', 'schoolYear')
      await setDoc(docRef, {
        startDate,
        endDate,
      })
      alert('Ustawienia roku szkolnego zostały zapisane.')
    } catch (error) {
      alert('Błąd zapisu ustawień roku szkolnego.')
      console.error(error)
    }
    setSavingSettings(false)
  }

  async function fetchSubjects() {
    const snapshot = await getDocs(collection(db, 'subjects'))
    setSubjects(snapshot.docs.map(doc => doc.data().name))
  }

  async function fetchPendingReviews() {
    setLoadingReviews(true)
    try {
      const snapshot = await getDocs(
        collection(db, 'reviews')
      )
      const reviews = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(r => !r.approved) // tylko opinie niezatwierdzone
      setPendingReviews(reviews)
    } catch (error) {
      console.error('Błąd pobierania opinii:', error)
    }
    setLoadingReviews(false)
  }

  const approveReview = async (reviewId: string) => {
    try {
      const reviewRef = doc(db, 'reviews', reviewId)
      await setDoc(reviewRef, { approved: true }, { merge: true })
      setPendingReviews(prev => prev.filter(r => r.id !== reviewId))
      alert('Opinia została zatwierdzona.')
    } catch (error) {
      console.error('Błąd zatwierdzania opinii:', error)
      alert('Nie udało się zatwierdzić opinii.')
    }
  }

  const rejectReview = async (reviewId: string) => {
    try {
      const reviewRef = doc(db, 'reviews', reviewId)
      await setDoc(reviewRef, { approved: false, rejected: true }, { merge: true })
      setPendingReviews(prev => prev.filter(r => r.id !== reviewId))
      alert('Opinia została odrzucona.')
    } catch (error) {
      console.error('Błąd odrzucania opinii:', error)
      alert('Nie udało się odrzucić opinii.')
    }
  }

  const addSubject = async () => {
    if (!newSubject.trim()) {
      alert('Podaj nazwę przedmiotu')
      return
    }
    try {
      await addDoc(collection(db, 'subjects'), { name: newSubject.trim() })
      setSubjects([...subjects, newSubject.trim()])
      setNewSubject('')
    } catch (error) {
      alert('Błąd przy dodawaniu przedmiotu')
      console.error(error)
    }
  }

  // Usuwanie przedmiotu
  const deleteSubject = async (subjectName: string) => {
    try {
      const snapshot = await getDocs(collection(db, 'subjects'))
      const subjectDoc = snapshot.docs.find(doc => doc.data().name === subjectName)
      if (subjectDoc) {
        await deleteDoc(doc(db, 'subjects', subjectDoc.id))
        setSubjects(subjects.filter(s => s !== subjectName))
      } else {
        alert('Nie znaleziono przedmiotu do usunięcia.')
      }
    } catch (error) {
      alert('Błąd przy usuwaniu przedmiotu')
      console.error(error)
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Ustawienia</h1>



      {/* Ustawienia roku szkolnego */}
      <Card className="mb-10 p-6 border rounded-md shadow-sm w-full">
        <CardHeader>
          <CardTitle>Ustawienia semestru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Data rozpoczęcia</Label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Data zakończenia</Label>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <Button onClick={saveSchoolYearSettings} disabled={savingSettings}>
            {savingSettings ? 'Zapisuję...' : 'Zapisz ustawienia'}
          </Button>
        </CardContent>
      </Card>

      {/* Sekcja opinii do zatwierdzenia */}
      <Card className="mb-10 p-6 border rounded-md shadow-sm w-full">
        <CardHeader>
          <CardTitle>Opinie do zatwierdzenia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingReviews ? (
            <p>Ładowanie opinii...</p>
          ) : pendingReviews.length === 0 ? (
            <p>Brak nowych opinii do zatwierdzenia.</p>
          ) : (
            <ul className="list-disc list-inside space-y-2">
              {pendingReviews.map(review => (
                <li key={review.id} className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-2">
                  <div>
                    <p>
                      <strong>{review.firstName || 'Anonim'} {review.lastName || ''}</strong> 
                      {review.stars ? Array.from({ length: review.stars }, () => '⭐').join('') : ''}: {review.comment}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => approveReview(review.id)}>Zatwierdź</Button>
                    <Button variant="destructive" onClick={() => rejectReview(review.id)}>Odrzuć</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Sekcja przedmiotów */}
      <Card className="mt-6 w-full">
        <CardHeader>
          <CardTitle>Przedmioty</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Nowy przedmiot"
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
            />
            <Button onClick={addSubject}>Dodaj</Button>
          </div>
          <ul className="list-disc list-inside space-y-1">
            {subjects.map((subject, idx) => (
              <li key={idx} className="flex items-center justify-between">
                <span>{subject}</span>
                <Button variant="destructive" size="sm" onClick={() => deleteSubject(subject)}>
                  Usuń
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

    </div>
  )
}