/**
 * Обрабатывает снапшот изменений коллекции досок из Firebase.
 * Перебирает изменения (added, modified, removed):
 *   - added/modified: обновляет state.boards и перерисовывает доску, если она активна.
 *   - removed: удаляет из state.boards, сбрасывает activeBoardId если удалена активная.
 * После обработки всех изменений перерисовывает сайдбар.
 * @param {QuerySnapshot} snapshot — снапшот изменений из Firebase
 */
async function handleBoardSnapshot(snapshot) {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added' || change.type === 'modified') {
      state.boards[change.doc.id] = change.doc.data();
      if (state.activeBoardId === change.doc.id) renderBoard();
    }
    if (change.type === 'removed') {
      delete state.boards[change.doc.id];
      if (state.activeBoardId === change.doc.id) {
        state.activeBoardId = null;
        showEmpty();
      }
    }
  });
  renderSidebar();
}

/**
 * Обрабатывает снапшот изменений карточек активной доски.
 * Обновляет state.cards при добавлении/изменении/удалении карточек.
 * @param {QuerySnapshot} snapshot — снапшот изменений из Firebase
 */
function handleCardsSnapshot(snapshot) {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added' || change.type === 'modified') {
      state.cards[change.doc.id] = change.doc.data();
    }
    if (change.type === 'removed') {
      delete state.cards[change.doc.id];
    }
  });
  if (state.activeBoardId) {
    state.boardCardsCache[state.activeBoardId] = { ...state.cards };
  }
  renderBoard();
}

/**
 * Обрабатывает снапшот изменений комментариев карточки.
 * Обновляет state.comments[cardId] при добавлении/изменении/удалении.
 * @param {string} cardId — ID карточки
 * @returns {Function} — callback для onSnapshot
 */
function makeCommentsHandler(cardId) {
  return function(snapshot) {
    const comments = [];
    snapshot.forEach(doc => comments.push(doc.data()));
    state.comments[cardId] = comments;
    if (state.activeBoardId) {
      state.boardCommentsCache[state.activeBoardId] = { ...state.comments };
    }
    renderBoard();
  };
}

/**
 * Загружает карточки доски из Firebase и подписывается на real-time обновления.
 * Отменяет предыдущую подписку (если была). Для оффлайн-режима — данные уже в state.
 * @param {string} boardId — ID доски
 */
async function loadBoardCards(boardId) {
  if (state.cardsUnsub) {
    state.cardsUnsub();
    state.cardsUnsub = null;
  }
  state.comments = {};
  state.commentsUnsubs = {};

  const cached = state.boardCardsCache[boardId];

  if (cached) {
    state.cards = { ...cached };
    state.comments = { ...(state.boardCommentsCache[boardId] || {}) };
    state.cardsUnsub = subscribeCards(boardId, handleCardsSnapshot, error => {
      console.error('Cards subscription error:', error);
    });
    renderBoard();
    return;
  }

  const inner = document.getElementById('boardInner');
  if (inner) inner.classList.add('board-loading');

  if (!firebaseOk) {
    state.cards = {};
    if (inner) inner.classList.remove('board-loading');
    renderBoard();
    return;
  }

  try {
    const snapshot = await cardsCol(boardId).get();
    state.cards = {};
    snapshot.forEach(doc => {
      state.cards[doc.id] = doc.data();
    });
    state.boardCardsCache[boardId] = { ...state.cards };
  } catch (error) {
    console.error('Error loading cards:', error);
    state.cards = {};
  }

  state.cardsUnsub = subscribeCards(boardId, handleCardsSnapshot, error => {
    console.error('Cards subscription error:', error);
  });

  if (inner) inner.classList.remove('board-loading');
  renderBoard();
}

/**
 * Главная функция запуска (boot) приложения.
 * 1) Инициализирует Firebase.
 * 2) Загружает голоса пользователя из localStorage.
 * 3) Если Firebase доступен:
 *    - Загружает все доски из Firestore (one-time get).
 *    - Подписывается на обновления в реальном времени.
 *    - Подписывается на баг-репорт (если функция доступна).
 * 4) Если Firebase недоступен:
 *    - Загружает данные из localStorage.
 *    - Загружает баг-репорт локально.
 * 5) Скрывает loading screen, показывает основной интерфейс.
 * 6) Инициализирует таймер, состояние сайдбара, рендерит сайдбар.
 * 7) Выбирает самую новую доску (или первую попавшуюся).
 */
async function boot() {
  initFirebase();
  lsLoadUserReactions();
  if (firebaseOk) {
    try {
      const snapshot = await boardsCol().get();
      snapshot.forEach(doc => {
        state.boards[doc.id] = doc.data();
      });
    } catch (error) {
      console.error(error);
    }
    subscribeBoards(handleBoardSnapshot, error => console.error(error));
    if (typeof subscribeBugReport === 'function') subscribeBugReport();
  } else {
    lsLoad();
    if (typeof loadBugReportLocal === 'function') loadBugReportLocal();
  }

  document.getElementById('loadingScreen')?.classList.add('hidden');
  document.getElementById('appShell').style.display = '';
  initGlobalTimer();
  initSidebarState();
  renderSidebar();

  const firstBoard = Object.values(state.boards).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  if (firstBoard) selectBoard(firstBoard.id);
}

/**
 * Инициализирует глобальные обработчики событий интерфейса:
 * 1) Клик по оверлею (вне содержимого) — закрывает его.
 * 2) Ctrl/Cmd + Enter — добавляет карточку во все открытые формы.
 * 3) Escape — закрывает все оверлеи, палитру цветов, формы добавления.
 * 4) Enter в поле «Название доски» — подтверждает создание.
 * 5) Enter в поле «Название колонки» — подтверждает создание.
 */
function initializeShellEvents() {
  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.classList.remove('open');
    });
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      const board = curBoard();
      if (!board) return;
      board.cols.forEach(col => {
        const form = document.getElementById('af-' + col.id);
        if (form?.classList.contains('open')) addCard(col.id);
      });
    }

    if (event.key === 'Escape') {
      document.querySelectorAll('.overlay.open').forEach(overlay => overlay.classList.remove('open'));
      closeColorPopup();
      closeEmojiPicker();
      const board = curBoard();
      if (!board) return;
      board.cols.forEach(col => closeAdd(col.id));
    }
  });

  document.getElementById('newBoardName')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') window.confirmNewBoard();
  });

  document.getElementById('newColName')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') window.confirmNewCol();
  });
}

/**
 * Инициализирует обработчики событий при загрузке страницы
 * и запускает boot(). Если boot() падает — скрывает loading screen
 * и показывает основной интерфейс (чтобы приложение не осталось в состоянии загрузки).
 */
initializeShellEvents();
boot().catch(error => {
  console.error('Boot failed:', error);
  document.getElementById('loadingScreen')?.classList.add('hidden');
  document.getElementById('appShell').style.display = '';
});
