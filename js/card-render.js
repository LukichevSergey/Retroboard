/**
 * Рендерит блок реакций карточки в HTML.
 * @param {Object} card — объект карточки
 * @returns {string} — HTML-строка reaction-bar или пустая строка
 */
function renderReactions(card) {
  const reactions = card.reactions || {};
  const keys = Object.keys(reactions).sort();
  if (keys.length === 0) return '';
  const userSet = state.userReactions[card.id] || new Set();
  const pills = keys.map(emoji => {
    const r = reactions[emoji];
    const reacted = userSet.has(emoji) ? ' reacted' : '';
    const title = r.users ? r.users.join(', ') : '';
    return `<button class="reaction-pill${reacted}" onclick="toggleReaction('${card.id}','${emoji}')" title="${esc(title)}">
      <span class="reaction-emoji">${emoji}</span>
      <span class="reaction-count">${r.count || 0}</span>
    </button>`;
  }).join('');
  return `<div class="reaction-bar">${pills}</div>`;
}

/**
 * Генерирует HTML-разметку одной карточки.
 * @param {Object} card — объект карточки { id, text, reactions, color, ownerId, ... }
 * @returns {string} — HTML-разметка карточки
 */
function cardHTML(card) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const displayColor = (isDark && card.color) ? dimColor(card.color) : card.color;
  const contrastText = displayColor ? getContrastColor(displayColor) : null;
  const btnBg = contrastText === '#fff' ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.7)';
  const bgStyle = displayColor ? `style="--card-bg:${displayColor};--card-text:${contrastText};--card-btn-bg:${btnBg};--card-btn-fg:${contrastText}"` : '';
  const count = card.commentCount || 0;
  const comments = getCommentsForCard(card.id);
  const commentCount = count ? `<span class="comment-count">${count}</span>` : '';
  const openClass = state.commentOpenState.has(card.id) ? ' open' : '';
  const isOwner = isAdmin() || (card.ownerId && (card.ownerId === getClientId()));
  const textHtml = `<div class="card-text">${linkify(card.text)}</div>`;
  const reactionsHtml = renderReactions(card);

  let footerBtns = `
      <button class="comment-btn${state.commentOpenState.has(card.id) ? ' active' : ''}" onclick="toggleComments('${card.id}')" title="Комментарии">` +
        `${ICONS.comment}${commentCount}` +
      `</button>
      <div class="card-spacer"></div>
      <button class="reaction-trigger-btn" onclick="openEmojiPicker(event, '${card.id}')" title="Добавить реакцию">😊+</button>`;

  if (isOwner) {
    footerBtns += `
      <button class="card-color-btn" onclick="openCardColorPopup(event, '${card.id}')" title="Цвет карточки">${ICONS.cardColor}</button>
      <button class="card-edit-btn" onclick="openCardEditModal('${card.id}')" title="Редактировать">${ICONS.cardEdit}</button>
      <button class="card-del-btn" onclick="delCard('${card.id}')" title="Удалить">${ICONS.cardDel}</button>`;
  }

  return `<div class="card" id="card-${card.id}" ${bgStyle} onmousedown="onCardDown(event, '${card.id}')">
    ${textHtml}
    ${reactionsHtml}
    <div class="card-footer">${footerBtns}
    </div>
    <div class="comment-section${openClass}" id="comments-${card.id}">
      <div class="comments-list">
        ${renderCommentItems(comments, card.id)}
      </div>
      <div class="comment-form">
        <textarea id="comment-input-${card.id}" placeholder="Напишите комментарий" rows="3"></textarea>
        <button class="btn btn-primary" onclick="saveComment('${card.id}')">Сохранить</button>
      </div>
    </div>
  </div>`;
}

/**
 * Создаёт DOM-элемент карточки из HTML-строки.
 * @param {Object} card — объект карточки
 * @returns {HTMLElement} — DOM-элемент .card
 */
function createCardElement(card) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = cardHTML(card);
  return wrapper.firstElementChild;
}

/**
 * Гарантирует наличие контейнера .cards-list внутри colBody.
 * @param {HTMLElement} colBody — DOM-элемент .col-body колонки
 * @returns {HTMLElement} — контейнер .cards-list
 */
function ensureCardsContainer(colBody) {
  let cardsContainer = colBody.querySelector('.cards-list');
  if (!cardsContainer) {
    cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-list';
    const nodesToMove = Array.from(colBody.children).filter(child => !child.classList.contains('add-wrap'));
    nodesToMove.forEach(node => cardsContainer.appendChild(node));
    colBody.appendChild(cardsContainer);
  }
  return cardsContainer;
}

/**
 * Захватывает текущее состояние всех input/textarea на доске.
 * @returns {Object} — объект с сохранённым состоянием
 */
