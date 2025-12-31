import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { 
  getFirestore, doc, setDoc, getDoc, collection, 
  onSnapshot, getDocs, query, where, writeBatch 
} from "firebase/firestore";
import { 
  getDatabase, ref, set, get, onValue, update 
} from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// --- 1. CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDNAarkY9MquMpJzKuXt4BayK6AHGImyr0",
  authDomain: "dec2025-96ecd.firebaseapp.com",
  projectId: "dec2025-96ecd",
  storageBucket: "dec2025-96ecd.firebasestorage.app",
  messagingSenderId: "617035489092",
  appId: "1:617035489092:web:cf470004dfcb97e41cc111",
  databaseURL: "https://dec2025-96ecd-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// --- 2. INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

// Analytics check (Browser environment ke liye)
let analytics;
isSupported().then(yes => yes ? analytics = getAnalytics(app) : null);

// --- 3. AUTH HELPERS ---
export const subscribeToAuth = (callback) => {
  return onAuthStateChanged(auth, (user) => callback(user));
};

// --- 4. USER DATA (DUAL SYNC) ---
export const saveUserToLive = async (user) => {
  if (!user?.id) return;
  try {
    const rtdbRef = ref(rtdb, `users/${user.id}`);
    const firestoreRef = doc(db, "users", user.id);
    
    // Dono jagah ek saath save hoga
    await Promise.all([
      set(rtdbRef, user),
      setDoc(firestoreRef, user)
    ]);
  } catch (error) { console.error("Save User Error:", error); }
};

export const subscribeToUsers = (callback) => {
  const q = collection(db, "users");
  return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data());
      if (users.length > 0) {
          callback(users);
      } else {
          // Fallback to RTDB
          onValue(ref(rtdb, 'users'), (snap) => {
             const data = snap.val();
             callback(data ? Object.values(data) : []);
          }, { onlyOnce: true });
      }
  });
};

export const getUserData = async (userId) => {
    try {
        const snap = await get(ref(rtdb, `users/${userId}`));
        if (snap.exists()) return snap.val();
        
        const docSnap = await getDoc(doc(db, "users", userId));
        return docSnap.exists() ? docSnap.data() : null;
    } catch (e) { return null; }
};

export const getUserByEmail = async (email) => {
    try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty ? querySnapshot.docs[0].data() : null;
    } catch (e) { return null; }
};

// --- 5. SYSTEM SETTINGS ---
export const saveSystemSettings = async (settings) => {
  try {
    await set(ref(rtdb, 'system_settings'), settings);
    await setDoc(doc(db, "config", "system_settings"), settings);
  } catch (e) { console.error(e); }
};

export const subscribeToSettings = (callback) => {
  return onSnapshot(doc(db, "config", "system_settings"), (docSnap) => {
      if (docSnap.exists()) {
          callback(docSnap.data());
      } else {
          onValue(ref(rtdb, 'system_settings'), (snap) => {
               if (snap.val()) callback(snap.val());
          }, { onlyOnce: true });
      }
  });
};

// --- 6. CONTENT & CHAPTERS (BULK & SINGLE) ---
export const bulkSaveLinks = async (updates) => {
  try {
    // 1. Update RTDB
    await update(ref(rtdb, 'content_links'), updates);
    
    // 2. Update Firestore using Batch (Better Performance)
    const batch = writeBatch(db);
    Object.entries(updates).forEach(([key, data]) => {
      const docRef = doc(db, "content_data", key);
      batch.set(docRef, data);
    });
    await batch.commit();
  } catch (e) { console.error("Bulk Save Error:", e); }
};

export const saveChapterData = async (key, data) => {
  try {
    await set(ref(rtdb, `content_data/${key}`), data);
    await setDoc(doc(db, "content_data", key), data);
  } catch (e) { console.error(e); }
};

export const getChapterData = async (key) => {
    try {
        const snapshot = await get(ref(rtdb, `content_data/${key}`));
        if (snapshot.exists()) return snapshot.val();
        
        const docSnap = await getDoc(doc(db, "content_data", key));
        return docSnap.exists() ? docSnap.data() : null;
    } catch (e) { return null; }
};

export const subscribeToChapterData = (key, callback) => {
    const rtdbRef = ref(rtdb, `content_data/${key}`);
    return onValue(rtdbRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            getDoc(doc(db, "content_data", key)).then(ds => ds.exists() && callback(ds.data()));
        }
    });
};

// --- 7. TESTS & STATUS ---
export const saveTestResult = async (userId, attempt) => {
    try {
        const docId = `${attempt.testId}_${Date.now()}`;
        await setDoc(doc(db, "users", userId, "test_results", docId), attempt);
    } catch(e) { console.error(e); }
};

export const updateUserStatus = async (userId) => {
     try {
        await update(ref(rtdb, `users/${userId}`), { 
            lastActiveTime: new Date().toISOString() 
        });
    } catch (e) { }
};

export { app, db, rtdb, auth };
