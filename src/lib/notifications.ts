"use client"

import type { Firestore } from "firebase/firestore"

let db!: Firestore;
if (typeof window !== "undefined") {
  (async () => {
    const firebaseModule = await import("./firebase")
    db = firebaseModule.db
  })()
}
import { addDoc, collection, serverTimestamp, getDocs, query, where, updateDoc, doc } from "firebase/firestore"

// Dodanie powiadomienia dla wybranego użytkownika
export const addNotification = async (recipientId: string, message: string) => {
  try {
    await addDoc(collection(db, "notifications"), {
      recipientId,
      message,
      createdAt: serverTimestamp(),
      read: false,
    })
  } catch (err) {
    console.error("Błąd przy dodawaniu powiadomienia:", err)
  }
}

// Pobranie powiadomień dla użytkownika
export const getNotificationsForUser = async (userId: string) => {
  try {
    const q = query(collection(db, "notifications"), where("recipientId", "==", userId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error("Błąd przy pobieraniu powiadomień:", err)
    return []
  }
}

// Oznaczenie powiadomienia jako przeczytane
export const markAsRead = async (notificationId: string) => {
  try {
    const ref = doc(db, "notifications", notificationId)
    await updateDoc(ref, { read: true })
  } catch (err) {
    console.error("Błąd przy oznaczaniu powiadomienia jako przeczytane:", err)
  }
}

// (opcjonalnie) funkcja pobierania rodzica powiązanego ze studentem
export const getParentOfStudent = async (studentId: string) => {
  try {
    const studentSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", studentId)))
    if (studentSnap.empty) return null
    const studentData = studentSnap.docs[0].data()
    const parentEmail = studentData.parentEmail
    if (!parentEmail) return null
    const q = query(collection(db, "users"), where("accountType", "==", "parent"), where("email", "==", parentEmail))
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
    }
    return null
  } catch (err) {
    console.error("Błąd przy pobieraniu rodzica:", err)
    return null
  }
}

// Powiadomienia o zarezerwowanej lekcji
export const notifyBooking = async ({
  booking,
}: {
  booking: { id: string; studentId: string; tutorId?: string; studentName: string; fullDate?: string; time?: string; createdByRole: string },
}) => {
  const dateTime = booking.fullDate && booking.time ? ` (${booking.fullDate} ${booking.time})` : '';
  const message = `Lekcja${dateTime} została zarezerwowana`;
  try {
    const parent = await getParentOfStudent(booking.studentId);
    switch (booking.createdByRole) {
      case "student":
        if (parent) await addNotification(parent.id, message);
        if (booking.tutorId) await addNotification(booking.tutorId, message);
        break;
      case "tutor":
        if (parent) await addNotification(parent.id, message);
        await addNotification(booking.studentId, message);
        break;
      case "parent":
        await addNotification(booking.studentId, message);
        if (booking.tutorId) await addNotification(booking.tutorId, message);
        break;
      case "admin":
        await addNotification(booking.studentId, message);
        if (parent) await addNotification(parent.id, message);
        if (booking.tutorId) await addNotification(booking.tutorId, message);
        break;
    }
  } catch (err) {
    console.error("Błąd przy wysyłaniu powiadomienia o rezerwacji:", err);
  }
}

// Powiadomienia o odwołanej lekcji
export const notifyCancellation = async ({
  booking,
}: {
  booking: { id: string; studentId: string; tutorId?: string; studentName: string; fullDate?: string; time?: string; createdByRole: string },
}) => {
  const dateTime = booking.fullDate && booking.time ? ` (${booking.fullDate} ${booking.time})` : '';
  const message = `Lekcja${dateTime} została odwołana`;

  try {
    const parent = await getParentOfStudent(booking.studentId);

    switch (booking.createdByRole) {
      case "student":
        // Do rodzica i korepetytora
        if (parent?.id) await addNotification(parent.id, message);
        if (booking.tutorId) await addNotification(booking.tutorId, message);
        break;

      case "tutor":
        // Do ucznia i rodzica
        await addNotification(booking.studentId, message);
        if (parent?.id) await addNotification(parent.id, message);
        break;

      case "parent":
        // Do ucznia i korepetytora
        await addNotification(booking.studentId, message);
        if (booking.tutorId) await addNotification(booking.tutorId, message);
        break;

      case "admin":
        // Do wszystkich powiązanych: uczeń, rodzic, korepetytor
        await addNotification(booking.studentId, message);
        if (parent?.id) await addNotification(parent.id, message);
        if (booking.tutorId) await addNotification(booking.tutorId, message);
        break;

      default:
        console.warn("Nieznana rola przy odwołaniu lekcji:", booking.createdByRole);
        break;
    }
  } catch (err) {
    console.error("Błąd przy wysyłaniu powiadomienia o odwołaniu lekcji:", err);
  }
}