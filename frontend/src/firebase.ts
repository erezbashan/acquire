import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  projectId: "acquire-game-1782999027",
  appId: "1:13397046224:web:cde4c3a9637972f464ffd5",
  storageBucket: "acquire-game-1782999027.firebasestorage.app",
  apiKey: "AIzaSyASeI7sudOZKb_jQnYGadix57m02STFUEo",
  authDomain: "acquire-game-1782999027.firebaseapp.com",
  messagingSenderId: "13397046224",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Use local emulator in development
if (import.meta.env.DEV) {
  connectFunctionsEmulator(functions, "localhost", 5001);
  connectFirestoreEmulator(db, "localhost", 8080);
}
