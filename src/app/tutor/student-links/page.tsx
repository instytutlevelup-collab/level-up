'use client'
import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
} from 'firebase/firestore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '../../../lib/useAuth' // Zakładamy, że masz hook do autoryzacji

interface Student {
  id: string
  firstName: string
  lastName: string
  meetingLink?: string
  notebookLink?: string
  classroomLink?: string
}

export default function StudentsPanel() {
  const { currentUser } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [canEditLinks, setCanEditLinks] = useState<boolean | null>(null)
  const [editedLinks, setEditedLinks] = useState<Record<string, { meetingLink: string, notebookLink: string, classroomLink: string }>>({})

  useEffect(() => {
    const fetchStudents = async () => {
      if (!currentUser) return

      // fetch permission from user's document
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
      const userData = userDoc.data()
      setCanEditLinks(userData?.canEditLinks ?? false)

      const studentsQuery = query(
        collection(db, 'users'),
        where('accountType', '==', 'student')
      )
      const snapshot = await getDocs(studentsQuery)
      const fetched = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Student[]
      // sortowanie alfabetyczne
      fetched.sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName))
      setStudents(fetched)

      const initLinks: Record<string, { meetingLink: string, notebookLink: string, classroomLink: string }> = {}
      fetched.forEach(s => {
        initLinks[s.id] = {
          meetingLink: s.meetingLink || '',
          notebookLink: s.notebookLink || '',
          classroomLink: s.classroomLink || '',
        }
      })
      setEditedLinks(initLinks)

      setLoading(false)
    }

    fetchStudents()
  }, [currentUser])

  const handleSave = async (studentId: string, meetingLink: string, notebookLink: string, classroomLink: string) => {
    await updateDoc(doc(db, 'users', studentId), {
      meetingLink,
      notebookLink,
      classroomLink,
    })
    alert('Zaktualizowano linki')
  }

  if (loading || canEditLinks === null) return <p className="p-4">Ładowanie...</p>

  if (!canEditLinks) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Brak dostępu</h1>
        <p>Nie masz uprawnień do edycji linków. Skontaktuj się z administratorem.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Uczniowie</h1>
      {students.map((student) => (
        <details key={student.id} className="border rounded-md bg-white shadow-sm">
          <summary className="cursor-pointer text-lg font-medium p-4">
            {student.firstName} {student.lastName}
          </summary>
          <div className="bg-white border rounded-md p-4 shadow-sm space-y-4 mt-4">
            <div>
              <label className="block font-medium mb-1">Wideokonferencja (link):</label>
              <Input
                className="border rounded-md p-2 w-full"
                value={editedLinks[student.id]?.meetingLink || ''}
                onChange={(e) =>
                  setEditedLinks(prev => ({
                    ...prev,
                    [student.id]: { ...prev[student.id], meetingLink: e.target.value }
                  }))
                }
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Zeszyt online (link):</label>
              <Input
                className="border rounded-md p-2 w-full"
                value={editedLinks[student.id]?.notebookLink || ''}
                onChange={(e) =>
                  setEditedLinks(prev => ({
                    ...prev,
                    [student.id]: { ...prev[student.id], notebookLink: e.target.value }
                  }))
                }
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Google Classroom (link):</label>
              <Input
                className="border rounded-md p-2 w-full"
                value={editedLinks[student.id]?.classroomLink || ''}
                onChange={(e) =>
                  setEditedLinks(prev => ({
                    ...prev,
                    [student.id]: { ...prev[student.id], classroomLink: e.target.value }
                  }))
                }
              />
            </div>
            <Button
              onClick={() => {
                const studentLinks = editedLinks[student.id]
                handleSave(student.id, studentLinks.meetingLink, studentLinks.notebookLink, studentLinks.classroomLink)
              }}
            >
              Zapisz
            </Button>
          </div>
        </details>
      ))}
    </div>
  )
}