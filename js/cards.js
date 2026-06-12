/**
 * Находит колонку, в которой находится карточка с указанным ID.
 * Перебирает все колонки текущей доски и ищет карточку по ID.
 * @param {number} cardId — ID карточки
 * @returns {string|null} — ID колонки, в которой найдена карточка, или null
 */
function colOfCard(cardId) {
  const board = curBoard();
  if (!board) return null;
  return Object.keys(board.cards).find(colId => board.cards[colId].some(card => card.id === cardId)) || null;
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
 * Читает текст из textarea, создаёт объект карточки с полями:
 *   id, text, votes (0), color (null), comments (пустой массив),
 *   ownerId (getClientId()), createdAt, modifiedAt.
 * Сохраняет в Firebase и localStorage, перерисовывает доску,
 * показывает toast «Карточка добавлена».
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
  board.cards[colId].push({ id: newId, text, votes: 0, color: null, comments: [], ownerId: getClientId(), createdAt: Date.now(), modifiedAt: Date.now() });
  closeAdd(colId);
  fbSave(board);
  lsSave();
  renderBoard();
  showToast('Карточка добавлена');
}

/**
 * Удаляет карточку по её ID.
 * Проверяет права доступа: удалить может только владелец карточки (ownerId === clientId).
 * Если карточка не имеет владельца — показывает предупреждение.
 * После подтверждения пользователем удаляет карточку из массива колонки,
 * сохраняет изменения и перерисовывает доску.
 * @param {number} cardId — ID карточки для удаления
 */
function delCard(cardId) {
  const board = curBoard();
  if (!board) return;
  const col = colOfCard(cardId);
  if (!col) return;
  const card = board.cards[col].find(c => c.id === cardId);
  if (!card) return;
  // Только владелец может удалить (или запретить если владелец отсутствует)
  const clientId = getClientId();
  if (!card.ownerId) {
    alert('Эта карточка не имеет владельца и не может быть удалена.');
    return;
  }
  if (card.ownerId !== clientId) {
    alert('Вы не можете удалить чужую карточку.');
    return;
  }
  // Запрос подтверждения перед удалением
  const confirmed = window.confirm('Вы уверены, что хотите удалить карточку "' + card.text.substring(0, 30) + (card.text.length > 30 ? '...' : '') + '"?\n\nЭто действие нельзя отменить.');
  if (!confirmed) return;
  board.cards[col] = board.cards[col].filter(card => card.id !== cardId);
  fbSave(board);
  lsSave();
  renderBoard();
  showToast('Карточка удалена');
}

/**
 * Голосует за карточку (или снимает голос).
 * Если пользователь уже голосовал — уменьшает счётчик на 1 и удаляет из state.userVotes.
 * Если не голосовал — увеличивает счётчик на 1 и добавляет в state.userVotes.
 * Сохраняет голоса в localStorage и перерисовывает доску.
 * @param {number} cardId — ID карточки
 */
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

/**
 * Открывает палитру выбора цвета фона карточки.
 * Сохраняет ID карточки в state._cardPickerCardId, формирует HTML палитры
 * из массива CARD_COLORS плюс кнопка «По умолчанию» (сброс цвета).
 * Подсвечивает текущий цвет как active. Позиционирует палитру рядом с кликом.
 * @param {MouseEvent} event — событие клика
 * @param {number} cardId — ID карточки, цвет которой меняется
 */
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

/**
 * Применяет выбранный цвет фона к карточке.
 * Устанавливает поле card.color, сохраняет в Firebase и localStorage,
 * закрывает палитру и перерисовывает доску.
 * @param {number}    cardId — ID карточки
 * @param {string|null} color — HEX-код цвета или null (сброс к дефолту)
 */
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

/**
 * Переключает видимость секции комментариев карточки.
 * Добавляет/удаляет ID карточки из state.commentOpenState (Set).
 * Перерисовывает доску для обновления UI.
 * @param {number} cardId — ID карточки
 */
function toggleComments(cardId) {
  if (state.commentOpenState.has(cardId)) {
    state.commentOpenState.delete(cardId);
  } else {
    state.commentOpenState.add(cardId);
  }
  renderBoard();
}

/**
 * Сохраняет новый комментарий к карточке.
 * Читает текст из textarea #comment-input-{cardId}, создаёт объект комментария
 * с полями: id (cm_ + uid), text, createdAt, ownerId, modifiedAt.
 * Добавляет в массив card.comments, сохраняет в Firebase и localStorage,
 * раскрывает секцию комментариев и перерисовывает доску.
 * @param {number} cardId — ID карточки, к которой добавляется комментарий
 */
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

/**
 * Сохраняет отредактированный текст карточки.
 * Проверяет права доступа (только владелец может редактировать).
 * Читает новый текст из модального окна (card-edit-input или modal-comment-edit-input),
 * обновляет card.text и card.modifiedAt. Закрывает состояние редактирования.
 * @param {number} cardId — ID редактируемой карточки
 */
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
  // Приоритет: модальный ввод, если есть (переиспользует modal comment edit)
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

