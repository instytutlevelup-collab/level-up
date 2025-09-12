import { initializeApp, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { readFileSync } from "fs"

const serviceAccount = JSON.parse(
  readFileSync(
    new URL("../serviceAccountKey.json", import.meta.url),
    "utf-8"
  )
)

initializeApp({
  credential: cert(serviceAccount),
})

const db = getFirestore()

async function migrateUserDoc(oldId: string, newUid: string) {
  const userRef = db.collection("users").doc(oldId)
  const userSnap = await userRef.get()
  if (!userSnap.exists) {
    console.log(`❌ Nie znaleziono użytkownika o ID: ${oldId}`)
    return
  }
  const userData = userSnap.data()
  if (!userData) {
    console.log(`❌ Dokument użytkownika ${oldId} nie zawiera danych`)
    return
  }
  // Dodaj pole authUid
  const newUserData = { ...userData, authUid: newUid }
  const newUserRef = db.collection("users").doc(newUid)
  await newUserRef.set(newUserData)

  // Kopiuj subkolekcje
  const subcollections = await userRef.listCollections()
  for (const subcollection of subcollections) {
    const subcollectionDocs = await subcollection.get()
    for (const doc of subcollectionDocs.docs) {
      const docData = doc.data()
      const newSubcollectionRef = newUserRef.collection(subcollection.id).doc(doc.id)
      await newSubcollectionRef.set(docData)
    }
  }

  await userRef.delete()
  console.log(`✅ Przeniesiono użytkownika ${oldId} ➡️ ${newUid}`)
}

async function migrateStudentId(oldId: string, newUid: string) {
  // Najpierw migracja dokumentu użytkownika
  await migrateUserDoc(oldId, newUid)

  const bookingsRef = db.collection("bookings")
  const snapshot = await bookingsRef.where("studentId", "==", oldId).get()

  if (snapshot.empty) {
    console.log(`❌ Brak lekcji ze studentId = ${oldId}`)
    return
  }

  console.log(`🔄 Znaleziono ${snapshot.size} lekcji. Aktualizacja...`)

  const batch = db.batch()

  snapshot.docs.forEach((doc) => {
    const ref = bookingsRef.doc(doc.id)
    batch.update(ref, { studentId: newUid })
  })

  await batch.commit()
  console.log(`✅ Zaktualizowano wszystkie lekcje. studentId = ${newUid}`)
}

// 👉 uruchamiasz z parametrami
//    np. ts-node scripts/migrate-student-id.ts OLD_ID NEW_UID
const [,, oldId, newUid] = process.argv

if (!oldId || !newUid) {
  console.error("❌ Podaj oba parametry: OLD_ID NEW_UID")
  process.exit(1)
}

migrateStudentId(oldId, newUid).catch((err) => {
  console.error("Błąd migracji:", err)
})