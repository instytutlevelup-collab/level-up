'use client'

// TypeScript interface for notifications used in this component
interface Notification {
  id: string
  message: string
  lessonDate?: { seconds: number }
  createdAt?: { seconds: number }
  read: boolean
}

import { useEffect, useState } from 'react'
import { BellIcon } from 'lucide-react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getNotificationsForUser, markAsRead } from "@/lib/notifications"

export default function UserNavLinks() {
  const [accountType, setAccountType] = useState<string | null>(null)
  const [canBook, setCanBook] = useState<boolean>(false)
  const [loggedIn, setLoggedIn] = useState<boolean>(true)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoggedIn(true)
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          setAccountType(data.accountType || null)
          setCanBook(!!data.canBook)
        }
        const fetchNotifications = async (uid: string) => {
          const raw = await getNotificationsForUser(uid)
          const data: Notification[] = raw.map((n: Partial<Notification> & { id: string }) => ({
            id: n.id,
            message: n.message ?? "",
            lessonDate: n.lessonDate,
            createdAt: n.createdAt,
            read: n.read ?? false
          }))
          data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
          setNotifications(data)
        }
        if (user) fetchNotifications(user.uid)
      } else {
        setLoggedIn(false)
        setAccountType(null)
        setCanBook(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const handleLogout = async () => {
    await signOut(auth)
    setLoggedIn(false)
    router.push('/')
  }

  return (
    <>
      {!loggedIn && (
        <Link
          href="/"
          className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium"
        >
          Strona główna
        </Link>
      )}

      {loggedIn && (
        <>
          <Link
            href="/dashboard"
            className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium"
          >
            Panel główny
          </Link>
          <Link
            href="/lessons"
            className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium"
          >
            Plan lekcji
          </Link>
          {/* Terminy: uczniowie tylko jeśli canBook, rodzic/korepetytor/admin zawsze */}
          {((accountType === 'student' && canBook) ||
            accountType === 'parent' ||
            accountType === 'tutor' ||
            accountType === 'admin') && (
            <Link
              href="/booking"
              className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              Zarerezwuj termin
            </Link>
          )}
                    <Link
            href="/payments"
            className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium"
          >
            Płatności
          </Link>
          {(accountType === 'student' || accountType === 'tutor' || accountType === 'parent') && (
            <>
            </>
          )}
          {accountType === 'tutor' && (
            <>
              <Link
                href="/tutor/availability"
                className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dostępność
              </Link>
              <Link
                href="/tutor/student-links"
                className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Uczniowie
              </Link>
            </>
          )}

          {accountType === 'admin' && (
            <>
              <Link
                href="/admin/users"
                className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Użytkownicy
              </Link>
              <Link
                href="/admin"
                className="text-gray-900 hover:text-gray-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Administracja
              </Link>
            </>
          )}

          <div className="relative inline-block mr-4">
            <button
              className="relative p-2 rounded hover:bg-gray-200"
              onClick={async () => {
                setShowNotifications(prev => !prev)
                if (!showNotifications) {
                  // oznacz wszystkie jako przeczytane
                  for (const n of notifications.filter(n => !n.read)) {
                    await markAsRead(n.id)
                  }
                  setNotifications(prev => prev.map(n => ({ ...n, read: true })))
                }
              }}
            >
              <BellIcon className="w-6 h-6 text-gray-700" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-64 max-h-60 overflow-y-auto bg-white border rounded shadow-lg z-50">
                {notifications.length === 0 ? (
                  <p className="p-2 text-gray-500 text-sm">Brak powiadomień</p>
                ) : (
                  <ul>
                    {notifications.map(n => (
                      <li key={n.id} className="px-3 py-2 border-b last:border-b-0 text-sm">
                        <div>
                          {n.message}
                          {n.lessonDate && (
                            <div className="text-xs text-gray-400">
                              {new Date(n.lessonDate.seconds * 1000).toLocaleString('pl-PL')}
                            </div>
                          )}
                        </div>
                        {n.createdAt && (
                          <div className="text-xs text-gray-400">
                            {n.createdAt.seconds
                              ? new Date(n.createdAt.seconds * 1000).toLocaleString('pl-PL')
                              : ''}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="bg-black text-white hover:bg-gray-800 px-4 py-2 rounded-md text-sm font-medium"
          >
            Wyloguj się
          </button>
        </>
      )}

      {!loggedIn && (
        <Link
          href="/auth/login"
          className="bg-black text-white hover:bg-gray-800 px-4 py-2 rounded-md text-sm font-medium"
        >
          Zaloguj się
        </Link>
      )}
    </>
  )
}