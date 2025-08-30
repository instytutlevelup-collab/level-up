'use client'

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  accountType: string;
}

interface Availability {
  id: string;
  isEditing: boolean;
  tutorId: string;
  tutorName: string;
  date: string;
  day?: string;
  startTime: string;
  endTime: string;
  type: "weekly" | "one-time";
  status: string;
  lessonType: string[];
}

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { db, auth } from "@/lib/firebase"
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  updateDoc
} from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

const daysOfWeek = [
  { label: "Poniedziałek", value: "monday" },
  { label: "Wtorek", value: "tuesday" },
  { label: "Środa", value: "wednesday" },
  { label: "Czwartek", value: "thursday" },
  { label: "Piątek", value: "friday" },
  { label: "Sobota", value: "saturday" },
  { label: "Niedziela", value: "sunday" },
]

export default function AvailabilityPage() {
  const [currentUser, setCurrentUser] = useState<UserData | null>(null)
  const [weeklyAvailability, setWeeklyAvailability] = useState<Availability[]>([])
  const [oneTimeAvailability, setOneTimeAvailability] = useState<Availability[]>([])
  const router = useRouter()

  const [weeklyDay, setWeeklyDay] = useState("")
  const [weeklyStart, setWeeklyStart] = useState("")
  const [weeklyEnd, setWeeklyEnd] = useState("")

  const [oneTimeDate, setOneTimeDate] = useState("")
  const [oneTimeStart, setOneTimeStart] = useState("")
  const [oneTimeEnd, setOneTimeEnd] = useState("")

  // NEW: selected lesson type for mode (now supports multiple)
  const [selectedLessonType, setSelectedLessonType] = useState<string[]>([])

  // Usunięto stany i funkcje związane z buforami i listą uczniów dla buforów

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/auth/login"
        return
      }

      try {
        const userDocRef = doc(db, "users", user.uid)
        const userDocSnap = await getDoc(userDocRef)

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data()
          setCurrentUser({ id: user.uid, ...(userData as Omit<UserData, "id">) })
          if (userData.accountType === "tutor") {
            await loadTutorAvailability(user.uid)
          } else {
            router.replace("/booking")
          }
        } else {
          alert("Nie znaleziono użytkownika w bazie danych.")
        }
      } catch (error) {
        console.error("Błąd podczas pobierania danych użytkownika:", error)
        alert("Wystąpił błąd przy pobieraniu danych użytkownika.")
      }
    })

    return () => unsubscribe()
  }, [router])

  const loadTutorAvailability = async (tutorId: string) => {
    const q = query(collection(db, "availability"), where("tutorId", "==", tutorId))
    const snapshot = await getDocs(q)
    const all: Availability[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      isEditing: false,
      ...(doc.data() as Omit<Availability, "id" | "isEditing">),
    }))
    // Sort helper: by date, then by startTime
    const sortByDateAndTime = (a: Availability, b: Availability) => {
      // Compare by date first
      if (a.date < b.date) return -1
      if (a.date > b.date) return 1
      // If date equal, compare by startTime
      if (a.startTime < b.startTime) return -1
      if (a.startTime > b.startTime) return 1
      return 0
    }
    setWeeklyAvailability(
      all.filter(item => item.type === "weekly").sort(sortByDateAndTime)
    )
    setOneTimeAvailability(
      all.filter(item => item.type === "one-time").sort(sortByDateAndTime)
    )
  }

  const addWeekly = async () => {
    if (!weeklyDay || !weeklyStart || !weeklyEnd || !currentUser) {
      alert("Uzupełnij wszystkie pola")
      return
    }

    try {
      const settingsSnap = await getDocs(collection(db, "settings"))
      if (settingsSnap.empty) {
        alert("Brak ustawień roku szkolnego")
        return
      }
      const schoolYear = settingsSnap.docs[0].data()
      const startDate = new Date(schoolYear.startDate)
      const endDate = new Date(schoolYear.endDate)

      const dayMap: { [key: string]: number } = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
        sunday: 0
      }

      const dates: string[] = []
      const current = new Date(startDate)
      while (current <= endDate) {
        if (current.getDay() === dayMap[weeklyDay]) {
          dates.push(current.toISOString().split("T")[0])
        }
        current.setDate(current.getDate() + 1)
      }

      const batch = dates.map(date =>
        addDoc(collection(db, "availability"), {
          tutorId: currentUser.id,
          tutorName: `${currentUser.firstName} ${currentUser.lastName}`,
          date,
          day: weeklyDay,
          startTime: weeklyStart,
          endTime: weeklyEnd,
          type: "weekly",
          status: "available",
          lessonType: selectedLessonType, // <-- Now an array
        })
      )

      await Promise.all(batch)

      setWeeklyDay("")
      setWeeklyStart("")
      setWeeklyEnd("")
      // setSelectedLessonModes([]) // removed unused state
      setSelectedLessonType([]) // reset to empty array
      await loadTutorAvailability(currentUser.id)
    } catch (error) {
      console.error("Błąd dodawania dostępności:", error)
      alert("Wystąpił błąd przy dodawaniu dostępności.")
    }
  }

  const addOneTime = async () => {
    if (!oneTimeDate || !oneTimeStart || !oneTimeEnd || !currentUser) {
      alert("Uzupełnij wszystkie pola")
      return
    }

    try {
      await addDoc(collection(db, "availability"), {
        tutorId: currentUser.id,
        tutorName: `${currentUser.firstName} ${currentUser.lastName}`,
        date: oneTimeDate,
        startTime: oneTimeStart,
        endTime: oneTimeEnd,
        type: "one-time",
        status: "available",
        lessonType: selectedLessonType, // <-- Now an array
      })

      setOneTimeDate("")
      setOneTimeStart("")
      setOneTimeEnd("")
      // setSelectedLessonModes([]) // removed unused state
      setSelectedLessonType([]) // reset to empty array
      await loadTutorAvailability(currentUser.id)
    } catch (error) {
      console.error("Błąd dodawania dostępności:", error)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, "availability", id))
    if (currentUser) {
      await loadTutorAvailability(currentUser.id)
    }
  }

  // Edycja dostępności
  const handleEdit = async (item: Availability, type: "weekly" | "one-time") => {
    try {
      await updateDoc(doc(db, "availability", item.id), {
        lessonType: item.lessonType,
      })
      // Po udanym zapisie ustaw isEditing na false dla danego elementu
      if (type === "weekly") {
        setWeeklyAvailability(prev =>
          prev.map(i => i.id === item.id ? { ...i, isEditing: false } : i)
        )
      } else {
        setOneTimeAvailability(prev =>
          prev.map(i => i.id === item.id ? { ...i, isEditing: false } : i)
        )
      }
      if (currentUser) {
        await loadTutorAvailability(currentUser.id)
      }
      alert("Dostępność została zaktualizowana.")
      await updateDoc(doc(db, "availability", item.id), {
        lessonType: item.lessonType,
        startTime: item.startTime,
        endTime: item.endTime,
      })
    } catch (error) {
      console.error("Błąd podczas edycji dostępności:", error)
      alert("Wystąpił błąd przy edycji.")
    }
  }

  // Funkcja do przełączania trybu edycji
  const toggleEditing = (id: string, type: "weekly" | "one-time") => {
    if (type === "weekly") {
      setWeeklyAvailability(prev =>
        prev.map(item =>
          item.id === id ? { ...item, isEditing: !item.isEditing } : item
        )
      )
    } else {
      setOneTimeAvailability(prev =>
        prev.map(item =>
          item.id === id ? { ...item, isEditing: !item.isEditing } : item
        )
      )
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "EEEE, d MMMM yyyy", { locale: pl })
    } catch {
      return dateStr
    }
  }

  // Usunięto toggleTravelDay (niepotrzebne bez buforów i travelDays)

  if (!currentUser) return <p className="p-4">Ładowanie danych użytkownika...</p>
  if (currentUser.accountType !== "tutor") return null

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-12">

      {/* Dodawanie cykliczne */}
      <Card>
        <CardHeader>
          <CardTitle>Dodaj dostępność cykliczną (co tydzień)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Dzień tygodnia</Label>
            <Select value={weeklyDay} onValueChange={setWeeklyDay}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz dzień" />
              </SelectTrigger>
              <SelectContent>
                {daysOfWeek.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Od (godzina)</Label>
              <Input type="time" value={weeklyStart} onChange={(e) => setWeeklyStart(e.target.value)} />
            </div>
            <div>
              <Label>Do (godzina)</Label>
              <Input type="time" value={weeklyEnd} onChange={(e) => setWeeklyEnd(e.target.value)} />
            </div>
          </div>
          {/* NEW: Select lesson type as checkboxes */}
          <div className="mt-4">
            <Label>Tryb zajęć (możesz zaznaczyć kilka):</Label>
            <div className="flex flex-wrap gap-4 mt-2">
              {[
                { value: "online", label: "Online" },
                { value: "tutorPlace", label: "U korepetytora" },
                { value: "travel", label: "Dojazd do ucznia" },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={selectedLessonType.includes(opt.value)}
                    onChange={() => {
                      if (selectedLessonType.includes(opt.value)) {
                        setSelectedLessonType(selectedLessonType.filter(t => t !== opt.value))
                      } else {
                        setSelectedLessonType([...selectedLessonType, opt.value])
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={addWeekly}>Dodaj cykliczną dostępność</Button>
        </CardContent>
      </Card>

      {/* Dodawanie jednorazowe */}
      <Card>
        <CardHeader>
          <CardTitle>Dodaj dostępność jednorazową</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Data</Label>
            <Input type="date" value={oneTimeDate} onChange={(e) => setOneTimeDate(e.target.value)} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Od (godzina)</Label>
              <Input type="time" value={oneTimeStart} onChange={(e) => setOneTimeStart(e.target.value)} />
            </div>
            <div>
              <Label>Do (godzina)</Label>
              <Input type="time" value={oneTimeEnd} onChange={(e) => setOneTimeEnd(e.target.value)} />
            </div>
          </div>
          {/* NEW: Select lesson type as checkboxes */}
          <div className="mt-4">
            <Label>Tryb zajęć (możesz zaznaczyć kilka):</Label>
            <div className="flex flex-wrap gap-4 mt-2">
              {[
                { value: "online", label: "Online" },
                { value: "tutorPlace", label: "U korepetytora" },
                { value: "travel", label: "Dojazd do ucznia" },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={selectedLessonType.includes(opt.value)}
                    onChange={() => {
                      if (selectedLessonType.includes(opt.value)) {
                        setSelectedLessonType(selectedLessonType.filter(t => t !== opt.value))
                      } else {
                        setSelectedLessonType([...selectedLessonType, opt.value])
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={addOneTime}>Dodaj jednorazową dostępność</Button>
        </CardContent>
      </Card>


      {/* Lista cyklicznych */}
      <Card>
        <CardHeader>
          <CardTitle>Cykliczne dostępności</CardTitle>
        </CardHeader>
        <CardContent>
          {weeklyAvailability.length === 0 ? (
            <p className="text-gray-500">Brak cyklicznych dostępności</p>
          ) : (
            <ul className="space-y-2">
              {weeklyAvailability.map((item) => (
                <li key={item.id} className="flex flex-col md:flex-row justify-between items-start md:items-center border p-3 rounded-md">
                  <div className="w-full md:w-auto">
                    <strong>{formatDate(item.date)}</strong>
{item.isEditing ? (
  <div className="flex gap-2 mt-1">
    <Input
      type="time"
      value={item.startTime}
      onChange={(e) =>
        setWeeklyAvailability((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, startTime: e.target.value } : i
          )
        )
      }
    />
    <Input
      type="time"
      value={item.endTime}
      onChange={(e) =>
        setWeeklyAvailability((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, endTime: e.target.value } : i
          )
        )
      }
    />
  </div>
) : (
  <span> {item.startTime} - {item.endTime}</span>
)}
                    <div className="text-sm text-gray-600 mt-1">
                      Tryby lekcji:
                      <div className="flex gap-3 mt-1">
                        {(() => {
                          // Show all possible modes regardless of what was originally saved
                          const allModes = [
                            { value: "online", label: "Online" },
                            { value: "tutorPlace", label: "U korepetytora" },
                            { value: "travel", label: "Dojazd do ucznia" },
                          ];
                          // Toggle function for weekly
                          const toggleLessonTypeWeekly = (id: string, mode: string) => {
                            if (!item.isEditing) return;
                            let updated;
                            if (item.lessonType?.includes(mode)) {
                              updated = (item.lessonType || []).filter((m: string) => m !== mode);
                            } else {
                              updated = [...(item.lessonType || []), mode];
                            }
                            setWeeklyAvailability(prev =>
                              prev.map(i => i.id === id ? { ...i, lessonType: updated } : i)
                            );
                          };
                          return allModes.map(opt => (
                            <label key={opt.value} className="flex items-center gap-1 text-sm">
                              <input
                                type="checkbox"
                                disabled={!item.isEditing}
                                checked={item.lessonType?.includes(opt.value)}
                                onChange={() => toggleLessonTypeWeekly(item.id, opt.value)}
                              />
                              {opt.label}
                            </label>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 md:mt-0">
                    {!item.isEditing ? (
                      <Button variant="outline" size="sm" onClick={() => toggleEditing(item.id, "weekly")}>Edytuj</Button>
                    ) : (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => handleEdit(item, "weekly")}>Zapisz</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>Usuń</Button>
                        <Button variant="outline" size="sm" onClick={() => toggleEditing(item.id, "weekly")}>Anuluj</Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Lista jednorazowych */}
      <Card>
        <CardHeader>
          <CardTitle>Jednorazowe dostępności</CardTitle>
        </CardHeader>
        <CardContent>
          {oneTimeAvailability.length === 0 ? (
            <p className="text-gray-500">Brak jednorazowych dostępności</p>
          ) : (
            <ul className="space-y-2">
              {oneTimeAvailability.map((item) => (
                <li key={item.id} className="flex flex-col md:flex-row justify-between items-start md:items-center border p-3 rounded-md">
                  <div className="w-full md:w-auto">
                    <strong>{formatDate(item.date)}</strong>
{item.isEditing ? (
  <div className="flex gap-2 mt-1">
    <Input
      type="time"
      value={item.startTime}
      onChange={(e) =>
        setOneTimeAvailability((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, startTime: e.target.value } : i
          )
        )
      }
    />
    <Input
      type="time"
      value={item.endTime}
      onChange={(e) =>
        setWeeklyAvailability((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, endTime: e.target.value } : i
          )
        )
      }
    />
  </div>
) : (
  <span> {item.startTime} - {item.endTime}</span>
)}
                    <div className="text-sm text-gray-600 mt-1">
                      Tryby lekcji:
                      <div className="flex gap-3 mt-1">
                        {(() => {
                          // Show all possible modes regardless of what was originally saved
                          const allModes = [
                            { value: "online", label: "Online" },
                            { value: "tutorPlace", label: "U korepetytora" },
                            { value: "travel", label: "Dojazd do ucznia" },
                          ];
                          // Toggle function for one-time
                          const toggleLessonTypeOneTime = (id: string, mode: string) => {
                            if (!item.isEditing) return;
                            let updated;
                            if (item.lessonType?.includes(mode)) {
                              updated = (item.lessonType || []).filter((m: string) => m !== mode);
                            } else {
                              updated = [...(item.lessonType || []), mode];
                            }
                            setOneTimeAvailability(prev =>
                              prev.map(i => i.id === id ? { ...i, lessonType: updated } : i)
                            );
                          };
                          return allModes.map(opt => (
                            <label key={opt.value} className="flex items-center gap-1 text-sm">
                              <input
                                type="checkbox"
                                disabled={!item.isEditing}
                                checked={item.lessonType?.includes(opt.value)}
                                onChange={() => toggleLessonTypeOneTime(item.id, opt.value)}
                              />
                              {opt.label}
                            </label>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 md:mt-0">
                    {!item.isEditing ? (
                      <Button variant="outline" size="sm" onClick={() => toggleEditing(item.id, "one-time")}>Edytuj</Button>
                    ) : (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => handleEdit(item, "one-time")}>Zapisz</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>Usuń</Button>
                        <Button variant="outline" size="sm" onClick={() => toggleEditing(item.id, "one-time")}>Anuluj</Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
