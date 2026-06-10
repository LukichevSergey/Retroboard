
function colOfCard(cardId) {
  const board = curBoard();
  if (!board) return null;
  return Object.keys(board.cards).find(colId => board.cards[colId].some(card => card.id === cardId)) || null;
}

function openAdd(colId) {
  const trigger = document.getElementById('at-' + colId);
  const form = document.getElementById('af-' + colId);
  if (!form || !trigger) return;
  trigger.style.display = 'none';
  form.classList.add('open');
  setTimeout(() => document.getElementById('atx-' + colId)?.focus(), 30);
}

function closeAdd(colId) {
  const trigger = document.getElementById('at-' + colId);
  const form = document.getElementById('af-' + colId);
  if (!form || !trigger) return;
  form.classList.remove('open');
  trigger.style.display = '';
  const input = document.getElementById('atx-' + colId);
  if (input) input.value = '';
}

function addCard(colId) {
  const board = curBoard();
  if (!board) return;
  const input = document.getElementById('atx-' + colId);
  const text = input?.value.trim();
  if (!text) return;
  const newId = nextGlobalCardId();
  board._nextId = Math.max(board._nextId || 0, newId);
  board.cards[colId].push({ id: newId, text, votes: 0, color: null, comments: [], ownerId: getClientId(), createdAt: Date.now(), modifiedAt: Date.now() });
  closeAdd(colId);
  fbSave(board);
  lsSave();
  renderBoard();
  showToast('Карточка добавлена');
}

function delCard(cardId) {
  const board = curBoard();
  if (!board) return;
  const col = colOfCard(cardId);
  if (!col) return;
  const card = board.cards[col].find(c => c.id === cardId);
  if (!card) return;
  // Only owner can delete (or disallow if owner missing)
  const clientId = getClientId();
  if (!card.ownerId) {
    alert('Эта карточка не имеет владельца и не может быть удалена.');
    return;
  }
  if (card.ownerId !== clientId) {
    alert('Вы не можете удалить чужую карточку.');
    return;
  }
  // Ask for confirmation before deleting
  const confirmed = window.confirm('Вы уверены, что хотите удалить карточку "' + card.text.substring(0, 30) + (card.text.length > 30 ? '...' : '') + '"?\n\nЭто действие нельзя отменить.');
  if (!confirmed) return;
  board.cards[col] = board.cards[col].filter(card => card.id !== cardId);
  fbSave(board);
  lsSave();
  renderBoard();
  showToast('Карточка удалена');
}

function vote(cardId) {
  const board = curBoard();
  if (!board) return;
  const col = colOfCard(cardId);
  if (!col) return;
  const card = board.cards[col].find(card => card.id === cardId);
  if (!card) return;

  const hasVoted = state.userVotes.has(cardId);
  if (hasVoted) {
    card.votes = Math.max(0, card.votes - 1);
    state.userVotes.delete(cardId);
  } else {
    card.votes = (card.votes || 0) + 1;
    state.userVotes.add(cardId);
  }
  if ('voted' in card) delete card.voted;

  fbSave(board);
  lsSave();
  lsSaveUserVotes();
  renderBoard();
}

function openCardColorPopup(event, cardId) {
  event.stopPropagation();
  state._cardPickerCardId = cardId;
  const board = curBoard();
  const columnId = colOfCard(cardId);
  const card = columnId ? board.cards[columnId].find(card => card.id === cardId) : null;
  const currentColor = card?.color || null;
  document.getElementById('colorPopupTitle').textContent = 'Цвет карточки';
  const swatches = document.getElementById('colorSwatches');
  swatches.innerHTML = `
    <div class="swatch none-swatch ${currentColor === null ? 'active' : ''}" title="По умолчанию" onclick="applyCardColor(${cardId},null)">
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>` +
    CARD_COLORS.map(color => `
      <div class="swatch ${currentColor === color.hex ? 'active' : ''}"
           style="background:${color.hex}; border:1.5px solid rgba(0,0,0,.12);"
           title="${color.label}"
           onclick="applyCardColor(${cardId},'${color.hex}')">
      </div>`).join('');
  positionPopup(event);
}

function applyCardColor(cardId, color) {
  const board = curBoard();
  if (!board) return;
  const col = colOfCard(cardId);
  if (!col) return;
  const card = board.cards[col].find(card => card.id === cardId);
  if (!card) return;
  card.color = color;
  fbSave(board);
  lsSave();
  closeColorPopup();
  renderBoard();
}

