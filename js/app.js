/* =========================================================
   REDFOOD — lógica de la página
   Datos: Firebase (Authentication + Firestore) si js/firebase-config.js
   está configurado; si no, modo local (localStorage del navegador).
   ========================================================= */

/* ---------- CONFIGURACIÓN ---------- */
// Dueños del local. El correo identifica al dueño (también en firestore.rules).
// En modo Firebase la contraseña sirve para crear la cuenta del dueño la primera vez
// que entra; después la contraseña válida es la de Firebase Authentication.
const ADMINS = [
  { email: 'dueno@redfood.com', password: 'RedFood2026!', name: 'Luz Hernández', local: 'RedFood' }
];
const RESTAURANT = { name: 'RedFood', address: 'Av. Juárez 128, Col. Centro, Ciudad de México, CDMX 06000', phone: '55 1234 5678', email: 'hola@redfood.com' };
const SHIPPING = 35;       // costo de envío (MXN)
const LOW_STOCK = 5;       // a partir de cuánto se considera "stock bajo"
const CATEGORIES = ['Entradas', 'Platillos', 'Bebidas', 'Postres'];
const CAT_STYLE = {
  Entradas:  { emoji: '🥗', bg: 'linear-gradient(140deg,#F2FBDD,#C9EC8A)' },
  Platillos: { emoji: '🌮', bg: 'linear-gradient(140deg,#FFF1E2,#FDBA74)' },
  Bebidas:   { emoji: '🥤', bg: 'linear-gradient(140deg,#E6F6FE,#8FD3F7)' },
  Postres:   { emoji: '🍮', bg: 'linear-gradient(140deg,#FDECF4,#F6A9CF)' }
};
const EMOJIS = ['🌮','🌯','🫔','🌶️','🍲','🍜','🥘','🍛','🍗','🥩','🍔','🍕','🥑','🥗','🧀','🍤','🐟','🥛','🍋','🥤','☕','🍺','🍹','🍮','🍫','🍰','🍨','🍩','🍪','🍓'];

const SEED = [
  { name:'Guacamole con totopos', category:'Entradas', emoji:'🥑', price:95, discountActive:false, discountPercent:0, stock:20, description:'Aguacate machacado al momento con jitomate, cebolla, cilantro, chile serrano y limón. Se sirve con totopos de maíz recién fritos.' },
  { name:'Sopa de tortilla', category:'Entradas', emoji:'🍲', price:85, discountActive:true, discountPercent:10, stock:12, description:'Caldo de jitomate y chile pasilla con tiras de tortilla crujiente, aguacate, crema, queso fresco y chicharrón.' },
  { name:'Tacos al pastor (5 pzas)', category:'Platillos', emoji:'🌮', price:120, discountActive:true, discountPercent:15, stock:30, description:'Cerdo adobado al trompo con piña, cebolla y cilantro en tortilla de maíz. Incluye salsa verde y roja de la casa.' },
  { name:'Enchiladas verdes', category:'Platillos', emoji:'🫔', price:145, discountActive:false, discountPercent:0, stock:15, description:'Tres enchiladas rellenas de pollo deshebrado bañadas en salsa de tomate verde, con crema, queso y cebolla morada.' },
  { name:'Chiles en nogada', category:'Platillos', emoji:'🌶️', price:210, discountActive:false, discountPercent:0, stock:4, description:'Chile poblano relleno de picadillo de carne y frutas, cubierto con nogada de nuez de Castilla, granada y perejil.' },
  { name:'Pozole rojo', category:'Platillos', emoji:'🍜', price:160, discountActive:true, discountPercent:20, stock:0, description:'Caldo de maíz cacahuazintle con cerdo y chile guajillo. Acompañado de lechuga, rábano, orégano, limón y tostadas.' },
  { name:'Agua de horchata (1 L)', category:'Bebidas', emoji:'🥛', price:45, discountActive:false, discountPercent:0, stock:40, description:'Bebida fresca de arroz con canela y un toque de vainilla, preparada diario en casa.' },
  { name:'Limonada mineral', category:'Bebidas', emoji:'🍋', price:50, discountActive:false, discountPercent:0, stock:25, description:'Limón recién exprimido con agua mineral y un toque de hierbabuena. Vaso de 500 ml.' },
  { name:'Flan napolitano', category:'Postres', emoji:'🍮', price:65, discountActive:true, discountPercent:10, stock:10, description:'Flan cremoso horneado a baño María con caramelo dorado. Receta de la abuela.' },
  { name:'Churros con chocolate', category:'Postres', emoji:'🍫', price:75, discountActive:false, discountPercent:0, stock:18, description:'Cuatro churros recién hechos con azúcar y canela, acompañados de chocolate caliente espeso para remojar.' }
];

/* ---------- ESTADO ---------- */
let foods = [];        // menú
let orders = [];       // dueño: todos los pedidos · cliente: solo los suyos
let cart = [];         // carrito del cliente: [{ foodId, qty }]
let profile = null;    // cliente: { uid, name, email, address }
let session = null;    // { role: 'admin' | 'user', uid, email, name }
let ready = false;     // ¿ya llegó el menú?
let Data = null;       // capa de datos activa (LocalData o FirebaseData)

/* ---------- UTILIDADES ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const round2 = n => Math.round(n * 100) / 100;
const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const money = n => fmt.format(n);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const hasDisc = f => f.discountActive && f.discountPercent > 0;
const finalPrice = f => hasDisc(f) ? round2(f.price * (100 - f.discountPercent) / 100) : f.price;
const catStyle = c => CAT_STYLE[c] || CAT_STYLE.Platillos;
const fmtDate = iso => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const firstName = n => String(n || '').trim().split(/\s+/)[0];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const adminByEmail = email => ADMINS.find(a => a.email.toLowerCase() === String(email || '').toLowerCase());
const sortFoods = list => list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
const sortOrders = list => list.sort((a, b) => String(b.date).localeCompare(String(a.date)));

class AppError extends Error {}
function errMsg(e){
  if (e instanceof AppError) return e.message;
  const code = e && e.code || '';
  const map = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos. ¿Aún no tienes cuenta? Créala en la pestaña "Crear cuenta".',
    'auth/invalid-login-credentials': 'Correo o contraseña incorrectos. ¿Aún no tienes cuenta? Créala en la pestaña "Crear cuenta".',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No existe una cuenta con ese correo. Créala en la pestaña "Crear cuenta".',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
    'auth/operation-not-allowed': 'Falta activar "Correo electrónico/contraseña" en Firebase → Authentication → Sign-in method.',
    'auth/configuration-not-found': 'Falta activar Authentication en tu proyecto de Firebase.',
    'permission-denied': 'Firebase rechazó la operación. Revisa que publicaste las reglas de firestore.rules.',
    'unavailable': 'No hay conexión con la base de datos. Revisa tu internet.'
  };
  return map[code] || (code ? `Error de Firebase (${code}).` : 'Ocurrió un error inesperado.');
}

async function hashPw(pw){
  const s = 'redfood::' + pw;
  try {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch(e){}
  let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return 'x' + (h >>> 0).toString(16);
}

function toast(msg, kind = '', action){
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement('button'); b.textContent = action.label;
    b.onclick = () => { t.remove(); action.fn(); };
    t.appendChild(b);
  }
  const box = $('#toasts'); box.appendChild(t);
  while (box.children.length > 2) box.firstElementChild.remove();
  setTimeout(() => t.remove(), action ? 5000 : 3600);
}
// Ejecuta una operación de datos mostrando el error si falla
async function attempt(fn, btn){
  const label = btn ? btn.innerHTML : '';
  if (btn) btn.disabled = true;
  try { return await fn(); }
  catch (e) { console.error(e); toast(errMsg(e), 'bad'); return undefined; }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = label; } }
}

/* ---------- SESIÓN ---------- */
const isAdmin = () => session?.role === 'admin';
const currentAdmin = () => isAdmin() ? (adminByEmail(session.email) || { name: session.name || 'Dueño', email: session.email, local: RESTAURANT.name }) : null;
const currentUser = () => session?.role === 'user' ? (profile || { uid: session.uid, name: session.name, email: session.email, address: null, loading: true }) : null;
const cartCount = () => cart.reduce((s, i) => s + i.qty, 0);

/* =========================================================
   CAPA DE DATOS · MODO LOCAL (localStorage)
   ========================================================= */
const mem = {};
function makeStore(kind){
  const area = () => { try { return window[kind]; } catch(e){ return null; } };
  return {
    get(k, fb){
      const key = kind + ':' + k;
      try { const a = area(); const v = a && a.getItem(k); if (v != null) return JSON.parse(v); } catch(e){}
      return key in mem ? mem[key] : fb;
    },
    set(k, v){
      mem[kind + ':' + k] = v;
      try { const a = area(); a && a.setItem(k, JSON.stringify(v)); } catch(e){}
    }
  };
}
const store = makeStore('localStorage');
const sess = makeStore('sessionStorage'); // sesión por pestaña

