/**
 * Открывает модальное окно создания новой колонки.
 * Сбрасывает выбранную цветовую схему на 0 (зелёную),
 * очищает поле ввода названия, рендерит сетку выбора цвета,
 * показывает оверлей и фокусирует поле ввода.
 */
function openAddCol() {
  state._newColScheme = 0;
  document.getElementById('newColName').value = '';
  renderSchemeGrid();
  document.getElementById('newColOverlay').classList.add('open');
  setTimeout(() => document.getElementById('newColName').focus(), 60);
}

/**
 * Рендерит сетку выбора цветовой схемы для заголовка колонки.
 * Создаёт HTML из массива COL_SCHEMES, подсвечивает текущий выбранный вариант.
 * Каждый элемент при клике вызывает selectScheme(id).
 */
function renderSchemeGrid() {
  const schemeGrid = document.getElementById('schemeGrid');
  if (!schemeGrid) return;
  schemeGrid.innerHTML = COL_SCHEMES.map(scheme => `
    <div class="scheme-tile ${scheme.id === state._newColScheme ? 'selected' : ''}" onclick="selectScheme(${scheme.id})"
         style="background:${scheme.bg}">
      <div class="scheme-dot" style="background:${scheme.dot}"></div>
      <span class="scheme-name" style="color:${scheme.text}">${scheme.name}</span>
    </div>`).join('');
}

/**
 * Устанавливает выбранную цветовую схему для новой колонки.
 * Обновляет state._newColScheme и перерисовывает сетку.
 * @param {number} id — ID схемы из COL_SCHEMES
 */
function selectScheme(id) {
  state._newColScheme = id;
  renderSchemeGrid();
}

/**
 * Создаёт новую колонку в текущей доске.
 * Сохраняет в Firebase и localStorage, закрывает модалку,
 * перерисовывает доску и фокусирует поле ввода названия новой колонки.
 */
function confirmNewCol() {
  const board = curBoard();
  if (!board) return;
  const label = document.getElementById('newColName').value.trim() || 'Новая колонка';
  const colId = 'c_' + uid();
  board.cols.push({ id: colId, label, s: state._newColScheme });
  fbSave(board);
  lsSave();
  closeOverlay('newColOverlay');
  renderBoard();
  setTimeout(() => {
    const input = document.getElementById('cli-' + colId);
    if (input) {
      input.focus();
      input.select();
    }
  }, 40);
}

/**
 * Переименовывает колонку.
 * Находит колонку по ID в текущей доске, обновляет label (trim + fallback).
 * Сохраняет в Firebase и localStorage. Вызывается из onblur/onchange
 * textarea в заголовке колонки.
 * @param {string} colId — ID колонки
 * @param {string} value — новое название
 */
function renameCol(colId, value) {
  const board = curBoard();
  if (!board) return;
  const column = board.cols.find(col => col.id === colId);
  if (!column) return;
  column.label = value.trim() || column.label;
  fbSave(board);
  lsSave();
}

/**
 * Открывает палитру выбора цвета для заголовка колонки.
 * Сохраняет цель выбора в state._colPickerTarget, формирует HTML палитры
 * из COL_SCHEMES. Подсвечивает текущий цвет. Позиционирует палитру.
 * @param {MouseEvent} event — событие клика
 * @param {string} colId     — ID колонки
 */
function openColSchemePopup(event, colId) {
  event.stopPropagation();
  state._colPickerTarget = { type: 'col', colId };
  const swatches = document.getElementById('colorSwatches');
  document.getElementById('colorPopupTitle').textContent = 'Цвет заголовка';
  const board = curBoard();
  const column = board?.cols.find(c => c.id === colId);
  swatches.innerHTML = COL_SCHEMES.map(scheme => `
    <div class="swatch ${column?.s === scheme.id ? 'active' : ''}"
         style="background:${scheme.bg}; border-color:${column?.s === scheme.id ? scheme.dot : 'transparent'}; outline: 2px solid ${scheme.dot}; outline-offset:1px;"
         title="${scheme.name}"
         onclick="applyColScheme('${colId}',${scheme.id})">
    </div>`).join('');
  positionPopup(event);
}

/**
 * Применяет выбранную цветовую схему к заголовку колонки.
 * Обновляет поле column.s, сохраняет в Firebase и localStorage,
 * закрывает палитру и перерисовывает доску.
 * @param {string} colId    — ID колонки
 * @param {number} schemeId — ID цветовой схемы из COL_SCHEMES
 */
function applyColScheme(colId, schemeId) {
  const board = curBoard();
  if (!board) return;
  const column = board.cols.find(col => col.id === colId);
  if (!column) return;
  column.s = schemeId;
  fbSave(board);
  lsSave();
  closeColorPopup();
  renderBoard();
}

/**
 * Открывает модальное окно подтверждения удаления колонки.
 * Показывает название колонки и количество карточек в ней.
 * @param {string} colId — ID колонки для удаления
 */
function confirmDelCol(colId) {
  state._pendingDelCol = colId;
  const board = curBoard();
  const column = board?.cols.find(col => col.id === colId);
  const count = getCardsForColumn(colId).length;
  document.getElementById('delColTitle').textContent = `Удалить «${column?.label}»?`;
  document.getElementById('delColMsg').textContent = count > 0
    ? `В колонке ${count} карт${count === 1 ? 'очка' : count < 5 ? 'очки' : 'очек'}. Все будут удалены.`
    : 'Колонка пустая.';
  document.getElementById('delColOk').onclick = doDelCol;
  document.getElementById('delColOverlay').classList.add('open');
}

/**
 * Выполняет удаление колонки после подтверждения.
 * Удаляет колонку из board.cols и все карточки колонки из Firebase.
 */
async function doDelCol() {
  const board = curBoard();
  if (!board || !state._pendingDelCol) return;
  const colId = state._pendingDelCol;

  const cardsToDelete = getCardsForColumn(colId);
  for (const card of cardsToDelete) {
    delete state.cards[card.id];
    fbDelCard(board.id, card.id);
  }

  board.cols = board.cols.filter(col => col.id !== colId);
  state._pendingDelCol = null;
  closeOverlay('delColOverlay');
  fbSave(board);
  lsSave();
  renderBoard();
  showToast('Колонка удалена');
}

/**
 * Закрывает оверлей по его ID (дубликат для изоляции модуля).
 * @param {string} id — ID HTML-элемента оверлея
 */
function closeOverlay(id) {
  document.getElementById(id)?.classList.remove('open');
}

/**
 * Экспорт функций колонок в глобальную область window.
 */
window.openAddCol = openAddCol;
window.selectScheme = selectScheme;
window.confirmNewCol = confirmNewCol;
window.openColSchemePopup = openColSchemePopup;
window.applyColScheme = applyColScheme;
window.confirmDelCol = confirmDelCol;
window.renameCol = renameCol;
