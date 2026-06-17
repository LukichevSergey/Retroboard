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
 * Возвращает ссылку на коллекцию досок в Firestore.
 * Используется коллекция 'retroBoardsV2' (отдельно от оригинальной 'retroBoards').
 * Оригинальная коллекция остаётся нетронутой как бекап.
 */
function boardsCol() {
  return db.collection('retroBoardsV2');
}

/**
 * Возвращает ссылку на конкретный документ доски по её ID.
 * @param {string} id — ID доски (например, 'b_m1a2b3c4')
 */
function boardDoc(id) {
  return boardsCol().doc(id);
}

/**
 * Обёртка для Firebase-операций с обновлением badge состояния синхронизации.
 * Устанавливает 'Сохранение…' перед вызовом, 'Сохранено' при успехе, 'Ошибка' при ошибке.
 * @param {Function} asyncFn — асинхронная функция для выполнения
 * @returns {*} — результат asyncFn или undefined при ошибке
 */
let _syncBadgeTimer = null;

function resetSyncBadge() {
  clearTimeout(_syncBadgeTimer);
  _syncBadgeTimer = setTimeout(() => {
    if (firebaseOk) setSyncBadge('ok', 'Подключено');
  }, 2000);
}

async function fbWithSyncBadge(asyncFn) {
  if (!firebaseOk) return;
  setSyncBadge('syncing', 'Сохранение…');
  try {
    const result = await asyncFn();
    setSyncBadge('ok', 'Сохранено');
    resetSyncBadge();
    return result;
  } catch (e) {
    console.error(e);
    setSyncBadge('offline', 'Ошибка');
    resetSyncBadge();
  }
}

/**
 * Сохраняет (создаёт или перезаписывает) доску в Firebase Firestore.
 * Используется только для создания новой доски.
 * @param {Object} board — объект доски с полями id, name, cols, cards и т.д.
 */
async function fbSave(board) {
  await fbWithSyncBadge(() => boardDoc(board.id).set(board));
}

/**
 * Обновляет отдельные поля документа доски в Firebase Firestore.
 * Используется вместо fbSave для обновлений — не перезаписывает весь документ,
 * а обновляет только указанные поля (предотвращает гонки при параллельных правках).
 * @param {string} boardId — ID доски
 * @param {Object} fields — объект с полями для обновления (например { name: '...' } или { cols: [...] })
 */