const LocalData = {
  mode: 'local',
  async init(){
    if (!Array.isArray(store.get('rf_foods', null))) {
      const now = Date.now();
      store.set('rf_foods', SEED.map((f, i) => ({ id: uid(), image: '', createdAt: now - i, ...f })));
    }
    session = sess.get('rf_session', null);
    this.reload();
    ready = true;
    // Sincroniza cambios hechos en otra pestaña
    window.addEventListener('storage', e => {
      if (e.key && e.key.startsWith('rf_')) { this.reload(); render(); if ($('#detail-modal').classList.contains('open')) renderDetail(); }
    });
  },
  reload(){
    foods = sortFoods(store.get('rf_foods', []));
    const all = store.get('rf_orders', []);
    orders = []; cart = []; profile = null;
    if (!session) return;
    if (session.role === 'admin') { orders = sortOrders(all); return; }
    const u = store.get('rf_users', []).find(x => x.uid === session.uid);
    if (!u) { session = null; sess.set('rf_session', null); return; }
    profile = { uid: u.uid, name: u.name, email: u.email, address: u.address || null };
    cart = (store.get('rf_carts', {})[u.uid]) || [];
    orders = sortOrders(all.filter(o => o.uid === u.uid));
  },
  setSession(s){ session = s; sess.set('rf_session', s); this.reload(); },
  async login(email, pw){
    const admin = adminByEmail(email);
    if (admin && admin.password === pw) { this.setSession({ role: 'admin', uid: 'admin:' + admin.email, email: admin.email, name: admin.name }); return; }
    const u = store.get('rf_users', []).find(x => x.email === email);
    if (!u || u.passHash !== await hashPw(pw)) throw new AppError('Correo o contraseña incorrectos. ¿Aún no tienes cuenta? Créala en la pestaña "Crear cuenta".');
    this.setSession({ role: 'user', uid: u.uid, email: u.email, name: u.name });
  },
  async register(name, email, pw){
    const users = store.get('rf_users', []);
    if (users.some(u => u.email === email)) throw new AppError('Ya existe una cuenta con ese correo. Inicia sesión.');
    const u = { uid: uid(), name, email, passHash: await hashPw(pw), address: null, createdAt: new Date().toISOString() };
    users.push(u); store.set('rf_users', users);
    this.setSession({ role: 'user', uid: u.uid, email, name });
  },
  async logout(){ this.setSession(null); },
  _foods(fn){ const all = store.get('rf_foods', []); fn(all); store.set('rf_foods', all); this.reload(); },
  async saveFood(id, data){
    this._foods(all => {
      if (id) { const f = all.find(x => x.id === id); if (f) Object.assign(f, data); }
      else all.push({ id: uid(), createdAt: Date.now(), ...data });
    });
  },
  async patchFood(id, partial){ this._foods(all => { const f = all.find(x => x.id === id); if (f) Object.assign(f, partial); }); },
  async deleteFood(id){ this._foods(all => { const i = all.findIndex(x => x.id === id); if (i > -1) all.splice(i, 1); }); },
  async seedFoods(){ const now = Date.now(); this._foods(all => SEED.forEach((f, i) => all.push({ id: uid(), image: '', createdAt: now - i, ...f }))); },
  async saveAddress(address){
    const users = store.get('rf_users', []); const u = users.find(x => x.uid === session.uid);
    if (u) { u.address = address; store.set('rf_users', users); }
    this.reload();
  },
  async setCart(items){ const c = store.get('rf_carts', {}); c[session.uid] = items; store.set('rf_carts', c); cart = items; },
  async checkout(order){
    const all = store.get('rf_foods', []);
    for (const it of order.items) {
      const f = all.find(x => x.id === it.foodId);
      if (!f || f.stock < it.qty) throw new AppError(`"${it.name}" ya no tiene stock suficiente. Revisa tu carrito.`);
    }
    order.items.forEach(it => { all.find(x => x.id === it.foodId).stock -= it.qty; });
    store.set('rf_foods', all);
    const o = { id: uid(), ...order };
    store.set('rf_orders', [o, ...store.get('rf_orders', [])]);
    const c = store.get('rf_carts', {}); c[session.uid] = []; store.set('rf_carts', c);
    this.reload();
    return o;
  }
};

/* =========================================================
   CAPA DE DATOS · FIREBASE (Authentication + Firestore)
   Colecciones:
     foods/{id}    menú (lectura pública, escritura del dueño)
     users/{uid}   perfil del cliente: nombre, correo, dirección
     carts/{uid}   carrito del cliente: { items: [{ foodId, qty }] }
     orders/{id}   pedidos pagados (con uid del cliente)
   ========================================================= */
const FirebaseData = {
  mode: 'firebase',
  unsubs: [],
  attachedUid: null,
  attached: null,
  async init(){
    const v = window.FIREBASE_SDK_VERSION || '13.2.0';
    const base = `https://www.gstatic.com/firebasejs/${v}/`;
    const [appM, authM, fsM] = await Promise.all([
      import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')
    ]);
    this.f = { ...authM, ...fsM };
    const app = appM.initializeApp(window.FIREBASE_CONFIG);
    this.auth = authM.getAuth(app);
    this.db = fsM.getFirestore(app);
    const { onSnapshot, collection, onAuthStateChanged } = this.f;

    // Menú en tiempo real (visible para todos)
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 10000);
      onSnapshot(collection(this.db, 'foods'), snap => {
        foods = sortFoods(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        ready = true; clearTimeout(timer); resolve(); render();
        if ($('#detail-modal').classList.contains('open')) renderDetail();
      }, err => { console.error(err); ready = true; clearTimeout(timer); resolve(); toast('No se pudo leer el menú: ' + errMsg(err), 'bad'); render(); });
    });

    // Sesión
    onAuthStateChanged(this.auth, user => { this.attached = this.attach(user); });
  },
  // Conecta los datos del usuario que inició sesión
  attach(user){
    const { onSnapshot, doc, collection, query, where } = this.f;
    this.unsubs.forEach(u => u()); this.unsubs = [];
    orders = []; cart = []; profile = null;
    this.attachedUid = user ? user.uid : null;
    if (!user) { session = null; render(); return Promise.resolve(); }
    const email = (user.email || '').toLowerCase();
    const onErr = err => { console.error(err); toast(errMsg(err), 'bad'); };
    const admin = adminByEmail(email);

    if (admin) {
      session = { role: 'admin', uid: user.uid, email, name: admin.name };
      return new Promise(resolve => {
        this.unsubs.push(onSnapshot(collection(this.db, 'orders'), s => {
          orders = sortOrders(s.docs.map(d => ({ id: d.id, ...d.data() }))); resolve(); render();
        }, e => { onErr(e); resolve(); }));
        render();
      });
    }

    session = { role: 'user', uid: user.uid, email, name: user.displayName || email };
    let waiting = 2; let done;
    const p = new Promise(r => done = r);
    const tick = () => { if (--waiting === 0) done(); };
    this.unsubs.push(onSnapshot(doc(this.db, 'users', user.uid), s => {
      const d = s.exists() ? s.data() : {};
      profile = { uid: user.uid, name: d.name || user.displayName || '', email, address: d.address || null };
      session.name = profile.name || session.name;
      if (waiting > 0) tick(); render();
    }, e => { onErr(e); tick(); }));
    this.unsubs.push(onSnapshot(doc(this.db, 'carts', user.uid), s => {
      cart = s.exists() ? (s.data().items || []) : [];
      if (waiting > 0) tick(); render();
    }, e => { onErr(e); tick(); }));
    this.unsubs.push(onSnapshot(query(collection(this.db, 'orders'), where('uid', '==', user.uid)), s => {
      orders = sortOrders(s.docs.map(d => ({ id: d.id, ...d.data() }))); render();
    }, onErr));
    render();
    return p;
  },
  // Espera a que el usuario recién autenticado tenga sus datos cargados
  whenAttached(uid){
    return new Promise(resolve => {
      const start = Date.now();
      const check = () => {
        if (this.attachedUid === uid && this.attached) this.attached.then(resolve);
        else if (Date.now() - start > 10000) resolve();
        else setTimeout(check, 40);
      };
      check();
    });
  },
  async login(email, pw){
    const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = this.f;
    let cred;
    try { cred = await signInWithEmailAndPassword(this.auth, email, pw); }
    catch (e) {
      // Primera vez del dueño: crea su cuenta con las credenciales del código
      const admin = adminByEmail(email);
      const canBootstrap = admin && admin.password && admin.password === pw &&
        ['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(e.code);
      if (!canBootstrap) throw e;
      try { cred = await createUserWithEmailAndPassword(this.auth, email, pw); }
      catch (e2) { throw e; }
    }
    await this.whenAttached(cred.user.uid);
  },
  async register(name, email, pw){
    const { createUserWithEmailAndPassword, updateProfile, setDoc, doc } = this.f;
    const cred = await createUserWithEmailAndPassword(this.auth, email, pw);
    await updateProfile(cred.user, { displayName: name }).catch(() => {});
    await setDoc(doc(this.db, 'users', cred.user.uid), { name, email, address: null, createdAt: new Date().toISOString() });
    await this.whenAttached(cred.user.uid);
  },
  async logout(){ await this.f.signOut(this.auth); },
  async saveFood(id, data){
    const { doc, updateDoc, addDoc, collection } = this.f;
    if (id) await updateDoc(doc(this.db, 'foods', id), data);
    else await addDoc(collection(this.db, 'foods'), { ...data, createdAt: Date.now() });
  },
  async patchFood(id, partial){ await this.f.updateDoc(this.f.doc(this.db, 'foods', id), partial); },
  async deleteFood(id){ await this.f.deleteDoc(this.f.doc(this.db, 'foods', id)); },
  async seedFoods(){
    const { writeBatch, doc, collection } = this.f;
    const batch = writeBatch(this.db); const now = Date.now();
    SEED.forEach((f, i) => batch.set(doc(collection(this.db, 'foods')), { image: '', createdAt: now - i, ...f }));
    await batch.commit();
  },
  async saveAddress(address){
    const { setDoc, doc } = this.f;
    await setDoc(doc(this.db, 'users', session.uid), { name: profile?.name || session.name, email: session.email, address }, { merge: true });
  },
  async setCart(items){
    cart = items;
    await this.f.setDoc(this.f.doc(this.db, 'carts', session.uid), { items, updatedAt: Date.now() });
  },
  // Transacción: valida y descuenta stock, guarda el pedido y vacía el carrito
  async checkout(order){
    const { runTransaction, doc, collection } = this.f;
    return runTransaction(this.db, async tx => {
      const refs = order.items.map(i => doc(this.db, 'foods', i.foodId));
      const snaps = [];
      for (const r of refs) snaps.push(await tx.get(r));
      snaps.forEach((s, i) => {
        if (!s.exists() || (s.data().stock ?? 0) < order.items[i].qty) throw new AppError(`"${order.items[i].name}" ya no tiene stock suficiente. Revisa tu carrito.`);
      });
      snaps.forEach((s, i) => tx.update(refs[i], { stock: s.data().stock - order.items[i].qty }));
      const oref = doc(collection(this.db, 'orders'));
      tx.set(oref, order);
      tx.set(doc(this.db, 'carts', session.uid), { items: [], updatedAt: Date.now() });
      return { id: oref.id, ...order };
    });
  }
};

