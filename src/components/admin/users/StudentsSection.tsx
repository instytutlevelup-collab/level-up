'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { db, auth } from '@/lib/firebase'
import { collection, getDocs, doc, setDoc, updateDoc, getDoc, QueryDocumentSnapshot } from 'firebase/firestore'
interface LinkedAccount {
  studentId: string;
  studentName: string;
}
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

interface ParentUser {
  id: string
  firstName: string
  lastName: string
  email?: string
}

interface StudentUser {
  id: string
  firstName: string
  lastName: string
  notebookLink?: string
  bookLink?: string
  meetingLink?: string
  classroomLink?: string
}

export default function AddStudentPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [subjects, setSubjects] = useState('')
  const [parentId, setParentId] = useState('')
  const [parents, setParents] = useState<ParentUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [grade, setGrade] = useState('')
  // students state
  const [students, setStudents] = useState<StudentUser[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [notebookLink, setNotebookLink] = useState('')
  const [bookLink, setBookLink] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [classroomLink, setClassroomLink] = useState('')
  const [studentEditLoading, setStudentEditLoading] = useState(false)
  const [studentEditError, setStudentEditError] = useState('')
  const [studentEditSuccess, setStudentEditSuccess] = useState('')

  useEffect(() => {
    async function fetchParentsAndStudents() {
      const snapshot = await getDocs(collection(db, 'users'))
      const docs = snapshot.docs
      const parentData = docs
        .filter(doc => doc.data().accountType === 'parent')
        .map(doc => ({ id: doc.id, ...doc.data() })) as ParentUser[]
      setParents(parentData)
      // fetch students
      const studentData = docs
        .filter(doc => doc.data().accountType === 'student')
        .map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            notebookLink: data.notebookLink || '',
            bookLink: data.bookLink || '',
            meetingLink: data.meetingLink || '',
            classroomLink: data.classroomLink || '',
          }
        }) as StudentUser[]
      setStudents(studentData)
    }
    fetchParentsAndStudents()
  }, [])

  // When selectedStudentId changes, update notebookLink/meetingLink fields
  useEffect(() => {
    if (selectedStudentId) {
      const student = students.find(s => s.id === selectedStudentId)
      setNotebookLink(student?.notebookLink || '')
      setBookLink(student?.bookLink || '')
      setMeetingLink(student?.meetingLink || '')
      setClassroomLink(student?.classroomLink || '')
      setStudentEditError('')
      setStudentEditSuccess('')
    }
  }, [selectedStudentId, students])

  async function addOrLinkStudent() {
    setError('')
    setLoading(true)
    try {
      let studentId = ''
      let existingStudentDoc: QueryDocumentSnapshot | null = null

      if (email) {
        // Check if student with this email exists
        const snap = await getDocs(collection(db, 'users'))
        existingStudentDoc = snap.docs.find(d => d.data().email === email && d.data().accountType === 'student') || null
      }

      if (existingStudentDoc) {
        // Link existing student to parent
        studentId = existingStudentDoc.id
        if (parentId) {
          const parentEmail = parents.find(p => p.id === parentId)?.email || null
          // Update student's parentEmail
          await updateDoc(doc(db, 'users', studentId), {
            parentEmail,
          })
          // Update parent's linkedAccounts
          const parentRef = doc(db, 'users', parentId)
          const parentSnap = await getDoc(parentRef)
          const parentData = parentSnap.data()
          const existingLinked = parentData?.linkedAccounts || []
          const alreadyLinked = existingLinked.some((acc: LinkedAccount) => acc.studentId === studentId)
          if (!alreadyLinked) {
            const updated = [...existingLinked, { studentId, studentName: `${existingStudentDoc.data().firstName} ${existingStudentDoc.data().lastName}` }]
            await updateDoc(parentRef, { linkedAccounts: updated })
          }
        }
      } else {
        // Create new student document
        if (email) {
          const cred = await createUserWithEmailAndPassword(auth, email, password)
          studentId = cred.user.uid
        } else {
          const docRef = doc(collection(db, 'users'))
          studentId = docRef.id
        }
        const newStudent = {
          firstName,
          lastName,
          email: email || null,
          accountType: 'student',
          subjects: subjects.split(',').map(s => s.trim()),
          canCancel: false,
          schoolType,
          grade,
          parentEmail: parentId ? parents.find(p => p.id === parentId)?.email || null : null,
        }
        await setDoc(doc(db, 'users', studentId), newStudent)
        // If parentId provided, update parent's linkedAccounts
        if (parentId) {
          const parentRef = doc(db, 'users', parentId)
          const parentSnap = await getDoc(parentRef)
          const parentData = parentSnap.data()
          const existingLinked = parentData?.linkedAccounts || []
          const alreadyLinked = existingLinked.some((acc: LinkedAccount) => acc.studentId === studentId)
          if (!alreadyLinked) {
            const updated = [...existingLinked, { studentId, studentName: `${firstName} ${lastName}` }]
            await updateDoc(parentRef, { linkedAccounts: updated })
          }
        }
      }

      alert('Uczeń został dodany lub powiązany z rodzicem.')
      setFirstName('')
      setLastName('')
      setEmail('')
      setPassword('')
      setSubjects('')
      setParentId('')
      setSchoolType('')
      setGrade('')

      // refresh students list
      const snapshot = await getDocs(collection(db, 'users'))
      const docs = snapshot.docs
      const studentData = docs
        .filter(doc => doc.data().accountType === 'student')
        .map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            notebookLink: data.notebookLink || '',
            bookLink: data.bookLink || '',
            meetingLink: data.meetingLink || '',
            classroomLink: data.classroomLink || '',
          }
        }) as StudentUser[]
      setStudents(studentData)
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message)
      }
    }
    setLoading(false)
  }

  async function handleSaveStudentLinks() {
    if (!selectedStudentId) return
    setStudentEditError('')
    setStudentEditSuccess('')
    setStudentEditLoading(true)
    try {
      await updateDoc(doc(db, 'users', selectedStudentId), {
        notebookLink,
        bookLink,
        meetingLink,
        classroomLink,
      })
      setStudentEditSuccess('Zapisano!')
      // update local state
      setStudents(prev =>
        prev.map(s =>
          s.id === selectedStudentId
            ? { ...s, notebookLink, bookLink, meetingLink, classroomLink }
            : s
        )
      )
    } catch (e: unknown) {
      if (e instanceof Error) {
        setStudentEditError('Błąd zapisu: ' + e.message)
      }
    }
    setStudentEditLoading(false)
  }

  async function linkStudentToParent(studentId: string, parentId: string) {
    try {
      const parent = parents.find(p => p.id === parentId)
      if (!parent) return
      const parentEmail = parent.email || null

      const studentRef = doc(db, 'users', studentId)
      const studentSnap = await getDoc(studentRef)
      if (!studentSnap.exists()) {
        alert('Uczeń nie istnieje w bazie.')
        return
      }
      const studentData = studentSnap.data()
      // Aktualizacja parentEmail
      await updateDoc(studentRef, { parentEmail })

      // Aktualizacja linkedAccounts rodzica, bez duplikatów
      const parentRef = doc(db, 'users', parentId)
      const parentSnap = await getDoc(parentRef)
      const parentData = parentSnap.data()
      const existingLinked = parentData?.linkedAccounts || []

      const alreadyLinked = existingLinked.some(
        (acc: LinkedAccount) => acc.studentId === studentId
      )
      if (!alreadyLinked) {
        const updated = [...existingLinked, { studentId, studentName: `${studentData?.firstName} ${studentData?.lastName}` }]
        await updateDoc(parentRef, { linkedAccounts: updated })
      }

      alert('Uczeń został powiązany z rodzicem.')
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error('Błąd powiązania ucznia z rodzicem:', e.message)
      } else {
        console.error('Błąd powiązania ucznia z rodzicem:', e)
      }
      alert('Nie udało się powiązać ucznia z rodzicem.')
    }
  }

  return (
    <div>
      <div className="max-w-xl mx-auto py-10">
        <Card>
        <CardHeader>
          <CardTitle>Dodaj ucznia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Imię</Label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div>
            <Label>Nazwisko</Label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} type="email" />
          </div>
          <div>
            <Label>Hasło</Label>
            <Input value={password} onChange={e => setPassword(e.target.value)} type="password" />
          </div>
          <div>
            <Label>Przedmioty (oddzielone przecinkami)</Label>
            <Input value={subjects} onChange={e => setSubjects(e.target.value)} />
          </div>
          {/* --- SCHOOL TYPE SELECT --- */}
          <div>
            <Label>Typ szkoły</Label>
            <Select value={schoolType} onValueChange={setSchoolType}>
              <SelectTrigger>
                <SelectValue>{schoolType || 'Wybierz typ szkoły'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="szkoła podstawowa">Szkoła podstawowa</SelectItem>
                <SelectItem value="liceum">Liceum</SelectItem>
                <SelectItem value="technikum">Technikum</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {schoolType && (
            <div>
              <Label>Klasa</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger>
                  <SelectValue>{grade || 'Wybierz klasę'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(schoolType === 'szkoła podstawowa'
                    ? ['1','2','3','4','5','6','7','8']
                    : schoolType === 'liceum'
                    ? ['1','2','3','4']
                    : ['1','2','3','4','5']
                  ).map(k => (
                    <SelectItem key={k} value={k}>Klasa {k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Powiąż z rodzicem (opcjonalnie)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue>{parentId ? parents.find(p => p.id === parentId)?.firstName + ' ' + parents.find(p => p.id === parentId)?.lastName : 'Wybierz rodzica'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {parents.map(parent => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.firstName} {parent.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button onClick={addOrLinkStudent} disabled={loading}>
            {loading ? 'Dodaję...' : 'Dodaj ucznia'}
          </Button>
        </CardContent>
        </Card>

        {/* --- STUDENT SELECT & EDIT LINKS --- */}
        <div className="mt-10">
          <Card>
            <CardHeader>
              <CardTitle>Edytuj linki ucznia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Wybierz ucznia</Label>
                <Select value={selectedStudentId ?? ''} onValueChange={setSelectedStudentId}>
                  <SelectTrigger>
                    <SelectValue>
                      {selectedStudentId
                        ? (() => {
                            const stu = students.find(s => s.id === selectedStudentId)
                            return stu ? stu.firstName + ' ' + stu.lastName : 'Wybierz ucznia'
                          })()
                        : 'Wybierz ucznia'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {students.map(stu => (
                      <SelectItem key={stu.id} value={stu.id}>
                        {stu.firstName} {stu.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedStudentId && (
                <div className="space-y-4">
                  <div>
                    <label>Link do wideokonferencji:</label>
                    <Input
                      value={meetingLink}
                      onChange={e => setMeetingLink(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Link do zeszytu:</label>
                    <Input
                      value={notebookLink}
                      onChange={e => setNotebookLink(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Link do podręcznika:</label>
                    <Input
                      value={bookLink}
                      onChange={e => setBookLink(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Link do Classroom:</label>
                    <Input
                      value={classroomLink}
                      onChange={e => setClassroomLink(e.target.value)}
                    />
                  </div>
                  {studentEditError && <p className="text-red-500 text-sm">{studentEditError}</p>}
                  {studentEditSuccess && <p className="text-green-600 text-sm">{studentEditSuccess}</p>}
                  <Button onClick={handleSaveStudentLinks} disabled={studentEditLoading}>
                    {studentEditLoading ? 'Zapisuję...' : 'Zapisz'}
                  </Button>
                  {/* Button to link selected student to selected parent */}
                  {parentId && (
                    <Button
                      onClick={() => linkStudentToParent(selectedStudentId, parentId)}
                      className="mt-2"
                    >
                      Powiąż ucznia z rodzicem
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}