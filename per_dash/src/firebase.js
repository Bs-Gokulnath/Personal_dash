import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  apiKey: "AIzaSyCBGY32oJNvEwcTIaPWRuUsJX5S59CB7l0",
  authDomain: "personal-dash-42633.firebaseapp.com",
  projectId: "personal-dash-42633",
  storageBucket: "personal-dash-42633.firebasestorage.app",
  messagingSenderId: "816497243132",
  appId: "1:816497243132:web:de531b2563f7a7fedf3879",
  measurementId: "G-7M5HSKSBYJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
