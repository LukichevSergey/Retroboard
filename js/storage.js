/**
 * Сохраняет текущее состояние всех досок и активную доску в localStorage.
 * Используется как fallback-хранилище, когда Firebase недоступен.
 * Данные сохраняются под ключом 'rb_v4' в формате JSON.
 *
 * Примечание: если Firebase подключён (firebaseOk === true),
 * сохранение в localStorage пропускается — приоритет у Firebase.
 */
function lsSave() {
  if (firebaseOk) return;
  try {
    localStorage.setItem('rb_v4', JSON.stringify({ boards: state.boards, activeBoardId: state.activeBoardId }));
  } catch (e) {
    console.warn('LS save failed', e);
  }
}

/**
 * Сохраняет множество ID карточек, за которые пользователь уже голосовал,
 * в localStorage под ключом 'rb_user_votes'.
 * Массив преобразуется из Set через Array.from() перед сериализацией.
 * Позволяет сохранять состояние «я уже голосовал» между сессиями.
 */
function lsSaveUserVotes() {
  try {
    localStorage.setItem('rb_user_votes', JSON.stringify(Array.from(state.userVotes)));
  } catch (e) {
    console.warn('LS user votes save failed', e);
  }
}

/**
 * Загружает из localStorage ранее сохранённые голоса пользователя.
 * Читает ключ 'rb_user_votes', парсит JSON-массив и восстанавливает
 * множество state.userVotes. Если данных нет или произошла ошибка —
 * создаёт пустой Set.
 */
function lsLoadUserVotes() {
  try {
    const saved = JSON.parse(localStorage.getItem('rb_user_votes') || 'null');
    if (Array.isArray(saved)) {
      state.userVotes = new Set(saved);
    }
  } catch (e) {
    state.userVotes = new Set();
  }
}

/**
 * Загружает все доски и ID активной доски из localStorage.
 * Читает ключ 'rb_v4', парсит JSON и заполняет state.boards и
 * state.activeBoardId. Возвращает true, если данные успешно загружены,
 * и false, если ключ не найден или произошла ошибка парсинга.
 *
 * Используется при старте приложения, когда Firebase недоступен.
 */
function lsLoad() {
  try {
    const saved = JSON.parse(localStorage.getItem('rb_v4') || 'null');
    if (!saved) return false;
    state.boards = saved.boards || {};
    state.activeBoardId = saved.activeBoardId || null;
    return true;
  } catch (e) {
    return false;
  }
}
