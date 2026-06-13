/**
 * Возвращает ID колонки для карточки из state.cards.
 * @param {number} cardId — ID карточки
 * @returns {string|null} — ID колонки или null
 */
function colOfCard(cardId) {
  const card = state.cards[cardId];
  if (!card) return null;
  return card.columnId || null;
}

/**
 * Возвращает массив карточек для указанной колонки, отсортированный по дате создания.
 * @param {string} colId — ID колонки
 * @returns {Array} — массив карточек
 */
function getCardsForColumn(colId) {
  return Object.values(state.cards)
    .filter(card => card.columnId === colId)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

/**
 * Возвращает массив комментариев для указанной карточки.
 * @param {number} cardId — ID карточки
 * @returns {Array} — массив комментариев
 */
function getCommentsForCard(cardId) {
  return state.comments[cardId] || [];
}

/**
 * Открывает форму добавления новой карточки в указанной колонке.
 * Скрывает кнопку-триггер «Добавить карточку» и показывает textarea.
 * Автоматически фокусирует textarea через 30мс (с задержкой для анимации).
 * @param {string} colId — ID колонки
 */
function openAdd(colId) {
  const trigger = document.getElementById('at-' + colId);
  const form = document.getElementById('af-' + colId);
  if (!form || !trigger) return;
  trigger.style.display = 'none';
  form.classList.add('open');
  setTimeout(() => document.getElementById('atx-' + colId)?.focus(), 30);
}

/**
 * Закрывает форму добавления карточки в указанной колонке.
 * Скрывает textarea, показывает кнопку-триггер обратно, очищает поле ввода.
 * @param {string} colId — ID колонки
 */
function closeAdd(colId) {
  const trigger = document.getElementById('at-' + colId);
  const form = document.getElementById('af-' + colId);
  if (!form || !trigger) return;
  form.classList.remove('open');
  trigger.style.display = '';
  const input = document.getElementById('atx-' + colId);
  if (input) input.value = '';
}

/**
 * Добавляет новую карточку в указанную колонку.
 * Сохраняет карточку в подколлекцию cards в Firebase.
 * @param {string} colId — ID колонки, куда добавляется карточка
 */
function addCard(colId) {
  const board = curBoard();
  if (!board) return;
  const input = document.getElementById('atx-' + colId);
  const text = input?.value.trim();
  if (!text) return;
  const newId = nextGlobalCardId();
  board._nextId = Math.max(board._nextId || 0, newId);

  const card = {
    id: newId,
    text,
    reactions: {},
    color: null,
    ownerId: getClientId(),
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    columnId: colId,
  };

  state.cards[newId] = card;
  closeAdd(colId);
  fbSaveCard(board.id, card);
  lsSave();
  renderBoard();
  showToast('Карточка добавлена');
}

/**
 * Удаляет карточку по её ID.
 * Проверяет права доступа: удалить может только владелец карточки.
 * @param {number} cardId — ID карточки для удаления
 */
function delCard(cardId) {
  const board = curBoard();
  if (!board) return;
  const card = state.cards[cardId];
  if (!card) return;

  const clientId = getClientId();
  if (!card.ownerId) {
    alert('Эта карточка не имеет владельца и не может быть удалена.');
    return;
  }
  if (card.ownerId !== clientId) {
    alert('Вы не можете удалить чужую карточку.');
    return;
  }
  const confirmed = window.confirm('Вы уверены, что хотите удалить карточку "' + card.text.substring(0, 30) + (card.text.length > 30 ? '...' : '') + '"?\n\nЭто действие нельзя отменить.');
  if (!confirmed) return;

  delete state.cards[cardId];
  fbDelCard(board.id, cardId);
  lsSave();
  renderBoard();
  showToast('Карточка удалена');
}

/**
 * Переключает реакцию пользователя на карточке.
 * @param {number} cardId — ID карточки
 * @param {string} emoji  — эмодзи реакции
 */
function toggleReaction(cardId, emoji) {
  const board = curBoard();
  if (!board) return;
  const card = state.cards[cardId];
  if (!card) return;

  if (!card.reactions) card.reactions = {};
  if (!card.reactions[emoji]) card.reactions[emoji] = { count: 0, users: [] };

  if (!state.userReactions[cardId]) state.userReactions[cardId] = new Set();
  const userSet = state.userReactions[cardId];

  const clientId = getClientId();
  const reaction = card.reactions[emoji];

  if (userSet.has(emoji)) {
    reaction.users = reaction.users.filter(u => u !== clientId);
    reaction.count = reaction.users.length;
    userSet.delete(emoji);
    if (reaction.users.length === 0) delete card.reactions[emoji];
  } else {
    reaction.users.push(clientId);
    reaction.count = reaction.users.length;
    userSet.add(emoji);
  }

  fbSaveCard(board.id, card);
  lsSave();
  lsSaveUserReactions();
  renderBoard();
}

/**
 * Открывает попап выбора эмодзи для реакции.
 * @param {MouseEvent} event — событие клика
 * @param {number} cardId    — ID карточки
 */
function openEmojiPicker(event, cardId) {
  event.stopPropagation();
  closeEmojiPicker();

  const picker = document.createElement('div');
  picker.className = 'emoji-picker';
  picker.id = 'emojiPicker';

  const userSet = state.userReactions[cardId] || new Set();

  picker.innerHTML = EMOJI_SET.map(item => {
    const picked = userSet.has(item.emoji) ? ' picked' : '';
    return `<button class="emoji-picker-btn${picked}" title="${item.label}" onclick="addReactionFromPicker(${cardId},'${item.emoji}')">${item.emoji}</button>`;
  }).join('');

  const btn = event.currentTarget;
  document.body.appendChild(picker);

  const btnRect = btn.getBoundingClientRect();
  const pickerW = 160;
  const pickerH = 160;

  let x = btnRect.left + btnRect.width / 2 - pickerW / 2;
  let y = btnRect.top - pickerH - 6;

  if (y < 8) y = btnRect.bottom + 6;
  if (x + pickerW > window.innerWidth - 8) x = window.innerWidth - pickerW - 8;
  if (x < 8) x = 8;

  picker.style.left = x + 'px';
  picker.style.top = y + 'px';

  setTimeout(() => {
    document.addEventListener('click', closeEmojiPickerOnOutside, { once: true });
    document.addEventListener('keydown', closeEmojiPickerOnEsc, { once: true });
  }, 0);
}

function closeEmojiPicker() {
  const existing = document.getElementById('emojiPicker');
  if (existing) existing.remove();
}

function closeEmojiPickerOnOutside(e) {
  const picker = document.getElementById('emojiPicker');
  if (picker && !picker.contains(e.target)) closeEmojiPicker();
}

function closeEmojiPickerOnEsc(e) {
  if (e.key === 'Escape') closeEmojiPicker();
}

function addReactionFromPicker(cardId, emoji) {
  closeEmojiPicker();
  toggleReaction(cardId, emoji);
}

/**
 * Открывает палитру выбора цвета фона карточки.
 * @param {MouseEvent} event — событие клика
 * @param {number} cardId — ID карточки, цвет которой меняется
 */
function openCardColorPopup(event, cardId) {
  event.stopPropagation();
  state._cardPickerCardId = cardId;
  const card = state.cards[cardId];
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

/**
 * Применяет выбранный цвет фона к карточке.
 * @param {number}    cardId — ID карточки
 * @param {string|null} color — HEX-код цвета или null (сброс к дефолту)
 */
function applyCardColor(cardId, color) {
  const board = curBoard();
  if (!board) return;
  const card = state.cards[cardId];
  if (!card) return;
  card.color = color;
  fbSaveCard(board.id, card);
  lsSave();
  closeColorPopup();
  renderBoard();
}

/**
 * Переключает видимость секции комментариев карточки.
 * Загружает комментарии из Firebase при первом раскрытии.
 * @param {number} cardId — ID карточки
 */
function toggleComments(cardId) {
  if (state.commentOpenState.has(cardId)) {
    state.commentOpenState.delete(cardId);
    if (state.commentsUnsubs[cardId]) {
      state.commentsUnsubs[cardId]();
      delete state.commentsUnsubs[cardId];
    }
  } else {
    state.commentOpenState.add(cardId);
    loadComments(cardId);
  }
  renderBoard();
}

/**
 * Загружает комментарии карточки из Firebase и подписывается на real-time.
 * @param {number} cardId — ID карточки
 */
function saveCommentsCache() {
  if (state.activeBoardId) {
    state.boardCommentsCache[state.activeBoardId] = { ...state.comments };
  }
}

/**
 * Загружает комментарии карточки из Firebase и подписывается на real-time.
 * @param {number} cardId — ID карточки
 */
async function loadComments(cardId) {
  const board = curBoard();
  if (!board || !firebaseOk) return;

  if (state.commentsUnsubs[cardId]) {
    state.commentsUnsubs[cardId]();
  }

  const alreadyCached = state.comments[cardId] && state.comments[cardId].length > 0;

  if (!alreadyCached) {
    state._loadingComments.add(cardId);
    renderBoard();

    try {
      const snapshot = await commentsCol(board.id, cardId).get();
      const comments = [];
      snapshot.forEach(doc => comments.push(doc.data()));
      state.comments[cardId] = comments;
    } catch (error) {
      console.error('Error loading comments:', error);
      state.comments[cardId] = [];
    }

    state._loadingComments.delete(cardId);
    saveCommentsCache();
  }

  state.commentsUnsubs[cardId] = subscribeComments(
    board.id, cardId,
    makeCommentsHandler(cardId),
    error => console.error('Comments subscription error:', error)
  );

  if (alreadyCached) renderBoard();
}

/**
 * Сохраняет новый комментарий к карточке.
 * @param {number} cardId — ID карточки, к которой добавляется комментарий
 */
function saveComment(cardId) {
  const board = curBoard();
  if (!board) return;
  const card = state.cards[cardId];
  if (!card) return;
  const input = document.getElementById('comment-input-' + cardId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const comment = {
    id: 'cm_' + uid(),
    text,
    createdAt: Date.now(),
    ownerId: getClientId(),
    modifiedAt: Date.now(),
  };

  if (!state.comments[cardId]) state.comments[cardId] = [];
  state.comments[cardId].push(comment);

  card.commentCount = (card.commentCount || 0) + 1;
  fbSaveCard(board.id, card);

  state.commentOpenState.add(cardId);
  input.value = '';
  fbSaveComment(board.id, cardId, comment);
  lsSave();
  saveCommentsCache();
  renderBoard();
}

/**
 * Сохраняет отредактированный текст карточки.
 * @param {number} cardId — ID редактируемой карточки
 */
function saveCardEdit(cardId) {
  const board = curBoard();
  if (!board) return;
  const card = state.cards[cardId];
  if (!card) return;
  if (!card.ownerId || card.ownerId !== getClientId()) {
    alert('Вы не можете редактировать эту карточку.');
    state._editingCardId = null;
    renderBoard();
    return;
  }
  const input = document.getElementById('card-edit-input-' + cardId) || document.getElementById('modal-comment-edit-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  card.text = text;
  card.modifiedAt = Date.now();
  state._editingCardId = null;
  fbSaveCard(board.id, card);
  lsSave();
  renderBoard();
  showToast('Карточка обновлена');
}

function cancelCardEdit(cardId) {
  // noop: editing moved to modal-only flow
}

function startEditComment(cardId, commentId) {
  state._editingComment = { cardId, commentId };
  renderBoard();
}

/**
 * Сохраняет отредактированный текст комментария.
 * @param {number} cardId    — ID карточки
 * @param {string} commentId — ID редактируемого комментария
 */
function saveCommentEdit(cardId, commentId) {
  const board = curBoard();
  if (!board) return;
  const comments = state.comments[cardId] || [];
  const comment = comments.find(c => c.id === commentId);
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
  fbSaveComment(board.id, cardId, comment);
  lsSave();
  saveCommentsCache();
  renderBoard();
  showToast('Комментарий обновлён');
}

function cancelCommentEdit() {
  state._editingComment = null;
  renderBoard();
}

/**
 * Удаляет комментарий по его ID.
 * @param {number} cardId    — ID карточки
 * @param {string} commentId — ID комментария для удаления
 */
function delComment(cardId, commentId) {
  const board = curBoard();
  if (!board) return;
  const comments = state.comments[cardId] || [];
  const comment = comments.find(c => c.id === commentId);
  if (!comment) return;
  if (!comment.ownerId) { alert('Этот комментарий не имеет владельца и не может быть удалён.'); return; }
  if (comment.ownerId !== getClientId()) { alert('Вы не можете удалить чужой комментарий.'); return; }
  const confirmed = window.confirm('Удалить комментарий?');
  if (!confirmed) return;

  state.comments[cardId] = comments.filter(c => c.id !== commentId);
  fbDelComment(board.id, cardId, commentId);

  const card = state.cards[cardId];
  if (card) {
    card.commentCount = Math.max(0, (card.commentCount || 0) - 1);
    fbSaveCard(board.id, card);
  }

  lsSave();
  saveCommentsCache();
  renderBoard();
}

window.saveCardEdit = saveCardEdit;
window.cancelCardEdit = cancelCardEdit;
window.startEditComment = startEditComment;
window.saveCommentEdit = saveCommentEdit;
window.cancelCommentEdit = cancelCommentEdit;
window.delComment = delComment;

window.openCardEditModal = function(cardId) {
  const card = state.cards[cardId]; if (!card) return;
  if (!card.ownerId || card.ownerId !== getClientId()) { alert('Вы не можете редактировать эту карточку.'); return; }
  document.getElementById('editCommentModalTitle').textContent = 'Редактировать карточку';
  const ta = document.getElementById('modal-comment-edit-input');
  ta.value = card.text || '';
  document.getElementById('modalCommentSaveBtn').onclick = function() { saveCardEdit(cardId); closeOverlay('editCommentOverlay'); };
  document.getElementById('editCommentOverlay').classList.add('open');
  setTimeout(() => ta.focus(), 50);
};

window.openCommentEditModal = function(cardId, commentId) {
  const comments = state.comments[cardId] || [];
  const comment = comments.find(c => c.id === commentId); if (!comment) return;
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
  const body = document.getElementById('cb-' + targetCol);
  if (!body) return;
  const cardsContainer = body.querySelector('.cards-list') || body;
  let insertBefore = null;
  const targetCards = getCardsForColumn(targetCol);
  for (const card of targetCards) {
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
    const card = state.cards[state.dnd.cardId];
    if (card) {
      const fromCol = card.columnId;
      card.columnId = state.dnd.targetCol;
      fbSaveCard(board.id, card);
      lsSave();
      renderBoard();
      if (fromCol !== state.dnd.targetCol) showToast('Карточка перемещена');
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
window.toggleReaction = toggleReaction;
window.openEmojiPicker = openEmojiPicker;
window.closeEmojiPicker = closeEmojiPicker;
window.addReactionFromPicker = addReactionFromPicker;
window.openCardColorPopup = openCardColorPopup;
window.applyCardColor = applyCardColor;
window.toggleComments = toggleComments;
window.saveComment = saveComment;
window.onCardDown = onCardDown;

function cancelDragIfActive() {
  if (state.dnd && (state.dnd.armed || state.dnd.active)) {
    try {
      onDragUp();
    } catch (e) {
      state.dnd = { active: false, armed: false, cardId: null, ghost: null, ox: 0, oy: 0, startX: 0, startY: 0, targetCol: null, insertBefore: null };
    }
  }
}

document.addEventListener('contextmenu', event => {
  if (state.dnd && (state.dnd.armed || state.dnd.active)) {
    cancelDragIfActive();
  }
});

document.addEventListener('pointercancel', () => cancelDragIfActive());
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDragIfActive(); });
window.addEventListener('blur', () => cancelDragIfActive());
