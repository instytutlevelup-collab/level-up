// firebase.ts
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyBI9P8O1OD4FXmi4kJgMb2Ecgk6v-q7Wsw",
  authDomain: "eduplan-cb8fb.firebaseapp.com",
  projectId: "eduplan-cb8fb",
  storageBucket: "eduplan-cb8fb.appspot.com", // ✅ poprawiono
  messagingSenderId: "171978303054",
  appId: "1:171978303054:web:5de6b6ce4e2b89e9b5c51f"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)

export { getAuth }