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
 * Проверяет, является ли текущий пользователь владельцем элемента.
 * Показывает alert при ошибке.
 * @param {string} ownerId — ID владельца
 * @param {string} actionLabel — описание действия (например, 'удалить', 'редактировать')
 * @returns {boolean} — true если проверка пройдена
 */
function requireOwnership(ownerId, actionLabel) {
  if (!ownerId) {
    alert(`Этот элемент не имеет владельца и не может быть ${actionLabel}.`);
    return false;
  }
  if (ownerId !== getClientId()) {
    alert(`Вы не можете ${actionLabel} чужой элемент.`);
    return false;
  }
  return true;
}

/**
 * Возвращает массив карточек для указанной колонки, отсортированный по позиции.
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
 * @param {string} colId — ID колонки, куда добавляется карточка
 */
function addCard(colId) {
  const board = curBoard();
  if (!board) return;
  const input = document.getElementById('atx-' + colId);
  const text = input?.value.trim();
  if (!text) return;
  const newId = uid();

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
  saveCard(card);
  showToast('Карточка добавлена');
}

/**
 * Удаляет карточку по её ID.
 * @param {number} cardId — ID карточки для удаления
 */
function delCard(cardId) {
  const board = curBoard();
  if (!board) return;
  const card = state.cards[cardId];
  if (!card) return;

  if (!requireOwnership(card.ownerId, 'удалить')) return;
  const confirmed = window.confirm('Вы уверены, что хотите удалить карточку "' + card.text.substring(0, 30) + (card.text.length > 30 ? '...' : '') + '"?\n\nЭто действие нельзя отменить.');
  if (!confirmed) return;

  delete state.cards[cardId];
  fbDelCard(board.id, cardId);
  lsSave();
  renderBoard();
  showToast('Карточка удалена');
}

/**
 * Открывает палитру выбора цвета фона карточки.
 * @param {MouseEvent} event — событие клика
 * @param {number} cardId — ID карточки, цвет которой меняется
 */
function openCardColorPopup(event, cardId) {
  event.stopPropagation();
  const popup = document.getElementById('colorPopup');
  if (popup?.classList.contains('open') && state._cardPickerCardId === cardId) {
    closeColorPopup();
    return;
  }
  state._cardPickerCardId = cardId;
  const card = state.cards[cardId];
  const currentColor = card?.color || null;
  document.getElementById('colorPopupTitle').textContent = 'Цвет карточки';
  const swatches = document.getElementById('colorSwatches');
  swatches.innerHTML = `
    <div class="swatch none-swatch ${currentColor === null ? 'active' : ''}" title="По умолчанию" onclick="applyCardColor('${cardId}',null)">
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>` +
    CARD_COLORS.map(color => `
      <div class="swatch ${currentColor === color.hex ? 'active' : ''}"
           style="background:${color.hex}; border:1.5px solid rgba(0,0,0,.12);"
           title="${color.label}"
           onclick="applyCardColor('${cardId}','${color.hex}')">
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
  closeColorPopup();
  saveCard(card);
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
  if (!requireOwnership(card.ownerId, 'редактировать')) {
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
  saveCard(card);
  showToast('Карточка обновлена');
}

window.openAdd = openAdd;
window.closeAdd = closeAdd;
window.addCard = addCard;
window.delCard = delCard;
window.openCardColorPopup = openCardColorPopup;
window.applyCardColor = applyCardColor;
window.saveCardEdit = saveCardEdit;

window.openCardEditModal = function(cardId) {
  const card = state.cards[cardId]; if (!card) return;
  if (!requireOwnership(card.ownerId, 'редактировать')) return;
  document.getElementById('editCommentModalTitle').textContent = 'Редактировать карточку';
  const ta = document.getElementById('modal-comment-edit-input');
  ta.value = card.text || '';
  document.getElementById('modalCommentSaveBtn').onclick = function() { saveCardEdit(cardId); closeOverlay('editCommentOverlay'); };
  document.getElementById('editCommentOverlay').classList.add('open');
  setTimeout(() => ta.focus(), 50);
};
