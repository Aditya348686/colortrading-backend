import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, update, push, remove, serverTimestamp } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyC7TExlnsFwx-VTqYwV6DAGOEkZrYe9vYE',
  authDomain: 'earn-and-money-3ff08.firebaseapp.com',
  databaseURL: 'https://earn-and-money-3ff08-default-rtdb.firebaseio.com',
  projectId: 'earn-and-money-3ff08',
  storageBucket: 'earn-and-money-3ff08.firebasestorage.app',
  messagingSenderId: '526193903372',
  appId: '1:526193903372:web:336f0285f411b63d842b29',
  measurementId: 'G-46YC836PD2'
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export { ref, set, get, onValue, update, push, remove, serverTimestamp, signInWithEmailAndPassword };
export default app;
