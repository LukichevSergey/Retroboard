/**
 * Глобальные переменные для работы с Firebase:
 *   db         — экземпляр Firestore (хранилище данных),
 *   firebaseOk — флаг: успешно ли подключились к Firebase,
 *   unsub      — функция отписки от текущей подписки на коллекцию досок.
 */
let db = null;
let firebaseOk = false;
let unsub = null;

/**
 * Инициализирует Firebase и подключается к Firestore.
 * Проверяет, что конфигурация заполнена (apiKey не является placeholder'ом).
 * При успешной инициализации:
 *   - включает offline-персистентность (кэширование данных),
 *   - устанавливает badge «Подключено».
 * При ошибке:
 *   - устанавливает badge «Локально»,
 *   - firebaseOk остаётся false — приложение работает в оффлайн-режиме.
 */
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

/**
 * Возвращает ссылку на коллекцию 'retroBoards' в Firestore.
 * Все доски хранятся в этой коллекции, документы — по ID доски.
 */
function boardsCol() {
  return db.collection('retroBoards');
}

/**
 * Возвращает ссылку на конкретный документ доски по её ID.
 * @param {string} id — ID доски (например, 'b_m1a2b3c4')
 */
function boardDoc(id) {
  return boardsCol().doc(id);
}

/**
 * Сохраняет (создаёт или перезаписывает) доску в Firebase Firestore.
 * Обновляет badge состояния синхронизации: 'Сохранение…' → 'Сохранено' / 'Ошибка'.
 * Использует метод set(), который перезаписывает весь документ.
 * @param {Object} board — объект доски с полями id, name, cols, cards и т.д.
 */
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

/**
 * Удаляет доску из Firebase Firestore по её ID.
 * @param {string} id — ID доски для удаления
 */
async function fbDel(id) {
  if (!firebaseOk) return;
  try {
    await boardDoc(id).delete();
  } catch (e) {
    console.error(e);
  }
}

/**
 * Подписывается на все изменения в коллекции 'retroBoards' в реальном времени.
 * При каждом изменении (добавление, изменение, удаление документа) вызывается回调 onChange.
 * При ошибке —回调 onError. Перед созданием новой подписки отменяет предыдущую (если есть).
 * @param {Function} onChange — callback, получающий snapshot изменений
 * @param {Function} onError  — callback при ошибке подписки
 */
function subscribeBoards(onChange, onError) {
  if (!firebaseOk) return;
  if (unsub) unsub();
  unsub = boardsCol().onSnapshot(onChange, onError);
}

/**
 * Возвращает ссылку на документ глобального таймера в Firestore.
 * Таймер хранится в коллекции 'global', документ 'timer'.
 * Содержит поля: running (boolean), durationSec, startTimestamp, updatedAt.
 */
function timerDocRef() {
  return db.collection('global').doc('timer');
}