/* =========================================================
   MODALES
   ========================================================= */
let zTop = 100;
let pending = null; // compra pendiente mientras el usuario inicia sesión o agrega dirección
function openModal(id){ const el = document.getElementById(id); el.style.zIndex = ++zTop; el.classList.add('open'); lockScroll(); }
function closeModal(id, cancelled = false){
  const el = document.getElementById(id); if (!el.classList.contains('open')) return;
  el.classList.remove('open'); lockScroll();
  if (cancelled && (id === 'auth-modal' || id === 'address-modal')) pending = null;
}
function lockScroll(){ document.body.style.overflow = ($$('.overlay.open').length || $('#cart-drawer').classList.contains('open')) ? 'hidden' : ''; }
$$('.overlay').forEach(ov => {
  ov.addEventListener('mousedown', e => { if (e.target === ov) closeModal(ov.id, true); });
  ov.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(ov.id, true); });
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = $$('.overlay.open').sort((a, b) => (+b.style.zIndex) - (+a.style.zIndex));
  if (open.length) closeModal(open[0].id, true);
  else if ($('#cart-drawer').classList.contains('open')) closeCart();
});

function mediaHTML(f, opts = {}){
  const st = catStyle(f.category);
  return `<div class="media" style="background:${st.bg}">
    ${f.image ? `<img src="${esc(f.image)}" alt="${esc(f.name)}">` : `<span class="emoji" aria-hidden="true">${esc(f.emoji || st.emoji)}</span>`}
    ${hasDisc(f) ? `<span class="disc-badge">-${f.discountPercent}%</span>` : ''}
    ${opts.stockTag ? `<span class="stock-tag" style="color:${f.stock <= 0 ? 'var(--bad)' : f.stock <= LOW_STOCK ? 'var(--warn)' : 'var(--ok)'}">Stock: ${f.stock}</span>` : ''}
    ${f.stock <= 0 ? '<div class="soldout">Agotado</div>' : ''}
  </div>`;
}
function thumbHTML(f){
  const st = catStyle(f.category);
  return `<div class="thumb" style="background:${st.bg}">${f.image ? `<img src="${esc(f.image)}" alt="">` : esc(f.emoji || st.emoji)}</div>`;
}
function priceHTML(f){
  return `<div class="price"><span class="now">${money(finalPrice(f))}</span>${hasDisc(f) ? `<span class="was">${money(f.price)}</span>` : ''}</div>`;
}
function stockBadge(n){
  if (n <= 0) return `<span class="stock-badge s-out">Agotado</span>`;
  if (n <= LOW_STOCK) return `<span class="stock-badge s-low">${n} · bajo</span>`;
  return `<span class="stock-badge s-ok">${n} disp.</span>`;
}

/* =========================================================
   RUTAS Y RENDER
   ========================================================= */
function route(){
  let r = location.hash.slice(1) || 'menu';
  if (r === 'panel' && !isAdmin()) r = 'menu';
  if (r === 'pedidos' && !currentUser()) r = 'menu';
  if (!['menu', 'panel', 'pedidos'].includes(r)) r = 'menu';
  return r;
}
function go(r){ if (location.hash.slice(1) === r) render(); else location.hash = r; }

function render(){
  if (!Data) return;
  const r = route();
  $('#view-menu').classList.toggle('hidden', r !== 'menu');
  $('#view-panel').classList.toggle('hidden', r !== 'panel');
  $('#view-orders').classList.toggle('hidden', r !== 'pedidos');
  renderHeader(r);
  if (r === 'menu') renderMenu();
  if (r === 'panel') renderPanel();
  if (r === 'pedidos') renderMyOrders();
  if ($('#cart-drawer').classList.contains('open')) renderCart();
}

