/* ============================================================
   CONFIGURACIÓN DE FIREBASE
   Reemplaza los valores de abajo con los de TU proyecto Firebase.
   Los encuentras en: Firebase Console > ⚙️ Configuración del proyecto
   > "Tus apps" > app web > "Configuración del SDK".
   Este objeto NO es secreto, es seguro tenerlo en el código del
   navegador (la seguridad real la dan las Reglas de Firestore).
   ============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyBDz2XlWvG9GvqGKIYxXazgqnxnBquDNrE",
  authDomain: "check-list-cocina.firebaseapp.com",
  projectId: "check-list-cocina",
  storageBucket: "check-list-cocina.firebasestorage.app",
  messagingSenderId: "764951099401",
  appId: "1:764951099401:web:2b584aca57732c33eae0d8",
  measurementId: "G-XRK5G6F72S",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let storage = null;
try {
  storage = firebase.storage();
} catch (e) {
  console.warn("Firebase Storage no disponible (opcional, solo afecta subir evidencia en foto).", e);
}
