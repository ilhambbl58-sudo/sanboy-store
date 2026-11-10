
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBE4Jq9-P5weUkbIsiw2xHHIFiSh7kuiYM",
  authDomain: "sanboy-store.firebaseapp.com",
  projectId: "sanboy-store",
  storageBucket: "sanboy-store.firebasestorage.app",
  messagingSenderId: "611393325593",
  appId: "1:611393325593:web:a8202d0ae6fb30eac5f888",
  measurementId: "G-L662Q8RFHK"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export {
    auth,
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
};