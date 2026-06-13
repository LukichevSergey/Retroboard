/**
 * Сохраняет текущее состояние всех досок и активную доску в localStorage.
 * Используется как fallback-хранилище, когда Firebase недоступен.
 * Данные сохраняются под ключом 'rb_v5' в формате JSON.
 * Карточки хранятся отдельно в state.cards для совместимости с новой структурой.
 *
 * Примечание: если Firebase подключён (firebaseOk === true),
 * сохранение в localStorage пропускается — приоритет у Firebase.
 */
function lsSave() {
  if (firebaseOk) return;
  try {
    localStorage.setItem('rb_v5', JSON.stringify({
      boards: state.boards,
      activeBoardId: state.activeBoardId,
      cards: state.cards,
    }));
  } catch (e) {
    console.warn('LS save failed', e);
  }
}

/**
 * Сохраняет реакции пользователя в localStorage под ключом 'rb_user_reactions'.
 * Формат: { [cardId]: [emoji1, emoji2, ...] }.
 */
function lsSaveUserReactions() {
  try {
    const data = {};
    for (const [cardId, emojiSet] of Object.entries(state.userReactions)) {
      data[cardId] = Array.from(emojiSet);
    }
    localStorage.setItem('rb_user_reactions', JSON.stringify(data));
  } catch (e) {
    console.warn('LS user reactions save failed', e);
  }
}

/**
 * Загружает из localStorage ранее сохранённые реакции пользователя.
 * Восстанавливает state.userReactions как { [cardId]: Set<emoji> }.
 */
function lsLoadUserReactions() {
  try {
    const saved = JSON.parse(localStorage.getItem('rb_user_reactions') || 'null');
    if (saved && typeof saved === 'object') {
      state.userReactions = {};
      for (const [cardId, emojis] of Object.entries(saved)) {
        if (Array.isArray(emojis)) {
          state.userReactions[cardId] = new Set(emojis);
        }
      }
    }
  } catch (e) {
    state.userReactions = {};
  }
}

/**
 * Загружает все доски, карточки и ID активной доски из localStorage.
 * Читает ключ 'rb_v5' (новый формат) или 'rb_v4' (старый формат для миграции).
 * Возвращает true, если данные успешно загружены.
 *
 * Используется при старте приложения, когда Firebase недоступен.
 */
function lsLoad() {
  try {
    let saved = JSON.parse(localStorage.getItem('rb_v5') || 'null');
    if (!saved) {
      saved = JSON.parse(localStorage.getItem('rb_v4') || 'null');
      if (saved && saved.boards) {
        state.cards = {};
        Object.values(saved.boards).forEach(board => {
          if (board.cards && typeof board.cards === 'object') {
            Object.values(board.cards).forEach(cards => {
              if (Array.isArray(cards)) {
                cards.forEach(card => {
                  state.cards[card.id] = card;
                });
              }
            });
          }
        });
        Object.values(saved.boards).forEach(board => {
          delete board.cards;
        });
        lsSave();
      }
    }
    if (!saved) return false;
    state.boards = saved.boards || {};
    state.activeBoardId = saved.activeBoardId || null;
    state.cards = saved.cards || state.cards || {};
    return true;
  } catch (e) {
    return false;
  }
}
