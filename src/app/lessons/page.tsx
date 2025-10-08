"use client"

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { db, auth } from "@/lib/firebase"
import { notifyCancellation } from "@/lib/notifications"
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  updateDoc,
  deleteDoc,
} from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { pl } from "date-fns/locale"

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  accountType: "student" | "parent" | "tutor" | "admin"
  linkedAccounts?: { studentId: string; firstName: string; lastName: string }[]
  canCancel?: boolean
}

interface Booking {
  id: string
  studentId: string
  studentName: string
  tutorId?: string
  tutorName?: string
  subject?: string
  day: string
  time: string
  duration: number
  repeating: boolean
  fullDate?: string
  status?: "scheduled" | "completed" | "cancelled" | "cancelled_in_time" | "cancelled_late" | "cancelled_by_tutor" | "makeup" | "makeup_used"
  originalLessonId?: string
  grade?: number
  notes?: string
  homework?: string
  createdById?: string
  createdByRole?: "parent" | "student" | "tutor" | "admin"
  cancelledByRole?: "parent" | "student" | "tutor" | "admin"
  lessonMode?: string
}

export default function LessonsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedStudent, setSelectedStudent] = useState("")
  const [studentOptions, setStudentOptions] = useState<{ id: string; name: string }[]>([])
  const [selectedTutor, setSelectedTutor] = useState("")
  const [tutorOptions, setTutorOptions] = useState<string[]>([])
  // Nowy stan do wyboru miesiąca
  const [selectedMonth, setSelectedMonth] = useState("");
  // For admin inline editing
  const [editingValues, setEditingValues] = useState<Record<string, { status?: string; createdByRole?: string; cancelledByRole?: string }>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  // New: track which row is being edited
  const [editingRowId, setEditingRowId] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists()) {
          const userData = { id: user.uid, ...userDoc.data() } as User
          setCurrentUser(userData)
          // Removed unused childrenIds and linkedIds
        } else {
          router.push("/auth/login")
        }
      } else {
        router.push("/auth/login")
      }
    })
    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    const fetchBookings = async () => {
      if (!currentUser) return

      try {
        let allBookings: Booking[] = []

        if (currentUser.accountType === "admin") {
          // Pobierz wszystkie dokumenty z kolekcji bookings
          const snapshot = await getDocs(collection(db, "bookings"))
          allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[]
        } else if (currentUser.accountType === "student") {
          const q = query(collection(db, "bookings"), where("studentId", "==", currentUser.id))
          const snapshot = await getDocs(q)
          allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[]
        } else if (currentUser.accountType === "tutor") {
          const q = query(collection(db, "bookings"), where("tutorId", "==", currentUser.id))
          const snapshot = await getDocs(q)
          allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[]
        } else if (currentUser.accountType === "parent") {
          const childrenSnap = await getDocs(collection(db, "users", currentUser.id, "children"))
          const childrenStudentIds = childrenSnap.docs
            .map((doc) => doc.data().studentId)
            .filter((id): id is string => typeof id === "string")

          const linkedIds = currentUser.linkedAccounts?.map((acc) => acc.studentId) || []
          const allStudentIds = Array.from(new Set([...linkedIds, ...childrenStudentIds])).filter(id => id && id !== currentUser.id)

          const bookingsByStudent: Booking[] = []
          if (allStudentIds.length > 0) {
            const q = query(collection(db, "bookings"), where("studentId", "in", allStudentIds))
            const snapshot = await getDocs(q)
            bookingsByStudent.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[])
          }

          const bookingsByCreator: Booking[] = []
          const q2 = query(collection(db, "bookings"), where("createdById", "==", currentUser.id))
          const snapshot2 = await getDocs(q2)
          bookingsByCreator.push(...snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[])

          const combined = [...bookingsByStudent, ...bookingsByCreator]
          const deduplicated = combined.filter(
            (item, index, self) => self.findIndex(b => b.id === item.id) === index
          )
          allBookings = deduplicated
        }

        allBookings.sort((a, b) => {
  const now = new Date().getTime()

  const aDate = a.fullDate ? new Date(`${a.fullDate}T${a.time}:00`).getTime() : 0
  const bDate = b.fullDate ? new Date(`${b.fullDate}T${b.time}:00`).getTime() : 0

  const isAFinished =
    aDate < now &&
    ["completed", "cancelled_in_time", "cancelled_late", "cancelled_by_tutor", "makeup", "makeup_used"].includes(a.status ?? "")

  const isBFinished =
    bDate < now &&
    ["completed", "cancelled_in_time", "cancelled_late", "cancelled_by_tutor", "makeup", "makeup_used"].includes(b.status ?? "")

  if (isAFinished && !isBFinished) return 1
  if (!isAFinished && isBFinished) return -1

  return aDate - bDate
})

        // Oznacz lekcje, które już się odbyły
        const now = new Date()
        for (const booking of allBookings) {
          if (
            (booking.status === "scheduled" || booking.status === "makeup") &&
            booking.fullDate &&
            booking.time
          ) {
            const bookingDateTime = new Date(`${booking.fullDate}T${booking.time}:00`)
            if (bookingDateTime < now) {
              try {
                const bookingRef = doc(db, "bookings", booking.id)
                await updateDoc(bookingRef, { status: "completed" })
                booking.status = "completed" // aktualizacja lokalnie
              } catch (err) {
                console.error("Błąd przy automatycznej aktualizacji statusu:", err)
              }
            }
          }
        }

        setBookings(allBookings)
        // Ustaw studentOptions i tutorOptions dla admina
        const students = Array.from(
          new Map(
            allBookings
              .filter(b => !!b.studentId && !!b.studentName)
              .map(b => [b.studentId, { id: b.studentId, name: b.studentName }])
          ).values()
        ).sort((a, b) => {
          const aFirst = a.name.split(" ")[0]
          const bFirst = b.name.split(" ")[0]
          return aFirst.localeCompare(bFirst, "pl")
        })
        setStudentOptions(students)
        if (currentUser.accountType === "admin") {
          const tutorNames = Array.from(new Set(allBookings.map(b => b.tutorName).filter((name): name is string => !!name)))
          setTutorOptions(tutorNames)
        }
      } catch (error) {
        console.error("Błąd podczas pobierania lekcji:", error)
      }
    }

    fetchBookings()
  }, [currentUser])

  useEffect(() => {
    const fetchTutors = async () => {
      const q = query(collection(db, "users"), where("accountType", "==", "tutor"))
      const snapshot = await getDocs(q)
      const tutors = snapshot.docs.map(doc => {
        const data = doc.data()
        return `${data.firstName} ${data.lastName}`
      })
      setTutorOptions(tutors)
    }
    if (currentUser && currentUser.accountType === "admin") {
      fetchTutors()
    }
  }, [currentUser])

  // Delete booking function moved out of cancelBooking
  const deleteBooking = async (bookingId: string) => {
    const confirmed = window.confirm("Czy na pewno chcesz trwale usunąć ten termin?")
    if (!confirmed) return
    try {
      await deleteDoc(doc(db, "bookings", bookingId))
      setBookings((prev) => prev.filter((b) => b.id !== bookingId))
      alert("Termin został usunięty.")
    } catch (error) {
      console.error("Błąd podczas usuwania terminu:", error)
      alert("Nie udało się usunąć terminu.")
    }
  }

  const cancelBooking = async (bookingId: string, fullDate: string | undefined, time: string) => {
    if (!fullDate) {
      alert("Brak daty lekcji, nie można odwołać.")
      return
    }

    const confirmed = window.confirm("Czy na pewno chcesz odwołać lekcję?")
    if (!confirmed) return

    const bookingDateTime = new Date(`${fullDate}T${time}:00`)
    const now = new Date()
    const diffMs = bookingDateTime.getTime() - now.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    let newStatus: Booking["status"] = "cancelled_in_time"
    if (currentUser?.accountType === "tutor") {
      newStatus = "cancelled_by_tutor"
    } else if (diffHours < 24) {
      if (currentUser?.accountType && !["tutor"].includes(currentUser.accountType)) {
        const proceedLateCancel = window.confirm(
          "Odwołanie lekcji mniej niż 24 godziny przed terminem skutkuje brakiem możliwości odrobienia i koniecznością dokonania płatności. Czy na pewno chcesz kontynuować?"
        )
        if (!proceedLateCancel) return;
      }
      newStatus = "cancelled_late"
    }

    try {
      const bookingRef = doc(db, "bookings", bookingId)
      // Pobierz booking, żeby mieć dostęp do studentId i tutorId
      const bookingSnap = await getDoc(bookingRef)
      if (!bookingSnap.exists()) {
        alert("Nie znaleziono lekcji.")
        return
      }
      const b = { id: bookingId, ...bookingSnap.data() } as Booking
      await updateDoc(bookingRef, { status: newStatus, cancelledByRole: currentUser?.accountType })

      // Zwolnij termin w dostępności korepetytora
      if (b.tutorId && b.fullDate && b.time) {
        try {
          const availRef = doc(db, "availability", b.tutorId)
          const availSnap = await getDoc(availRef)
          if (availSnap.exists()) {
            const availData = availSnap.data()
            // Załóżmy, że slots to tablica obiektów { date: string, time: string, booked: boolean }
            const updatedSlots = (availData.slots || []).map((slot: { date: string; time: string; booked: boolean }) => {
              if (slot.date === b.fullDate && slot.time === b.time) {
                return { ...slot, booked: false }
              }
              return slot
            })
            await updateDoc(availRef, { slots: updatedSlots })
          }
        } catch (err) {
          console.error("Błąd przy zwalnianiu terminu:", err)
        }
      }

      // Dodaj powiadomienia
      await notifyCancellation({
        booking: {
          id: b.id,
          studentId: b.studentId,
          tutorId: b.tutorId,
          studentName: b.studentName,
          fullDate: b.fullDate,
          time: b.time,
          createdByRole: b.createdByRole ?? "admin"
        }
      })

      alert("Lekcja została odwołana.")
      setBookings((prev) =>
        prev.map((b2) => (b2.id === bookingId ? { ...b2, status: newStatus, cancelledByRole: currentUser?.accountType } : b2))
      )
    } catch (error) {
      console.error("Błąd podczas odwoływania lekcji:", error)
      alert("Wystąpił błąd podczas odwoływania lekcji.")
    }
  }

  // Helper: status options for admin
  const statusOptions = [
    { value: "scheduled", label: "Zaplanowana" },
    { value: "completed", label: "Zrealizowana" },
    { value: "cancelled_in_time", label: "Do odrobienia" },
    { value: "cancelled_late", label: "Odwołana po terminie" },
    { value: "cancelled_by_tutor", label: "Do odrobienia" },
    { value: "makeup", label: "Zaplanowana" },
    { value: "makeup_used", label: "Wybrano nowy termin/rozliczone" },
  ]
  const roleOptions = [
    { value: "parent", label: "Rodzic" },
    { value: "student", label: "Uczeń" },
    { value: "tutor", label: "Korepetytor" },
    { value: "", label: "-" },
  ]
  // Helper: get value for select (editing or fallback)
  const getEditingValue = (id: string, field: "status" | "createdByRole" | "cancelledByRole", fallback: string | undefined) => {
    return editingValues[id]?.[field] !== undefined ? editingValues[id]?.[field] : (fallback ?? "")
  }
  // Handler: update local editing value
  const handleEditChange = (id: string, field: "status" | "createdByRole" | "cancelledByRole", value: string) => {
    setEditingValues((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      }
    }))
  }
  // Handler: save edited values to Firestore
  const handleSave = async (booking: Booking) => {
    const id = booking.id
    const values = editingValues[id]
    if (!values) return
    setSaving((prev) => ({ ...prev, [id]: true }))
    try {
      const updateObj: Partial<Pick<Booking, "status" | "createdByRole" | "cancelledByRole">> = {}
      if ("status" in values && values.status) updateObj.status = values.status as Booking["status"]
      if ("createdByRole" in values && values.createdByRole) updateObj.createdByRole = values.createdByRole as Booking["createdByRole"]
      if ("cancelledByRole" in values && values.cancelledByRole) updateObj.cancelledByRole = values.cancelledByRole as Booking["cancelledByRole"]
      const bookingRef = doc(db, "bookings", id)
      await updateDoc(bookingRef, updateObj)
      // Update bookings in UI
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                ...updateObj,
              }
            : b
        )
      )
      // Remove from editingValues
      setEditingValues((prev) => {
        const newVals = { ...prev }
        delete newVals[id]
        return newVals
      })
    } catch (error) {
      alert("Błąd podczas zapisu zmian: " + (error as unknown as { message?: string })?.message)
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }))
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Twoje lekcje</h1>

      <Card>
        <CardHeader>
          <CardTitle>Lista lekcji</CardTitle>
          <CardDescription>Zarezerwowane terminy i szczegóły spotkań</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex space-x-4 max-w-3xl">
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="flex-grow px-4 py-2 border border-gray-300 rounded-md shadow-sm"
            >
              <option value="">Wszyscy uczniowie</option>
              {studentOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {currentUser?.accountType === "admin" && (
              <select
                value={selectedTutor}
                onChange={(e) => setSelectedTutor(e.target.value)}
                className="flex-grow px-4 py-2 border border-gray-300 rounded-md shadow-sm"
              >
                <option value="">Wszyscy korepetytorzy</option>
                {tutorOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex-grow px-4 py-2 border border-gray-300 rounded-md shadow-sm"
            >
              <option value="">Wszystkie miesiące</option>
              {Array.from({ length: 12 }, (_, i) => {
                const month = `${i + 1}`.padStart(2, "0")
                return (
                  <option key={month} value={month}>
                    {new Date(0, i).toLocaleString("pl-PL", { month: "long" })}
                  </option>
                )
              })}
            </select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Godzina</TableHead>
                <TableHead>Czas trwania</TableHead>
                <TableHead>Tryb zajęć</TableHead>
                <TableHead>Uczeń</TableHead>
                <TableHead>Przedmiot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Zarezerwował/a</TableHead>
                <TableHead>Odwołał/a</TableHead>
                <TableHead>Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    Brak lekcji do wyświetlenia
                  </TableCell>
                </TableRow>
              ) : (
                bookings
                  .filter((b) => !selectedStudent || b.studentId === selectedStudent)
                  .filter((b) => !selectedTutor || b.tutorName === selectedTutor)
                  .filter((b) => {
                    if (!selectedMonth) return true;
                    if (!b.fullDate) return false;
                    const [, month] = b.fullDate.split("-");
                    return month === selectedMonth;
                  })
                  .map((b) => {
                    const bookingDateTime = new Date(`${b.fullDate}T${b.time}:00`)
                    const now = new Date()
                    const diffHours = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
                    const canCancel =
                      b.status !== "completed" &&
                      b.status !== "makeup_used" &&
                      !(b.status?.startsWith("cancelled")) &&
                      (
                        currentUser?.accountType === "tutor" ||
                        (currentUser?.accountType === "student" && currentUser.canCancel) ||
                        currentUser?.accountType === "parent"
                      )

                    return (
                      <TableRow key={b.id}>
                        <TableCell>
  {b.fullDate ? (() => {
    try {
      const date = parseISO(b.fullDate)
      const mainDate = format(date, "EEEE, d MMMM yyyy", { locale: pl })

      if (b.status === "makeup" && b.originalLessonId) {
        const original = bookings.find(orig => orig.id === b.originalLessonId)
        if (original?.fullDate) {
          const origDate = format(parseISO(original.fullDate), "d MMMM yyyy", { locale: pl })
          return (
            <span className="group relative inline-block">
              {mainDate}
              <span className="ml-1 text-xs text-gray-500">(*)</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block rounded bg-gray-800 px-2 py-1 text-xs text-white whitespace-nowrap z-10">
                Pierwotnie: {origDate}
              </span>
            </span>
          )
        }
      }
      return mainDate
    } catch {
      return "-"
    }
  })() : "-"}
                        </TableCell>
                        <TableCell>
                          {b.time} -{" "}
                          {(() => {
                            const [hours, minutes] = b.time.split(":").map(Number);
                            const start = new Date(0, 0, 0, hours, minutes);
                            const end = new Date(start.getTime() + b.duration * 60000);
                            return `${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`;
                          })()}
                        </TableCell>
                        <TableCell>{b.duration} min</TableCell>
                        <TableCell>{b.lessonMode ?? "-"}</TableCell>
                        <TableCell>{b.studentName}</TableCell>
                        <TableCell>{b.subject ?? "-"}</TableCell>
                        <TableCell>
                          {currentUser?.accountType === "admin" ? (
                            editingRowId === b.id ? (
                              <select
                                className="border rounded px-2 py-1"
                                value={getEditingValue(b.id, "status", b.status)}
                                onChange={e => handleEditChange(b.id, "status", e.target.value)}
                              >
                                {statusOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Badge
                                className={
                                  b.status === "makeup"
                                  ? "bg-blue-100 text-blue-800"
                                  : b.status === "makeup_used"
                                  ? "bg-gray-100 text-gray-800"
                                  : b.status === "cancelled_in_time"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : b.status === "cancelled_late"
                                  ? "bg-pink-100 text-pink-800"
                                  : b.status === "cancelled_by_tutor"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : b.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : b.status === "scheduled"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                                }
                              >
                                {b.status === "makeup"
                                  ? "Zaplanowana"
                                  : b.status === "makeup_used"
                                  ? "Wybrano nowy termin/rozliczone"
                                  : b.status === "cancelled_in_time"
                                  ? "Do odrobienia"
                                  : b.status === "cancelled_late"
                                  ? "Odwołana po terminie"
                                  : b.status === "cancelled_by_tutor"
                                  ? "Do odrobienia"
                                  : b.status === "completed"
                                  ? "Zrealizowana"
                                  : "Zaplanowana"}
                              </Badge>
                            )
                          ) : (
                            <Badge
                              className={
                                b.status === "makeup"
                                  ? "bg-blue-100 text-blue-800"
                                  : b.status === "makeup_used"
                                  ? "bg-gray-100 text-gray-800"
                                  : b.status === "cancelled_in_time"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : b.status === "cancelled_late"
                                  ? "bg-pink-100 text-pink-800"
                                  : b.status === "cancelled_by_tutor"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : b.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : b.status === "scheduled"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }
                            >
                              {b.status === "makeup"
                                ? "Zaplanowana"
                                : b.status === "makeup_used"
                                ? "Wybrano nowy termin/rozliczone"
                                : b.status === "cancelled_in_time"
                                ? "Do odrobienia"
                                : b.status === "cancelled_late"
                                ? "Odwołana po terminie"
                                : b.status === "cancelled_by_tutor"
                                ? "Do odrobienia"
                                : b.status === "completed"
                                ? "Zrealizowana"
                                : "Zaplanowana"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {currentUser?.accountType === "admin" ? (
                            editingRowId === b.id ? (
                              <select
                                className="border rounded px-2 py-1"
                                value={getEditingValue(b.id, "createdByRole", b.createdByRole)}
                                onChange={e => handleEditChange(b.id, "createdByRole", e.target.value)}
                              >
                                {roleOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>
                                {b.createdByRole
                                  ? b.createdByRole === "parent"
                                    ? "Rodzic"
                                    : b.createdByRole === "student"
                                    ? "Uczeń"
                                    : b.createdByRole === "tutor"
                                    ? "Korepetytor"
                                    : b.createdByRole === "admin"
                                    ? "Administrator"
                                    : "Nieznane"
                                  : "Nieznane"}
                              </span>
                            )
                          ) : (
                            b.createdByRole === "parent"
                              ? "Rodzic"
                              : b.createdByRole === "student"
                              ? "Uczeń"
                              : b.createdByRole === "tutor"
                              ? "Korepetytor"
                              : b.createdByRole === "admin"
                              ? "Administrator"
                              : "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {currentUser?.accountType === "admin" ? (
                            editingRowId === b.id ? (
                              <select
                                className="border rounded px-2 py-1"
                                value={getEditingValue(b.id, "cancelledByRole", b.cancelledByRole)}
                                onChange={e => handleEditChange(b.id, "cancelledByRole", e.target.value)}
                              >
                                {roleOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>
                                {b.status?.startsWith("cancelled")
                                  ? b.cancelledByRole
                                    ? b.cancelledByRole === "parent"
                                      ? "Rodzic"
                                      : b.cancelledByRole === "student"
                                      ? "Uczeń"
                                      : b.cancelledByRole === "tutor"
                                      ? "Korepetytor"
                                      : b.cancelledByRole === "admin"
                                      ? "Administrator"
                                      : "Nieznane"
                                    : "Nieznane"
                                  : "-"}
                              </span>
                            )
                          ) : (
                            b.status?.startsWith("cancelled")
                              ? b.cancelledByRole === "parent"
                                ? "Rodzic"
                                : b.cancelledByRole === "student"
                                ? "Uczeń"
                                : b.cancelledByRole === "tutor"
                                ? "Korepetytor"
                                : "-"
                              : "-"
                          )}
                        </TableCell>
                        {currentUser?.accountType === "tutor" && <TableCell>{b.grade ?? "-"}</TableCell>}
                        <TableCell className="flex gap-2 items-center">
                          {(currentUser?.accountType === "student" ||
                            currentUser?.accountType === "parent" ||
                            currentUser?.accountType === "tutor") && (
                            <button
                              onClick={() => {
                                if (
                                  currentUser?.accountType === "student" &&
                                  !currentUser?.canCancel
                                ) {
                                  alert("Nie masz uprawnień do odwoływania lekcji. Poproś rodzica o nadanie uprawnień lub skontaktuj się z administratorem.")
                                  return
                                }
                                if (!canCancel) {
                                  // Przycisk nieaktywny dla innych przypadków bez uprawnień
                                  if (currentUser?.accountType === "student") {
                                    alert("Nie masz uprawnień do odwoływania lekcji. Poproś rodzica o nadanie uprawnień lub skontaktuj się z administratorem.")
                                  }
                                  return
                                }
                                cancelBooking(b.id, b.fullDate, b.time)
                              }}
                              title={
                                b.status?.startsWith("cancelled")
                                  ? "Lekcja już odwołana"
                                  : diffHours < 24
                                  ? "Odwołanie mniej niż 24h przed lekcją – zostanie uznana za zrealizowaną"
                                  : "Odwołaj lekcję"
                              }
                              className={`rounded px-2 py-1 text-white text-sm ${
                                canCancel
                                  ? "bg-red-600 hover:bg-red-700"
                                  : "bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
                              }`}
                            >
                              Odwołaj
                            </button>
                          )}
                          {/* Usuń - dla korepetytorów (dowolny status) oraz administratorów */}
                          {(currentUser?.accountType === "tutor" || currentUser?.accountType === "admin") && (
                            <button
                              onClick={() => deleteBooking(b.id)}
                              className="rounded px-2 py-1 text-white text-sm bg-gray-600 hover:bg-gray-700"
                            >
                              Usuń
                            </button>
                          )}
                          {/* Edytuj/Zapisz dla admina */}
                          {currentUser?.accountType === "admin" && editingRowId !== b.id && (
                            <button
                              onClick={() => setEditingRowId(b.id)}
                              className="rounded px-2 py-1 text-white text-sm bg-yellow-500 hover:bg-yellow-600"
                            >
                              Edytuj
                            </button>
                          )}
                          {currentUser?.accountType === "admin" && editingRowId === b.id && (
                            <button
                              className={`rounded px-2 py-1 text-white text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400`}
                              disabled={saving[b.id]}
                              onClick={async () => {
                                await handleSave({
                                  ...b,
                                  createdByRole: b.createdByRole || "admin", // ustaw domyślną rolę administratora, jeśli pusta
                                  cancelledByRole: b.cancelledByRole || (b.status?.startsWith("cancelled") ? "admin" : b.cancelledByRole)
                                })
                                setEditingRowId(null)
                              }}
                            >
                              {saving[b.id] ? "Zapisywanie..." : "Zapisz"}
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}