"use client"

import { useState, useEffect } from "react"
import { db, auth } from "@/lib/firebase"
import { doc, updateDoc, addDoc, collection, serverTimestamp, getDocs, query, where } from "firebase/firestore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface Student {
  id: string
  firstName?: string
  lastName?: string
  studentName?: string
  canCancel?: boolean
  canBook?: boolean
}

interface StudentsPageProps {
  studentsList?: Student[]
}

export default function StudentsPage({ studentsList = [] }: StudentsPageProps) {
  const [students, setStudents] = useState<Student[]>(studentsList)
  const [error, setError] = useState("")
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [editedPermissions, setEditedPermissions] = useState<Record<string, { canCancel: boolean; canBook: boolean }>>({})
  const [showForm, setShowForm] = useState(false)
  const [newStudent, setNewStudent] = useState({
    firstName: "",
    lastName: "",
    email: "",
    school: "",
    classLevel: "",
    subjects: "",
  })

  useEffect(() => {
    const fetchStudents = async () => {
      if (!auth.currentUser) return
      try {
        const q = query(collection(db, "users"), where("parentId", "==", auth.currentUser.uid))
        const querySnapshot = await getDocs(q)
        const fetchedStudents: Student[] = []
        querySnapshot.forEach((doc) => {
          const data = doc.data()
          fetchedStudents.push({
            id: doc.id,
            firstName: data.firstName,
            lastName: data.lastName,
            studentName: data.studentName,
            canCancel: data.canCancel,
            canBook: data.canBook,
          })
        })
        setStudents(fetchedStudents)
      } catch (e) {
        setError("Błąd podczas pobierania uczniów.")
        console.error(e)
      }
    }
    fetchStudents()
  }, [])

  const handlePermissionToggle = async (student: Student, permission: "canCancel" | "canBook", value: boolean) => {
    try {
      const studentRef = doc(db, "users", student.id)
      await updateDoc(studentRef, { [permission]: value })

      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, [permission]: value } : s))
      )
    } catch (e) {
      setError("Błąd podczas aktualizacji uprawnień dziecka.")
      console.error(e)
    }
  }

  // Dodawanie nowego ucznia przez rodzica
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      if (!auth.currentUser) {
        setError("Musisz być zalogowany.")
        return
      }

      const docRef = await addDoc(collection(db, "users"), {
        firstName: newStudent.firstName,
        lastName: newStudent.lastName,
        email: newStudent.email,
        school: newStudent.school,
        classLevel: newStudent.classLevel,
        subjects: newStudent.subjects.split(",").map((s) => s.trim()).filter(Boolean),
        accountType: "student",
        acceptedTerms: true,
        acceptedTermsAt: new Date().toISOString(),
        parentId: auth.currentUser.uid,
        parentEmail: auth.currentUser.email,
        createdAt: serverTimestamp(),
        canBook: false,
        canCancel: false,
        authUid: null,
      })
      const uid = docRef.id

      setStudents((prev) => [
        ...prev,
        {
          id: uid,
          firstName: newStudent.firstName,
          lastName: newStudent.lastName,
          canBook: false,
          canCancel: false,
          authUid: null,
        },
      ])
      setShowForm(false)
      setNewStudent({
        firstName: "",
        lastName: "",
        email: "",
        school: "",
        classLevel: "",
        subjects: "",
      })
    } catch (e: unknown) {
      setError("Błąd podczas dodawania ucznia.")
      if (e instanceof Error) {
        console.error(e.message)
      } else {
        console.error(e)
      }
    }
  }

  // Opcje klas w zależności od szkoły
  const getClassOptions = () => {
    switch (newStudent.school) {
      case "szkoła podstawowa":
        return Array.from({ length: 8 }, (_, i) => `klasa ${i + 1}`)
      case "liceum":
        return Array.from({ length: 4 }, (_, i) => `klasa ${i + 1}`)
      case "technikum":
        return Array.from({ length: 5 }, (_, i) => `klasa ${i + 1}`)
      default:
        return []
    }
  }

  return (
    <div className="w-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Twoje dzieci</CardTitle>
          <CardDescription>Możesz modyfikować uprawnienia powiązanych uczniów</CardDescription>
        </CardHeader>
        <CardContent className="w-full">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {students.length === 0 ? (
            <p className="text-gray-600">Brak powiązanych uczniów.</p>
          ) : (
            <ul className="w-full space-y-4">
              {students.map((student) => {
                const isEditing = editingStudentId === student.id
                const permissions = isEditing
                  ? editedPermissions[student.id] || { canCancel: student.canCancel || false, canBook: student.canBook || false }
                  : { canCancel: student.canCancel || false, canBook: student.canBook || false }

                const displayName = [student.firstName, student.lastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || (student.studentName ?? "").trim() || "—"

                const onCheckboxChange = (permission: "canCancel" | "canBook", value: boolean) => {
                  setEditedPermissions((prev) => ({
                    ...prev,
                    [student.id]: {
                      ...prev[student.id],
                      [permission]: value,
                    },
                  }))
                }

                const onEditClick = () => {
                  setEditingStudentId(student.id)
                  setEditedPermissions((prev) => ({
                    ...prev,
                    [student.id]: { canCancel: student.canCancel || false, canBook: student.canBook || false },
                  }))
                }

                const onSaveClick = async () => {
                  if (!editedPermissions[student.id]) return
                  try {
                    const { canCancel, canBook } = editedPermissions[student.id]
                    if (canCancel !== student.canCancel) {
                      await handlePermissionToggle(student, "canCancel", canCancel)
                    }
                    if (canBook !== student.canBook) {
                      await handlePermissionToggle(student, "canBook", canBook)
                    }
                    setEditingStudentId(null)
                  } catch {
                    // error handling already in handlePermissionToggle
                  }
                }

                return (
                  <li
                    key={student.id}
                    className="border rounded p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <strong>{displayName}</strong>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`cancel-${student.id}`}
                          checked={permissions.canCancel}
                          disabled={!isEditing}
                          onCheckedChange={(val) => onCheckboxChange("canCancel", Boolean(val))}
                        />
                        <Label htmlFor={`cancel-${student.id}`}>Może odwoływać lekcje</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`book-${student.id}`}
                          checked={permissions.canBook}
                          disabled={!isEditing}
                          onCheckedChange={(val) => onCheckboxChange("canBook", Boolean(val))}
                        />
                        <Label htmlFor={`book-${student.id}`}>Może rezerwować lekcje</Label>
                      </div>
                      {!isEditing ? (
                        <Button
                          type="button"
                          className="bg-blue-100 text-blue-700 hover:bg-blue-200"
                          onClick={onEditClick}
                        >
                          Edytuj
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className="bg-green-100 text-green-700 hover:bg-green-200"
                          onClick={onSaveClick}
                        >
                          Zapisz
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {/* Dodaj ucznia */}
          <div className="mt-6">
            {!showForm ? (
              <Button
                type="button"
                className="bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => setShowForm(true)}
              >
                Dodaj ucznia
              </Button>
            ) : (
              <form onSubmit={handleAddStudent} className="border rounded p-4 mt-4 space-y-3 bg-gray-50">
                <div>
                  <Label htmlFor="firstName">Imię</Label>
                  <input
                    id="firstName"
                    type="text"
                    className="block w-full border rounded px-2 py-1 mt-1"
                    value={newStudent.firstName}
                    onChange={(e) => setNewStudent((prev) => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nazwisko</Label>
                  <input
                    id="lastName"
                    type="text"
                    className="block w-full border rounded px-2 py-1 mt-1"
                    value={newStudent.lastName}
                    onChange={(e) => setNewStudent((prev) => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <input
                    id="email"
                    type="email"
                    className="block w-full border rounded px-2 py-1 mt-1"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="school">Szkoła</Label>
                  <select
                    id="school"
                    className="block w-full border rounded px-2 py-1 mt-1"
                    value={newStudent.school}
                    onChange={(e) => setNewStudent((prev) => ({ ...prev, school: e.target.value, classLevel: "" }))}
                  >
                    <option value="">Wybierz szkołę</option>
                    <option value="szkoła podstawowa">szkoła podstawowa</option>
                    <option value="liceum">liceum</option>
                    <option value="technikum">technikum</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="classLevel">Klasa</Label>
                  <select
                    id="classLevel"
                    className="block w-full border rounded px-2 py-1 mt-1"
                    value={newStudent.classLevel}
                    onChange={(e) => setNewStudent((prev) => ({ ...prev, classLevel: e.target.value }))}
                    disabled={!newStudent.school}
                  >
                    {!newStudent.school ? (
                      <option value="">Wybierz szkołę</option>
                    ) : (
                      getClassOptions().map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <Label htmlFor="subjects">Przedmioty (oddziel przecinkami)</Label>
                  <input
                    id="subjects"
                    type="text"
                    className="block w-full border rounded px-2 py-1 mt-1"
                    placeholder="matematyka, angielski"
                    value={newStudent.subjects}
                    onChange={(e) => setNewStudent((prev) => ({ ...prev, subjects: e.target.value }))}
                  />
                </div>
                <div className="flex gap-3 mt-2">
                  <Button type="submit" className="bg-green-500 text-white hover:bg-green-600">
                    Zapisz
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Anuluj
                  </Button>
                </div>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}