function toggleComments(cardId) {
  if (state.commentOpenState.has(cardId)) {
    state.commentOpenState.delete(cardId);
  } else {
    state.commentOpenState.add(cardId);
  }
  renderBoard();
}

function saveComment(cardId) {
  const board = curBoard();
  if (!board) return;
  const col = colOfCard(cardId);
  if (!col) return;
  const card = board.cards[col].find(card => card.id === cardId);
  if (!card) return;
  const input = document.getElementById('comment-input-' + cardId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  card.comments = card.comments || [];
  card.comments.push({ id: 'cm_' + uid(), text, createdAt: Date.now(), ownerId: getClientId(), modifiedAt: Date.now() });
  state.commentOpenState.add(cardId);
  input.value = '';
  fbSave(board);
  lsSave();
  renderBoard();
}

function saveCardEdit(cardId) {
  const board = curBoard();
  if (!board) return;
  const col = colOfCard(cardId);
  if (!col) return;
  const card = board.cards[col].find(c => c.id === cardId);
  if (!card) return;
  if (!card.ownerId || card.ownerId !== getClientId()) {
    alert('Вы не можете редактировать эту карточку.');
    state._editingCardId = null;
    renderBoard();
    return;
  }
  // Prefer modal input if present (reuse comment edit modal)
  const input = document.getElementById('card-edit-input-' + cardId) || document.getElementById('modal-comment-edit-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  card.text = text;
  card.modifiedAt = Date.now();
  state._editingCardId = null;
  fbSave(board);
  lsSave();
  renderBoard();
  showToast('Карточка обновлена');
}

function cancelCardEdit(cardId) {
  // noop: editing moved to modal-only flow
}

// Comment edit/delete
function startEditComment(cardId, commentId) {
  state._editingComment = { cardId, commentId };
  renderBoard();
}

function saveCommentEdit(cardId, commentId) {
  const board = curBoard();
  if (!board) return;
  const col = colOfCard(cardId);
  if (!col) return;
  const card = board.cards[col].find(c => c.id === cardId);
  if (!card) return;
  const comment = (card.comments || []).find(c => c.id === commentId);
  if (!comment) return;
  if (!comment.ownerId || comment.ownerId !== getClientId()) {
    alert('Вы не можете редактировать этот комментарий.');
    state._editingComment = null;
    renderBoard();
    return;
  }
  const input = document.getElementById('comment-edit-input-' + commentId) || document.getElementById('modal-comment-edit-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  comment.text = text;
  comment.modifiedAt = Date.now();
  state._editingComment = null;
  fbSave(board);
  lsSave();
  renderBoard();
  showToast('Комментарий обновлён');
}

function cancelCommentEdit() {
  state._editingComment = null;
  renderBoard();
}

function delComment(cardId, commentId) {
  const board = curBoard();
  if (!board) return;
  const col = colOfCard(cardId);
  if (!col) return;
  const card = board.cards[col].find(c => c.id === cardId);
  if (!card) return;
  const comment = (card.comments || []).find(c => c.id === commentId);
  if (!comment) return;
  if (!comment.ownerId) { alert('Этот комментарий не имеет владельца и не может быть удалён.'); return; }
  if (comment.ownerId !== getClientId()) { alert('Вы не можете удалить чужой комментарий.'); return; }
  const confirmed = window.confirm('Удалить комментарий?');
  if (!confirmed) return;
  card.comments = (card.comments || []).filter(c => c.id !== commentId);
  fbSave(board);
  lsSave();
  renderBoard();
}

window.saveCardEdit = saveCardEdit;
window.cancelCardEdit = cancelCardEdit;
window.startEditComment = startEditComment;
window.saveCommentEdit = saveCommentEdit;
window.cancelCommentEdit = cancelCommentEdit;
window.delComment = delComment;
window.openCardEditModal = function(cardId) {
  const board = curBoard(); if (!board) return;
  const col = colOfCard(cardId); if (!col) return;
  const card = board.cards[col].find(c => c.id === cardId); if (!card) return;
  if (!card.ownerId || card.ownerId !== getClientId()) { alert('Вы не можете редактировать эту карточку.'); return; }
  // Reuse comment edit modal for cards
  document.getElementById('editCommentModalTitle').textContent = 'Редактировать карточку';
  const ta = document.getElementById('modal-comment-edit-input');
  ta.value = card.text || '';
  document.getElementById('modalCommentSaveBtn').onclick = function() { saveCardEdit(cardId); closeOverlay('editCommentOverlay'); };
  document.getElementById('editCommentOverlay').classList.add('open');
  setTimeout(() => ta.focus(), 50);
};

window.openCommentEditModal = function(cardId, commentId) {
  const board = curBoard(); if (!board) return;
  const col = colOfCard(cardId); if (!col) return;
  const card = board.cards[col].find(c => c.id === cardId); if (!card) return;
  const comment = (card.comments || []).find(c => c.id === commentId); if (!comment) return;
  if (!comment.ownerId || comment.ownerId !== getClientId()) { alert('Вы не можете редактировать этот комментарий.'); return; }
  document.getElementById('editCommentModalTitle').textContent = 'Редактировать комментарий';
  const ta = document.getElementById('modal-comment-edit-input');
  ta.value = comment.text || '';
  document.getElementById('modalCommentSaveBtn').onclick = function() { saveCommentEdit(cardId, commentId); closeOverlay('editCommentOverlay'); };
  document.getElementById('editCommentOverlay').classList.add('open');
  setTimeout(() => ta.focus(), 50);
};

function onCardDown(event, cardId) {
  if (event.target.closest('button, a, textarea, input, select, .comment-item, .comment-form, .comment-btn, .card-text')) return;
  const cardElement = document.getElementById('card-' + cardId);
  if (!cardElement) return;
  const rect = cardElement.getBoundingClientRect();
  // Arm drag but don't start until user moves pointer beyond threshold — allows text selection
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

function onDragMove(event) {
  if (!state.dnd || !state.dnd.armed) return;

  // If not yet active, check movement threshold to begin dragging (so text selection still works)
  if (!state.dnd.active) {
    const dx = event.clientX - state.dnd.startX;
    const dy = event.clientY - state.dnd.startY;
    if (Math.sqrt(dx * dx + dy * dy) < 6) return; // threshold in pixels

    // begin drag
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
    // disable text selection while dragging and clear any existing selection
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
  const body = document.getElementById('cb-' + targetCol);
  if (!body) return;
  const cardsContainer = body.querySelector('.cards-list') || body;
  let insertBefore = null;
  for (const card of (board.cards[targetCol] || [])) {
    if (card.id === state.dnd.cardId) continue;
    const cardEl = document.getElementById('card-' + card.id);
    if (!cardEl) continue;
    const rect = cardEl.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) {
      insertBefore = card.id;
      break;
    }
  }
  state.dnd.insertBefore = insertBefore;
  const indicator = document.createElement('div');
  indicator.className = 'drop-ind';
  if (insertBefore !== null) {
    const reference = document.getElementById('card-' + insertBefore);
    if (reference) cardsContainer.insertBefore(indicator, reference);
  } else {
    cardsContainer.appendChild(indicator);
  }
}

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
    const fromCol = colOfCard(state.dnd.cardId);
    if (fromCol) {
      const cardObject = board.cards[fromCol].find(card => card.id === state.dnd.cardId);
      board.cards[fromCol] = board.cards[fromCol].filter(card => card.id !== state.dnd.cardId);
      const insertIndex = state.dnd.insertBefore === null
        ? board.cards[state.dnd.targetCol].length
        : board.cards[state.dnd.targetCol].findIndex(card => card.id === state.dnd.insertBefore);
      board.cards[state.dnd.targetCol].splice(insertIndex < 0 ? board.cards[state.dnd.targetCol].length : insertIndex, 0, cardObject);
      fbSave(board);
      lsSave();
      renderBoard();
      if (fromCol !== state.dnd.targetCol) showToast('Карточка перемещена');
    }
  }
  state.dnd = { active: false, armed: false, cardId: null, ghost: null, ox: 0, oy: 0, targetCol: null, insertBefore: null };
  // restore selection behavior
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

document.addEventListener('mousedown', event => {
  const popup = document.getElementById('colorPopup');
  if (popup?.classList.contains('open') && !popup.contains(event.target)) {
    closeColorPopup();
  }
});

window.openAdd = openAdd;
window.closeAdd = closeAdd;
window.addCard = addCard;
window.delCard = delCard;
window.vote = vote;
window.openCardColorPopup = openCardColorPopup;
window.applyCardColor = applyCardColor;
window.toggleComments = toggleComments;
window.saveComment = saveComment;
window.onCardDown = onCardDown;
