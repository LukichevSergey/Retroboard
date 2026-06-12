/**
 * Экранирует спецсимволы HTML в строке (дубликат esc() из ui.js).
 * Используется при выводе названий досок в селекте выбора шаблона.
 * @param {string} text — исходный текст
 * @returns {string} — экранированная строка
 */
function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
      options.push(`<option value="${board.id}">${escapeHtml(board.name)}</option>`);
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
function confirmNewBoard() {
  const name = document.getElementById('newBoardName').value.trim() || 'Новая доска';
  if (state._newBoardMode === 'copy') {
    doCopyBoard(name);
  } else {
    const sourceBoardId = document.getElementById('newBoardCopySource')?.value || null;
    doCreateBoard(name, sourceBoardId);
  }
  closeOverlay('newBoardOverlay');
}

/**
 * Переназначает все ID колонок и карточек в доске на новые уникальные значения.
 * Создаёт маппинг colIdMap { старый_ID: новый_ID }, затем обновляет:
 *   - board.cols (каждая колонка получает новый id),
 *   - board.cards (ключи — новые ID колонок, карточки — с новыми id).
 * Используется при создании новой доски и копировании, чтобы избежать
 * конфликтов ID.
 * @param {Object} board — объект доски (модифицируется на месте)
 */
function remapBoardIds(board) {
  const colIdMap = {};
  board.cols = board.cols.map(col => {
    const newId = 'c_' + uid();
    colIdMap[col.id] = newId;
    return { ...col, id: newId };
  });

  const newCards = {};
  let maxCardId = 0;
  Object.entries(board.cards).forEach(([oldColId, cards]) => {
    const newColId = colIdMap[oldColId] || oldColId;
    newCards[newColId] = cards.map(card => {
      const newId = nextGlobalCardId();
      maxCardId = Math.max(maxCardId, newId);
      return { ...card, id: newId };
    });
  });
  board.cards = newCards;
  board._nextId = Math.max(board._nextId || 0, maxCardId);
}

/**
 * Создаёт новую доску с дефолтными колонками.
 * Если указан sourceBoardId — копирует карточки из последней колонки
 * исходной доски в первую колонку новой (с переназначением ID и сбросом голосов).
 * Сохраняет в Firebase и localStorage, обновляет сайдбар, выбирает новую доску.
 * @param {string}      name          — название новой доски
 * @param {string|null} sourceBoardId — ID доски-источника для копирования карточек (или null)
 */
function doCreateBoard(name, sourceBoardId = null) {
  const id = 'b_' + uid();
  const board = {
    id,
    name,
    createdAt: Date.now(),
    cols: JSON.parse(JSON.stringify(DEFAULT_COLS)),
    cards: JSON.parse(JSON.stringify(DEFAULT_CARDS)),
    _nextId: 10,
    _nextColId: 5,
  };
  remapBoardIds(board);

  if (sourceBoardId) {
    const source = state.boards[sourceBoardId];
    if (source && Array.isArray(source.cols) && source.cols.length) {
      const lastCol = source.cols[source.cols.length - 1];
      const lastCards = source.cards?.[lastCol.id] || [];
      const targetColId = board.cols?.[0]?.id;
      if (targetColId && lastCards.length) {
        board.cards[targetColId] = lastCards.map(sourceCard => {
          const newId = nextGlobalCardId();
          return {
            id: newId,
            text: sourceCard.text,
            votes: 0,
            color: sourceCard.color || null,
            comments: (sourceCard.comments || []).map(comment => ({
              id: 'cm_' + uid(),
              text: comment.text,
              createdAt: comment.createdAt || Date.now(),
              modifiedAt: comment.modifiedAt || comment.createdAt || Date.now(),
              ownerId: comment.ownerId || getClientId(),
            })),
            ownerId: getClientId(),
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          };
        });
        board._nextId = Math.max(board._nextId || 0, ...board.cards[targetColId].map(card => card.id));
      }
    }
  }

  state.boards[id] = board;
  fbSave(board);
  lsSave();
  renderSidebar();
  selectBoard(id);
  showToast('Доска «' + name + '» создана');
}

/**
 * Копирует текущую доску с новым именем.
 * Создаёт глубокую копию текущей доски через JSON-сериализацию,
 * переназначает все ID (колонки + карточки), сбрасывает голоса (voted).
 * Сохраняет в Firebase и localStorage, выбирает новую доску.
 * @param {string} name — название для копии доски
 */
function doCopyBoard(name) {
  const source = curBoard();
  if (!source) return;
  const id = 'b_' + uid();
  const board = JSON.parse(JSON.stringify(source));
  board.id = id;
  board.name = name;
  board.createdAt = Date.now();
  remapBoardIds(board);
  Object.values(board.cards).forEach(arr => arr.forEach(card => { if ('voted' in card) delete card.voted; }));
  state.boards[id] = board;
  fbSave(board);
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
 * Удаляет из Firebase и state.boards. Если удалена активная доска —
 * сбрасывает activeBoardId и показывает пустое состояние.
 * Обновляет сайдбар и показывает toast.
 */
function doDelBoard() {
  if (!state._pendingDelBoard) return;
  fbDel(state._pendingDelBoard);
  delete state.boards[state._pendingDelBoard];
  if (state.activeBoardId === state._pendingDelBoard) {
    state.activeBoardId = null;
    showEmpty();
  }
  state._pendingDelBoard = null;
  closeOverlay('delBoardOverlay');
  lsSave();
  renderSidebar();
  showToast('Доска удалена');
}

/**
 * Закрывает оверлей по его ID (дубликат для изоляции модуля).
 * @param {string} id — ID HTML-элемента оверлея
 */
function closeOverlay(id) {
  document.getElementById(id)?.classList.remove('open');
}

/**
 * Экспорт функций досок в глобальную область window.
 */
window.openNewBoardModal = openNewBoardModal;
window.copyBoard = copyBoard;
window.confirmNewBoard = confirmNewBoard;
window.confirmDelBoard = confirmDelBoard;
