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
 * Сохраняет кэш комментариев текущей доски.
 */
function saveCommentsCache() {
  if (state.activeBoardId) {
    state.boardCommentsCache[state.activeBoardId] = JSON.parse(JSON.stringify(state.comments));
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
  state.commentOpenState.add(cardId);
  input.value = '';

  fbSaveComment(board.id, cardId, comment);
  fbUpdateCommentCount(board.id, cardId, 1);
  lsSave();
  saveCommentsCache();
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
  if (!requireOwnership(comment.ownerId, 'редактировать')) {
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
  fbUpdateComment(board.id, cardId, commentId, { text, modifiedAt: comment.modifiedAt });
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
async function delComment(cardId, commentId) {
  const board = curBoard();
  if (!board) return;
  const comments = state.comments[cardId] || [];
  const comment = comments.find(c => c.id === commentId);
  if (!comment) return;
  if (!requireOwnership(comment.ownerId, 'удалить')) return;
  const confirmed = window.confirm('Удалить комментарий?');
  if (!confirmed) return;

  state.comments[cardId] = comments.filter(c => c.id !== commentId);

  const card = state.cards[cardId];
  if (card) {
    card.commentCount = Math.max(0, (card.commentCount || 0) - 1);
  }

  await fbDelComment(board.id, cardId, commentId);
  if (card) {
    await fbUpdateCommentCount(board.id, cardId, -1);
  }

  lsSave();
  saveCommentsCache();
  renderBoard();
}

window.toggleComments = toggleComments;
window.saveComment = saveComment;
window.saveCommentEdit = saveCommentEdit;
window.cancelCommentEdit = cancelCommentEdit;
window.delComment = delComment;

window.openCommentEditModal = function(cardId, commentId) {
  const comments = state.comments[cardId] || [];
  const comment = comments.find(c => c.id === commentId); if (!comment) return;
  if (!requireOwnership(comment.ownerId, 'редактировать')) return;
  document.getElementById('editCommentModalTitle').textContent = 'Редактировать комментарий';
  const ta = document.getElementById('modal-comment-edit-input');
  ta.value = comment.text || '';
  document.getElementById('modalCommentSaveBtn').onclick = function() { saveCommentEdit(cardId, commentId); closeOverlay('editCommentOverlay'); };
  document.getElementById('editCommentOverlay').classList.add('open');
  setTimeout(() => ta.focus(), 50);
};
