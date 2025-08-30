'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { setDoc, doc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function TutorsPage() {
  const [newTutorData, setNewTutorData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    subjects: '',
    offersOnline: true,
    offersAtTutor: true,
    offersAtStudent: false,
  })

  const [addingTutor, setAddingTutor] = useState(false)
  const [addTutorError, setAddTutorError] = useState('')


  async function handleAddTutor() {
    setAddTutorError('')
    setAddingTutor(true)

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, newTutorData.email, newTutorData.password)
      const user = userCredential.user

      await setDoc(doc(db, 'users', user.uid), {
        firstName: newTutorData.firstName,
        lastName: newTutorData.lastName,
        email: newTutorData.email,
        accountType: 'tutor',
        subjects: newTutorData.subjects.split(',').map(s => s.trim()),
        offersOnline: newTutorData.offersOnline,
        offersAtTutor: newTutorData.offersAtTutor,
        offersAtStudent: newTutorData.offersAtStudent,
      })

      setNewTutorData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        subjects: '',
        offersOnline: true,
        offersAtTutor: true,
        offersAtStudent: false,
      })
      alert('Korepetytor został dodany.')
    } catch (error: unknown) {
      if (error instanceof Error) {
        setAddTutorError(error.message)
      } else {
        setAddTutorError('Wystąpił nieznany błąd.')
      }
    }
    setAddingTutor(false)
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Dodaj nowego korepetytora</h1>
      <Card className="p-6">
        <CardHeader>
          <CardTitle>Nowy korepetytor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input placeholder="Imię" value={newTutorData.firstName || ''} onChange={e => setNewTutorData({ ...newTutorData, firstName: e.target.value })} />
            <Input placeholder="Nazwisko" value={newTutorData.lastName || ''} onChange={e => setNewTutorData({ ...newTutorData, lastName: e.target.value })} />
            <Input placeholder="Email" type="email" value={newTutorData.email || ''} onChange={e => setNewTutorData({ ...newTutorData, email: e.target.value })} />
            <Input placeholder="Hasło" type="password" value={newTutorData.password || ''} onChange={e => setNewTutorData({ ...newTutorData, password: e.target.value })} />
            <Input placeholder="Przedmioty (oddzielone przecinkami)" value={newTutorData.subjects || ''} onChange={e => setNewTutorData({ ...newTutorData, subjects: e.target.value })} className="md:col-span-2" />
          </div>
          <div className="col-span-2 flex flex-col gap-2 mt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newTutorData.offersOnline}
                onChange={e => setNewTutorData({ ...newTutorData, offersOnline: e.target.checked })}
              />
              Zajęcia online
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newTutorData.offersAtTutor}
                onChange={e => setNewTutorData({ ...newTutorData, offersAtTutor: e.target.checked })}
              />
              Zajęcia u korepetytora
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newTutorData.offersAtStudent}
                onChange={e => setNewTutorData({ ...newTutorData, offersAtStudent: e.target.checked })}
              />
              Dojazd do ucznia
            </label>
          </div>
          {addTutorError && <p className="text-red-600 mt-2">{addTutorError}</p>}
          <Button onClick={handleAddTutor} disabled={addingTutor} className="mt-4">
            {addingTutor ? 'Dodaję...' : 'Dodaj korepetytora'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}