function renderHeader(r){
  const links = [`<button class="nav-link ${r === 'menu' ? 'active' : ''}" data-go="menu">Menú</button>`];
  if (isAdmin()) links.push(`<button class="nav-link ${r === 'panel' ? 'active' : ''}" data-go="panel">Panel del dueño</button>`);
  if (currentUser()) links.push(`<button class="nav-link ${r === 'pedidos' ? 'active' : ''}" data-go="pedidos">Mis pedidos</button>`);
  $('#nav-links').innerHTML = links.join('');

  const cartIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg>`;
  let html = '';
  if (isAdmin()) {
    const a = currentAdmin();
    html = `<span class="role-pill">MODO DUEÑO</span>
      <div class="dd"><button class="dd-btn" data-dd><span class="avatar">${esc(initials(a.name))}</span><span class="dd-name">${esc(firstName(a.name))}</span></button>
        <div class="dd-menu"><div class="who"><b>${esc(a.name)}</b><span>${esc(a.email)}</span></div>
          <button data-go="panel">Panel del dueño</button><button data-go="menu">Ver menú</button><button data-act="logout">Cerrar sesión</button></div></div>`;
  } else if (currentUser()) {
    const u = currentUser(); const n = cartCount();
    html = `<button class="icon-btn cart-btn" data-act="cart" aria-label="Carrito">${cartIcon}${n ? `<span class="badge-count">${n}</span>` : ''}</button>
      <div class="dd"><button class="dd-btn" data-dd><span class="avatar">${esc(initials(u.name))}</span><span class="dd-name">${esc(firstName(u.name))}</span></button>
        <div class="dd-menu"><div class="who"><b>${esc(u.name)}</b><span>${esc(u.email)}</span></div>
          <button data-act="address">${u.address ? 'Editar mi dirección' : 'Agregar mi dirección'}</button><button data-go="pedidos">Mis pedidos</button><button data-act="logout">Cerrar sesión</button></div></div>`;
  } else {
    html = `<button class="icon-btn cart-btn" data-act="cart" aria-label="Carrito">${cartIcon}</button>
      <button class="btn btn-dark" data-act="login">Iniciar sesión</button>`;
  }
  $('#top-actions').innerHTML = html;
}

/* ---------- Menú principal + filtros ---------- */
let menuQ = '';
const filters = { maxPrice: null, onlyDiscount: false, hideSoldOut: false, cats: new Set(), sort: 'relevancia' };

// Precio máximo del slider: el precio final más alto, redondeado a la decena
function priceCeil(){ return Math.max(10, Math.ceil(Math.max(0, ...foods.map(finalPrice)) / 10) * 10); }

// Aplica los filtros; "skip" permite contar resultados ignorando un filtro (para los contadores)
function matches(f, skip = ''){
  const q = menuQ.trim().toLowerCase();
  if (q && !(f.name + ' ' + f.description + ' ' + f.category).toLowerCase().includes(q)) return false;
  if (skip !== 'price' && filters.maxPrice != null && finalPrice(f) > filters.maxPrice) return false;
  if (skip !== 'disc' && filters.onlyDiscount && !hasDisc(f)) return false;
  if (skip !== 'stock' && filters.hideSoldOut && f.stock <= 0) return false;
  if (skip !== 'cat' && filters.cats.size && !filters.cats.has(f.category)) return false;
  return true;
}
function sorted(list){
  const by = {
    'precio-asc': (a, b) => finalPrice(a) - finalPrice(b),
    'precio-desc': (a, b) => finalPrice(b) - finalPrice(a),
    'descuento': (a, b) => (hasDisc(b) ? b.discountPercent : 0) - (hasDisc(a) ? a.discountPercent : 0),
    'nombre': (a, b) => a.name.localeCompare(b.name, 'es')
  }[filters.sort];
  return by ? [...list].sort(by) : list;
}
function activeFilterCount(){
  return (filters.maxPrice != null ? 1 : 0) + (filters.onlyDiscount ? 1 : 0) + (filters.hideSoldOut ? 1 : 0) + filters.cats.size;
}

function renderMenu(){ renderFilters(); renderGrid(); }

function renderFilters(){
  const ceil = priceCeil(), slider = $('#f-price');
  if (filters.maxPrice != null && filters.maxPrice >= ceil) filters.maxPrice = null;
  slider.max = ceil;
  slider.value = filters.maxPrice ?? ceil;
  updatePriceLabel();
  $('#f-disc').checked = filters.onlyDiscount;
  $('#f-stock').checked = filters.hideSoldOut;
  $('#o-disc').classList.toggle('on', filters.onlyDiscount);
  $('#o-stock').classList.toggle('on', filters.hideSoldOut);
  $('#c-disc').textContent = foods.filter(f => hasDisc(f) && matches(f, 'disc')).length;
  $('#c-out').textContent = foods.filter(f => f.stock <= 0 && matches(f, 'stock')).length;
  $('#f-cats').innerHTML = CATEGORIES.map(c => {
    const n = foods.filter(f => f.category === c && matches(f, 'cat')).length;
    const on = filters.cats.has(c);
    return `<label class="fopt ${on ? 'on' : ''} ${n ? '' : 'zero'}"><input type="checkbox" data-fcat="${esc(c)}" ${on ? 'checked' : ''}><span class="box"></span><span class="txt">${esc(catStyle(c).emoji)} ${esc(c)}</span><span class="cnt">${n}</span></label>`;
  }).join('');
  $('#f-sort').value = filters.sort;
  const a = activeFilterCount();
  $('#f-active').textContent = a; $('#f-active').classList.toggle('hidden', !a);
  $('#f-clear').disabled = !a && !menuQ.trim();
}
function updatePriceLabel(){
  const s = $('#f-price'), ceil = +s.max, v = +s.value;
  s.style.setProperty('--pct', (ceil ? v / ceil * 100 : 100) + '%');
  $('#f-price-label').innerHTML = filters.maxPrice == null ? 'Cualquier precio' : `Hasta <b>${money(v)}</b>`;
}

function renderGrid(){
  const admin = isAdmin();
  if (!ready) {
    $('#results-count').textContent = ''; $('#results-note').textContent = '';
    $('#food-grid').innerHTML = `<div class="loading"><div class="spinner"></div>Cargando menú…</div>`;
    return;
  }
  const list = sorted(foods.filter(f => matches(f)));
  $('#results-count').textContent = `${list.length} ${list.length === 1 ? 'platillo' : 'platillos'}`;
  $('#results-note').textContent = list.length !== foods.length ? `de ${foods.length} en el menú` : '';
  if (!foods.length) {
    $('#food-grid').innerHTML = `<div class="empty"><div class="big">🍽️</div><b>Aún no hay comidas en el menú.</b><br>${admin ? '<br><button class="btn btn-primary" data-act="new-food">+ Agregar comida</button> <button class="btn" data-act="seed">Cargar menú de ejemplo</button>' : 'Vuelve pronto.'}</div>`;
    return;
  }
  if (!list.length) {
    $('#food-grid').innerHTML = `<div class="empty"><div class="big">🔎</div><b>Ningún platillo coincide con tus filtros.</b><br><br><button class="btn" data-clear-filters>Limpiar filtros</button></div>`;
    return;
  }
  $('#food-grid').innerHTML = list.map(f => `
    <article class="card" tabindex="0" data-open="${f.id}" aria-label="${esc(f.name)}">
      ${mediaHTML(f, { stockTag: admin })}
      <div class="card-body">
        <span class="card-cat">${esc(f.category)}</span>
        <h3 class="card-name">${esc(f.name)}</h3>
        <div class="card-foot">
          ${priceHTML(f)}
          ${admin
            ? `<button class="btn btn-sm" data-edit="${f.id}">Editar</button>`
            : `<button class="btn btn-primary btn-sm" data-buy="${f.id}" ${f.stock <= 0 ? 'disabled' : ''}>${f.stock <= 0 ? 'Agotado' : 'Comprar'}</button>`}
        </div>
      </div>
    </article>`).join('');
}
function clearFilters(){
  Object.assign(filters, { maxPrice: null, onlyDiscount: false, hideSoldOut: false });
  filters.cats.clear();
  menuQ = ''; $('#menu-search').value = '';
  renderMenu();
}

$('#menu-search').addEventListener('input', e => { menuQ = e.target.value; renderMenu(); });
$('#f-price').addEventListener('input', e => {
  const v = +e.target.value;
  filters.maxPrice = v >= +e.target.max ? null : v;
  updatePriceLabel(); renderGrid();
});
$('#f-price').addEventListener('change', renderFilters);
$('#f-disc').addEventListener('change', e => { filters.onlyDiscount = e.target.checked; renderMenu(); });
$('#f-stock').addEventListener('change', e => { filters.hideSoldOut = e.target.checked; renderMenu(); });
$('#f-cats').addEventListener('change', e => {
  const c = e.target.closest('[data-fcat]'); if (!c) return;
  c.checked ? filters.cats.add(c.dataset.fcat) : filters.cats.delete(c.dataset.fcat);
  renderMenu();
});
$('#f-sort').addEventListener('change', e => { filters.sort = e.target.value; renderGrid(); });
$('#f-clear').addEventListener('click', clearFilters);
$('#f-toggle').addEventListener('click', () => $('#fside').classList.toggle('open'));
$('#food-grid').addEventListener('click', e => {
  const buy = e.target.closest('[data-buy]'); if (buy) { e.stopPropagation(); requestBuy(buy.dataset.buy, 1); return; }
  const ed = e.target.closest('[data-edit]'); if (ed) { e.stopPropagation(); openFoodForm(ed.dataset.edit); return; }
  if (e.target.closest('[data-clear-filters]')) { clearFilters(); return; }
  const card = e.target.closest('[data-open]'); if (card) openDetail(card.dataset.open);
});
$('#food-grid').addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open]')) { e.preventDefault(); openDetail(e.target.dataset.open); }
});

/* ---------- Detalle (modal) ---------- */
let detailId = null, detailQty = 1;
function openDetail(id){ detailId = id; detailQty = 1; renderDetail(); openModal('detail-modal'); }
function renderDetail(){
  const f = foods.find(x => x.id === detailId); if (!f) { closeModal('detail-modal'); return; }
  const admin = isAdmin();
  const max = Math.max(0, f.stock);
  detailQty = Math.min(Math.max(1, detailQty), Math.max(1, max));
  $('#detail-content').innerHTML = `
    <div class="detail">
      ${mediaHTML(f)}
      <div class="detail-info">
        <span class="card-cat">${esc(f.category)}</span>
        <h2>${esc(f.name)}</h2>
        <p class="desc">${esc(f.description) || '<i>Sin descripción.</i>'}</p>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${priceHTML(f)}${hasDisc(f) ? `<span class="save-note">Ahorras ${money(round2(f.price - finalPrice(f)))}</span>` : ''}</div>
        <div class="info-rows">
          <div><span>Precio regular</span><b>${money(f.price)}</b></div>
          <div><span>Descuento</span><b>${hasDisc(f) ? f.discountPercent + '% activo' : 'Sin descuento'}</b></div>
          <div><span>Disponibles</span><b style="color:${f.stock <= 0 ? 'var(--bad)' : f.stock <= LOW_STOCK ? 'var(--warn)' : 'var(--ok)'}">${f.stock <= 0 ? 'Agotado' : f.stock + (f.stock === 1 ? ' porción' : ' porciones')}</b></div>
        </div>
        ${admin ? `
          <div class="buy-row"><button class="btn btn-primary" data-detail-edit>Editar comida</button></div>` : `
          <div class="buy-row">
            <div class="stepper"><button data-dq="-1" ${detailQty <= 1 || max <= 0 ? 'disabled' : ''} aria-label="Menos">−</button><span>${detailQty}</span><button data-dq="1" ${detailQty >= max ? 'disabled' : ''} aria-label="Más">+</button></div>
            <button class="btn btn-primary" data-detail-buy ${max <= 0 ? 'disabled' : ''}>${max <= 0 ? 'Agotado' : 'Comprar · ' + money(round2(finalPrice(f) * detailQty))}</button>
          </div>`}
      </div>
    </div>`;
}
$('#detail-content').addEventListener('click', e => {
  const dq = e.target.closest('[data-dq]'); if (dq) { detailQty += +dq.dataset.dq; renderDetail(); return; }
  if (e.target.closest('[data-detail-buy]')) { requestBuy(detailId, detailQty); return; }
  if (e.target.closest('[data-detail-edit]')) { const id = detailId; closeModal('detail-modal'); openFoodForm(id); }
});

/* ---------- Flujo de compra ---------- */
function requestBuy(id, qty = 1){
  const f = foods.find(x => x.id === id); if (!f) return;
  if (f.stock <= 0) { toast('Este platillo está agotado.', 'bad'); return; }
  if (!session) { pending = { id, qty }; openAuth('login', 'Para comprar necesitas iniciar sesión. Si no tienes cuenta, créala en un minuto.'); return; }
  if (isAdmin()) { toast('Estás en modo dueño. Inicia sesión con una cuenta de cliente para comprar.'); return; }
  const u = currentUser();
  if (u.loading) { toast('Cargando tu cuenta, inténtalo en un momento…'); return; }
  if (!u.address) { pending = { id, qty }; openAddress('Antes de comprar, agrega la dirección donde quieres recibir tu pedido.'); return; }
  addToCart(id, qty);
}
function resumePending(){ if (pending) { const p = pending; pending = null; requestBuy(p.id, p.qty); } }
async function addToCart(id, qty){
  const f = foods.find(x => x.id === id); if (!f) return;
  const items = cart.map(i => ({ ...i }));
  const item = items.find(i => i.foodId === id); const inCart = item ? item.qty : 0;
  if (inCart + qty > f.stock) {
    toast(`Solo hay ${f.stock} disponibles${inCart ? ` y ya tienes ${inCart} en tu carrito` : ''}.`, 'bad');
    return;
  }
  if (item) item.qty += qty; else items.push({ foodId: id, qty });
  const ok = await attempt(async () => { await Data.setCart(items); return true; });
  if (!ok) return;
  closeModal('detail-modal');
  render();
  toast(`${qty} × ${f.name} agregado al carrito`, 'ok', { label: 'Ver carrito', fn: openCart });
}

/* ---------- Autenticación ---------- */
function openAuth(tab = 'login', notice = ''){
  setAuthTab(tab);
  $('#auth-notice').textContent = notice; $('#auth-notice').classList.toggle('hidden', !notice);
  $('#login-form').reset(); $('#register-form').reset();
  openModal('auth-modal');
  setTimeout(() => (tab === 'login' ? $('#li-email') : $('#re-name')).focus(), 50);
}
function setAuthTab(tab){
  $$('.tabs [data-auth-tab]').forEach(b => b.classList.toggle('active', b.dataset.authTab === tab));
  $('#login-form').classList.toggle('hidden', tab !== 'login');
  $('#register-form').classList.toggle('hidden', tab !== 'register');
  $('#auth-title').textContent = tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta';
  hideAuthError(); $$('#register-form .field').forEach(f => f.classList.remove('invalid'));
}
function showAuthError(m){ $('#auth-error').textContent = m; $('#auth-error').classList.remove('hidden'); }
function hideAuthError(){ $('#auth-error').classList.add('hidden'); }
$('#auth-modal').addEventListener('click', e => { const t = e.target.closest('[data-auth-tab]'); if (t) setAuthTab(t.dataset.authTab); });

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault(); hideAuthError();
  const email = $('#li-email').value.trim().toLowerCase(); const pw = $('#li-pass').value;
  if (!email || !pw) { showAuthError('Escribe tu correo y contraseña.'); return; }
  const btn = $('#login-form button[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    await Data.login(email, pw);
  } catch (err) {
    console.error(err); showAuthError(errMsg(err)); return;
  } finally { btn.disabled = false; btn.textContent = 'Entrar'; }
  closeModal('auth-modal');
  if (isAdmin()) {
    pending = null;
    toast(`Bienvenida/o, ${firstName(currentAdmin().name)}. Modo dueño activado.`, 'ok');
    go('panel'); return;
  }
  render();
  toast(`¡Hola, ${firstName(currentUser().name)}!`, 'ok');
  resumePending();
});

$('#register-form').addEventListener('submit', async e => {
  e.preventDefault(); hideAuthError();
  const name = $('#re-name').value.trim(), email = $('#re-email').value.trim().toLowerCase(), p1 = $('#re-pass').value, p2 = $('#re-pass2').value;
  const checks = [
    ['#re-name', name.length >= 2], ['#re-email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)],
    ['#re-pass', p1.length >= 6], ['#re-pass2', p1 === p2 && p2.length > 0]
  ];
  let ok = true;
  checks.forEach(([sel, valid]) => { $(sel).closest('.field').classList.toggle('invalid', !valid); if (!valid) ok = false; });
  if (!ok) return;
  if (adminByEmail(email)) { showAuthError('Ese correo está reservado para el dueño del local. Usa otro.'); return; }
  const btn = $('#register-form button[type=submit]'); btn.disabled = true; btn.textContent = 'Creando cuenta…';
  try {
    await Data.register(name, email, p1);
  } catch (err) {
    console.error(err); showAuthError(errMsg(err)); return;
  } finally { btn.disabled = false; btn.textContent = 'Crear cuenta y entrar'; }
  closeModal('auth-modal'); render();
  toast(`¡Cuenta creada! Bienvenido/a, ${firstName(name)}.`, 'ok');
  if (pending) resumePending();
  else setTimeout(() => toast('Agrega tu dirección para poder comprar.', '', { label: 'Agregar', fn: () => openAddress() }), 400);
});

async function logout(){
  pending = null; closeCart(); $('#toasts').innerHTML = '';
  await attempt(() => Data.logout());
  session = null; profile = null; cart = []; orders = [];
  toast('Sesión cerrada.');
  go('menu');
}

/* ---------- Dirección ---------- */
const AD = { street: '#ad-street', colonia: '#ad-col', zip: '#ad-zip', city: '#ad-city', state: '#ad-state', phone: '#ad-phone', refs: '#ad-refs' };
function openAddress(notice = ''){
  const u = currentUser(); if (!u) return;
  const a = u.address || {};
  Object.entries(AD).forEach(([k, sel]) => { $(sel).value = a[k] || ''; $(sel).closest('.field').classList.remove('invalid'); });
  $('#address-notice').textContent = notice; $('#address-notice').classList.toggle('hidden', !notice);
  openModal('address-modal');
  setTimeout(() => $('#ad-street').focus(), 50);
}
$('#address-form').addEventListener('submit', async e => {
  e.preventDefault();
  const u = currentUser(); if (!u) return;
  const v = {}; Object.entries(AD).forEach(([k, sel]) => v[k] = $(sel).value.trim());
  v.phone = v.phone.replace(/\D/g, '');
  const rules = { street: v.street.length >= 3, colonia: !!v.colonia, zip: /^\d{5}$/.test(v.zip), city: !!v.city, state: !!v.state, phone: /^\d{10}$/.test(v.phone) };
  let ok = true;
  Object.entries(rules).forEach(([k, valid]) => { $(AD[k]).closest('.field').classList.toggle('invalid', !valid); if (!valid) ok = false; });
  if (!ok) return;
  const saved = await attempt(async () => { await Data.saveAddress(v); return true; }, $('#address-form button[type=submit]'));
  if (!saved) return;
  if (profile) profile.address = v;
  closeModal('address-modal'); render();
  toast('Dirección guardada.', 'ok');
  resumePending();
});
function addressText(a){ return a ? `${a.street}, Col. ${a.colonia}, ${a.city}, ${a.state}, C.P. ${a.zip}` : ''; }

/* ---------- Carrito ---------- */
function openCart(){
  if (!session) { openAuth('login', 'Inicia sesión para ver tu carrito.'); return; }
  if (isAdmin()) return;
  renderCart();
  $('#cart-drawer').classList.add('open'); $('#cart-backdrop').classList.add('open'); lockScroll();
}
function closeCart(){ $('#cart-drawer').classList.remove('open'); $('#cart-backdrop').classList.remove('open'); lockScroll(); }
$('#cart-backdrop').addEventListener('click', closeCart);

// Líneas del carrito con su platillo (ignora platillos que el dueño eliminó)
function cartLines(){
  return cart.map(i => ({ item: i, f: foods.find(x => x.id === i.foodId) }))
    .filter(l => l.f)
    .map(l => ({ ...l, available: l.f.stock > 0 && l.item.qty <= l.f.stock }));
}
function totals(lines){
  let regular = 0, subtotal = 0, count = 0;
  lines.forEach(({ item, f, available }) => { if (!available) return; regular += f.price * item.qty; subtotal += finalPrice(f) * item.qty; count += item.qty; });
  regular = round2(regular); subtotal = round2(subtotal);
  const savings = round2(regular - subtotal), shipping = count ? SHIPPING : 0;
  return { regular, subtotal, savings, shipping, total: round2(subtotal + shipping), count };
}
function renderCart(){
  const u = currentUser(); if (!u) { closeCart(); return; }
  const lines = cartLines();
  if (!lines.length) {
    $('#cart-body').innerHTML = `<div class="empty" style="padding:70px 10px"><div class="big">🛒</div><b>Tu carrito está vacío</b><br>Agrega platillos desde el menú.</div>`;
    $('#cart-foot').innerHTML = `<button class="btn btn-dark btn-block" data-close-cart>Ver menú</button>`;
    return;
  }
  $('#cart-body').innerHTML = lines.map(({ item, f, available }) => `
    <div class="cart-item">
      ${thumbHTML(f)}
      <div>
        <div class="nm">${esc(f.name)}</div>
        <div class="unit">${money(finalPrice(f))} c/u ${hasDisc(f) ? `<span style="text-decoration:line-through">${money(f.price)}</span>` : ''}</div>
        ${!available ? `<div class="warn">${f.stock <= 0 ? 'Se agotó — retíralo para continuar' : `Solo quedan ${f.stock}, ajusta la cantidad`}</div>` : ''}
        <div class="stepper" style="margin-top:8px"><button data-ci="-1" data-id="${f.id}" aria-label="Menos">−</button><span>${item.qty}</span><button data-ci="1" data-id="${f.id}" ${item.qty >= f.stock ? 'disabled' : ''} aria-label="Más">+</button></div>
      </div>
      <div class="right"><span class="line">${money(round2(finalPrice(f) * item.qty))}</span><button class="link-btn" style="color:var(--muted);font-size:13px" data-cremove="${f.id}">Quitar</button></div>
    </div>`).join('');
  const t = totals(lines);
  const blocked = lines.some(l => !l.available);
  $('#cart-foot').innerHTML = `
    <div class="addr-card"><div class="t"><span>Entregar en</span><button class="link-btn" data-act="address" style="font-size:13px;text-transform:none;letter-spacing:0">${u.address ? 'Cambiar' : 'Agregar'}</button></div>
      ${u.address ? `${esc(addressText(u.address))}<br><span class="muted">Tel. ${esc(u.address.phone)}</span>` : '<span class="muted">Sin dirección registrada.</span>'}</div>
    <div class="sum">
      <div><span>Productos (${t.count})</span><span>${money(t.regular)}</span></div>
      ${t.savings > 0 ? `<div class="save"><span>Descuentos</span><span>−${money(t.savings)}</span></div>` : ''}
      <div><span>Envío</span><span>${money(t.shipping)}</span></div>
      <div class="total"><span>Total</span><span>${money(t.total)}</span></div>
    </div>
    <button class="btn btn-primary btn-block" data-act="checkout" ${blocked || !t.count ? 'disabled' : ''}>Pagar ${money(t.total)}</button>`;
}
$('#cart-drawer').addEventListener('click', e => {
  if (e.target.closest('[data-close-cart]')) { closeCart(); go('menu'); return; }
  const ci = e.target.closest('[data-ci]');
  const rm = e.target.closest('[data-cremove]');
  if (!ci && !rm) return;
  const items = cart.map(i => ({ ...i }));
  if (ci) {
    const it = items.find(i => i.foodId === ci.dataset.id); const f = foods.find(x => x.id === ci.dataset.id);
    if (!it || !f) return;
    it.qty = Math.min(it.qty + +ci.dataset.ci, f.stock);
    if (it.qty <= 0) items.splice(items.indexOf(it), 1);
  } else {
    const i = items.findIndex(x => x.foodId === rm.dataset.cremove); if (i > -1) items.splice(i, 1);
  }
  attempt(async () => { await Data.setCart(items); render(); });
});

/* ---------- Pago ---------- */
function openCheckout(){
  const u = currentUser(); if (!u) return;
  if (!u.address) { openAddress('Agrega tu dirección de entrega antes de pagar.'); return; }
  const lines = cartLines().filter(l => l.available); if (!lines.length) return;
  const t = totals(lines);
  $('#checkout-summary').innerHTML = `
    <div class="ticket">
      ${lines.map(({ item, f }) => `<div class="r"><span>${item.qty} × ${esc(f.name)}</span><span>${money(round2(finalPrice(f) * item.qty))}</span></div>`).join('')}
      <hr>
      ${t.savings > 0 ? `<div class="r" style="color:var(--ok)"><span>Ahorro por descuentos</span><span>−${money(t.savings)}</span></div>` : ''}
      <div class="r"><span>Envío</span><span>${money(t.shipping)}</span></div>
      <div class="r" style="font-weight:700;font-size:16px"><span>Total a pagar</span><span>${money(t.total)}</span></div>
      <hr><div class="muted" style="font-size:13px">📍 ${esc(addressText(u.address))}</div>
    </div>`;
  $('#pay-form').reset(); $('#pc-name').value = u.name;
  $$('#pay-form .field').forEach(f => f.classList.remove('invalid')); $('#pay-error').classList.add('hidden');
  $('#pay-submit').textContent = 'Pagar ' + money(t.total);
  openModal('checkout-modal');
}
$('#pc-num').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '); });
$('#pc-exp').addEventListener('input', e => { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; });
$('#pc-cvv').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });

$('#pay-form').addEventListener('submit', async e => {
  e.preventDefault();
  const u = currentUser(); if (!u) return;
  const name = $('#pc-name').value.trim(), num = $('#pc-num').value.replace(/\D/g, ''), exp = $('#pc-exp').value, cvv = $('#pc-cvv').value;
  let expOk = false; const m = exp.match(/^(\d{2})\/(\d{2})$/);
  if (m) { const mm = +m[1], yy = 2000 + +m[2]; const now = new Date(); expOk = mm >= 1 && mm <= 12 && (yy > now.getFullYear() || (yy === now.getFullYear() && mm >= now.getMonth() + 1)); }
  const rules = [['#pc-name', name.length >= 3], ['#pc-num', num.length === 16], ['#pc-exp', expOk], ['#pc-cvv', /^\d{3,4}$/.test(cvv)]];
  let ok = true; rules.forEach(([s, v]) => { $(s).closest('.field').classList.toggle('invalid', !v); if (!v) ok = false; });
  if (!ok) return;

  const lines = cartLines();
  const problem = lines.find(l => !l.available);
  const showErr = msg => { $('#pay-error').textContent = msg; $('#pay-error').classList.remove('hidden'); };
  if (problem) { showErr(`"${problem.f.name}" ya no tiene stock suficiente. Revisa tu carrito.`); renderCart(); return; }
  const t = totals(lines);
  const d = new Date();
  const order = {
    folio: 'RF-' + d.toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    date: d.toISOString(),
    uid: u.uid,
    customer: { name: u.name, email: u.email },
    address: { ...u.address },
    items: lines.map(({ item, f }) => ({ foodId: f.id, name: f.name, qty: item.qty, unitPrice: finalPrice(f), regularPrice: f.price, discountPercent: hasDisc(f) ? f.discountPercent : 0 })),
    regular: t.regular, savings: t.savings, subtotal: t.subtotal, shipping: t.shipping, total: t.total,
    payment: { method: 'Tarjeta', last4: num.slice(-4), holder: name }, status: 'Pagado'
  };
  const btn = $('#pay-submit'); const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Procesando pago…'; $('#pay-error').classList.add('hidden');
  let saved;
  try { saved = await Data.checkout(order); }
  catch (err) { console.error(err); showErr(errMsg(err)); return; }
  finally { btn.disabled = false; btn.textContent = label; }
  cart = [];
  if (!orders.some(o => o.id === saved.id)) orders = sortOrders([saved, ...orders]);
  closeModal('checkout-modal'); closeCart(); render();
  openReceipt(saved);
});

function openReceipt(o){
  $('#receipt-content').innerHTML = `
    <div class="receipt-ok"><div class="check">✓</div><h2>¡Pago exitoso!</h2><div class="muted">Tu pedido ya está en preparación.</div></div>
    <div class="ticket">
      <div class="r"><span class="muted">Folio</span><b>${esc(o.folio)}</b></div>
      <div class="r"><span class="muted">Fecha</span><span>${esc(fmtDate(o.date))}</span></div>
      <div class="r"><span class="muted">Pago</span><span>Tarjeta •••• ${esc(o.payment.last4)}</span></div>
      <hr>
      ${o.items.map(i => `<div class="r"><span>${i.qty} × ${esc(i.name)}</span><span>${money(round2(i.unitPrice * i.qty))}</span></div>`).join('')}
      <hr>
      ${o.savings > 0 ? `<div class="r" style="color:var(--ok)"><span>Descuentos</span><span>−${money(o.savings)}</span></div>` : ''}
      <div class="r"><span>Envío</span><span>${money(o.shipping)}</span></div>
      <div class="r" style="font-weight:700;font-size:16px"><span>Total pagado</span><span>${money(o.total)}</span></div>
    </div>
    <button class="btn btn-primary btn-block" data-pdf="${esc(o.id)}">⬇ Descargar comprobante (PDF)</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" data-close>Seguir comprando</button>`;
  openModal('receipt-modal');
}
$('#receipt-content').addEventListener('click', e => { const b = e.target.closest('[data-pdf]'); if (b) downloadReceipt(b.dataset.pdf, b); });

