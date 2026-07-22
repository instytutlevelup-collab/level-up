import admin from 'firebase-admin';

// Inicjalizacja z obsługą błędów ESM
try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (e) {
  // Aplikacja jest już zainicjalizowana
}

const db = admin.firestore();

async function fixRecurringField() {
  const collectionRef = db.collection('bookings');
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    console.log('Nie znaleziono żadnych dokumentów w kolekcji /bookings.');
    return;
  }

  console.log(`Znaleziono ${snapshot.size} dokumentów. Rozpoczynam aktualizację...`);

  const batchSize = 500;
  let count = 0;

  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(i, i + batchSize);

    chunk.forEach((doc) => {
      // Zmieniamy na logiczne false (bez cudzysłowu!)
      batch.update(doc.ref, { isRecurring: false });
      count++;
    });

    await batch.commit();
    console.log(`Zaktualizowano ${count} z ${snapshot.size}...`);
  }

  console.log('Sukces! Wszystkie dokumenty w Firestore mają teraz isRecurring: false (boolean).');
}

fixRecurringField().catch(console.error);