'use client'

import { useEffect, useState } from 'react'
import { getDocs, updateDoc, doc, getDoc, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface User {
  id: string
  firstName: string
  lastName: string
  accountType: string
  email?: string
  linkedAccounts?: { studentId: string; studentName: string }[]
}

export default function ParentManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedParentId, setSelectedParentId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState('')

  const parents = users.filter(u => u.accountType === 'parent')
  const students = users.filter(u => u.accountType === 'student')

  useEffect(() => {
    async function fetchUsers() {
      const snapshot = await getDocs(collection(db, 'users'))
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[]
      setUsers(data)
    }
    fetchUsers()
  }, [])

  async function handleLinkAccounts() {
    setError('')
    if (!selectedParentId || !selectedStudentId) {
      setError('Wybierz rodzica i ucznia.')
      return
    }
    setLinking(true)
    try {
      const parentRef = doc(db, 'users', selectedParentId)
      const parentSnap = await getDoc(parentRef)
      if (!parentSnap.exists()) {
        setError('Rodzic nie istnieje.')
        setLinking(false)
        return
      }
      const parentData = parentSnap.data() as User
      const currentLinks = parentData.linkedAccounts || []
      const student = users.find(u => u.id === selectedStudentId)
      if (!student) {
        setError('Uczeń nie istnieje.')
        setLinking(false)
        return
      }
      if (currentLinks.some(acc => acc.studentId === student.id)) {
        setError('Uczeń już powiązany.')
        setLinking(false)
        return
      }
      const updatedLinks = [...currentLinks, { studentId: student.id, studentName: `${student.firstName} ${student.lastName}` }]
      await updateDoc(parentRef, { linkedAccounts: updatedLinks })
      const studentRef = doc(db, 'users', student.id)
      await updateDoc(studentRef, { parentEmail: parentData.email || '' })
      alert('Powiązano.')
      setSelectedParentId('')
      setSelectedStudentId('')
      const snapshot = await getDocs(collection(db, 'users'))
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[]
      setUsers(data)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Błąd.')
      }
    }
    setLinking(false)
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Powiąż konto ucznia z rodzicem</h1>
      <Card className="p-6 border rounded-md shadow-sm">
        <CardHeader>
          <CardTitle>Wybierz użytkowników</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedParentId} onValueChange={setSelectedParentId}>
              <SelectTrigger>
                <SelectValue>{selectedParentId ? parents.find(p => p.id === selectedParentId)?.firstName + ' ' + parents.find(p => p.id === selectedParentId)?.lastName : 'Wybierz rodzica'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {parents.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger>
                <SelectValue>{selectedStudentId ? students.find(s => s.id === selectedStudentId)?.firstName + ' ' + students.find(s => s.id === selectedStudentId)?.lastName : 'Wybierz ucznia'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button onClick={handleLinkAccounts} disabled={linking}>
            {linking ? 'Łączenie...' : 'Powiąż konto'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}