/**
 * Заполняет выпадающий список (select) опциями досок для копирования колонок.
 * Сортирует доски по дате создания (новые сверху).
 * Первая опция — «Не заполнять» (без копирования).
 * @param {string} selectedId — ID предварительно выбранной доски (по умолчанию '')
 */
function fillNewBoardCopySourceOptions(selectedId = '') {
  const select = document.getElementById('newBoardCopySource');
  if (!select) return;
  const options = ['<option value="">Не заполнять</option>'];
  Object.values(state.boards)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach(board => {
      options.push(`<option value="${board.id}">${esc(board.name)}</option>`);
    });
  select.innerHTML = options.join('');
  select.value = selectedId || '';
}

/**
 * Открывает модальное окно создания новой доски.
 * Устанавливает заголовок «Новая доска», подсказку, текст кнопки «Создать».
 * Очищает поле ввода названия, показывает строку выбора шаблона (copy source).
 * Заполняет select досками для копирования. Фокусирует поле ввода.
 */
function openNewBoardModal() {
  state._newBoardMode = 'create';
  document.getElementById('newBoardModalTitle').textContent = 'Новая доска';
  document.getElementById('newBoardModalSub').textContent = 'Введите название, например «Sprint #43».';
  document.getElementById('newBoardConfirmBtn').textContent = 'Создать';
  document.getElementById('newBoardName').value = '';
  const sourceRow = document.getElementById('newBoardCopySourceRow');
  if (sourceRow) sourceRow.style.display = '';
  fillNewBoardCopySourceOptions();
  document.getElementById('newBoardOverlay').classList.add('open');
  setTimeout(() => document.getElementById('newBoardName').focus(), 60);
}

/**
 * Открывает модальное окно копирования текущей доски.
 * Устанавливает заголовок «Копировать доску», текст кнопки «Копировать».
 * Предзаполняет название: «имя (копия)». Скрывает строку выбора шаблона
 * (копируется текущая доска). Фокусирует и выделяет поле ввода.
 */
function copyBoard() {
  const board = curBoard();
  if (!board) return;
  state._newBoardMode = 'copy';
  document.getElementById('newBoardModalTitle').textContent = 'Копировать доску';
  document.getElementById('newBoardModalSub').textContent = 'Введите название для копии. Все колонки и карточки будут скопированы.';
  document.getElementById('newBoardConfirmBtn').textContent = 'Копировать';
  document.getElementById('newBoardName').value = board.name + ' (копия)';
  const sourceRow = document.getElementById('newBoardCopySourceRow');
  if (sourceRow) sourceRow.style.display = 'none';
  document.getElementById('newBoardOverlay').classList.add('open');
  setTimeout(() => {
    const input = document.getElementById('newBoardName');
    input.focus();
    input.select();
  }, 60);
}

/**
 * Обрабатывает нажатие кнопки «Создать» / «Копировать» в модальном окне.
 * Читает название из input (или «Новая доска» по умолчанию).
 * В зависимости от режима (_newBoardMode) вызывает doCopyBoard или doCreateBoard.
 * Закрывает модальное окно.
 */
async function confirmNewBoard() {
  const name = document.getElementById('newBoardName').value.trim() || 'Новая доска';
  if (state._newBoardMode === 'copy') {
    await doCopyBoard(name);
  } else {
    const sourceBoardId = document.getElementById('newBoardCopySource')?.value || null;
    await doCreateBoard(name, sourceBoardId);
  }
  closeOverlay('newBoardOverlay');
}

/**
 * Переназначает все ID колонок в доске на новые уникальные значения.
 * Возвращает маппинг colIdMap { старый_ID: новый_ID } для обновления card.columnId.
 * @param {Object} board — объект доски (модифицируется на месте)
 * @returns {Object} — маппинг старых ID колонок на новые
 */
function remapBoardIds(board) {
  const colIdMap = {};
  board.cols = board.cols.map(col => {
    const newId = 'c_' + uid();
    colIdMap[col.id] = newId;
    return { ...col, id: newId };
  });
  return colIdMap;
}

/**
 * Создаёт новую доску с дефолтными колонками.
 * Сохраняет доску и карточки в подколлекции Firebase.
 * @param {string}      name          — название новой доски
 * @param {string|null} sourceBoardId — ID доски-источника для копирования карточек (или null)
 */