/**
 * Отмена редактирования карточки (заглушка).
 * Редактирование карточек теперь происходит только через модальное окно.
 */
function cancelCardEdit(cardId) {
  // noop: editing moved to modal-only flow
}

// ---- Редактирование и удаление комментариев ----

/**
 * Начинает редактирование комментария — устанавливает state._editingComment
 * с указанием ID карточки и комментария. Перерисовывает доску, чтобы
 * отобразить textarea вместо текста комментария.
 * @param {number}   cardId    — ID карточки
 * @param {string}   commentId — ID комментария
 */
function startEditComment(cardId, commentId) {
  state._editingComment = { cardId, commentId };
  renderBoard();
}

/**
 * Сохраняет отредактированный текст комментария.
 * Проверяет права доступа (только владелец может редактировать).
 * Читает новый текст из textarea, обновляет comment.text и comment.modifiedAt.
 * Сохраняет в Firebase и localStorage, закрывает режим редактирования.
 * @param {number} cardId    — ID карточки
 * @param {string} commentId — ID редактируемого комментария
 */
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

/**
 * Отменяет редактирование комментария.
 * Сбрасывает state._editingComment в null и перерисовывает доску.
 */
function cancelCommentEdit() {
  state._editingComment = null;
  renderBoard();
}

/**
 * Удаляет комментарий по его ID.
 * Проверяет права доступа (только владелец может удалить).
 * После подтверждения пользователем удаляет из массива card.comments,
 * сохраняет изменения и перерисовывает доску.
 * @param {number} cardId    — ID карточки
 * @param {string} commentId — ID комментария для удаления
 */
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

/**
 * Экспорт функций карточек в глобальную область window.
 */
window.saveCardEdit = saveCardEdit;
window.cancelCardEdit = cancelCardEdit;
window.startEditComment = startEditComment;
window.saveCommentEdit = saveCommentEdit;
window.cancelCommentEdit = cancelCommentEdit;
window.delComment = delComment;

/**
 * Открывает модальное окно редактирования текста карточки.
 * Переиспользует модальное окно редактирования комментариев (#editCommentOverlay).
 * Устанавливает заголовок «Редактировать карточку», заполняет textarea текущим текстом,
 * привязывает обработчик кнопки «Сохранить» к saveCardEdit(cardId).
 * @param {number} cardId — ID редактируемой карточки
 */
window.openCardEditModal = function(cardId) {
  const board = curBoard(); if (!board) return;
  const col = colOfCard(cardId); if (!col) return;
  const card = board.cards[col].find(c => c.id === cardId); if (!card) return;
  if (!card.ownerId || card.ownerId !== getClientId()) { alert('Вы не можете редактировать эту карточку.'); return; }
  // Переиспользует модалку редактирования комментариев для карточек
  document.getElementById('editCommentModalTitle').textContent = 'Редактировать карточку';
  const ta = document.getElementById('modal-comment-edit-input');
  ta.value = card.text || '';
  document.getElementById('modalCommentSaveBtn').onclick = function() { saveCardEdit(cardId); closeOverlay('editCommentOverlay'); };
  document.getElementById('editCommentOverlay').classList.add('open');
  setTimeout(() => ta.focus(), 50);
};

/**
 * Открывает модальное окно редактирования текста комментария.
 * Переиспользует модальное окно #editCommentOverlay.
 * Устанавливает заголовок «Редактировать комментарий», заполняет textarea,
 * привязывает обработчик кнопки «Сохранить» к saveCommentEdit(cardId, commentId).
 * @param {number} cardId    — ID карточки
 * @param {string} commentId — ID редактируемого комментария
 */
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

/**
 * Обработчик нажатия мыши на карточку для начала перетаскивания (drag & drop).
 * Игнорирует клики по интерактивным элементам (кнопки, ссылки, textarea, input).
 * «Заряжает» drag-состояние (armed = true) но не начинает перетаскивание
 * до тех пор, пока пользователь не сдвинет мышь более чем на 6px (порог).
 * Это позволяет выделять текст в карточках без случайного перетаскивания.
 * @param {MouseEvent} event — событие mousedown
 * @param {number} cardId    — ID карточки
 */
