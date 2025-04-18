// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAEDoV8VzgmyYcvIqkj_G9oDPVvpHdyFPM",
  authDomain: "family-fitness-record-31bb0.firebaseapp.com",
  projectId: "family-fitness-record-31bb0",
  storageBucket: "family-fitness-record-31bb0.firebasestorage.app",
  messagingSenderId: "695651933387",
  appId: "1:695651933387:web:47488d1c7c7cb5ffb4cf4e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