async function doCreateBoard(name, sourceBoardId = null) {
  const id = 'b_' + uid();
  const board = {
    id,
    name,
    createdAt: Date.now(),
    cols: JSON.parse(JSON.stringify(DEFAULT_COLS)),
  };
  const colIdMap = remapBoardIds(board);

  const cardsToSave = [];
  if (sourceBoardId) {
    const source = state.boards[sourceBoardId];
    if (source && Array.isArray(source.cols) && source.cols.length) {
      const lastCol = source.cols[source.cols.length - 1];

      let sourceCards = Object.values(state.cards).filter(c => c.columnId === lastCol.id);
      if (sourceCards.length === 0 && firebaseOk) {
        try {
          const snap = await cardsCol(sourceBoardId).get();
          sourceCards = [];
          snap.forEach(doc => {
            const data = doc.data();
            if (data.columnId === lastCol.id) sourceCards.push(data);
          });
        } catch (e) {
          console.error('Error loading source board cards:', e);
        }
      }

      const targetColId = board.cols?.[0]?.id;
      if (targetColId && sourceCards.length) {
        sourceCards.forEach(sourceCard => {
          const newId = uid();
          cardsToSave.push({
            id: newId,
            text: sourceCard.text,
            votes: 0,
            color: sourceCard.color || null,
            ownerId: getClientId(),
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            columnId: targetColId,
          });
        });
        board._nextId = Math.max(board._nextId || 0, ...cardsToSave.map(c => c.id));
      }
    }
  }

  state.boards[id] = board;
  await fbSave(board);
  for (const card of cardsToSave) {
    await fbSaveCard(id, card);
  }
  lsSave();
  renderSidebar();
  selectBoard(id);
  showToast('Доска «' + name + '» создана');
}

/**
 * Копирует текущую доску с новым именем.
 * Сохраняет доску и карточки в подколлекции Firebase.
 * @param {string} name — название для копии доски
 */
async function doCopyBoard(name) {
  const source = curBoard();
  if (!source) return;
  const id = 'b_' + uid();
  const board = JSON.parse(JSON.stringify(source));
  board.id = id;
  board.name = name;
  board.createdAt = Date.now();
  delete board.cards;
  const colIdMap = remapBoardIds(board);

  const sourceColIds = new Set(source.cols.map(c => c.id));
  const sourceCards = Object.values(state.cards).filter(c => sourceColIds.has(c.columnId));
  const cardsToSave = [];
  sourceCards.forEach(sourceCard => {
    const newId = uid();
    const newColId = colIdMap[sourceCard.columnId] || sourceCard.columnId;
    cardsToSave.push({
      ...sourceCard,
      id: newId,
      columnId: newColId,
      votes: 0,
    });
    if ('voted' in cardsToSave[cardsToSave.length - 1]) delete cardsToSave[cardsToSave.length - 1].voted;
  });

  state.boards[id] = board;
  await fbSave(board);
  for (const card of cardsToSave) {
    await fbSaveCard(id, card);
  }
  lsSave();
  renderSidebar();
  selectBoard(id);
  showToast('Доска скопирована');
}

/**
 * Открывает модальное окно подтверждения удаления доски.
 * Показывает название доски и предупреждение о необратимости.
 * Привязывает обработчик кнопки «Удалить» к doDelBoard.
 * @param {string} id — ID доски для удаления
 */
function confirmDelBoard(id) {
  state._pendingDelBoard = id;
  const board = state.boards[id];
  document.getElementById('delBoardTitle').textContent = `Удалить «${board?.name}»?`;
  document.getElementById('delBoardMsg').textContent = 'Все колонки и карточки будут удалены безвозвратно.';
  document.getElementById('delBoardOk').onclick = doDelBoard;
  document.getElementById('delBoardOverlay').classList.add('open');
}

/**
 * Выполняет удаление доски после подтверждения.
 * Удаляет карточки из подколлекции, затем доску из Firebase.
 * Если удалена активная доска — сбрасывает activeBoardId.
 */
async function doDelBoard() {
  if (!isAdmin()) { alert('Только админ может удалять доски.'); return; }
  if (!state._pendingDelBoard) return;
  const boardId = state._pendingDelBoard;
  const board = state.boards[boardId];
  const boardColIds = board ? new Set(board.cols.map(c => c.id)) : new Set();

  if (firebaseOk) {
    try {
      const cardsSnapshot = await cardsCol(boardId).get();
      const batch = db.batch();
      cardsSnapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (e) {
      console.error('Error deleting cards subcollection:', e);
    }
  }

  await fbDel(boardId);

  Object.keys(state.cards).forEach(cardId => {
    if (boardColIds.has(state.cards[cardId]?.columnId)) {
      delete state.cards[cardId];
    }
  });

  delete state.boards[boardId];

  if (state.activeBoardId === boardId) {
    state.activeBoardId = null;
    state.cards = {};
    state.comments = {};
    unsubscribeBoardDoc();
    if (state.cardsUnsub) { state.cardsUnsub(); state.cardsUnsub = null; }
    Object.values(state.commentsUnsubs).forEach(unsub => unsub());
    state.commentsUnsubs = {};
    showEmpty();
  }
  state._pendingDelBoard = null;
  closeOverlay('delBoardOverlay');
  lsSave();
  renderSidebar();
  showToast('Доска удалена');
}

/**
 * Экспорт функций досок в глобальную область window.
 */
window.openNewBoardModal = openNewBoardModal;
window.copyBoard = copyBoard;
window.confirmNewBoard = confirmNewBoard;
window.confirmDelBoard = confirmDelBoard;