/* ---------- Comprobante PDF ---------- */
function buildReceiptPDF(o){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 18, R = W - M;
  const ink = [42, 30, 23], muted = [122, 106, 94], brand = [220, 38, 38], line = [234, 223, 210];
  const m2 = n => fmt.format(n);

  // Encabezado
  doc.setFillColor(...brand); doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.text(RESTAURANT.name, M, 17);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(RESTAURANT.address, M, 25); doc.text(`Tel. ${RESTAURANT.phone}  |  ${RESTAURANT.email}`, M, 30);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('COMPROBANTE DE PAGO', R, 17, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`Folio: ${o.folio}`, R, 25, { align: 'right' });
  doc.text(fmtDate(o.date), R, 30, { align: 'right' });

  // Cliente y entrega
  let y = 52;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...muted);
  doc.text('CLIENTE', M, y); doc.text('DIRECCIÓN DE ENTREGA', 110, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...ink);
  const left = [o.customer.name, o.customer.email, 'Tel. ' + o.address.phone];
  const addrLines = doc.splitTextToSize(addressText(o.address) + (o.address.refs ? `. Ref.: ${o.address.refs}` : ''), R - 110);
  left.forEach((t, i) => doc.text(t, M, y + 6 + i * 5));
  addrLines.forEach((t, i) => doc.text(t, 110, y + 6 + i * 5));
  y += 6 + Math.max(left.length, addrLines.length) * 5 + 8;

  // Tabla
  const cols = { qty: M + 3, name: M + 18, unit: 128, disc: 152, amt: R - 3 };
  const header = () => {
    doc.setFillColor(251, 246, 239); doc.rect(M, y, R - M, 9, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...muted);
    doc.text('CANT.', cols.qty, y + 6); doc.text('PRODUCTO', cols.name, y + 6);
    doc.text('P. UNITARIO', cols.unit, y + 6, { align: 'right' }); doc.text('DESC.', cols.disc, y + 6, { align: 'right' });
    doc.text('IMPORTE', cols.amt, y + 6, { align: 'right' });
    y += 9;
  };
  header();
  doc.setFontSize(10);
  o.items.forEach(it => {
    const nameLines = doc.splitTextToSize(it.name, cols.unit - cols.name - 22);
    const h = nameLines.length * 5 + 5;
    if (y + h > 265) { doc.addPage(); y = 20; header(); doc.setFontSize(10); }
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...ink);
    doc.text(String(it.qty), cols.qty, y + 6);
    nameLines.forEach((t, i) => doc.text(t, cols.name, y + 6 + i * 5));
    doc.text(m2(it.unitPrice), cols.unit, y + 6, { align: 'right' });
    doc.setTextColor(...(it.discountPercent ? brand : muted));
    doc.text(it.discountPercent ? `-${it.discountPercent}%` : '-', cols.disc, y + 6, { align: 'right' });
    doc.setTextColor(...ink); doc.setFont('helvetica', 'bold');
    doc.text(m2(round2(it.unitPrice * it.qty)), cols.amt, y + 6, { align: 'right' });
    y += h;
    doc.setDrawColor(...line); doc.setLineWidth(0.2); doc.line(M, y, R, y);
  });

  // Totales
  if (y > 225) { doc.addPage(); y = 20; }
  y += 8;
  const ty0 = y;
  const tx = 128;
  const row = (label, val, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(opts.size || 10);
    doc.setTextColor(...(opts.color || ink));
    doc.text(label, tx, y); doc.text(val, R - 3, y, { align: 'right' }); y += opts.gap || 6;
  };
  row('Productos (precio regular)', m2(o.regular));
  if (o.savings > 0) row('Descuentos', '-' + m2(o.savings), { color: [21, 128, 61] });
  row('Subtotal', m2(o.subtotal));
  row('Envío', m2(o.shipping), { gap: 4 });
  doc.setDrawColor(...ink); doc.setLineWidth(0.4); doc.line(tx, y, R, y); y += 7;
  row('TOTAL PAGADO', m2(o.total), { bold: true, size: 13, color: brand, gap: 4 });

  // Método de pago
  const py = ty0;
  doc.setFillColor(251, 246, 239); doc.roundedRect(M, py - 5, 92, 30, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...muted); doc.text('MÉTODO DE PAGO', M + 5, py + 1);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...ink);
  doc.text(`Tarjeta terminación ${o.payment.last4}`, M + 5, py + 8);
  doc.text(`Titular: ${o.payment.holder}`, M + 5, py + 14);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(21, 128, 61); doc.text('Estado: PAGADO', M + 5, py + 20);

  // Pie
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...ink);
  doc.text('¡Gracias por tu compra!', W / 2, 272, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...muted);
  doc.text('Este documento es un comprobante de pago y no sustituye a una factura fiscal (CFDI).', W / 2, 278, { align: 'center' });
  doc.text(`${RESTAURANT.name}  |  Folio ${o.folio}`, W / 2, 283, { align: 'center' });

  return doc.output('blob');
}

