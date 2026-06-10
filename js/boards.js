
function openNewBoardModal() {
  state._newBoardMode = 'create';
  document.getElementById('newBoardModalTitle').textContent = 'Новая доска';
  document.getElementById('newBoardModalSub').textContent = 'Введите название, например «Sprint #43».';
  document.getElementById('newBoardConfirmBtn').textContent = 'Создать';
  document.getElementById('newBoardName').value = '';
  document.getElementById('newBoardOverlay').classList.add('open');
  setTimeout(() => document.getElementById('newBoardName').focus(), 60);
}

function copyBoard() {
  const board = curBoard();
  if (!board) return;
  state._newBoardMode = 'copy';
  document.getElementById('newBoardModalTitle').textContent = 'Копировать доску';
  document.getElementById('newBoardModalSub').textContent = 'Введите название для копии. Все колонки и карточки будут скопированы.';
  document.getElementById('newBoardConfirmBtn').textContent = 'Копировать';
  document.getElementById('newBoardName').value = board.name + ' (копия)';
  document.getElementById('newBoardOverlay').classList.add('open');
  setTimeout(() => {
    const input = document.getElementById('newBoardName');
    input.focus();
    input.select();
  }, 60);
}

function confirmNewBoard() {
  const name = document.getElementById('newBoardName').value.trim() || 'Новая доска';
  if (state._newBoardMode === 'copy') {
    doCopyBoard(name);
  } else {
    doCreateBoard(name);
  }
  closeOverlay('newBoardOverlay');
}

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

function doCreateBoard(name) {
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
  state.boards[id] = board;
  fbSave(board);
  lsSave();
  renderSidebar();
  selectBoard(id);
  showToast('Доска «' + name + '» создана');
}

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

function confirmDelBoard(id) {
  state._pendingDelBoard = id;
  const board = state.boards[id];
  document.getElementById('delBoardTitle').textContent = `Удалить «${board?.name}»?`;
  document.getElementById('delBoardMsg').textContent = 'Все колонки и карточки будут удалены безвозвратно.';
  document.getElementById('delBoardOk').onclick = doDelBoard;
  document.getElementById('delBoardOverlay').classList.add('open');
}

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

function closeOverlay(id) {
  document.getElementById(id)?.classList.remove('open');
}

window.openNewBoardModal = openNewBoardModal;
window.copyBoard = copyBoard;
window.confirmNewBoard = confirmNewBoard;
window.confirmDelBoard = confirmDelBoard;