function onCardDown(event, cardId) {
  if (event.target.closest('button, a, textarea, input, select, .comment-item, .comment-form, .comment-btn, .card-text')) return;
  const cardElement = document.getElementById('card-' + cardId);
  if (!cardElement) return;
  const rect = cardElement.getBoundingClientRect();
  // Заряжает drag но не начинает пока курсор не сдвинется за порог — позволяет выделять текст
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
 * Обработчик движения мыши при перетаскивании карточки.
 * Если drag ещё не активен — проверяет расстояние от начальной точки (порог 6px).
 * При превышении порога:
 *   1) Создаёт DOM-элемент «призрак» (ghost) — визуальную копию карточки,
 *   2) Отключает выделение текста на странице,
 *   3) Устанавливает флаг active = true.
 * Далее:
 *   - Перемещает ghost вслед за курсором,
 *   - Определяет целевую колонку по позиции курсора,
 *   - Вычисляет позицию вставки (перед какой карточкой),
 *   - Отображает визуальный индикатор места вставки (drop-ind).
 * @param {MouseEvent} event — событие mousemove
 */
function onDragMove(event) {
  if (!state.dnd || !state.dnd.armed) return;

  // Если drag ещё не начался, проверяет порог движения для начала перетаскивания (текст всё ещё можно выделять)
  if (!state.dnd.active) {
    const dx = event.clientX - state.dnd.startX;
    const dy = event.clientY - state.dnd.startY;
    if (Math.sqrt(dx * dx + dy * dy) < 6) return; // порог в пикселях

    // Начинает drag
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
    // Отключает выделение текста во время drag и очищает текущее выделение
    try {
      state._prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      if (window.getSelection && window.getSelection().removeAllRanges) window.getSelection().removeAllRanges();
    } catch (e) {
      // игнорировать
    }
  }

  state.dnd.ghost.style.left = (event.clientX - state.dnd.ox) + 'px';
  state.dnd.ghost.style.top = (event.clientY - state.dnd.oy) + 'px';
  document.querySelectorAll('.drop-ind').forEach(el => el.remove());
  const board = curBoard();
  if (!board) return;
  board.cols.forEach(col => document.querySelector(`.column[data-col="${col.id}"]`)?.classList.remove('drag-over'));
  let targetCol = null;
  // Определяет целевую колонку по позиции курсора
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
  // Определяет позицию вставки: перед какой карточкой (или в конец)
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
  // Визуальный индикатор места вставки
  const indicator = document.createElement('div');
  indicator.className = 'drop-ind';
  if (insertBefore !== null) {
    const reference = document.getElementById('card-' + insertBefore);
    if (reference) cardsContainer.insertBefore(indicator, reference);
  } else {
    cardsContainer.appendChild(indicator);
  }
}

/**
 * Обработчик отпускания кнопки мыши — завершение перетаскивания.
 * Удаляет ghost-элемент, индикаторы, слушатели событий.
 * Если drag был активным и есть целевая колонка:
 *   1) Удаляет карточку из исходной колонки,
 *   2) Вставляет в целевую колонку на вычисленную позицию,
 *   3) Сохраняет изменения и перерисовывает доску.
 * Восстанавливает выделение текста. Сбрасывает состояние drag.
 * Если есть отложенная перерисовка (renderBoard во время drag) — выполняет её.
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
  state.dnd = { active: false, armed: false, cardId: null, ghost: null, ox: 0, oy: 0, startX: 0, startY: 0, targetCol: null, insertBefore: null };
  // Восстанавливает поведение выделения текста
  try {
    if (state._prevUserSelect !== undefined) {
      document.body.style.userSelect = state._prevUserSelect || '';
      delete state._prevUserSelect;
    }
  } catch (e) {
    // игнорировать
  }
  if (state._pendingBoardRender) renderBoard();
}

/**
 * Глобальный обработчик клика мыши — закрывает палитру цветов,
 * если клик был сделан вне палитры.
 */
document.addEventListener('mousedown', event => {
  const popup = document.getElementById('colorPopup');
  if (popup?.classList.contains('open') && !popup.contains(event.target)) {
    closeColorPopup();
  }
});

/**
 * Экспорт функций карточек в глобальную область window.
 */
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

/**
 * Отменяет текущее перетаскивание, если оно активно или «заряжено».
 * Вызывает onDragUp() для корректной очистки состояния.
 * Используется при открытии контекстного меню, потере фокуса, скрытии страницы.
 */
function cancelDragIfActive() {
  if (state.dnd && (state.dnd.armed || state.dnd.active)) {
    try {
      onDragUp();
    } catch (e) {
      // Фоллбэк: гарантирует очистку dnd-состояния
      state.dnd = { active: false, armed: false, cardId: null, ghost: null, ox: 0, oy: 0, startX: 0, startY: 0, targetCol: null, insertBefore: null };
    }
  }
}

// Если пользователь открывает контекстное меню, отменяется pointer или
// меняется видимость/фокус страницы — отменяет drag чтобы избежать «зависших» карточек.
document.addEventListener('contextmenu', event => {
  if (state.dnd && (state.dnd.armed || state.dnd.active)) {
    cancelDragIfActive();
    // не предотвращаем поведение: разрешаем стандартное контекстное меню
  }
});

document.addEventListener('pointercancel', () => cancelDragIfActive());
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDragIfActive(); });
window.addEventListener('blur', () => cancelDragIfActive());
