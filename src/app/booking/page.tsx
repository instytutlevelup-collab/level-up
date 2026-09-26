"use client"

import { useEffect, useState } from "react"
import { notifyBooking } from "@/lib/notifications"
import { db, auth } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  DocumentData,
} from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { format, parseISO, addMinutes } from "date-fns"
import { pl } from "date-fns/locale"

const daysOfWeek = [
  { label: "Niedziela", value: "sunday" },
  { label: "Poniedziałek", value: "monday" },
  { label: "Wtorek", value: "tuesday" },
  { label: "Środa", value: "wednesday" },
  { label: "Czwartek", value: "thursday" },
  { label: "Piątek", value: "friday" },
  { label: "Sobota", value: "saturday" },
]

const normalizeMode = (v: string) => {
  const s = (v || "").toLowerCase().trim()
  if (["u korepetytora", "tutorplace", "tutor place", "tutor_place"].includes(s)) return "tutor_place"
  if (["z dojazdem do ucznia", "z dojazdem", "dojazd", "travel"].includes(s)) return "travel"
  if (["online"].includes(s)) return "online"
  return s
}

// Helper function to check if two intervals overlap
function intervalsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  return s1 < e2 && s2 < e1;
}

export default function BookingPage() {
  const [subjects, setSubjects] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [vacations, setVacations] = useState<DocumentData[]>([])

  useEffect(() => {
    const fetchSubjects = async () => {
      const snap = await getDocs(collection(db, "subjects"))
      setSubjects(
        snap.docs
          .map(doc => doc.data().name)
          .sort((a: string, b: string) => a.localeCompare(b))
      )
    }
    fetchSubjects()
  }, [])
  
  const [currentUser, setCurrentUser] = useState<UserData | null>(null)
  const [availability, setAvailability] = useState<DocumentData[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [tutors, setTutors] = useState<DocumentData[]>([])
  const [tutorId, setTutorId] = useState("")
  const [subject, setSubject] = useState("")
  const [duration, setDuration] = useState(60)
  const [linkedChildren, setLinkedChildren] = useState<DocumentData[]>([])
  const [selectedChildId, setSelectedChildId] = useState("")
  const [day, setDay] = useState("")
  const [specificDate, setSpecificDate] = useState("")
  const [time, setTime] = useState("")
  const [lessonMode, setLessonMode] = useState("")
  const [bufferBefore, setBufferBefore] = useState<number>(0)
  const [bufferAfter, setBufferAfter] = useState<number>(0)

  // Booking interface for typing bookings
  interface Booking {
    id: string;
    studentId: string;
    tutorId?: string;
    studentName: string;
    fullDate?: string;
    time?: string;
    createdByRole: "parent" | "student" | "tutor" | "admin";
    subject?: string;
    status?: string;
    duration?: number;
    lessonMode?: string;
    isRecurring?: boolean;
    day?: string | null;
    tutorName?: string;
    originalLessonId?: string;
    createdAt?: string;
    createdById?: string;
    bufferBefore?: number;
    bufferAfter?: number;
  }

  // Odrabiane lekcje (makeup)
  const [makeupForLessonId, setMakeupForLessonId] = useState<string | null>(null)

  const [schoolYearStart, setSchoolYearStart] = useState<Date | null>(null)
  const [schoolYearEnd, setSchoolYearEnd] = useState<Date | null>(null)

  // UserData interface for typing currentUser
  interface UserData {
    id: string;
    accountType?: "parent" | "student" | "tutor" | "admin";
    email?: string;
    firstName?: string;
    lastName?: string;
    linkedAccounts?: { studentId: string; studentName: string }[];
  }

  useEffect(() => {
    const fetchUserAndBookings = async (user: DocumentData | null) => {
      if (user) {
        const userDoc = await getDocs(
          query(collection(db, "users"), where("email", "==", user.email))
        );
        const docSnap = userDoc.docs[0];
        if (docSnap) {
          const userData: UserData = { id: docSnap.id, ...(docSnap.data() as Partial<UserData>) };
          setCurrentUser(userData);

          if (userData.accountType === "parent") {
            const studentsSnap = await getDocs(
              query(collection(db, "users"), where("accountType", "==", "student"))
            );

            const students = studentsSnap.docs
              .map(s => {
                const data = s.data();
                return {
                  id: s.id,
                  firstName: data.firstName,
                  lastName: data.lastName,
                  parentEmail: data.parentEmail || null
                };
              })
              .filter(s => s.parentEmail === userData.email);

            setLinkedChildren(students);
          }
          if (userData.accountType === "admin") {
            const studentsSnap = await getDocs(
              query(collection(db, "users"), where("accountType", "==", "student"))
            );
            const students = studentsSnap.docs.map(s => ({
              id: s.id,
              firstName: s.data().firstName,
              lastName: s.data().lastName,
            }));
            setLinkedChildren(students);
          }
        }
      } else {
        window.location.href = "/auth/login";
      }
    };
    const unsub = onAuthStateChanged(auth, fetchUserAndBookings);
    return () => unsub();
  }, []);

  // Dla korepetytora: pobierz wszystkich uczniów (niezależnie od typu konta rodzica)
  useEffect(() => {
    const fetchAllStudents = async () => {
      if (currentUser?.accountType === "tutor") {
        const usersSnap = await getDocs(collection(db, "users"))
        const allStudents = usersSnap.docs
          .filter(doc => doc.data().accountType === "student")
          .map(doc => ({
            id: doc.id,
            firstName: doc.data().firstName,
            lastName: doc.data().lastName,
          }));
        setLinkedChildren(allStudents);
      }
    }
    fetchAllStudents()
  }, [currentUser])

  useEffect(() => {
    const fetchData = async () => {
      const [avail, books, tutorsData, vacationsSnap] = await Promise.all([
        getDocs(collection(db, "availability")),
        getDocs(collection(db, "bookings")),
        getDocs(query(collection(db, "users"), where("accountType", "==", "tutor"))),
        getDocs(collection(db, "vacations")),
      ]);
      
      setAvailability(avail.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          day: (data.day || "").toLowerCase().trim(),
          lessonType: Array.isArray(data.lessonType)
            ? data.lessonType.map((m: string) => normalizeMode(m))
            : [],
        }
      }))
      setBookings(books.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)))
      setTutors(tutorsData.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      setVacations(vacationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))

      const settingsSnap = await getDocs(collection(db, "settings"))
      if (!settingsSnap.empty) {
        const yearData = settingsSnap.docs[0].data()
        
        if (yearData.startDate) {
          const [y, m, d] = yearData.startDate.split('-').map(Number)
          setSchoolYearStart(new Date(y, m - 1, d))
        }
        
        if (yearData.endDate) {
          const [y, m, d] = yearData.endDate.split('-').map(Number)
          const endObj = new Date(y, m - 1, d)
          endObj.setHours(23, 59, 59, 999)
          setSchoolYearEnd(endObj)
        }
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (currentUser?.accountType === "tutor") {
      setTutorId(currentUser.id)
    } else {
      setTutorId("")
    }
  }, [currentUser])

  const formatPolishDate = (date: Date | string) =>
    format(typeof date === 'string' ? parseISO(date) : date, 'EEEE, d MMMM yyyy', { locale: pl })

  // Uproszczona i w 100% precyzyjna funkcja sprawdzająca zajętość (naprawia błąd "cienia" i odblokowuje m.in 18:45)
  const isSlotTaken = (tutorId: string, date: string, time: string, duration: number, bufferBeforeParam?: number, bufferAfterParam?: number) => {
    const ignoredStatuses = ["cancelled", "cancelled_in_time", "cancelled_late", "cancelled_by_tutor", "makeup_used"];

    const taken = bookings.some(b => {
      if (b.tutorId !== tutorId) return false;
      if (ignoredStatuses.includes(b.status ?? "")) return false;
      
      // KLUCZOWA ZMIANA: Sprawdzamy tylko po konkretnej dacie, nie po dniu tygodnia.
      if (b.fullDate !== date) return false; 
      if (!b.time) return false;

      const lessonBufferBefore = typeof b.bufferBefore === "number" ? b.bufferBefore : 0;
      const lessonBufferAfter = typeof b.bufferAfter === "number" ? b.bufferAfter : 0;

      const lessonStart = new Date((b.fullDate || "") + "T" + b.time);
      const lessonEnd = addMinutes(new Date(lessonStart), b.duration ?? 60);
      const blockStart = addMinutes(new Date(lessonStart), -lessonBufferBefore);
      const blockEnd = addMinutes(new Date(lessonEnd), lessonBufferAfter);

      const newStart = new Date((date || "") + "T" + time);
      const newEnd = addMinutes(new Date(newStart), duration);
      const newBufferBefore = typeof bufferBeforeParam === "number" ? bufferBeforeParam : 0;
      const newBufferAfter = typeof bufferAfterParam === "number" ? bufferAfterParam : 0;
      const newBlockStart = addMinutes(new Date(newStart), -newBufferBefore);
      const newBlockEnd = addMinutes(new Date(newEnd), newBufferAfter);

      if (newBlockStart < blockEnd && newBlockEnd > blockStart) {
        return true;
      }
      return false;
    });

    if (taken) return true;

    const slotStart = date + "T" + time;
    const endDateObj = new Date(date + "T" + time);
    endDateObj.setMinutes(endDateObj.getMinutes() + duration);
    const slotEnd = endDateObj.toISOString().slice(0, 16);
    
    for (const vac of vacations) {
      if (vac.tutorId === tutorId) {
        if (intervalsOverlap(slotStart, slotEnd, vac.startDateTime, vac.endDateTime)) {
          return true;
        }
      }
    }
    return false;
  }

  // Zwraca dostępne daty TYLKO z puli jednorazowej (blokada "kradzieży" stałych dni)
  const getAvailableDates = () => {
    const start = schoolYearStart;
    const end = schoolYearEnd;
    if (!start || !end) return [];

    const datesSet = new Set<string>()
    const todayMid = new Date()
    todayMid.setHours(0, 0, 0, 0)
    const now = new Date()
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const todayStr = format(now, "yyyy-MM-dd")

    availability.forEach((a) => {
      if (a.tutorId !== tutorId) return
      if (
        lessonMode &&
        (!a.lessonType || !a.lessonType.includes(normalizeMode(lessonMode)))
      ) return
      
      if (a.type === "one-time") {
        let date = "";
        
        if (a.date?.toDate) {
          date = format(a.date.toDate(), "yyyy-MM-dd");
        } else if (typeof a.date === "string") {
          date = a.date;
        } else {
          return;
        }

        if (new Date(date) >= todayMid) {
          const [sh, sm] = (a.startTime || "").split(":").map(Number)
          const [eh, em] = (a.endTime || "").split(":").map(Number)
          const startTime = sh * 60 + sm
          const endTime = eh * 60 + em

          for (let t = startTime; t + duration <= endTime; t += 10) {
            if (date === todayStr && t <= nowMins) continue
            const h = String(Math.floor(t / 60)).padStart(2, "0")
            const m = String(t % 60).padStart(2, "0")
            const timeStr = `${h}:${m}`
            
            if (
              !isSlotTaken(tutorId, date || "", timeStr, duration, bufferBefore, bufferAfter) ||
              bookings.some(b =>
                b.isRecurring &&
                b.fullDate === date &&
                ["cancelled_in_time", "cancelled_by_tutor"].includes(b.status ?? "")
              )
            ) {
              break
            }
          }
          datesSet.add(date)
        }
      }
    })
    
    return Array.from(datesSet).sort()
  }

  // Zwraca dostępne sloty, poprawnie skanując cały rok dla rezerwacji stałych
  const getAvailableSlots = (type: "weekly" | "one-time") => {
    const slots: string[] = []
    const filtered = availability.filter(a => {
      if (a.tutorId !== tutorId) return false
      if (
        lessonMode &&
        (!a.lessonType || !a.lessonType.includes(normalizeMode(lessonMode)))
      ) return false
      
      if (type === "weekly") {
        return a.type === "weekly" &&
          String(a.day).toLowerCase().trim() === String(day).toLowerCase().trim()
      }
      
      if (type === "one-time") {
        if (!specificDate) return false
        if (a.type === "one-time") {
          let oneTimeDate = ""
          if (a.date?.toDate) {
            oneTimeDate = format(a.date.toDate(), "yyyy-MM-dd")
          }
          else if (typeof a.date === "string") {
            oneTimeDate = a.date
          }
          if (oneTimeDate === specificDate) return true
        }
        return false 
      }
      return false
    })

    let fullDate = specificDate;
    if (type === "weekly" && day && schoolYearStart) {
      const todayMid = new Date();
      todayMid.setHours(0, 0, 0, 0);
      const dayIndex = daysOfWeek.findIndex(d => d.value.toLowerCase() === String(day).toLowerCase());
      const first = new Date(schoolYearStart);
      const offset = (dayIndex - first.getDay() + 7) % 7;
      first.setDate(first.getDate() + offset);
      while (first < todayMid) {
        first.setDate(first.getDate() + 7);
      }
      fullDate = format(first, "yyyy-MM-dd");
    }

    if (!fullDate) return slots

    const now = new Date()
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const todayStr = format(now, "yyyy-MM-dd")

    filtered.forEach(a => {
      const [sh, sm] = (a.startTime || "").split(":").map(Number)
      const [eh, em] = (a.endTime || "").split(":").map(Number)
      const startTime = sh * 60 + sm
      const endTime = eh * 60 + em

      for (let t = startTime; t + duration <= endTime; t += 10) {
        if (fullDate === todayStr && t <= nowMins) continue
        const h = String(Math.floor(t / 60)).padStart(2, "0")
        const m = String(t % 60).padStart(2, "0")
        const timeStr = `${h}:${m}`
        
        if (type === "weekly") {
          let isFreeForAllWeeks = true;
          const checkDate = new Date(fullDate);
          
          while (checkDate <= (schoolYearEnd || new Date(2027, 6, 1))) {
            const checkDateStr = format(checkDate, "yyyy-MM-dd");
            if (isSlotTaken(tutorId, checkDateStr, timeStr, duration, bufferBefore, bufferAfter)) {
              isFreeForAllWeeks = false;
              break; 
            }
            checkDate.setDate(checkDate.getDate() + 7);
          }
          
          if (isFreeForAllWeeks) {
            slots.push(timeStr);
          }
          
        } else {
          // Niezawodny bypass dla odwołanych terminów (jednorazowych)
          const slotTaken = isSlotTaken(tutorId, fullDate, timeStr, duration, bufferBefore, bufferAfter);
          
          const hasCancelledOverride = bookings.some(b => 
            b.tutorId === tutorId && 
            b.fullDate === fullDate && 
            b.time === timeStr && 
            ["cancelled_in_time", "cancelled_by_tutor", "cancelled_late", "makeup_used"].includes(b.status ?? "")
          );
          
          const hasValidBooking = bookings.some(b => 
            b.tutorId === tutorId && 
            b.fullDate === fullDate && 
            b.time === timeStr && 
            !["cancelled", "cancelled_in_time", "cancelled_late", "cancelled_by_tutor", "makeup_used"].includes(b.status ?? "")
          );

          if ((!slotTaken || hasCancelledOverride) && !hasValidBooking) {
             slots.push(timeStr);
          }
        }
      }
    })
    return [...new Set(slots)]
  }

  // Rozszerzona obsługa rezerwacji cyklicznych — zapisuje wszystkie wystąpienia do końca roku szkolnego
  const handleBooking = async (type: "weekly" | "one-time") => {
    if (isSubmitting) return; 
    setIsSubmitting(true);
    
    const refreshBookings = async () => {
      const booksSnap = await getDocs(collection(db, "bookings"));
      setBookings(booksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    }

    if (
      !tutorId ||
      !subject ||
      !lessonMode ||
      !time ||
      (type === "weekly" && !day) ||
      (type === "one-time" && !specificDate) ||
      (currentUser?.accountType === "parent" && !selectedChildId)
    ) {
      alert("Uzupełnij wszystkie wymagane pola.")
      setIsSubmitting(false)
      return
    }

    let fullDate = specificDate;
    if (type === "weekly" && day && schoolYearStart) {
      const todayMid = new Date();
      todayMid.setHours(0, 0, 0, 0);
      const dayIndex = daysOfWeek.findIndex(d => d.value === day);
      const first = new Date(schoolYearStart);
      const offset = (dayIndex - first.getDay() + 7) % 7;
      first.setDate(first.getDate() + offset);
      while (first < todayMid) {
        first.setDate(first.getDate() + 7);
      }
      fullDate = format(first, "yyyy-MM-dd");
    }

    let studentId = currentUser!.id
    let studentName = `${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`

    if (
      (currentUser?.accountType === "parent" ||
        currentUser?.accountType === "tutor" ||
        currentUser?.accountType === "admin") &&
      selectedChildId
    ) {
      const selectedChild = linkedChildren.find(c => c.id === selectedChildId)
      studentName = `${selectedChild?.firstName} ${selectedChild?.lastName}`

      const usersSnap = await getDocs(
        query(
          collection(db, "users"),
          where("firstName", "==", selectedChild?.firstName),
          where("lastName", "==", selectedChild?.lastName),
          where("accountType", "==", "student")
        )
      )
      if (!usersSnap.empty) {
        studentId = usersSnap.docs[0].id
      } else {
        studentId = selectedChildId
      }
    }

    let slotStart: string, slotEnd: string;
    if (type === "weekly" && day && fullDate) {
      slotStart = fullDate + "T" + time;
      const endDateObj = new Date(fullDate + "T" + time);
      endDateObj.setMinutes(endDateObj.getMinutes() + duration);
      slotEnd = endDateObj.toISOString().slice(0, 16);
    } else if (type === "one-time" && fullDate) {
      slotStart = fullDate + "T" + time;
      const endDateObj = new Date(fullDate + "T" + time);
      endDateObj.setMinutes(endDateObj.getMinutes() + duration);
      slotEnd = endDateObj.toISOString().slice(0, 16);
    } else {
      slotStart = "";
      slotEnd = "";
    }
    
    for (const vac of vacations) {
      if (vac.tutorId === tutorId) {
        if (intervalsOverlap(slotStart, slotEnd, vac.startDateTime, vac.endDateTime)) {
          alert("Korepetytor jest na urlopie w tym terminie.");
          setIsSubmitting(false)
          return;
        }
      }
    }

    if (isSlotTaken(tutorId || "", fullDate || "", time || "", duration, bufferBefore, bufferAfter)) {
      alert("Ten termin jest już zajęty.")
      setIsSubmitting(false)
      return
    }

    const tutorName =
      tutors.find(t => t.id === tutorId)?.firstName +
      " " +
      tutors.find(t => t.id === tutorId)?.lastName

    // PATCH: Dodano naprawioną zmienną dla poprawnych statusów (wspiera admina i tutora)
    const isMakeupEligible = !!makeupForLessonId && ["student", "parent", "tutor", "admin"].includes(currentUser?.accountType || "");

    try {
      if (type === "weekly" && day && schoolYearStart && schoolYearEnd) {
        const dayIndex = daysOfWeek.findIndex(d => d.value === day)
        const first = new Date(schoolYearStart)
        const offset = (dayIndex - first.getDay() + 7) % 7
        first.setDate(first.getDate() + offset)
        const d = new Date(first)
        const toAdd: Omit<Booking, "id">[] = []
        const now = new Date()
        
        while (d <= schoolYearEnd) {
          if (d >= now) {
            const dStr = format(new Date(d), "yyyy-MM-dd")
            const slotStartRec = dStr + "T" + time;
            const endDateObj = new Date(dStr + "T" + time);
            endDateObj.setMinutes(endDateObj.getMinutes() + duration);
            const slotEndRec = endDateObj.toISOString().slice(0, 16);
            let isVacation = false;
            for (const vac of vacations) {
              if (vac.tutorId === tutorId) {
                if (intervalsOverlap(slotStartRec, slotEndRec, vac.startDateTime, vac.endDateTime)) {
                  isVacation = true;
                  break;
                }
              }
            }
            if (isVacation) {
              d.setDate(d.getDate() + 7)
              continue;
            }
            
            if (!isSlotTaken(tutorId || "", dStr || "", time || "", duration, bufferBefore, bufferAfter)) {
              if (isMakeupEligible && toAdd.length === 0) {
                toAdd.push({
                  tutorId, tutorName, studentId, studentName, time, duration, subject, lessonMode,
                  status: "makeup", originalLessonId: makeupForLessonId, day, fullDate: dStr,
                  isRecurring: true, createdAt: new Date().toISOString(), createdById: currentUser?.id ?? "",
                  createdByRole: (currentUser?.accountType ?? "student") as "parent" | "student" | "tutor" | "admin",
                  bufferBefore, bufferAfter,
                })
              } else {
                toAdd.push({
                  tutorId, tutorName, studentId, studentName, time, duration, subject, lessonMode,
                  status: "scheduled", day, fullDate: dStr, isRecurring: true, createdAt: new Date().toISOString(),
                  createdById: currentUser?.id ?? "", createdByRole: (currentUser?.accountType ?? "student") as "parent" | "student" | "tutor" | "admin",
                  bufferBefore, bufferAfter,
                })
              }
            }
          }
          d.setDate(d.getDate() + 7)
        }
        
        if (toAdd.length === 0) {
          alert("Wszystkie terminy cykliczne są już zajęte lub przypadają na urlop korepetytora.")
          setIsSubmitting(false)
          return
        }
        
        for (const bookingData of toAdd) {
          let docRef;
          if (bookingData.status === "makeup" && bookingData.originalLessonId) {
            docRef = await addDoc(collection(db, "bookings"), bookingData)
            await updateDoc(doc(db, "bookings", bookingData.originalLessonId), { status: "makeup_used" })
          } else {
            docRef = await addDoc(collection(db, "bookings"), bookingData)
          }
          await notifyBooking({
            booking: {
              id: docRef.id, studentId: bookingData.studentId, tutorId: bookingData.tutorId,
              studentName: bookingData.studentName, fullDate: bookingData.fullDate, time: bookingData.time,
              createdByRole: bookingData.createdByRole,
            },
          })
        }
        await refreshBookings();
        alert(`Zarezerwowano lekcje cykliczne (${toAdd.length} terminów)!`)
      } else {
        // one-time booking
        const bookingData: Omit<Booking, "id"> = {
          tutorId, tutorName, studentId, studentName, time, duration, subject, lessonMode,
          day: null, fullDate, isRecurring: false, createdAt: new Date().toISOString(),
          createdById: currentUser!.id, createdByRole: currentUser?.accountType ?? "student",
          bufferBefore, bufferAfter,
        }
        
        if (isMakeupEligible) {
          bookingData.status = "makeup"
          bookingData.originalLessonId = makeupForLessonId
        } else {
          bookingData.status = "scheduled"
        }
        
        let docRef;
        if (bookingData.status === "makeup" && bookingData.originalLessonId) {
          docRef = await addDoc(collection(db, "bookings"), bookingData)
          await updateDoc(doc(db, "bookings", bookingData.originalLessonId), { status: "makeup_used" })
        } else {
          docRef = await addDoc(collection(db, "bookings"), bookingData)
        }
        await notifyBooking({
          booking: {
            id: docRef.id, studentId: bookingData.studentId, tutorId: bookingData.tutorId,
            studentName: bookingData.studentName, fullDate: bookingData.fullDate, time: bookingData.time,
            createdByRole: bookingData.createdByRole,
          },
        })
        await refreshBookings();
        alert("Zarezerwowano lekcję!")
      }
      
      setDay("")
      setSpecificDate("")
      setTime("")
      setSubject("")
      setTutorId("")
      setSelectedChildId("")
      setLessonMode("")
      setMakeupForLessonId(null)
    } catch (err) {
      console.error(err)
      alert("Błąd podczas rezerwacji.")
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      setTime("")
    }
  }, [lessonMode, tutorId, specificDate, day])

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-wrap justify-between gap-6">
      <Card className="w-full md:w-[calc(50%-0.75rem)]">
        <CardHeader><CardTitle>Rezerwacja stała</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(currentUser?.accountType === "admin" || currentUser?.accountType === "parent" || currentUser?.accountType === "student") && (
            <>
              <Label>Korepetytor</Label>
              <Select value={tutorId} onValueChange={setTutorId}>
                <SelectTrigger><SelectValue placeholder="Wybierz korepetytora" /></SelectTrigger>
                <SelectContent>
                  {tutors.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <Label>Tryb zajęć</Label>
          <Select value={lessonMode} onValueChange={(v) => setLessonMode(v.toLowerCase())}>
            <SelectTrigger>
              <SelectValue placeholder="Wybierz tryb zajęć" />
            </SelectTrigger>
            <SelectContent>
              {currentUser &&
                (currentUser.accountType === "student" || currentUser.accountType === "parent" ? (
                  <>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="u korepetytora">U korepetytora</SelectItem>
                  </>
                ) : null)}
              {currentUser &&
                (currentUser.accountType === "tutor" || currentUser.accountType === "admin" ? (
                  <>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="u korepetytora">U korepetytora</SelectItem>
                    <SelectItem value="z dojazdem do ucznia">Z dojazdem do ucznia</SelectItem>
                  </>
                ) : null)}
            </SelectContent>
          </Select>

          <Label>Dzień tygodnia</Label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger><SelectValue placeholder="Wybierz dzień" /></SelectTrigger>
            <SelectContent>
              {(() => {
                const allowedDays = new Set<string>();
                availability.forEach(a => {
                  if (
                    a.tutorId === tutorId &&
                    a.type === "weekly" &&
                    lessonMode &&
                    Array.isArray(a.lessonType) &&
                    a.lessonType.includes(normalizeMode(lessonMode))
                  ) {
                    allowedDays.add(String(a.day).toLowerCase().trim());
                  }
                });
                return daysOfWeek
                  .filter(d => allowedDays.has(d.value.toLowerCase()))
                  .map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ));
              })()}
            </SelectContent>
          </Select>

          <Label>Godzina</Label>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger><SelectValue placeholder="Wybierz godzinę" /></SelectTrigger>
            <SelectContent>
              {tutorId && lessonMode && duration && day &&
                getAvailableSlots("weekly")
                  .sort((a, b) => {
                    const [ah, am] = (a || "").split(":").map(Number);
                    const [bh, bm] = (b || "").split(":").map(Number);
                    return ah * 60 + am - (bh * 60 + bm);
                  })
                  .map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))
              }
            </SelectContent>
          </Select>

          <Label>Przedmiot</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue placeholder="Wybierz przedmiot" /></SelectTrigger>
            <SelectContent>
              {subjects.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label>Czas trwania</Label>
          <Select value={duration.toString()} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger><SelectValue placeholder="Wybierz długość" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="60">60 minut</SelectItem>
              <SelectItem value="90">90 minut</SelectItem>
              <SelectItem value="120">120 minut</SelectItem>
            </SelectContent>
          </Select>

          {(currentUser?.accountType === "tutor" || currentUser?.accountType === "admin") && (
            <>
              <label>
                Bufor przed (min):
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={bufferBefore}
                  onChange={e => setBufferBefore(Number(e.target.value))}
                />
              </label>

              <label>
                Bufor po (min):
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={bufferAfter}
                  onChange={e => setBufferAfter(Number(e.target.value))}
                />
              </label>
            </>
          )}

          {(currentUser?.accountType === "parent" || currentUser?.accountType === "tutor" || currentUser?.accountType === "admin") && (
            <>
              <Label>Uczeń</Label>
              <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                <SelectTrigger><SelectValue placeholder="Wybierz ucznia" /></SelectTrigger>
                <SelectContent>
                  {linkedChildren
                    .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName))
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </>
          )}

          <Button disabled={isSubmitting} onClick={() => handleBooking("weekly")}>
            {isSubmitting ? "Przetwarzanie..." : "Zarezerwuj lekcję"}
          </Button>
        </CardContent>
      </Card>

      <Card className="w-full md:w-[calc(50%-0.75rem)]">
        <CardHeader><CardTitle>Rezerwacja jednorazowa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(currentUser?.accountType === "admin" || currentUser?.accountType === "parent" || currentUser?.accountType === "student") && (
            <>
              <Label>Korepetytor</Label>
              <Select value={tutorId} onValueChange={setTutorId}>
                <SelectTrigger><SelectValue placeholder="Wybierz korepetytora" /></SelectTrigger>
                <SelectContent>
                  {tutors.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <Label>Tryb zajęć</Label>
          <Select value={lessonMode} onValueChange={(v) => setLessonMode(v.toLowerCase())}>
            <SelectTrigger>
              <SelectValue placeholder="Wybierz tryb zajęć" />
            </SelectTrigger>
            <SelectContent>
              {currentUser &&
                (currentUser.accountType === "student" || currentUser.accountType === "parent" ? (
                  <>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="u korepetytora">U korepetytora</SelectItem>
                  </>
                ) : null)}
              {currentUser &&
                (currentUser.accountType === "tutor" || currentUser.accountType === "admin" ? (
                  <>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="u korepetytora">U korepetytora</SelectItem>
                    <SelectItem value="z dojazdem do ucznia">Z dojazdem do ucznia</SelectItem>
                  </>
                ) : null)}
            </SelectContent>
          </Select>

          <Label>Data</Label>
          <Select value={specificDate} onValueChange={setSpecificDate}>
            <SelectTrigger><SelectValue placeholder="Wybierz datę" /></SelectTrigger>
            <SelectContent>
              {getAvailableDates().map(date => (
                <SelectItem key={date} value={date}>{formatPolishDate(date || "")}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label>Godzina</Label>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger><SelectValue placeholder="Wybierz godzinę" /></SelectTrigger>
            <SelectContent>
              {tutorId && lessonMode && duration && specificDate &&
                getAvailableSlots("one-time")
                  .sort((a, b) => {
                    const [ah, am] = (a || "").split(":").map(Number);
                    const [bh, bm] = (b || "").split(":").map(Number);
                    return ah * 60 + am - (bh * 60 + bm);
                  })
                  .map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))
              }
            </SelectContent>
          </Select>

          <Label>Przedmiot</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue placeholder="Wybierz przedmiot" /></SelectTrigger>
            <SelectContent>
              {subjects.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label>Czas trwania</Label>
          <Select value={duration.toString()} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger><SelectValue placeholder="Wybierz długość" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="60">60 minut</SelectItem>
              <SelectItem value="90">90 minut</SelectItem>
              <SelectItem value="120">120 minut</SelectItem>
            </SelectContent>
          </Select>

          {(currentUser?.accountType === "tutor" || currentUser?.accountType === "admin") && (
            <>
              <label>Bufor przed (min):
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={bufferBefore}
                  onChange={e => setBufferBefore(Number(e.target.value))}
                />
              </label>

              <label>
                Bufor po (min):
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={bufferAfter}
                  onChange={e => setBufferAfter(Number(e.target.value))}
                />
              </label>
            </>
          )}

          {(currentUser?.accountType === "parent" || currentUser?.accountType === "tutor" || currentUser?.accountType === "admin") && (
            <>
              <Label>Uczeń</Label>
              <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                <SelectTrigger><SelectValue placeholder="Wybierz ucznia" /></SelectTrigger>
                <SelectContent>
                  {linkedChildren
                    .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName))
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </>
          )}

          {currentUser && currentUser.accountType && ["student", "parent", "tutor", "admin"].includes(currentUser.accountType) && (
            <>
              <Label>Odrobienie lekcji</Label>
              <Select value={makeupForLessonId || ""} onValueChange={setMakeupForLessonId}>
                <SelectTrigger><SelectValue placeholder="Wybierz lekcję do odrobienia" /></SelectTrigger>
                <SelectContent>
                  {bookings
                    .filter(
                      b =>
                        ["cancelled_in_time", "cancelled_by_tutor"].includes(b.status ?? "") &&
                        b.studentId ===
                          (currentUser?.accountType === "student"
                            ? currentUser?.id
                            : selectedChildId)
                    )
                    .sort(
                      (a, b) =>
                        new Date((a.fullDate || "") + "T" + (a.time || "00:00")).getTime() -
                        new Date((b.fullDate || "") + "T" + (b.time || "00:00")).getTime()
                    )
                    .map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {`${b.subject} - ${formatPolishDate(b.fullDate || "")} ${b.time ?? ""}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Button disabled={isSubmitting} onClick={() => handleBooking("one-time")}>
            {isSubmitting ? "Przetwarzanie..." : "Zarezerwuj lekcję"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}