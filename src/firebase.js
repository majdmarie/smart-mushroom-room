// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, set, get, child, onValue, off, push } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDHxDP31-FMnGOJMfLansnyKvEezki5skU",
  authDomain: "mushrrom-4ce90.firebaseapp.com",
  databaseURL: "https://mushrrom-4ce90-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mushrrom-4ce90",
  storageBucket: "mushrrom-4ce90.appspot.com",
  messagingSenderId: "897617698961",
  appId: "1:897617698961:web:a4f7d8569743d6d4f65f30",
  measurementId: "G-JHMJL7T997"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const database = getDatabase(app);

export { auth, database, signInWithEmailAndPassword, ref, child, set, get, onValue, off, push };