async function fbUpdateBoard(boardId, fields) {
  await fbWithSyncBadge(() => boardDoc(boardId).update(fields));
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

// --- Подколлекции: карточки и комментарии ---

/**
 * Возвращает ссылку на подколлекцию карточек доски.
 * @param {string} boardId — ID доски
 */
function cardsCol(boardId) {
  return boardDoc(boardId).collection('cards');
}

/**
 * Возвращает ссылку на конкретную карточку.
 * @param {string} boardId — ID доски
 * @param {number|string} cardId — ID карточки
 */
function cardDoc(boardId, cardId) {
  return cardsCol(boardId).doc(String(cardId));
}

/**
 * Возвращает ссылку на подколлекцию комментариев карточки.
 * @param {string} boardId — ID доски
 * @param {number|string} cardId — ID карточки
 */
function commentsCol(boardId, cardId) {
  return cardDoc(boardId, cardId).collection('comments');
}

/**
 * Возвращает ссылку на конкретный комментарий.
 * @param {string} boardId — ID доски
 * @param {number|string} cardId — ID карточки
 * @param {string} commentId — ID комментария
 */
function commentDoc(boardId, cardId, commentId) {
  return commentsCol(boardId, cardId).doc(commentId);
}

/**
 * Сохраняет карточку в подколлекцию cards.
 * Используется только для создания новой карточки.
 * @param {string} boardId — ID доски
 * @param {Object} card — объект карточки
 */
async function fbSaveCard(boardId, card) {
  await fbWithSyncBadge(() => cardDoc(boardId, card.id).set(card));
}

/**
 * Обновляет отдельные поля документа карточки в Firebase Firestore.
 * Используется вместо fbSaveCard для обновлений — не перезаписывает весь документ,
 * а обновляет только указанные поля (предотвращает гонки при параллельных правках).
 * @param {string} boardId — ID доски
 * @param {string} cardId — ID карточки
 * @param {Object} fields — объект с полями для обновления (например { text: '...', color: '#fff' })
 */
async function fbUpdateCard(boardId, cardId, fields) {
  await fbWithSyncBadge(() => cardDoc(boardId, cardId).update(fields));
}

/**
 * Удаляет карточку из подколлекции cards.
 * @param {string} boardId — ID доски
 * @param {number|string} cardId — ID карточки
 */
async function fbDelCard(boardId, cardId) {
  if (!firebaseOk) return;
  try {
    await cardDoc(boardId, cardId).delete();
  } catch (e) {
    console.error(e);
  }
}

/**
 * Сохраняет комментарий в подколлекцию comments карточки.
 * Используется только для создания нового комментария.
 * @param {string} boardId — ID доски
 * @param {number|string} cardId — ID карточки
 * @param {Object} comment — объект комментария
 */
async function fbSaveComment(boardId, cardId, comment) {
  await fbWithSyncBadge(() => commentDoc(boardId, cardId, comment.id).set(comment));
}

/**
 * Обновляет отдельные поля документа комментария в Firebase Firestore.
 * Используется вместо fbSaveComment для обновлений — не перезаписывает весь документ,
 * а обновляет только указанные поля (предотвращает гонки при параллельных правках).
 * @param {string} boardId — ID доски
 * @param {number|string} cardId — ID карточки
 * @param {string} commentId — ID комментария
 * @param {Object} fields — объект с полями для обновления (например { text: '...' })
 */
async function fbUpdateComment(boardId, cardId, commentId, fields) {
  await fbWithSyncBadge(() => commentDoc(boardId, cardId, commentId).update(fields));
}

/**
 * Удаляет комментарий из подколлекции comments.
 * @param {string} boardId — ID доски
 * @param {number|string} cardId — ID карточки
 * @param {string} commentId — ID комментария
 */
async function fbDelComment(boardId, cardId, commentId) {
  if (!firebaseOk) return;
  try {
    await commentDoc(boardId, cardId, commentId).delete();
  } catch (e) {
    console.error(e);
  }
}

/**
 * Атомарно обновляет реакции карточки в Firestore.
 * @param {string} boardId — ID доски
 * @param {number|string} cardId — ID карточки
 * @param {string} emoji — эмодзи реакции
 * @param {boolean} add — true для добавления, false для удаления
 * @param {string} userId — ID пользователя
 */
async function fbUpdateReaction(boardId, cardId, emoji, add, userId) {
  await fbWithSyncBadge(async () => {
    const update = {};
    update[`reactions.${emoji}.count`] = firebase.firestore.FieldValue.increment(add ? 1 : -1);
    if (add) {
      update[`reactions.${emoji}.users`] = firebase.firestore.FieldValue.arrayUnion(userId);
    } else {
      update[`reactions.${emoji}.users`] = firebase.firestore.FieldValue.arrayRemove(userId);
    }
    await cardDoc(boardId, cardId).update(update);
  });
}

/**
 * Атомарно обновляет commentCount карточки в Firestore.
 * @param {string} boardId — ID доски
 * @param {number|string} cardId — ID карточки
 * @param {number} delta — величина изменения (+1 или -1)
 */
async function fbUpdateCommentCount(boardId, cardId, delta) {
  if (!firebaseOk) return;
  try {
    await cardDoc(boardId, cardId).update({
      commentCount: firebase.firestore.FieldValue.increment(delta),
    });
  } catch (e) {
    console.error(e);
  }
}

/**
 * Подписывается на изменения карточек доски в реальном времени.
 * @param {string} boardId — ID доски
 * @param {Function} onChange — callback с snapshot изменений
 * @param {Function} onError — callback при ошибке
 * @returns {Function|null} — функция отписки или null
 */
function subscribeCards(boardId, onChange, onError) {
  if (!firebaseOk) return null;
  return cardsCol(boardId).onSnapshot(onChange, onError);
}

/**
 * Подписывается на изменения комментариев карточки в реальном времени.
 * @param {string} boardId — ID доски
 * @param {number|string} cardId — ID карточки
 * @param {Function} onChange — callback с snapshot изменений
 * @param {Function} onError — callback при ошибке
 * @returns {Function|null} — функция отписки или null
 */
function subscribeComments(boardId, cardId, onChange, onError) {
  if (!firebaseOk) return null;
  return commentsCol(boardId, cardId).onSnapshot(onChange, onError);
}
