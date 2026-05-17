
let db = null;
let firebaseOk = false;
let unsub = null;

function initFirebase() {
  try {
    if (FIREBASE_CONFIG.apiKey === 'PASTE_YOUR_apiKey_HERE') throw new Error('Конфиг не заполнен');
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    db.enablePersistence().catch(() => {});
    firebaseOk = true;
    setSyncBadge('ok', 'Подключено');
  } catch (e) {
    console.warn('Firebase:', e.message);
    firebaseOk = false;
    setSyncBadge('offline', 'Локально');
  }
}

function boardsCol() {
  return db.collection('retroBoards');
}

function boardDoc(id) {
  return boardsCol().doc(id);
}

async function fbSave(board) {
  if (!firebaseOk) return;
  setSyncBadge('syncing', 'Сохранение…');
  try {
    await boardDoc(board.id).set(board);
    setSyncBadge('ok', 'Сохранено');
  } catch (e) {
    console.error(e);
    setSyncBadge('offline', 'Ошибка');
  }
}

async function fbDel(id) {
  if (!firebaseOk) return;
  try {
    await boardDoc(id).delete();
  } catch (e) {
    console.error(e);
  }
}

function subscribeBoards(onChange, onError) {
  if (!firebaseOk) return;
  if (unsub) unsub();
  unsub = boardsCol().onSnapshot(onChange, onError);
}

function timerDocRef() {
  return db.collection('global').doc('timer');
}
