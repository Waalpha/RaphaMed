import { initializeApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0157746319",
  appId: "1:890328803474:web:44e7222539a28278969e4b",
  apiKey: "AIzaSyBNufmtGu7Y7d7CLhXRbMoR58x8ccHIeM8",
  authDomain: "gen-lang-client-0157746319.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-8c62a475-d390-4b00-ba10-bac3294cd8b2",
  storageBucket: "gen-lang-client-0157746319.firebasestorage.app",
  messagingSenderId: "890328803474",
  measurementId: "",
  oAuthClientId: "890328803474-hoerbpfldgrv8c60a2qsfagar68nq7qt.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
}, firebaseConfig.firestoreDatabaseId || '(default)');
const auth = getAuth(app);

export { app, db, auth };
