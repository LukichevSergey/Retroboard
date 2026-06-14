/**
 * Обработчик mousedown на карточке — начало drag-and-drop.
 * @param {MouseEvent} event — событие mousedown
 * @param {string} cardId — ID карточки
 */
function onCardDown(event, cardId) {
  if (event.target.closest('button, a, textarea, input, select, .comment-item, .comment-form, .comment-btn, .card-text')) return;
  const cardElement = document.getElementById('card-' + cardId);
  if (!cardElement) return;
  const rect = cardElement.getBoundingClientRect();
  state.dnd = {
    armed: true,
    active: false,
    cardId,
    ghost: null,
    ox: event.clientX - rect.left,
    oy: event.clientY - rect.top,
    startX: event.clientX,
    startY: event.clientY,
    targetCol: null,
    insertBefore: null,
  };
  document.addEventListener('mousemove', onDragMove, { passive: true });
  document.addEventListener('mouseup', onDragUp);
}

/**
 * Обработчик mousemove — обновление позиции ghost и определение целевой колонки.
 * @param {MouseEvent} event — событие mousemove
 */
function onDragMove(event) {
  if (!state.dnd || !state.dnd.armed) return;

  if (!state.dnd.active) {
    const dx = event.clientX - state.dnd.startX;
    const dy = event.clientY - state.dnd.startY;
    if (Math.sqrt(dx * dx + dy * dy) < 6) return;

    state.dnd.active = true;
    const cardElement = document.getElementById('card-' + state.dnd.cardId);
    if (!cardElement) return;
    const rect = cardElement.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'card-ghost';
    ghost.style.cssText = `width:${rect.width}px;left:${event.clientX - state.dnd.ox}px;top:${event.clientY - state.dnd.oy}px`;
    ghost.textContent = cardElement.querySelector('.card-text')?.textContent || '';
    document.body.appendChild(ghost);
    state.dnd.ghost = ghost;
    cardElement.classList.add('is-dragging');
    try {
      state._prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      if (window.getSelection && window.getSelection().removeAllRanges) window.getSelection().removeAllRanges();
    } catch (e) {
      // ignore
    }
  }

  state.dnd.ghost.style.left = (event.clientX - state.dnd.ox) + 'px';
  state.dnd.ghost.style.top = (event.clientY - state.dnd.oy) + 'px';
  document.querySelectorAll('.drop-ind').forEach(el => el.remove());
  const board = curBoard();
  if (!board) return;
  board.cols.forEach(col => document.querySelector(`.column[data-col="${col.id}"]`)?.classList.remove('drag-over'));
  let targetCol = null;
  board.cols.some(col => {
    const body = document.getElementById('cb-' + col.id);
    if (!body) return false;
    const rect = body.getBoundingClientRect();
    if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top - 30 && event.clientY <= rect.bottom + 30) {
      targetCol = col.id;
      return true;
    }
    return false;
  });
  state.dnd.targetCol = targetCol;
  if (!targetCol) return;
  document.querySelector(`.column[data-col="${targetCol}"]`)?.classList.add('drag-over');
  if (targetCol !== state.dnd.cardId && colOfCard(state.dnd.cardId) !== targetCol) {
    const body = document.getElementById('cb-' + targetCol);
    if (!body) return;
    const cardsContainer = body.querySelector('.cards-list') || body;
    const indicator = document.createElement('div');
    indicator.className = 'drop-ind';
    cardsContainer.appendChild(indicator);
  }
}

/**
 * Обработчик mousemove — завершение drag-and-drop, перемещение карточки.
 */
function onDragUp() {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragUp);
  document.querySelectorAll('.drop-ind').forEach(el => el.remove());
  const board = curBoard();
  if (board) board.cols.forEach(col => document.querySelector(`.column[data-col="${col.id}"]`)?.classList.remove('drag-over'));
  if (state.dnd && state.dnd.ghost) {
    state.dnd.ghost.remove();
    state.dnd.ghost = null;
  }
  const cardElement = state.dnd ? document.getElementById('card-' + state.dnd.cardId) : null;
  cardElement?.classList.remove('is-dragging');

  if (state.dnd && state.dnd.active && state.dnd.targetCol && board) {
    const card = state.cards[state.dnd.cardId];
    if (card) {
      const fromCol = card.columnId;

      if (fromCol !== state.dnd.targetCol) {
        card.columnId = state.dnd.targetCol;
        card.createdAt = Date.now();

        saveCard(card);
        showToast('Карточка перемещена');
      }
    }
  }
  state.dnd = { active: false, armed: false, cardId: null, ghost: null, ox: 0, oy: 0, startX: 0, startY: 0, targetCol: null, insertBefore: null };
  try {
    if (state._prevUserSelect !== undefined) {
      document.body.style.userSelect = state._prevUserSelect || '';
      delete state._prevUserSelect;
    }
  } catch (e) {
    // ignore
  }
  if (state._pendingBoardRender) renderBoard();
}

/**
 * Отменяет drag-and-drop если он активен.
 */
function cancelDragIfActive() {
  if (state.dnd && (state.dnd.armed || state.dnd.active)) {
    try {
      onDragUp();
    } catch (e) {
      state.dnd = { active: false, armed: false, cardId: null, ghost: null, ox: 0, oy: 0, startX: 0, startY: 0, targetCol: null, insertBefore: null };
    }
  }
}

window.onCardDown = onCardDown;

document.addEventListener('mousedown', event => {
  const popup = document.getElementById('colorPopup');
  if (popup?.classList.contains('open') && !popup.contains(event.target) && !event.target.closest('.card-color-btn')) {
    closeColorPopup();
  }
});

document.addEventListener('contextmenu', event => {
  if (state.dnd && (state.dnd.armed || state.dnd.active)) {
    cancelDragIfActive();
  }
});

document.addEventListener('pointercancel', () => cancelDragIfActive());
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDragIfActive(); });
window.addEventListener('blur', () => cancelDragIfActive());
