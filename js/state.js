/**
 * Глобальное состояние приложения (global state).
 * Все данные приложения хранятся в этом单一 объекте:
 *
 *   boards            — объект { boardId: boardData } со всеми досками,
 *   activeBoardId     — ID текущей активной доски (или null, если не выбрана),
 *   commentOpenState  — Set с ID карточек, у которых раскрыта секция комментариев,
 *   _newBoardMode     — режим модального окна создания доски ('create' | 'copy'),
 *   _pendingDelBoard  — ID доски, которую пользователь подтвердил на удаление,
 *   _newColScheme     — ID выбранной цветовой схемы для новой колонки,
 *   _colPickerTarget  — цель выбора цвета: { type: 'col', colId } или null,
 *   _cardPickerCardId — ID карточки для выбора цвета (или null),
 *   dnd               — состояние перетаскивания карточек (drag & drop):
 *     active    — идёт ли сейчас перетаскивание,
 *     armed     — drag «заряжен» (кнопка нажата, но ещё не начато движение),
 *     cardId    — ID перетаскиваемой карточки,
 *     ghost     — DOM-элемент «призрака» (визуальная копия при drag),
 *     ox, oy    — смещение курсора относительно левого верхнего угла карточки,
 *     startX/Y  — начальная позиция курсора (для определения порога начала drag),
 *     targetCol — ID колонки, куда перетаскивается карточка,
 *     insertBefore — ID карточки, перед которой будет вставлена (или null — в конец),
 *   bugReportText     — текущий текст баг-репорта,
 *   bugReportUnsub    — функция отписки от Firebase-подписки баг-репорта,
 *   localTimerSeconds — оставшееся время таймера в секундах,
 *   timerRunning      — запущен ли таймер сейчас,
 *   timerInterval     — ID интервала (setInterval) для локального отсчёта,
 *   globalTimerUnsub  — функция отписки от Firebase-подписки таймера,
 *   userReactions     — объект { [cardId]: Set<emoji> } — реакции текущего пользователя на карточки,
 *   _pendingBoardRender — флаг: есть ли отложенная перерисовка доски ( во время drag),
 *   _globalCardId     — счётчик для генерации уникальных ID карточек (инкрементируется).
 */
const state = {
  boards: {},
  activeBoardId: null,
  cards: {},
  boardCardsCache: {},
  comments: {},
  boardCommentsCache: {},
  cardsUnsub: null,
  commentsUnsubs: {},
  commentOpenState: new Set(),
  _loadingComments: new Set(),
  _newBoardMode: 'create',
  _pendingDelBoard: null,
  _newColScheme: 0,
  _colPickerTarget: null,
  _cardPickerCardId: null,
  dnd: { active: false, armed: false, cardId: null, ghost: null, ox: 0, oy: 0, startX: 0, startY: 0, targetCol: null, insertBefore: null },
  bugReportText: '',
  bugReportUnsub: null,
  localTimerSeconds: 300,
  timerRunning: false,
  timerInterval: null,
  globalTimerUnsub: null,
  userReactions: {},
  _pendingBoardRender: false,
};

/**
 * Возвращает объект текущей (активной) доски или null, если доска не выбрана.
 * Обращается к state.boards[state.activeBoardId].
 */
function curBoard() {
  return state.boards[state.activeBoardId] || null;
}

/**
 * Генерирует короткий уникальный строковый ID на основе текущего времени
 * и случайного числа. Используется для ID колонок, комментариев и досок.
 * Формат: timestamp-base36 + 4 символа random-base36.
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Возвращает или создаёт уникальный ID клиента (пользователя).
 * Сохраняется в localStorage под ключом 'rb.clientId', чтобы
 * идентификатор сохранялся между сессиями.
 * Используется для определения владельца карточек и комментариев.
 * В случае ошибки localStorage возвращает 'unknown'.
 */
function getClientId() {
  try {
    const key = 'rb.clientId';
    let id = localStorage.getItem(key);
    if (!id) {
      id = uid();
      localStorage.setItem(key, id);
    }
    return id;
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Экспорт функции getClientId в глобальную область window,
 * чтобы она была доступна из HTML-атрибутов (onclick и т.п.).
 */
window.getClientId = getClientId;
