'use client'

import React, { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  accountType: string
  canEditLinks?: boolean
  canCancel?: boolean
  canBook?: boolean
  subjects?: string[]
  linkedAccounts?: { studentName: string }[]
}

export default function AllUsersSection() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [filterRole, setFilterRole] = useState<string>('all')
  const roles = ['admin', 'teacher', 'student', 'parent']

  useEffect(() => {
    const fetchUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const usersList = usersSnapshot.docs.map(docSnap => {
        const data = docSnap.data() as Omit<User, 'id'>
        return { id: docSnap.id, ...data }
      })
      setUsers(usersList)
    }

    fetchUsers()
  }, [])

  const filteredUsers = filterRole === 'all' ? users : users.filter(user => user.accountType === filterRole)

  const handleDeleteClick = async (id: string) => {
    await deleteDoc(doc(db, 'users', id))
    setUsers(prev => prev.filter(user => user.id !== id))
  }

  const handleSave = async () => {
    if (!selectedUser) return

    const { id, ...data } = selectedUser
    // Ensure canCancel and canBook are included in the update
    await updateDoc(doc(db, 'users', id), data)
    setIsEditDialogOpen(false)
  }

  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setIsEditDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Zarządzanie użytkownikami</h2>

      {/* Filtrowanie */}
      <div className="mb-4 flex items-center gap-4">
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-48">
            <SelectValue>{filterRole === 'all' ? 'Wszystkie role' : filterRole}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie role</SelectItem>
            {roles.map(role => (
              <SelectItem key={role} value={role}>{role}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-600">Liczba użytkowników: {filteredUsers.length}</span>
      </div>

      {/* Lista użytkowników */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredUsers.map(user => (
          <Card
            key={user.id}
            className="cursor-pointer hover:shadow-md"
            onClick={() => openEditDialog(user)}
          >
            <CardHeader>
              <CardTitle>{user.firstName} {user.lastName}</CardTitle>
            </CardHeader>
            <CardContent>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Rola:</strong> {user.accountType}</p>
              {user.subjects && user.subjects.length > 0 && (
                <p><strong>Przedmioty:</strong> {user.subjects.join(', ')}</p>
              )}
              {user.accountType === 'student' && (
                <>
                  <p><strong>Może odwoływać lekcje:</strong> {user.canCancel ? 'Tak' : 'Nie'}</p>
                  <p><strong>Może rezerwować lekcje:</strong> {user.canBook ? 'Tak' : 'Nie'}</p>
                </>
              )}
              {user.accountType === 'parent' && user.linkedAccounts && user.linkedAccounts.length > 0 && (
                <p><strong>Powiązani uczniowie:</strong> {user.linkedAccounts.map((acc: { studentName: string }) => acc.studentName).join(', ')}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog edycji użytkownika */}
      {selectedUser && isEditDialogOpen && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edycja użytkownika</DialogTitle>
            </DialogHeader>
            {/* Przykładowe pola formularza edycji użytkownika */}
            <div className="flex flex-col gap-2">
              <label>
                Imię:
                <Input
                  value={selectedUser.firstName}
                  onChange={e =>
                    setSelectedUser(prev =>
                      prev ? { ...prev, firstName: e.target.value } : prev
                    )
                  }
                />
              </label>
              <label>
                Nazwisko:
                <Input
                  value={selectedUser.lastName}
                  onChange={e =>
                    setSelectedUser(prev =>
                      prev ? { ...prev, lastName: e.target.value } : prev
                    )
                  }
                />
              </label>
              <label>
                Email:
                <Input
                  value={selectedUser.email}
                  onChange={e =>
                    setSelectedUser(prev =>
                      prev ? { ...prev, email: e.target.value } : prev
                    )
                  }
                />
              </label>
              <label>
                Rola:
                <Select value={selectedUser.accountType} onValueChange={value =>
                  setSelectedUser(prev =>
                    prev ? { ...prev, accountType: value } : prev
                  )
                }>
                  <SelectTrigger>
                    <SelectValue>{selectedUser.accountType}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              {/* Pole wyboru canEditLinks dla nauczyciela */}
              {selectedUser?.accountType === 'tutor' && (
                <div className="flex items-center gap-2 mt-4">
                  <label htmlFor="canEditLinks" className="text-sm font-medium">
                    Może edytować linki:
                  </label>
                  <input
                    id="canEditLinks"
                    type="checkbox"
                    checked={selectedUser.canEditLinks || false}
                    onChange={e =>
                      setSelectedUser(prev =>
                        prev ? { ...prev, canEditLinks: e.target.checked } : prev
                      )
                    }
                  />
                </div>
              )}
              {/* Pola wyboru dla ucznia */}
              {selectedUser?.accountType === 'student' && (
                <div className="flex flex-col gap-2 mt-4">
                  <div className="flex items-center gap-2">
                    <input
                      id="canCancel"
                      type="checkbox"
                      checked={selectedUser.canCancel ?? false}
                      onChange={e =>
                        setSelectedUser(prev =>
                          prev ? { ...prev, canCancel: e.target.checked } : prev
                        )
                      }
                    />
                    <label htmlFor="canCancel" className="text-sm font-medium">
                      Może samodzielnie odwoływać lekcje
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="canBook"
                      type="checkbox"
                      checked={selectedUser.canBook ?? false}
                      onChange={e =>
                        setSelectedUser(prev =>
                          prev ? { ...prev, canBook: e.target.checked } : prev
                        )
                      }
                    />
                    <label htmlFor="canBook" className="text-sm font-medium">
                      Może samodzielnie rezerwować lekcje
                    </label>
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <Button onClick={handleSave}>Zapisz</Button>
                <Button variant="secondary" onClick={() => setIsEditDialogOpen(false)}>Anuluj</Button>
                <Button variant="destructive" onClick={() => { if (selectedUser) { handleDeleteClick(selectedUser.id); setIsEditDialogOpen(false); } }}>Usuń użytkownika</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
