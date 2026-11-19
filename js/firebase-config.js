/* =========================================================
   CONFIGURACIÓN DE FIREBASE
   1. Crea un proyecto en https://console.firebase.google.com
   2. Agrega una app web (ícono </>) y copia aquí los valores de "firebaseConfig".
   3. Activa Authentication → Correo/contraseña y crea la base de datos Firestore.
   (Pasos completos en README.md)

   Si dejas apiKey vacío, la página funciona en MODO LOCAL:
   los datos se guardan solo en el navegador (útil para probar).
   ========================================================= */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyD-ud75nUAwCjJvQUjPXg5BtCL6ovNLVao",
  authDomain: "refood-c699a.firebaseapp.com",
  projectId: "refood-c699a",
  storageBucket: "refood-c699a.firebasestorage.app",
  messagingSenderId: "958134936138",
  appId: "1:958134936138:web:826039d3b9b93816bf7cb3",
  measurementId: "G-5KFLE7CM1D"
};

// Versión del SDK de Firebase que se carga desde el CDN de Google
window.FIREBASE_SDK_VERSION = "13.2.0";