let downloadsP = null;
function getDownloads(){
  if (downloadsP) return downloadsP;
  if (!(window.claude && typeof window.claude.use === 'function')) return Promise.resolve(null);
  downloadsP = Promise.race([
    Promise.resolve().then(() => window.claude.use('downloads')).catch(() => null),
    new Promise(r => setTimeout(() => r(null), 10000))
  ]);
  return downloadsP;
}
window.addEventListener('load', () => setTimeout(getDownloads, 0));

function plainDownload(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
async function downloadReceipt(orderId, btn){
  const o = orders.find(x => x.id === orderId); if (!o) return;
  if (!window.jspdf) { toast('El generador de PDF aún no carga. Revisa tu conexión e inténtalo de nuevo.', 'bad'); return; }
  const label = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando PDF…'; }
  try {
    const blob = buildReceiptPDF(o);
    const filename = `Comprobante-${o.folio}.pdf`;
    const dl = await getDownloads();
    if (dl) {
      try { await dl.save({ filename, data: blob }); toast('Comprobante descargado.', 'ok'); }
      catch (err) {
        const code = err && err.code;
        if (code === 'declined') toast('Descarga cancelada.');
        else if (code === 'rate_limited') toast('Espera un momento y vuelve a intentarlo.');
        else plainDownload(blob, filename);
      }
    } else {
      plainDownload(blob, filename);
    }
  } catch (err) {
    console.error(err); toast('No se pudo generar el PDF.', 'bad');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
  }
}

/* ---------- Mis pedidos (cliente) ---------- */
function ordersListHTML(list, showClient){
  if (!list.length) return `<div class="empty" style="background:#fff;border:1px solid var(--line);border-radius:var(--radius)"><div class="big">🧾</div>${showClient ? 'Todavía no hay pedidos.' : 'Aún no has hecho pedidos.<br><br><button class="btn btn-primary" data-go="menu">Ver menú</button>'}</div>`;
  return `<div class="orders">${list.map(o => `
    <div class="order">
      <div>
        <div class="fol">${esc(o.folio)} <span class="stock-badge s-ok" style="margin-left:6px">${esc(o.status)}</span></div>
        <div class="meta">${esc(fmtDate(o.date))}${showClient ? ` · ${esc(o.customer.name)} (${esc(o.customer.email)})` : ''}</div>
        <div class="items">${o.items.map(i => `${i.qty} × ${esc(i.name)}`).join(' · ')}</div>
        ${showClient ? `<div class="meta" style="margin-top:2px">📍 ${esc(addressText(o.address))}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:14px"><span class="tot">${money(o.total)}</span><button class="btn btn-sm" data-pdf="${esc(o.id)}">⬇ PDF</button></div>
    </div>`).join('')}</div>`;
}
function renderMyOrders(){
  $('#view-orders').innerHTML = `
    <div class="panel-head"><div><div class="eyebrow">Tu cuenta</div><h1>Mis pedidos</h1><p class="muted">Descarga el comprobante de cualquiera de tus compras.</p></div></div>
    ${ordersListHTML(orders, false)}`;
}
$('#view-orders').addEventListener('click', e => { const b = e.target.closest('[data-pdf]'); if (b) downloadReceipt(b.dataset.pdf, b); });

/* =========================================================
   PANEL DEL DUEÑO
   ========================================================= */
let panelTab = 'comidas', panelQ = '';
function renderPanel(){
  const a = currentAdmin();
  const withDisc = foods.filter(hasDisc).length;
  const low = foods.filter(f => f.stock > 0 && f.stock <= LOW_STOCK).length;
  const out = foods.filter(f => f.stock <= 0).length;
  const sales = round2(orders.reduce((s, o) => s + (o.total || 0), 0));
  $('#view-panel').innerHTML = `
    <div class="panel-head">
      <div><div class="eyebrow">Panel del dueño · ${esc(a.local || RESTAURANT.name)}</div><h1>Hola, ${esc(firstName(a.name))}</h1>
      <p class="muted">Agrega, edita o elimina comidas y controla precios, descuentos y stock. Todo se refleja al instante en el menú.</p></div>
      <button class="btn btn-primary" data-act="new-food">+ Agregar comida</button>
    </div>
    <div class="stats">
      <div class="stat"><div class="k">Comidas en menú</div><div class="v">${foods.length}</div></div>
      <div class="stat accent"><div class="k">Con descuento</div><div class="v">${withDisc}</div></div>
      <div class="stat warn"><div class="k">Stock bajo (≤${LOW_STOCK})</div><div class="v">${low}</div></div>
      <div class="stat bad"><div class="k">Agotadas</div><div class="v">${out}</div></div>
      <div class="stat"><div class="k">Ventas (${orders.length})</div><div class="v" style="font-size:24px">${money(sales)}</div></div>
    </div>
    <div class="toolbar">
      <div class="seg"><button class="${panelTab === 'comidas' ? 'active' : ''}" data-ptab="comidas">Comidas</button><button class="${panelTab === 'pedidos' ? 'active' : ''}" data-ptab="pedidos">Pedidos recibidos</button></div>
      ${panelTab === 'comidas' ? `<div class="search" style="max-width:280px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="panel-search" type="search" placeholder="Buscar comida…" value="${esc(panelQ)}"></div>` : ''}
    </div>
    <div id="panel-content"></div>`;
  renderPanelContent();
  const ps = $('#panel-search'); if (ps) ps.addEventListener('input', e => { panelQ = e.target.value; renderPanelContent(); });
}
function renderPanelContent(){
  const box = $('#panel-content'); if (!box) return;
  if (panelTab === 'pedidos') { box.innerHTML = ordersListHTML(orders, true); return; }
  const q = panelQ.trim().toLowerCase();
  const list = foods.filter(f => !q || f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
  if (!list.length) {
    box.innerHTML = `<div class="empty" style="background:#fff;border:1px solid var(--line);border-radius:var(--radius)"><div class="big">🍽️</div>${foods.length ? 'Sin resultados.' : 'Aún no hay comidas en el menú.<br><br><button class="btn btn-primary" data-act="new-food">+ Agregar comida</button> <button class="btn" data-act="seed">Cargar menú de ejemplo</button>'}</div>`;
    return;
  }
  box.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Comida</th><th>Descripción</th><th>Precio</th><th>Descuento</th><th>Precio final</th><th>Stock</th><th style="text-align:right">Acciones</th></tr></thead>
    <tbody>${list.map(f => `
      <tr>
        <td><div class="prod-cell">${thumbHTML(f)}<div><b>${esc(f.name)}</b><small>${esc(f.category)}</small></div></div></td>
        <td class="desc-cell">${esc(f.description.length > 90 ? f.description.slice(0, 90) + '…' : f.description)}</td>
        <td class="nowrap">${money(f.price)}</td>
        <td class="nowrap"><label class="switch" title="Activar / desactivar descuento"><input type="checkbox" data-disc="${f.id}" ${f.discountActive ? 'checked' : ''}><span class="track"></span>${f.discountPercent ? f.discountPercent + '%' : '—'}</label></td>
        <td class="nowrap"><b>${money(finalPrice(f))}</b>${hasDisc(f) ? `<span class="strike">${money(f.price)}</span>` : ''}</td>
        <td><div class="stock-cell"><button class="mini" data-stock="-1" data-id="${f.id}" ${f.stock <= 0 ? 'disabled' : ''} aria-label="Restar stock">−</button>${stockBadge(f.stock)}<button class="mini" data-stock="1" data-id="${f.id}" aria-label="Sumar stock">+</button></div></td>
        <td><div class="actions"><button class="btn btn-sm" data-edit="${f.id}">Editar</button><button class="btn btn-sm" style="color:var(--bad)" data-del="${f.id}">Eliminar</button></div></td>
      </tr>`).join('')}</tbody></table></div>`;
}
$('#view-panel').addEventListener('click', e => {
  const t = e.target.closest('[data-ptab]'); if (t) { panelTab = t.dataset.ptab; renderPanel(); return; }
  const ed = e.target.closest('[data-edit]'); if (ed) { openFoodForm(ed.dataset.edit); return; }
  const del = e.target.closest('[data-del]'); if (del) { askDelete(del.dataset.del); return; }
  const st = e.target.closest('[data-stock]');
  if (st) {
    const f = foods.find(x => x.id === st.dataset.id); if (!f) return;
    const stock = Math.max(0, f.stock + +st.dataset.stock);
    attempt(async () => { await Data.patchFood(f.id, { stock }); render(); });
    return;
  }
  const pdf = e.target.closest('[data-pdf]'); if (pdf) downloadReceipt(pdf.dataset.pdf, pdf);
});
$('#view-panel').addEventListener('change', e => {
  const d = e.target.closest('[data-disc]'); if (!d) return;
  const f = foods.find(x => x.id === d.dataset.disc); if (!f) return;
  const patch = { discountActive: d.checked };
  if (d.checked && !(f.discountPercent > 0)) patch.discountPercent = 10;
  attempt(async () => {
    await Data.patchFood(f.id, patch); render();
    if (patch.discountPercent) toast('Descuento activado al 10 %. Puedes cambiar el porcentaje en "Editar".');
    else toast(d.checked ? `Descuento del ${f.discountPercent}% activado en ${f.name}.` : `Descuento desactivado en ${f.name}.`);
  });
});