function captureBoardInputState() {
  const result = { activeElementId: null, selectionStart: null, selectionEnd: null, values: {}, openAddForms: [] };
  const inner = document.getElementById('boardInner');
  if (!inner) return result;

  inner.querySelectorAll('input[id], textarea[id]').forEach(field => {
    result.values[field.id] = field.value;
  });

  inner.querySelectorAll('.add-form.open').forEach(form => {
    if (form.id && form.id.startsWith('af-')) {
      result.openAddForms.push(form.id.slice(3));
    }
  });

  const active = document.activeElement;
  if (active && active.id && inner.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    result.activeElementId = active.id;
    if (typeof active.selectionStart === 'number') {
      result.selectionStart = active.selectionStart;
      result.selectionEnd = active.selectionEnd;
    }
  }

  return result;
}

/**
 * Восстанавливает состояние input/textarea после renderBoard().
 * @param {Object} saved — объект сохранённого состояния
 */
function restoreBoardInputState(saved) {
  if (!saved) return;
  const inner = document.getElementById('boardInner');
  if (!inner) return;

  Object.keys(saved.values).forEach(id => {
    const field = document.getElementById(id);
    if (field && (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA')) {
      if (field.value !== saved.values[id]) {
        field.value = saved.values[id];
      }
    }
  });

  saved.openAddForms.forEach(colId => {
    const form = document.getElementById('af-' + colId);
    const trigger = document.getElementById('at-' + colId);
    if (form && trigger) {
      form.classList.add('open');
      trigger.style.display = 'none';
    }
  });

  if (saved.activeElementId) {
    const activeField = document.getElementById(saved.activeElementId);
    if (activeField && typeof activeField.focus === 'function') {
      activeField.focus();
      if (typeof saved.selectionStart === 'number') {
        activeField.setSelectionRange(saved.selectionStart, saved.selectionEnd);
      }
    }
  }
}

/**
 * Обновляет CSS-переменные карточки (цвет фона, текста, кнопок).
 * @param {HTMLElement} cardEl — DOM-элемент карточки
 * @param {Object}      card  — объект карточки
 */
function applyCardStyles(cardEl, card) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const displayColor = (isDark && card.color) ? dimColor(card.color) : card.color;
  const contrastText = displayColor ? getContrastColor(displayColor) : null;
  const btnBg = contrastText === '#fff' ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.7)';
  if (displayColor) {
    cardEl.style.cssText = `--card-bg:${displayColor};--card-text:${contrastText};--card-btn-bg:${btnBg};--card-btn-fg:${contrastText};`;
  } else {
    cardEl.style.cssText = '';
  }
}

/**
 * Рендерит список комментариев карточки в HTML.
 * @param {Array}  comments — массив объектов комментариев
 * @param {number} cardId   — ID карточки
 * @returns {string} — HTML-строка списка комментариев
 */
function renderCommentItems(comments, cardId) {
  if (state._loadingComments.has(cardId)) {
    return '<div class="comment-loading"><div class="comment-spinner"></div>Загрузка...</div>';
  }
  if (!comments || comments.length === 0) return '<div class="comment-empty">Нет комментариев</div>';
  return comments.map(comment => {
    const isEditing = state._editingComment && state._editingComment.commentId === comment.id && state._editingComment.cardId === cardId;
    const isOwner = isAdmin() || (comment.ownerId && (comment.ownerId === getClientId()));
    if (isEditing) {
      return `
        <div class="comment-item">
          <textarea id="comment-edit-input-${comment.id}" rows="3">${esc(comment.text)}</textarea>
          <div>
            <button class="btn btn-ghost" onclick="cancelCommentEdit()">Отмена</button>
            <button class="btn btn-primary" onclick="saveCommentEdit('${cardId}', '${comment.id}')">Сохранить</button>
          </div>
        </div>`;
    }
    const ownerBtns = isOwner ? `<div style="display:flex;gap:6px">` +
      `<button class="card-edit-btn" onclick="openCommentEditModal('${cardId}', '${comment.id}')" title="Редактировать">${ICONS.commentEdit}</button>` +
      `<button class="card-del-btn" onclick="delComment('${cardId}', '${comment.id}')" title="Удалить">${ICONS.commentDel}</button>` +
    `</div>` : '';
    return `
      <div class="comment-item">
        <div class="comment-text">${linkify(comment.text)}</div>
        ${ownerBtns}
      </div>`;
  }).join('');
}

/**
 * Обновляет существующий DOM-элемент карточки вместо пересоздания.
 * @param {HTMLElement} cardEl — существующий DOM-элемент .card
 * @param {Object}      card  — объект карточки с актуальными данными
 */
