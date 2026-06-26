function getTheme() {
  return localStorage.getItem('rb_theme') || 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('rb_theme', theme); } catch (e) {}
  if (typeof renderBoard === 'function') renderBoard();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

let _renderBoardRaf = null;
function scheduleRenderBoard() {
  if (_renderBoardRaf) return;
  _renderBoardRaf = requestAnimationFrame(() => {
    _renderBoardRaf = null;
    renderBoard();
  });
}

/**
 * Обрабатывает снапшот документа активной доски из Firebase.
 * Обновляет данные текущей доски и перерисовывает интерфейс.
 * @param {DocumentSnapshot} snapshot — снапшот документа доски
 */
function handleActiveBoardSnapshot(snapshot) {
  if (!snapshot.exists) {
    if (state.activeBoardId) {
      delete state.boards[state.activeBoardId];
      state.activeBoardId = null;
      showEmpty();
      renderSidebar();
    }
    return;
  }

  const boardId = snapshot.id;
  const boardData = snapshot.data();
  state.boards[boardId] = boardData;
  if (state.activeBoardId === boardId) renderBoard();
  renderSidebar();
}

async function loadBoards(all = false) {
  if (!firebaseOk) return;
  state.boardsLoading = true;
  renderSidebar();
  const query = all ? boardsCol().orderBy('createdAt', 'desc') : boardsCol().orderBy('createdAt', 'desc').limit(5);
  try {
    const snapshot = await query.get();
    state.boards = {};
    snapshot.forEach(doc => {
      state.boards[doc.id] = doc.data();
    });
    state.boardsLoadedAll = all || snapshot.size < 5;
    state.boardsLoading = false;
    renderSidebar();
  } catch (error) {
    console.error('Error loading boards:', error);
    state.boardsLoading = false;
    renderSidebar();
  }
}

function loadAllBoards() {
  if (!firebaseOk || state.boardsLoading) return;
  loadBoards(true);
}

function cleanEmptyReactions(card) {
  if (!card || !card.reactions) return;
  for (const [emoji, r] of Object.entries(card.reactions)) {
    if (!r.users || r.users.length === 0) delete card.reactions[emoji];
  }
}

/**
 * Обрабатывает снапшот изменений карточек активной доски.
 * Обновляет state.cards при добавлении/изменении/удалении карточек.
 * @param {QuerySnapshot} snapshot — снапшот изменений из Firebase
 */
function handleCardsSnapshot(snapshot) {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added' || change.type === 'modified') {
      const data = change.doc.data();
      data.id = String(change.doc.id);
      cleanEmptyReactions(data);
      state.cards[change.doc.id] = data;
    }
    if (change.type === 'removed') {
      delete state.cards[change.doc.id];
    }
  });
  if (state.activeBoardId) {
    const board = state.boards[state.activeBoardId];
    if (board && board.cols) {
      const colIds = new Set(board.cols.map(c => c.id));
      const filtered = {};
      for (const [id, card] of Object.entries(state.cards)) {
        if (colIds.has(card.columnId)) filtered[id] = card;
      }
      state.boardCardsCache[state.activeBoardId] = filtered;
    } else {
      state.boardCardsCache[state.activeBoardId] = { ...state.cards };
    }
  }
  scheduleRenderBoard();
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
      state.boardCommentsCache[state.activeBoardId] = JSON.parse(JSON.stringify(state.comments));
    }
    scheduleRenderBoard();
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
  Object.values(state.commentsUnsubs).forEach(unsub => unsub());
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
      const data = doc.data();
      data.id = String(doc.id);
      cleanEmptyReactions(data);
      state.cards[doc.id] = data;
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
  applyTheme(getTheme());
  if (isAdmin()) {
    const b = document.getElementById('adminBadge');
    if (b) b.style.display = '';
  }
  initFirebase();
  lsLoadUserReactions();
  if (firebaseOk) {
    await loadBoards(false);
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

  const canvas = document.getElementById('boardCanvas');
  if (canvas) {
    let isPanning = false, startX, startY, scrollLeft, scrollTop;
    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('.card, .column, .add-wrap, .add-col-btn, .empty-board')) return;
      isPanning = true;
      startX = e.pageX - canvas.offsetLeft;
      startY = e.pageY - canvas.offsetTop;
      scrollLeft = canvas.scrollLeft;
      scrollTop = canvas.scrollTop;
      canvas.style.cursor = 'grabbing';
      canvas.style.userSelect = 'none';
    });
    canvas.addEventListener('mousemove', e => {
      if (!isPanning) return;
      e.preventDefault();
      canvas.scrollLeft = scrollLeft - (e.pageX - canvas.offsetLeft - startX);
      canvas.scrollTop = scrollTop - (e.pageY - canvas.offsetTop - startY);
    });
    document.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        canvas.style.cursor = '';
        canvas.style.userSelect = '';
      }
    });
  }
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
