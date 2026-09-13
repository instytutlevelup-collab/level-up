"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { format, parseISO, addDays, isSameWeek } from "date-fns"
import { pl } from "date-fns/locale"
import { User as UserIcon, BookOpen, Video, MapPin, Home, Clock, Trash2, XCircle, Edit, Save } from "lucide-react"

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
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState(""); // Nowy stan dla filtra daty
  const [editingValues, setEditingValues] = useState<Record<string, { status?: string; createdByRole?: string; cancelledByRole?: string }>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists()) {
          const userData = { id: user.uid, ...userDoc.data() } as User
          setCurrentUser(userData)
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
                booking.status = "completed"
              } catch (err) {
                console.error("Błąd przy automatycznej aktualizacji statusu:", err)
              }
            }
          }
        }

        setBookings(allBookings)
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
    } else if (diffHours <= 24) { 
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
      const bookingSnap = await getDoc(bookingRef)
      if (!bookingSnap.exists()) {
        alert("Nie znaleziono lekcji.")
        return
      }
      const b = { id: bookingId, ...bookingSnap.data() } as Booking
      await updateDoc(bookingRef, { status: newStatus, cancelledByRole: currentUser?.accountType })

      if (b.tutorId && b.fullDate && b.time) {
        try {
          const availRef = doc(db, "availability", b.tutorId)
          const availSnap = await getDoc(availRef)
          if (availSnap.exists()) {
            const availData = availSnap.data()
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

  const statusOptions = [
    { value: "scheduled", label: "Zaplanowana" },
    { value: "completed", label: "Zrealizowana" },
    { value: "cancelled_in_time", label: "Do odrobienia" },
    { value: "cancelled_late", label: "Odwołana po terminie" },
    { value: "cancelled_by_tutor", label: "Do odrobienia (Korepetytor)" },
    { value: "makeup", label: "Zaplanowana (Odrabianie)" },
    { value: "makeup_used", label: "Wybrano nowy termin/rozliczone" },
  ]
  
  const roleOptions = [
    { value: "parent", label: "Rodzic" },
    { value: "student", label: "Uczeń" },
    { value: "tutor", label: "Korepetytor" },
    { value: "admin", label: "Administrator" },
    { value: "", label: "-" },
  ]

  const getEditingValue = (id: string, field: "status" | "createdByRole" | "cancelledByRole", fallback: string | undefined) => {
    return editingValues[id]?.[field] !== undefined ? editingValues[id]?.[field] : (fallback ?? "")
  }

  const handleEditChange = (id: string, field: "status" | "createdByRole" | "cancelledByRole", value: string) => {
    setEditingValues((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      }
    }))
  }

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
      
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, ...updateObj } : b))
      setEditingValues((prev) => {
        const newVals = { ...prev }
        delete newVals[id]
        return newVals
      })
      setEditingRowId(null)
    } catch (error) {
      alert("Błąd podczas zapisu zmian: " + (error as unknown as { message?: string })?.message)
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }))
    }
  }

  const renderBookingsCards = (displayedBookings: Booking[]) => {
    if (displayedBookings.length === 0) {
      return <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed">Brak lekcji do wyświetlenia</div>
    }

    const groupedBookings = displayedBookings.reduce((acc, b) => {
      const dateKey = b.fullDate || "Brak daty"
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(b)
      return acc
    }, {} as Record<string, Booking[]>)

    return (
      <div className="space-y-6">
        {Object.entries(groupedBookings).map(([date, dayBookings]) => {
          const parsedDate = date !== "Brak daty" ? parseISO(date) : null
          const dateLabel = parsedDate ? format(parsedDate, "EEEE, d MMMM yyyy", { locale: pl }) : "Brak daty"

          return (
            <div key={date} className="space-y-3">
              <h3 className="text-lg font-bold text-gray-800 capitalize border-b border-gray-100 pb-1">{dateLabel}</h3>
              <div className="grid gap-3">
                {dayBookings.map((b) => {
                  const canCancel =
                    b.status !== "completed" &&
                    b.status !== "makeup_used" &&
                    !(b.status?.startsWith("cancelled")) &&
                    (
                      currentUser?.accountType === "tutor" ||
                      (currentUser?.accountType === "student" && currentUser.canCancel) ||
                      currentUser?.accountType === "parent"
                    )

                  const modeIcon = b.lessonMode === "online" ? <Video className="w-3.5 h-3.5" /> : 
                                  (b.lessonMode === "z dojazdem do ucznia" || b.lessonMode === "travel" ? <MapPin className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />);

                  const [hours, minutes] = b.time.split(":").map(Number);
                  const startObj = new Date(0, 0, 0, hours, minutes);
                  const endObj = new Date(startObj.getTime() + b.duration * 60000);
                  const endTimeStr = `${endObj.getHours().toString().padStart(2, "0")}:${endObj.getMinutes().toString().padStart(2, "0")}`;

                  return (
                    <Card key={b.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        
                        <div className="flex flex-col items-center justify-center min-w-[80px] bg-gray-50 rounded-md p-2 border border-gray-100">
                          <div className="text-2xl font-bold text-gray-900 tracking-tight leading-none">{b.time}</div>
                          <div className="text-xs font-semibold text-gray-500 mt-1">do {endTimeStr}</div>
                        </div>

                        <div className="flex-grow space-y-1">
                          <div className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-gray-400" />
                            {b.studentName}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-600">
                            <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-gray-400" /> {b.subject || "-"}</span>
                            <span className="flex items-center gap-1">{modeIcon} {b.lessonMode || "-"}</span>
                            {currentUser?.accountType !== "tutor" && b.tutorName && (
                                <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-sm">
                                    Korepetytor: {b.tutorName}
                                </span>
                            )}
                          </div>

                          <div className="text-xs text-gray-500 pt-1 flex flex-col sm:flex-row sm:gap-4">
                            <span><span className="font-semibold text-gray-600">Zarezerwował/a:</span> {roleOptions.find(r => r.value === b.createdByRole)?.label || b.createdByRole || "-"}</span>
                            {(b.status?.startsWith("cancelled") || b.status === "makeup_used") && (
                              <span className="text-red-600"><span className="font-semibold">Odwołał/a:</span> {roleOptions.find(r => r.value === b.cancelledByRole)?.label || b.cancelledByRole || "-"}</span>
                            )}
                          </div>
                          
                          {b.status === "makeup" && b.originalLessonId && (
                            (() => {
                              const original = bookings.find(orig => orig.id === b.originalLessonId);
                              if (original?.fullDate) {
                                const origDate = format(parseISO(original.fullDate), "d MMMM yyyy", { locale: pl });
                                return (
                                  <div className="text-xs text-gray-600 mt-1 flex items-center gap-1.5 font-medium">
                                    <Clock className="w-3.5 h-3.5" />
                                    Pierwotnie: {origDate}
                                  </div>
                                );
                              }
                              return null;
                            })()
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                          {editingRowId === b.id && currentUser?.accountType === "admin" ? (
                             <select
                               className="border border-gray-300 rounded px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                               value={getEditingValue(b.id, "status", b.status)}
                               onChange={e => handleEditChange(b.id, "status", e.target.value)}
                             >
                               {statusOptions.map(opt => (
                                 <option key={opt.value} value={opt.value}>{opt.label}</option>
                               ))}
                             </select>
                          ) : (
                            <Badge className={`px-2 py-0.5 text-xs font-medium ${
                                b.status === "makeup" ? "bg-blue-100 text-blue-800 border-blue-200"
                                : b.status === "makeup_used" ? "bg-gray-100 text-gray-800 border-gray-200"
                                : b.status === "cancelled_in_time" ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                                : b.status === "cancelled_late" ? "bg-pink-100 text-pink-800 border-pink-200"
                                : b.status === "cancelled_by_tutor" ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                                : b.status === "completed" ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                              }`} variant="outline">
                                {b.status === "makeup" ? "Zaplanowana"
                                : b.status === "makeup_used" ? "Wybrano nowy termin/rozliczone"
                                : b.status === "cancelled_in_time" ? "Do odrobienia"
                                : b.status === "cancelled_late" ? "Odwołana po terminie"
                                : b.status === "cancelled_by_tutor" ? "Do odrobienia"
                                : b.status === "completed" ? "Zrealizowana"
                                : "Zaplanowana"}
                            </Badge>
                          )}

                          <div className="flex items-center gap-2">
                             {(currentUser?.accountType === "student" || currentUser?.accountType === "parent" || currentUser?.accountType === "tutor") && canCancel && (
                                <button
                                  onClick={() => cancelBooking(b.id, b.fullDate, b.time)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-semibold transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Odwołaj
                                </button>
                             )}

                             {currentUser?.accountType === "admin" && (
                                <button
                                  onClick={() => setExpandedDetailsId(expandedDetailsId === b.id ? null : b.id)}
                                  className="text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2"
                                >
                                  {expandedDetailsId === b.id ? "Zwiń szczegóły" : "Edytuj"}
                                </button>
                             )}
                          </div>
                        </div>
                      </div>

                      {expandedDetailsId === b.id && currentUser?.accountType === "admin" && (
                        <div className="bg-gray-50 border-t p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="text-xs">
                                    <span className="font-semibold text-gray-700 block mb-0.5">Zarezerwował/a:</span>
                                    {editingRowId === b.id ? (
                                        <select
                                            className="border rounded px-2 py-1 w-full max-w-[200px]"
                                            value={getEditingValue(b.id, "createdByRole", b.createdByRole)}
                                            onChange={e => handleEditChange(b.id, "createdByRole", e.target.value)}
                                        >
                                            {roleOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="text-gray-600 bg-white border px-2 py-0.5 rounded">
                                            {roleOptions.find(r => r.value === b.createdByRole)?.label || b.createdByRole || "-"}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs">
                                    <span className="font-semibold text-gray-700 block mb-0.5">Odwołał/a:</span>
                                    {editingRowId === b.id ? (
                                        <select
                                            className="border rounded px-2 py-1 w-full max-w-[200px]"
                                            value={getEditingValue(b.id, "cancelledByRole", b.cancelledByRole)}
                                            onChange={e => handleEditChange(b.id, "cancelledByRole", e.target.value)}
                                        >
                                            {roleOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="text-gray-600 bg-white border px-2 py-0.5 rounded">
                                            {roleOptions.find(r => r.value === b.cancelledByRole)?.label || b.cancelledByRole || "-"}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex flex-col items-start md:items-end justify-start gap-2">
                                {editingRowId !== b.id ? (
                                    <button
                                        onClick={() => setEditingRowId(b.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 shadow-sm text-gray-700 hover:bg-gray-50 rounded text-xs font-semibold transition-colors w-full md:w-auto justify-center"
                                    >
                                        <Edit className="w-3.5 h-3.5" /> Edytuj
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleSave({ ...b, createdByRole: b.createdByRole || "admin", cancelledByRole: b.cancelledByRole || (b.status?.startsWith("cancelled") ? "admin" : b.cancelledByRole) })}
                                        disabled={saving[b.id]}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-xs font-semibold transition-colors w-full md:w-auto justify-center disabled:opacity-50"
                                    >
                                        <Save className="w-3.5 h-3.5" /> {saving[b.id] ? "Zapisywanie..." : "Zapisz zmiany"}
                                    </button>
                                )}
                                
                                <button
                                    onClick={() => deleteBooking(b.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded text-xs font-semibold transition-colors w-full md:w-auto justify-center"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Usuń
                                </button>
                            </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12 flex justify-center items-center">
        <div className="text-gray-500 font-medium">Ładowanie planu lekcji...</div>
      </div>
    )
  }

  const today = new Date()
  const todayStr = format(today, "yyyy-MM-dd")
  const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd")

  const todayBookings = bookings.filter(b => b.fullDate === todayStr)
  const tomorrowBookings = bookings.filter(b => b.fullDate === tomorrowStr)
  
  const weekBookings = bookings.filter(b => {
    if (!b.fullDate) return false;
    return isSameWeek(parseISO(b.fullDate), today, { weekStartsOn: 1 })
  })

  const filteredAllBookings = bookings
    .filter((b) => !selectedStudent || b.studentId === selectedStudent)
    .filter((b) => !selectedTutor || b.tutorName === selectedTutor)
    .filter((b) => {
      if (!selectedMonth) return true;
      if (!b.fullDate) return false;
      const [, month] = b.fullDate.split("-");
      return month === selectedMonth;
    })
    .filter((b) => {
      if (!selectedDate) return true;
      return b.fullDate === selectedDate;
    });

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Plan lekcji</h1>
      </div>

      {currentUser?.accountType === "admin" || currentUser?.accountType === "tutor" ? (
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="mb-6 p-1 bg-gray-100 rounded-lg">
            <TabsTrigger value="today" className="rounded-md px-4 py-1.5 text-sm font-semibold">Dziś</TabsTrigger>
            <TabsTrigger value="tomorrow" className="rounded-md px-4 py-1.5 text-sm font-semibold">Jutro</TabsTrigger>
            <TabsTrigger value="all" className="rounded-md px-4 py-1.5 text-sm font-semibold">Pełny grafik</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="focus:outline-none">
            {renderBookingsCards(todayBookings)}
          </TabsContent>
          
          <TabsContent value="tomorrow" className="focus:outline-none">
            {renderBookingsCards(tomorrowBookings)}
          </TabsContent>

          <TabsContent value="all" className="focus:outline-none">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-gray-700">Wybierz ucznia</label>
                      <select
                          value={selectedStudent}
                          onChange={(e) => setSelectedStudent(e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      >
                          <option value="">Wszyscy uczniowie</option>
                          {studentOptions.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                      </select>
                  </div>
                  
                  {currentUser?.accountType === "admin" && (
                      <div className="flex-1 space-y-1">
                          <label className="text-xs font-medium text-gray-700">Wybierz korepetytora</label>
                          <select
                              value={selectedTutor}
                              onChange={(e) => setSelectedTutor(e.target.value)}
                              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          >
                              <option value="">Wszyscy korepetytorzy</option>
                              {tutorOptions.map((name) => (
                              <option key={name} value={name}>{name}</option>
                              ))}
                          </select>
                      </div>
                  )}

                  <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-gray-700">Wybierz miesiąc</label>
                      <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                  
                  {/* Nowy filtr daty dla administratora i korepetytora */}
                  <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-gray-700">Wybierz datę</label>
                      <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                  </div>
              </div>
            </div>
            {renderBookingsCards(filteredAllBookings)}
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="week" className="w-full">
          <TabsList className="mb-6 p-1 bg-gray-100 rounded-lg">
            <TabsTrigger value="week" className="rounded-md px-4 py-1.5 text-sm font-semibold">Ten tydzień</TabsTrigger>
            <TabsTrigger value="all" className="rounded-md px-4 py-1.5 text-sm font-semibold">Pełny grafik</TabsTrigger>
          </TabsList>

          <TabsContent value="week" className="focus:outline-none">
            {renderBookingsCards(weekBookings)}
          </TabsContent>

          <TabsContent value="all" className="focus:outline-none">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-gray-700">Wybierz ucznia</label>
                      <select
                          value={selectedStudent}
                          onChange={(e) => setSelectedStudent(e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      >
                          <option value="">Wszyscy uczniowie</option>
                          {studentOptions.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                      </select>
                  </div>
                  
                  <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-gray-700">Wybierz miesiąc</label>
                      <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                  <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-gray-700">Wybierz datę</label>
                      <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                  </div>
              </div>
            </div>
            {renderBookingsCards(filteredAllBookings)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}