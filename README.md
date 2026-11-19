# RedFood — Restaurante

Página web de un restaurante con dos vistas:

- **Cliente:** menú en tarjetas, filtros (precio, descuentos, disponibilidad, categoría), búsqueda, orden, detalle en modal, cuenta de usuario, dirección de entrega, carrito y pago con comprobante en PDF.
- **Dueño:** panel para agregar, editar y eliminar comidas (nombre, descripción, precio, descuento activable, stock y foto), ver ventas y pedidos recibidos.

Los datos se guardan en **Firebase**: Authentication para las cuentas y Cloud Firestore para el menú, carritos y pedidos. Mientras no configures Firebase, la página funciona en **modo local** (los datos se quedan en el navegador), así puedes probarla de inmediato.

En el pie de página se indica qué modo está activo: **"Datos en la nube · Firebase"** o **"Modo local"**.

## Estructura

```
index.html               ← estructura de la página y modales
css/styles.css           ← estilos
js/firebase-config.js    ← AQUÍ pegas la configuración de tu proyecto de Firebase
js/app.js                ← lógica (menú, filtros, sesión, carrito, pagos, panel del dueño)
firestore.rules          ← reglas de seguridad para copiar en Firebase
```

### Colecciones de Firestore

| Colección | Contenido | Quién puede leer / escribir |
| --- | --- | --- |
| `foods` | Menú: nombre, descripción, categoría, precio, descuento, stock, foto | Todos leen · el dueño escribe · un cliente solo puede bajar el stock al pagar |
| `users/{uid}` | Nombre, correo y dirección del cliente | El propio cliente · el dueño puede leer |
| `carts/{uid}` | Carrito del cliente | El propio cliente |
| `orders` | Pedidos pagados (productos, totales, dirección, folio) | El cliente ve los suyos · el dueño ve todos |

Al pagar, una **transacción** valida el stock, lo descuenta, guarda el pedido y vacía el carrito, todo junto.

## Configurar Firebase (una sola vez, ~10 min)

1. Entra a [console.firebase.google.com](https://console.firebase.google.com) y pulsa **Crear un proyecto** (por ejemplo `redfood`). Google Analytics es opcional.
2. **Registra la app web:** en la página principal del proyecto pulsa el ícono **`</>`**, ponle un nombre y pulsa **Registrar app**. Copia los valores de `firebaseConfig` y pégalos en `js/firebase-config.js`:
   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "redfood-xxxx.firebaseapp.com",
     projectId: "redfood-xxxx",
     storageBucket: "redfood-xxxx.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef"
   };
   ```
   Estos valores no son secretos: identifican tu proyecto y es normal que estén en el código público. La seguridad la dan las reglas del paso 5.
3. **Activa el inicio de sesión:** menú **Compilación → Authentication → Comenzar → Correo electrónico/contraseña → Habilitar → Guardar**.
4. **Crea la base de datos:** **Compilación → Firestore Database → Crear base de datos**. Elige una ubicación (p. ej. `nam5` o `us-central`) y **modo de producción**.
5. **Publica las reglas:** en Firestore, pestaña **Reglas**, borra lo que haya, pega el contenido de `firestore.rules` y pulsa **Publicar**.
6. **Crea la cuenta del dueño:** **Authentication → Usuarios → Agregar usuario** con el correo `dueno@redfood.com` y la contraseña que tú quieras.
   *(Si te saltas este paso, la cuenta se crea sola la primera vez que entres con el correo y la contraseña de `ADMINS` en `js/app.js`.)*
7. **Autoriza tu dominio:** **Authentication → Configuración → Dominios autorizados → Agregar dominio** y añade `TU-USUARIO.github.io`. (`localhost` ya viene autorizado.)
8. Abre la página, entra como dueño y en el panel pulsa **Cargar menú de ejemplo** (o agrega tus propias comidas).

> Para probar en tu computadora usa un servidor local (el modo Firebase no funciona abriendo el archivo con doble clic): en la carpeta del proyecto ejecuta `npx serve` o `python -m http.server 8000` y entra a `http://localhost:8000`.

## Credenciales del dueño

En `js/app.js`, constante `ADMINS`:

| Correo | Contraseña |
| --- | --- |
| dueno@redfood.com | RedFood2026! |

- En **modo local** se usan tal cual.
- En **modo Firebase** el correo identifica al dueño, y la contraseña válida es la que tenga en Firebase Authentication. La del código solo sirve para crear la cuenta la primera vez.

Para cambiar el correo del dueño o agregar otro, cámbialo en **dos lugares**: `ADMINS` en `js/app.js` y la lista de `isAdmin()` en `firestore.rules` (y vuelve a publicar las reglas).

> ⚠️ El repositorio es público: cualquiera puede leer la contraseña del código. Crea al dueño en la consola de Firebase con **otra contraseña** (paso 6) y luego borra el campo `password` de `ADMINS`, o cámbialo por uno que no uses en otro lado.

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (público, sin README), por ejemplo `redfood`.
2. Pulsa **uploading an existing file**, arrastra **el contenido** de esta carpeta (`index.html`, `README.md`, `firestore.rules`, `css`, `js`) y pulsa **Commit changes**. `index.html` debe quedar en la raíz.
3. **Settings → Pages → Source: Deploy from a branch**, rama **main**, carpeta **/(root)** → **Save**.
4. En 1–2 minutos tendrás tu enlace: `https://TU-USUARIO.github.io/redfood/`.
5. No olvides agregar `TU-USUARIO.github.io` a los dominios autorizados de Firebase (paso 7).

Con Git desde la terminal:

```bash
cd redfood
git init
git add .
git commit -m "RedFood con Firebase"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/redfood.git
git push -u origin main
```

## Notas

- **El pago es simulado:** no se cobra nada ni se guardan datos de tarjeta.
- **Fotos:** se reducen a 600 px y se guardan dentro del documento de Firestore (límite de 1 MB por documento). Para muchas fotos grandes conviene usar Firebase Storage.
- **Stock:** las reglas permiten que un cliente con sesión solo reduzca el stock (necesario para pagar). Para un sistema real, el cobro y el descuento de stock deberían hacerse en el servidor (Cloud Functions).
- El SDK de Firebase se carga desde el CDN de Google; la versión se cambia en `js/firebase-config.js` (`FIREBASE_SDK_VERSION`).
