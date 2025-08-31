"use client"

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { db, auth } from '@/lib/firebase'
import { doc, collection, getDocs, query, where, orderBy, addDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import ChildrenListContent from '@/components/ChildrenListContent'
import { deleteDoc } from 'firebase/firestore'
import { useCallback } from 'react'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  accountType: 'student' | 'parent' | 'tutor' | 'admin'
  subjects?: string[]
  grade?: string
  linkedAccounts?: { studentId: string; firstName?: string; lastName?: string; studentName?: string }[]
  videoLink?: string
  notebookLink?: string
  classroomLink?: string
}

interface Lesson {
  id: string
  studentId: string
  studentName: string
  tutorId: string
  tutorName: string
  subject: string
  date: string
  fullDate?: string
  time: string
  status: "scheduled" | "completed" | "cancelled" | "cancelled_in_time" | "cancelled_late" | "cancelled_by_tutor" | "makeup" | "makeup_used"
  grade?: number
  notes?: string
  rawStatus?: string
  cancelledBy?: 'student' | 'parent' | 'tutor'
  cancelledLate?: boolean
}

interface Announcement {
  id: string
  text: string
  authorName: string
  authorId: string
  createdAt?: { seconds: number; nanoseconds: number }
  status: 'draft' | 'published'
}

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // --- ANNOUNCEMENTS STATE ---
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [newAnnouncement, setNewAnnouncement] = useState('')
  const [isAddingAnnouncement, setIsAddingAnnouncement] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)

  useEffect(() => {
  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = '/auth/login'
    } else {
      const userRef = doc(db, 'users', user.uid)
      const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setCurrentUser({ id: user.uid, ...docSnap.data() } as User)
        }
      })
      return () => unsubscribeDoc()
    }
  })

  return () => unsubscribeAuth()
}, [])

  // --- ANNOUNCEMENTS FETCH ---
  useEffect(() => {
    // Listen for changes in the announcements collection ordered by createdAt desc
    const colRef = collection(db, 'announcements')
    const q = query(colRef, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snapshot) => {
      setAnnouncements(
        snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Announcement, 'id'>)
        }))
      )
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        if (!currentUser) return

        let q
        const bookingsCollection = collection(db, 'bookings')

        // Pobieranie dokumentów zależnie od roli użytkownika
        if (currentUser.accountType === 'student') {
          q = query(bookingsCollection, where('studentId', '==', currentUser.id))
        } else if (currentUser.accountType === 'parent') {
          const linkedIds = currentUser.linkedAccounts?.map(acc => acc.studentId) || []
          if (linkedIds.length) {
            // Firestore 'in' requires a non-empty array
            q = query(bookingsCollection, where('studentId', 'in', linkedIds))
          } else {
            // gdy brak powiązanych dzieci, ustaw zapytanie które nie zwróci wyników
            q = query(bookingsCollection, where('studentId', '==', '__no_match__'))
          }
        } else if (currentUser.accountType === 'tutor') {
          q = query(bookingsCollection, where('tutorId', '==', currentUser.id))
        } else {
          // admin i inni widzą wszystkie
          q = bookingsCollection
        }

        const snapshot = await getDocs(q)
        // debug: ile dokumentów pobrano
        console.debug('bookings snapshot size:', snapshot.size)

        const fetchedLessons = snapshot.docs.map(docSnap => {
          const data = docSnap.data() || {}
          const rawStatus = (data.status || '').toString()
          const rs = rawStatus.toLowerCase()

          // Normalizacja statusów do pełnego zakresu Lesson["status"]
          let status: Lesson["status"] = 'scheduled'

          if (['completed', 'realized', 'zrealizowane', 'done'].includes(rs)) {
            status = 'completed'
          } else if (['cancelled_late', 'late', 'po_terminie'].some(x => rs.includes(x))) {
            status = 'cancelled_late'
          } else if (['cancelled_in_time', 'cancel_in', 'odwo', 'makeup', 'makeup_used', 'cancelled_by_tutor'].some(x => rs.includes(x))) {
            // Rozróżniamy subtelniejsze typy odwołań
            if (['makeup', 'makeup_used'].some(x => rs.includes(x))) {
              status = rs.includes('makeup_used') ? 'makeup_used' : 'makeup'
            } else if (['cancelled_by_tutor'].some(x => rs.includes(x))) {
              status = 'cancelled_by_tutor'
            } else {
              status = 'cancelled_in_time'
            }
          } else {
            status = 'scheduled'
          }

          // Jeśli pole cancelledLate jest zapisane, użyj go; jeśli nie, spróbuj wywnioskować z nazwy statusu
          const cancelledLate = typeof data.cancelledLate !== 'undefined'
            ? !!data.cancelledLate
            : (rs.includes('late') || rs.includes('po_terminie') || rs.includes('after') || rs.includes('late'))

          const cancelledBy = data.cancelledByRole || data.cancelledBy || data.cancelledBy || undefined

          return {
            id: docSnap.id,
            studentId: data.studentId,
            studentName: data.studentName || `${data.studentFirstName || ''} ${data.studentLastName || ''}`.trim(),
            tutorId: data.tutorId,
            tutorName: data.tutorName,
            subject: data.subject,
            date: data.fullDate || data.date || '',
            fullDate: data.fullDate || data.date || '',
            time: data.time || data.startTime || '',
            status,
            grade: data.grade,
            notes: data.notes,
            // dodatkowe pola potrzebne w statystykach
            cancelledBy,
            cancelledLate,
            rawStatus,
          } as Lesson & { cancelledBy?: 'student' | 'parent' | 'tutor', cancelledLate?: boolean }
        })

        console.debug('fetchedLessons sample:', fetchedLessons.slice(0, 6))
        setLessons(fetchedLessons)
      } catch (error) {
        console.error('Błąd podczas pobierania bookingów:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLessons()
  }, [currentUser])

  // --- STATE ---
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [selectedStudent, setSelectedStudent] = useState<string>('all')

  // --- MONTHS ---
  function getMonthOptions(lessons: Lesson[]) {
    const months = Array.from(
      new Set(
        lessons.map((l) => {
          const date = new Date(l.date)
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        })
      )
    )
    months.sort((a, b) => b.localeCompare(a))
    return months
  }
  // --- STUDENTS ---
  const getStudentOptions = useCallback(() => {
  if (!currentUser) return []
  if (currentUser.accountType === 'tutor' || currentUser.accountType === 'admin') {
    const students = Array.from(
      new Map(
        lessons.map((l) => [l.studentId, { id: l.studentId, name: l.studentName }])
      ).values()
    )
    students.sort((a, b) => a.name.localeCompare(b.name))
    return students
  }
  return []
}, [currentUser, lessons])

  const monthOptions = useMemo(() => getMonthOptions(lessons), [lessons])
  const studentOptions = useMemo(() => getStudentOptions(), [getStudentOptions])
  // --- FILTERED LESSONS ---
  // Filtrowanie tylko po miesiącu i ewentualnie studencie, nie ograniczamy statusów
  const filteredLessons = useMemo(() => {
    let filtered = lessons
    if (selectedMonth !== 'all') {
      filtered = filtered.filter((l) => {
        const date = new Date(l.date)
        const y = date.getFullYear()
        const m = date.getMonth() + 1
        const [selY, selM] = selectedMonth.split('-').map(Number)
        return y === selY && m === selM
      })
    }
    if (
      (currentUser?.accountType === 'tutor' || currentUser?.accountType === 'admin') &&
      selectedStudent !== 'all'
    ) {
      filtered = filtered.filter((l) => l.studentId === selectedStudent)
    }
    return filtered
  }, [lessons, selectedMonth, selectedStudent, currentUser])

  if (isLoading) {
    return <p className="p-4">Ładowanie...</p>
  }

  if (!currentUser) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Musisz być zalogowany</AlertDescription>
      </Alert>
    )
  }

  // --- ANNOUNCEMENTS HANDLER ---
  const handleAddAnnouncement = async (e: React.FormEvent, status: 'published') => {
    e.preventDefault()
    if (!newAnnouncement.trim() || !currentUser) return
    setIsAddingAnnouncement(true)
    try {
      await addDoc(collection(db, 'announcements'), {
        text: newAnnouncement.trim(),
        authorName: `${currentUser.firstName} ${currentUser.lastName}`,
        authorId: currentUser.id,
        createdAt: serverTimestamp(),
        status: status
      })
      setNewAnnouncement('')
    } catch (err) {
      console.error('Błąd dodawania ogłoszenia:', err)
    } finally {
      setIsAddingAnnouncement(false)
    }
  }

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAnnouncement.trim() || !currentUser) return
    setIsSavingDraft(true)
    try {
      await addDoc(collection(db, 'announcements'), {
        text: newAnnouncement.trim(),
        authorName: `${currentUser.firstName} ${currentUser.lastName}`,
        authorId: currentUser.id,
        createdAt: serverTimestamp(),
        status: 'draft'
      })
      setNewAnnouncement('')
    } catch (err) {
      console.error('Błąd zapisu wersji roboczej:', err)
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handlePublishAnnouncement = async (id: string) => {
    try {
      await updateDoc(doc(db, 'announcements', id), { status: 'published' })
    } catch (err) {
      console.error('Błąd publikacji ogłoszenia:', err)
    }
  }

  // --- ANNOUNCEMENT DELETE HANDLER ---
  const handleDeleteAnnouncement = async (id: string) => {
    if (currentUser?.accountType !== 'admin') return
    try {
      await deleteDoc(doc(db, 'announcements', id))
    } catch (err) {
      console.error('Błąd usuwania ogłoszenia:', err)
    }
  }

  // --- DRAFT DELETE HANDLER ---
  const handleDeleteDraft = async (id: string) => {
    // Only admin or tutor can delete draft
    if (
      !currentUser ||
      (currentUser.accountType !== 'admin' && currentUser.accountType !== 'tutor')
    ) {
      return
    }
    try {
      await deleteDoc(doc(db, 'announcements', id))
    } catch (err) {
      console.error('Błąd usuwania wersji roboczej ogłoszenia:', err)
    }
  }

  // --- STATISTICS ---
  // Statusy: 'completed', 'cancelled', 'scheduled'
  // Pola "cancelledBy" i "cancelledLate" są już mapowane z kolekcji lessons
  type LessonWithCancel = Lesson & {
    cancelledBy?: 'student' | 'parent' | 'tutor'
    cancelledLate?: boolean
  }
  const lessonsWithCancel: LessonWithCancel[] = filteredLessons.map(l => ({
    ...l,
    cancelledBy: l.cancelledBy,
    cancelledLate: l.cancelledLate,
  }))
  // Pie chart: dwa zestawy danych
  const pieData1 = [
    { name: 'Zrealizowana', value: lessonsWithCancel.filter(l => l.status === 'completed').length },
    { name: 'Odwołana po terminie', value: lessonsWithCancel.filter(l => l.status === 'cancelled_late').length },
    { name: 'Odwołana w terminie', value: lessonsWithCancel.filter(l =>
        l.status === 'cancelled_in_time' || l.status === 'makeup_used'
      ).length },
  ]
  const pieData2 = [
    { name: 'Wybrano nowy termin', value: lessonsWithCancel.filter(l => l.rawStatus === 'makeup_used').length },
    { name: 'Do odrobienia', value: lessonsWithCancel.filter(l =>
      l.rawStatus === 'cancelled_in_time' || l.rawStatus === 'cancelled_by_tutor'
    ).length },
  ]
  // Kolory dla wykresów
  const PIE_COLORS1 = ['#22c55e', '#ef4444', '#fbbf24']
  const PIE_COLORS2 = ['#06b6d4', '#fbbf24']

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Witaj, {currentUser.firstName}!</h1>

      {/* --- ANNOUNCEMENTS BOARD --- */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Tablica ogłoszeń</CardTitle>
          </CardHeader>
          <CardContent>
            {(currentUser.accountType === 'tutor' || currentUser.accountType === 'admin') && (
              <form
                onSubmit={e => handleAddAnnouncement(e, 'published')}
                className="mb-6 flex flex-col gap-2"
              >
                <textarea
                  value={newAnnouncement}
                  onChange={e => setNewAnnouncement(e.target.value)}
                  className="border rounded px-2 py-1 min-h-[60px] resize-vertical"
                  placeholder="Dodaj nowe ogłoszenie..."
                  required
                  disabled={isAddingAnnouncement}
                />
                <div className="flex flex-row gap-2">
                  <Button type="submit" disabled={isAddingAnnouncement || !newAnnouncement.trim()}>
                    {isAddingAnnouncement ? 'Dodawanie...' : 'Dodaj ogłoszenie'}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft || !newAnnouncement.trim()}
                  >
                    {isSavingDraft ? 'Zapisywanie...' : 'Zapisz jako wersję roboczą'}
                  </Button>
                </div>
              </form>
            )}
            <div>
              {announcements.length === 0 && (
                <div className="text-gray-500 italic">Brak ogłoszeń.</div>
              )}
              <ul className="space-y-4">
                {announcements
                  .filter(a => a.status === 'published' || (a.status === 'draft' && a.authorId === currentUser.id))
                  .map(a => (
                  <li
                    key={a.id}
                    className="border rounded p-3 bg-gray-50 flex justify-between items-start"
                  >
                    <div>
                      <div className="mb-1">
                        {a.text}{' '}
                        {a.status === 'draft' && (
                          <span className="ml-2 text-xs font-semibold text-orange-500">(Wersja robocza)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex flex-row gap-2">
                        <span>Autor: {a.authorName}</span>
                        {a.createdAt && (
                          <span>
                            • {a.createdAt.seconds
                              ? new Date(a.createdAt.seconds * 1000).toLocaleString('pl-PL')
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-row gap-2">
                      {a.status === 'draft' && (currentUser.accountType === 'admin' || currentUser.accountType === 'tutor') && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handlePublishAnnouncement(a.id)}
                          >
                            Opublikuj
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteDraft(a.id)}
                          >
                            Usuń wersję roboczą
                          </Button>
                        </>
                      )}
                      {a.status === 'published' && currentUser.accountType === 'admin' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteAnnouncement(a.id)}
                        >
                          Usuń
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- STUDENT PROFILE SECTION --- */}
      {currentUser.accountType === 'student' && (
        <div className="mt-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Informacje dla ucznia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mt-4 space-y-2">
                {currentUser.videoLink && (
                  <Button
                    asChild
                    variant="default"
                    className="w-full"
                  >
                    <a
                      href={currentUser.videoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Przejdź do wideokonferencji
                    </a>
                  </Button>
                )}
                {currentUser.notebookLink && (
                  <Button
                    asChild
                    variant="default"
                    className="w-full"
                  >
                    <a
                      href={currentUser.notebookLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Otwórz zeszyt online
                    </a>
                  </Button>
                )}
                {currentUser.classroomLink && (
                  <Button
                    asChild
                    variant="default"
                    className="w-full"
                  >
                    <a
                      href={currentUser.classroomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Otwórz Google Classroom
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- Twoje dzieci dla rodzica --- */}
      {currentUser?.accountType === 'parent' && (
        <div className="mt-6 mb-6 w-full">
          <ChildrenListContent
            studentsList={(currentUser.linkedAccounts || []).map((child) => {
              const name = (child.studentName ?? `${child.firstName ?? ''} ${child.lastName ?? ''}`.trim()) || '—'
              return { id: child.studentId, studentName: name }
            })}
          />
        </div>
      )}

      {/* --- STATYSTYKI ZAJĘĆ --- */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Statystyki zajęć</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Filtry */}
              <div className="flex flex-row gap-4 items-center flex-wrap">
                <label>
                  Miesiąc:&nbsp;
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="border rounded px-2 py-1"
                  >
                    <option value="all">Ogółem</option>
                    {monthOptions.map((m) => {
                      const [y, mo] = m.split('-')
                      const monthName = new Date(Number(y), Number(mo) - 1).toLocaleString('pl-PL', { month: 'long', year: 'numeric' })
                      return (
                        <option value={m} key={m}>{monthName}</option>
                      )
                    })}
                  </select>
                </label>
                {(currentUser.accountType === 'tutor' || currentUser.accountType === 'admin' || currentUser.accountType === 'parent') && (
                  <label>
                    Uczeń:&nbsp;
                    <select
                      value={selectedStudent}
                      onChange={e => setSelectedStudent(e.target.value)}
                      className="border rounded px-2 py-1"
                    >
                      <option value="all">Wszyscy</option>
                      {studentOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {/* Wykresy i liczby */}
              <div className="flex flex-col md:flex-row w-full md:items-center md:justify-between gap-8 mt-6 md:mt-0">
                <div className="flex flex-col md:flex-row gap-8 w-full">
                  <div className="w-full md:w-1/2 h-72 flex flex-col items-center justify-center self-start">
                    <h3 className="text-center mb-1 font-medium">Realizacja / Odwołania</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                        <Pie
                          data={pieData1}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          labelLine={false}
                        >
                          {pieData1.map((entry, idx) => (
                            <Cell key={`cell1-${idx}`} fill={PIE_COLORS1[idx % PIE_COLORS1.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" layout="horizontal" align="center" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/2 h-72 flex flex-col items-center justify-center self-start">
                    <h3 className="text-center mb-1 font-medium">Odrabianie / Zmiany terminów</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                        <Pie
                          data={pieData2}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          labelLine={false}
                        >
                          {pieData2.map((entry, idx) => (
                            <Cell key={`cell2-${idx}`} fill={PIE_COLORS2[idx % PIE_COLORS2.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" layout="horizontal" align="center" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



    </div>
  )
}