function updateCardElement(cardEl, card) {
  applyCardStyles(cardEl, card);

  const cardText = cardEl.querySelector('.card-text');
  if (cardText && cardText.textContent !== card.text) {
    cardText.innerHTML = linkify(card.text);
  }

  const reactionsHtml = renderReactions(card);
  const existingBar = cardEl.querySelector('.reaction-bar');
  if (reactionsHtml) {
    if (existingBar) {
      existingBar.outerHTML = reactionsHtml;
    } else {
      const footer = cardEl.querySelector('.card-footer');
      if (footer) footer.insertAdjacentHTML('beforebegin', reactionsHtml);
    }
  } else if (existingBar) {
    existingBar.remove();
  }

  const commentSection = cardEl.querySelector('.comment-section');
  if (commentSection) {
    commentSection.classList.toggle('open', state.commentOpenState.has(card.id));
    const commentsList = commentSection.querySelector('.comments-list');
    if (commentsList) {
      commentsList.innerHTML = renderCommentItems(getCommentsForCard(card.id), card.id);
    }
  }

  const cardFooter = cardEl.querySelector('.card-footer');
  if (cardFooter) {
    const commentCount = card.commentCount || 0;
    const isOwner = isAdmin() || (card.ownerId && (card.ownerId === getClientId()));

    const commentBtn = cardFooter.querySelector('.comment-btn');
    if (commentBtn) {
      commentBtn.classList.toggle('active', state.commentOpenState.has(card.id));
      const existingCount = commentBtn.querySelector('.comment-count');
      if (commentCount) {
        if (existingCount) {
          existingCount.textContent = commentCount;
        } else {
          commentBtn.insertAdjacentHTML('beforeend', `<span class="comment-count">${commentCount}</span>`);
        }
      } else if (existingCount) {
        existingCount.remove();
      }
    }

    const ownerBtnsExist = cardFooter.querySelector('.card-color-btn');
    if (isOwner && !ownerBtnsExist) {
      cardFooter.insertAdjacentHTML('beforeend',
        `<button class="card-color-btn" onclick="openCardColorPopup(event, '${card.id}')" title="Цвет карточки">${ICONS.cardColor}</button>
      <button class="card-edit-btn" onclick="openCardEditModal('${card.id}')" title="Редактировать">${ICONS.cardEdit}</button>
      <button class="card-del-btn" onclick="delCard('${card.id}')" title="Удалить">${ICONS.cardDel}</button>`);
    } else if (!isOwner && ownerBtnsExist) {
      cardFooter.querySelectorAll('.card-color-btn, .card-edit-btn, .card-del-btn').forEach(el => el.remove());
    }
  }
}

/**
 * Приводит DOM-контейнер карточек колонки к желаемому состоянию (reconcile).
 * @param {HTMLElement} cardsContainer — DOM-контейнер .cards-list
 * @param {Array}       cards          — массив объектов карточек колонки
 */
function reconcileColumnCards(cardsContainer, cards) {
  const desiredIds = new Set(cards.map(card => String(card.id)));
  const existingCards = Array.from(cardsContainer.children).filter(child => child.classList.contains('card'));
  const localCardMap = new Map(existingCards.map(el => [el.id.replace(/^card-/, ''), el]));

  cards.forEach((card, index) => {
    const cardId = String(card.id);
    let cardEl = cardsContainer.querySelector('#card-' + cardId) || localCardMap.get(cardId) || document.getElementById('card-' + cardId);
    if (cardEl && cardEl.parentElement !== cardsContainer) {
      cardsContainer.appendChild(cardEl);
    }
    if (!cardEl) {
      cardEl = createCardElement(card);
    } else {
      updateCardElement(cardEl, card);
    }

    const nextCard = cards[index + 1] ? cardsContainer.querySelector('#card-' + cards[index + 1].id) : null;
    if (nextCard) {
      cardsContainer.insertBefore(cardEl, nextCard);
    } else {
      cardsContainer.appendChild(cardEl);
    }
  });

  existingCards.forEach(existingCard => {
    const existingId = existingCard.id.replace(/^card-/, '');
    if (!desiredIds.has(existingId)) {
      existingCard.remove();
    }
  });

  const emptyHint = cardsContainer.querySelector('.empty-hint');
  if (cards.length === 0) {
    if (!emptyHint) {
      const hint = document.createElement('div');
      hint.className = 'empty-hint';
      hint.textContent = 'Перетащите сюда карточку или добавьте новую';
      cardsContainer.appendChild(hint);
    }
  } else if (emptyHint) {
    emptyHint.remove();
  }
}

/**
 * Автоматически подстраивает высоту textarea-ввода названия колонки под содержимое.
 * @param {HTMLTextAreaElement} labelInput — textarea заголовка колонки
 */
function autosizeColumnLabel(labelInput) {
  if (!labelInput) return;
  labelInput.style.height = 'auto';
  labelInput.style.height = (labelInput.scrollHeight) + 'px';
}
