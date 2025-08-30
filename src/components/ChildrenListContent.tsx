"use client"

import { useState } from "react"
import { db } from "@/lib/firebase"
import { doc, updateDoc } from "firebase/firestore"
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
        </CardContent>
      </Card>
    </div>
  )
}