/* Formulario agregar / editar */
let editingId = null, formImage = '';
$('#fd-cat').innerHTML = CATEGORIES.map(c => `<option>${c}</option>`).join('');
$('#fd-emoji').innerHTML = EMOJIS.map(e => `<option value="${e}">${e}</option>`).join('');
function openFoodForm(id = null){
  if (!isAdmin()) return;
  editingId = id;
  const f = id ? foods.find(x => x.id === id) : null;
  $('#food-title').textContent = f ? 'Editar comida' : 'Agregar comida';
  $('#food-submit').textContent = f ? 'Guardar cambios' : 'Agregar al menú';
  $('#fd-name').value = f?.name || '';
  $('#fd-cat').value = f?.category || 'Platillos';
  $('#fd-emoji').value = f?.emoji || catStyle($('#fd-cat').value).emoji;
  $('#fd-desc').value = f?.description || '';
  $('#fd-price').value = f ? f.price : '';
  $('#fd-stock').value = f ? f.stock : '';
  $('#fd-disc-on').checked = !!f?.discountActive;
  $('#fd-disc').value = f?.discountPercent || '';
  formImage = f?.image || '';
  $$('#food-form .field').forEach(x => x.classList.remove('invalid'));
  syncFoodForm();
  openModal('food-modal');
  setTimeout(() => $('#fd-name').focus(), 50);
}
function syncFoodForm(){
  const on = $('#fd-disc-on').checked;
  $('#fd-disc-fields').classList.toggle('hidden', !on);
  const price = parseFloat($('#fd-price').value), pct = parseFloat($('#fd-disc').value);
  let msg = '';
  if (price > 0) {
    if (on && pct >= 1 && pct <= 90) msg = `Precio para el cliente: <b>${money(round2(price * (100 - pct) / 100))}</b> <span class="muted" style="text-decoration:line-through">${money(price)}</span> · ahorra ${money(round2(price * pct / 100))}`;
    else msg = `Precio para el cliente: <b>${money(price)}</b>${on ? ' <span class="muted">(escribe el % de descuento)</span>' : ''}`;
  }
  $('#fd-preview').innerHTML = msg;
  const st = catStyle($('#fd-cat').value);
  $('#fd-thumb').style.background = st.bg;
  $('#fd-thumb').innerHTML = formImage ? `<img src="${esc(formImage)}" alt="">` : esc($('#fd-emoji').value);
  $('#fd-file-clear').classList.toggle('hidden', !formImage);
  $('#fd-file-btn').textContent = formImage ? 'Cambiar foto' : 'Subir foto';
}
['#fd-disc-on', '#fd-price', '#fd-disc', '#fd-cat', '#fd-emoji'].forEach(s => { $(s).addEventListener('input', syncFoodForm); $(s).addEventListener('change', syncFoodForm); });
$('#fd-cat').addEventListener('change', () => { if (!editingId) { $('#fd-emoji').value = catStyle($('#fd-cat').value).emoji; syncFoodForm(); } });
$('#fd-file-btn').addEventListener('click', () => $('#fd-file').click());
$('#fd-file-clear').addEventListener('click', () => { formImage = ''; $('#fd-file').value = ''; syncFoodForm(); });
$('#fd-file').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try { formImage = await resizeImage(file, 600); syncFoodForm(); }
  catch (err) { toast('No se pudo leer la imagen.', 'bad'); }
});
// Reduce la foto para que quepa en un documento de Firestore (máx. 1 MB)
function resizeImage(file, max){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
$('#food-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!isAdmin()) return;
  const name = $('#fd-name').value.trim(), description = $('#fd-desc').value.trim();
  const price = round2(parseFloat($('#fd-price').value)), stockRaw = $('#fd-stock').value, stock = Number(stockRaw);
  const on = $('#fd-disc-on').checked, pct = Number($('#fd-disc').value);
  const rules = [
    ['#fd-name', name.length > 0], ['#fd-desc', description.length > 0], ['#fd-price', price > 0],
    ['#fd-stock', stockRaw !== '' && Number.isInteger(stock) && stock >= 0],
    ['#fd-disc', !on || (Number.isInteger(pct) && pct >= 1 && pct <= 90)]
  ];
  let ok = true; rules.forEach(([s, v]) => { $(s).closest('.field').classList.toggle('invalid', !v); if (!v) ok = false; });
  if (!ok) return;
  const data = { name, description, price, stock, category: $('#fd-cat').value, emoji: $('#fd-emoji').value, image: formImage, discountActive: on, discountPercent: on ? pct : (Number.isInteger(pct) && pct >= 1 && pct <= 90 ? pct : 0) };
  const wasEditing = editingId;
  const saved = await attempt(async () => { await Data.saveFood(wasEditing, data); return true; }, $('#food-submit'));
  if (!saved) return;
  closeModal('food-modal');
  toast(wasEditing ? `"${name}" actualizado.` : `"${name}" agregado al menú.`, 'ok');
  render();
});

