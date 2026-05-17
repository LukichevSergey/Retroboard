
function openAddCol() {
  state._newColScheme = 0;
  document.getElementById('newColName').value = '';
  renderSchemeGrid();
  document.getElementById('newColOverlay').classList.add('open');
  setTimeout(() => document.getElementById('newColName').focus(), 60);
}

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

function selectScheme(id) {
  state._newColScheme = id;
  renderSchemeGrid();
}

function confirmNewCol() {
  const board = curBoard();
  if (!board) return;
  const label = document.getElementById('newColName').value.trim() || 'Новая колонка';
  const colId = 'c_' + uid();
  board.cols.push({ id: colId, label, s: state._newColScheme });
  board.cards[colId] = [];
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

function renameCol(colId, value) {
  const board = curBoard();
  if (!board) return;
  const column = board.cols.find(col => col.id === colId);
  if (!column) return;
  column.label = value.trim() || column.label;
  fbSave(board);
  lsSave();
}

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

function confirmDelCol(colId) {
  state._pendingDelCol = colId;
  const board = curBoard();
  const column = board?.cols.find(col => col.id === colId);
  const count = (board?.cards[colId] || []).length;
  document.getElementById('delColTitle').textContent = `Удалить «${column?.label}»?`;
  document.getElementById('delColMsg').textContent = count > 0
    ? `В колонке ${count} карт${count === 1 ? 'очка' : count < 5 ? 'очки' : 'очек'}. Все будут удалены.`
    : 'Колонка пустая.';
  document.getElementById('delColOk').onclick = doDelCol;
  document.getElementById('delColOverlay').classList.add('open');
}

function doDelCol() {
  const board = curBoard();
  if (!board || !state._pendingDelCol) return;
  board.cols = board.cols.filter(col => col.id !== state._pendingDelCol);
  delete board.cards[state._pendingDelCol];
  state._pendingDelCol = null;
  closeOverlay('delColOverlay');
  fbSave(board);
  lsSave();
  renderBoard();
  showToast('Колонка удалена');
}

function closeOverlay(id) {
  document.getElementById(id)?.classList.remove('open');
}

window.openAddCol = openAddCol;
window.selectScheme = selectScheme;
window.confirmNewCol = confirmNewCol;
window.openColSchemePopup = openColSchemePopup;
window.applyColScheme = applyColScheme;
window.confirmDelCol = confirmDelCol;
window.renameCol = renameCol;