/* Eliminar */
let confirmFn = null;
function askDelete(id){
  const f = foods.find(x => x.id === id); if (!f) return;
  $('#confirm-title').textContent = '¿Eliminar comida?';
  $('#confirm-text').innerHTML = `Se eliminará <b>${esc(f.name)}</b> del menú y de los carritos de los clientes. Esta acción no se puede deshacer.`;
  confirmFn = () => attempt(async () => { await Data.deleteFood(id); render(); toast(`"${f.name}" eliminado.`); });
  openModal('confirm-modal');
}
$('#confirm-ok').addEventListener('click', () => { closeModal('confirm-modal'); if (confirmFn) confirmFn(); confirmFn = null; });

/* =========================================================
   ACCIONES GLOBALES
   ========================================================= */
document.addEventListener('click', e => {
  const dd = e.target.closest('[data-dd]');
  $$('.dd.open').forEach(d => { if (!dd || d !== dd.parentElement) d.classList.remove('open'); });
  if (dd) { dd.parentElement.classList.toggle('open'); return; }
  const g = e.target.closest('[data-go]');
  if (g) { closeCart(); go(g.dataset.go); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act;
  if (act === 'login') openAuth('login');
  else if (act === 'logout') logout();
  else if (act === 'cart') openCart();
  else if (act === 'address') openAddress();
  else if (act === 'checkout') openCheckout();
  else if (act === 'new-food') openFoodForm();
  else if (act === 'seed') attempt(async () => { await Data.seedFoods(); render(); toast('Menú de ejemplo cargado.', 'ok'); }, a);
});
window.addEventListener('hashchange', render);

/* =========================================================
   ARRANQUE
   ========================================================= */
function showDataMode(){
  const el = $('#data-mode'); if (!el) return;
  const cloud = Data.mode === 'firebase';
  el.className = 'data-mode' + (cloud ? ' cloud' : '');
  el.innerHTML = `<span class="dot"></span>${cloud ? 'Datos en la nube · Firebase' : 'Modo local · los datos se guardan en este navegador'}`;
}
(async function start(){
  const cfg = window.FIREBASE_CONFIG || {};
  if (cfg.apiKey && cfg.projectId) {
    Data = FirebaseData;
    render(); // muestra "Cargando menú…"
    try {
      await FirebaseData.init();
    } catch (err) {
      console.error('No se pudo conectar con Firebase:', err);
      toast('No se pudo conectar con Firebase. Se usará el modo local.', 'bad');
      Data = LocalData; await LocalData.init();
    }
  } else {
    Data = LocalData; await LocalData.init();
  }
  showDataMode();
  render();
})();
