/**
 * Возвращает объект цветовой схемы по её ID.
 * Если схема не найдена — возвращает дефолтную (индекс 0, зелёная).
 * @param {number} schemeId — индекс схемы в массиве COL_SCHEMES
 * @returns {Object} — объект схемы { bg, text, dot, tag, tt, ... }
 */
function getScheme(schemeId) {
  return COL_SCHEMES[schemeId] || COL_SCHEMES[0];
}

/**
 * Возвращает CSS-строку стиля фона заголовка колонки.
 * @param {number} s — ID цветовой схемы
 * @returns {string} — CSS-строка, например "background:#EAF3DE"
 */
function schemeHeadStyle(s) {
  return `background:${getScheme(s).bg}`;
}

/**
 * Возвращает CSS-строку стиля точки-индикатора в заголовке колонки.
 * @param {number} s — ID цветовой схемы
 * @returns {string} — CSS-строка, например "background:#639922"
 */
function schemeDotStyle(s) {
  return `background:${getScheme(s).dot}`;
}

/**
 * Возвращает CSS-строку стиля текста заголовка колонки.
 * @param {number} s — ID цветовой схемы
 * @returns {string} — CSS-строка, например "color:#3B6D11"
 */
function schemeLabelStyle(s) {
  return `color:${getScheme(s).text}`;
}

/**
 * Возвращает CSS-строку стиля бейджа-счётчика карточек в заголовке колонки.
 * @param {number} s — ID цветовой схемы
 * @returns {string} — CSS-строка с background и color
 */
function schemeBadgeStyle(s) {
  const sc = getScheme(s);
  return `background:${sc.tag};color:${sc.tt}`;
}

/**
 * Последний ID доски, которая была отрисована.
 * Используется для оптимизации: если доска не изменилась,
 * input-состояние восстанавливается без полной перерисовки.
 */
let lastRenderedBoardId = null;

/**
 * Генерирует HTML-разметку одной карточки.
 * Включает:
 *   - Текст карточки (с linkify для кликабельных ссылок),
 *   - Блок реакций (reaction-bar) с эмодзи и кнопкой "+",
 *   - Кнопку комментариев (comment-btn) с количеством,
 *   - Кнопку выбора цвета (card-color-btn),
 *   - Кнопки редактирования и удаления (только для владельца),
 *   - Секцию комментариев (список + форма добавления).
 * @param {Object} card — объект карточки { id, text, reactions, color, ownerId, ... }
 * @returns {string} — HTML-разметка карточки
 */
function renderReactions(card) {
  const reactions = card.reactions || {};
  const keys = Object.keys(reactions);
  if (keys.length === 0) {
    return `<div class="reaction-bar">
      <button class="reaction-add-btn" onclick="openEmojiPicker(event, ${card.id})" title="Добавить реакцию">+</button>
    </div>`;
  }
  const userSet = state.userReactions[card.id] || new Set();
  const pills = keys.map(emoji => {
    const r = reactions[emoji];
    const reacted = userSet.has(emoji) ? ' reacted' : '';
    const title = r.users ? r.users.join(', ') : '';
    return `<button class="reaction-pill${reacted}" onclick="toggleReaction(${card.id},'${emoji}')" title="${esc(title)}">
      <span class="reaction-emoji">${emoji}</span>
      <span class="reaction-count">${r.count || 0}</span>
    </button>`;
  }).join('');
  return `<div class="reaction-bar">
    ${pills}
    <button class="reaction-add-btn" onclick="openEmojiPicker(event, ${card.id})" title="Добавить реакцию">+</button>
  </div>`;
}

function cardHTML(card) {
  const contrastText = card.color ? getContrastColor(card.color) : null;
  const btnBg = contrastText === '#fff' ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.7)';
  const bgStyle = card.color ? `style="--card-bg:${card.color};--card-text:${contrastText};--card-btn-bg:${btnBg};--card-btn-fg:${contrastText}"` : '';
  const count = card.commentCount || 0;
  const comments = getCommentsForCard(card.id);
  const commentCount = count ? `<span class="comment-count">${count}</span>` : '';
  const openClass = state.commentOpenState.has(card.id) ? ' open' : '';
  const isOwner = card.ownerId && (card.ownerId === getClientId());
  const textHtml = `<div class="card-text">${linkify(card.text)}</div>`;
  const reactionsHtml = renderReactions(card);

  let footerBtns = `
      <button class="comment-btn${state.commentOpenState.has(card.id) ? ' active' : ''}" onclick="toggleComments(${card.id})" title="Комментарии">` +
        `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">` +
          `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>` +
        `</svg>${commentCount}` +
      `</button>
      <div class="card-spacer"></div>
      <button class="card-color-btn" onclick="openCardColorPopup(event, ${card.id})" title="Цвет карточки">` +
        `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">` +
          `<path d="M12 2a10 10 0 1 0 10 10"/>` +
          `<circle cx="12" cy="12" r="3"/>` +
          `<path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>` +
        `</svg>` +
      `</button>`;

  if (isOwner) {
    footerBtns += `
      <button class="card-edit-btn" onclick="openCardEditModal(${card.id})" title="Редактировать">✎</button>
      <button class="card-del-btn" onclick="delCard(${card.id})" title="Удалить">` +
        `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">` +
          `<polyline points="3 6 5 6 21 6"/>` +
          `<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>` +
          `<path d="M10 11v6"/>` +
          `<path d="M14 11v6"/>` +
          `<path d="M9 6V4h6v2"/>` +
        `</svg>` +
      `</button>`;
  }

  return `<div class="card" id="card-${card.id}" ${bgStyle} onmousedown="onCardDown(event, ${card.id})">
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
        <button class="btn btn-primary" onclick="saveComment(${card.id})">Сохранить</button>
      </div>
    </div>
  </div>`;
}

/**
 * Вычисляет контрастный цвет текста для заданного фона карточки.
 * Парсит HEX или RGB формат цвета, вычисляет luminance по формуле WCAG.
 * Если luminance > 0.65 (светлый фон) — возвращает тёмный текст (#1A1916),
 * иначе — белый (#fff).
 * @param {string} color — HEX-код (#RRGGBB) или rgb() строка
 * @returns {string} — '#1A1916' или '#fff'
 */
function getContrastColor(color) {
  if (!color) return '#1A1916';
  let r, g, b;
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    }
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (color.startsWith('rgb')) {
    const nums = color.match(/\d+/g);
    if (!nums) return '#1A1916';
    [r, g, b] = nums.map(Number);
  } else {
    return '#1A1916';
  }
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.65 ? '#1A1916' : '#fff';
}

/**
 * Создаёт DOM-элемент карточки из HTML-строки.
 * Оборачивает cardHTML() в div, возвращает первый дочерний элемент.
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
 * Если его нет — создаёт, переносит в него существующие дочерние элементы
 * (кроме .add-wrap). Возвращает контейнер.
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
 * Сохраняет: ID активного элемента, позицию курсора (selectionStart/End),
 * значения всех полей ввода, список открытых форм добавления карточек.
 * Используется для восстановления после renderBoard().
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
 * Восстанавливает: значения полей, открытые формы добавления,
 * фокус и позицию курсора. Вызывается с результатом captureBoardInputState().
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
  const contrastText = card.color ? getContrastColor(card.color) : null;
  const btnBg = contrastText === '#fff' ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.7)';
  if (card.color) {
    cardEl.style.cssText = `--card-bg:${card.color};--card-text:${contrastText};--card-btn-bg:${btnBg};--card-btn-fg:${contrastText};`;
  } else {
    cardEl.style.cssText = '';
  }
}

/**
 * Рендерит список комментариев карточки в HTML.
 * Для каждого комментария:
 *   - Если находится в режиме редактирования — показывает textarea с кнопками.
 *   - Иначе — показывает текст и (для владельца) кнопки редактирования/удаления.
 * Если комментариев нет — показывает «Нет комментариев».
 * @param {Array}  comments — массив объектов комментариев
 * @param {number} cardId   — ID карточки (для определения владельца)
 * @returns {string} — HTML-строка списка комментариев
 */
function renderCommentItems(comments, cardId) {
  if (state._loadingComments.has(cardId)) {
    return '<div class="comment-loading"><div class="comment-spinner"></div>Загрузка...</div>';
  }
  if (!comments || comments.length === 0) return '<div class="comment-empty">Нет комментариев</div>';
  return comments.map(comment => {
    const isEditing = state._editingComment && state._editingComment.commentId === comment.id && state._editingComment.cardId === cardId;
    const isOwner = comment.ownerId && (comment.ownerId === getClientId());
    if (isEditing) {
      return `
        <div class="comment-item">
          <textarea id="comment-edit-input-${comment.id}" rows="3">${esc(comment.text)}</textarea>
          <div>
            <button class="btn btn-ghost" onclick="cancelCommentEdit()">Отмена</button>
            <button class="btn btn-primary" onclick="saveCommentEdit(${cardId}, '${comment.id}')">Сохранить</button>
          </div>
        </div>`;
    }
    const ownerBtns = isOwner ? `<div style="display:flex;gap:6px">` +
      `<button class="card-edit-btn" onclick="openCommentEditModal(${cardId}, '${comment.id}')" title="Редактировать">` +
        `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>` +
      `</button>` +
      `<button class="card-del-btn" onclick="delComment(${cardId}, '${comment.id}')" title="Удалить">` +
        `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">` +
          `<polyline points="3 6 5 6 21 6"/>` +
          `<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>` +
        `</svg>` +
      `</button>` +
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
 * Обновляет: стили цвета, текст, кнопку голосования, кнопку комментариев,
 * секцию комментариев, подвал карточки (кнопки edit/delete для владельца).
 * Используется для инкрементального обновления (без полной перерисовки DOM).
 * @param {HTMLElement} cardEl — существующий DOM-элемент .card
 * @param {Object}      card  — объект карточки с актуальными данными
 */
function updateCardElement(cardEl, card) {
  applyCardStyles(cardEl, card);

  const cardText = cardEl.querySelector('.card-text');
  if (cardText && cardText.textContent !== card.text) {
    cardText.innerHTML = linkify(card.text);
  }

  const reactionBar = cardEl.querySelector('.reaction-bar');
  if (reactionBar) {
    reactionBar.outerHTML = renderReactions(card);
  }

  const commentBtn = cardEl.querySelector('.comment-btn');
  if (commentBtn) {
    const commentCount = card.commentCount || 0;
    commentBtn.classList.toggle('active', state.commentOpenState.has(card.id));
    const commentCountHtml = commentCount ? `<span class="comment-count">${commentCount}</span>` : '';
    commentBtn.innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>${commentCountHtml}`;
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
    const isOwner = card.ownerId && (card.ownerId === getClientId());
    let footerBtns = `\n      <button class="comment-btn${state.commentOpenState.has(card.id) ? ' active' : ''}" onclick="toggleComments(${card.id})" title="Комментарии">` +
        `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">` +
          `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>` +
        `</svg>${commentCount ? `<span class="comment-count">${commentCount}</span>` : ''}` +
      `</button>\n      <div class="card-spacer"></div>\n      <button class="card-color-btn" onclick="openCardColorPopup(event, ${card.id})" title="Цвет карточки">` +
        `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">` +
          `<path d="M12 2a10 10 0 1 0 10 10"/>` +
          `<circle cx="12" cy="12" r="3"/>` +
          `<path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>` +
        `</svg>` +
      `</button>`;

    if (isOwner) {
      footerBtns += `\n      <button class="card-edit-btn" onclick="openCardEditModal(${card.id})" title="Редактировать">✎</button>\n      <button class="card-del-btn" onclick="delCard(${card.id})" title="Удалить">` +
                    `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">` +
                      `<polyline points="3 6 5 6 21 6"/>` +
                      `<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>` +
                      `<path d="M10 11v6"/>` +
                      `<path d="M14 11v6"/>` +
                      `<path d="M9 6V4h6v2"/>` +
                    `</svg>` +
                    `</button>`;
    }

    cardFooter.innerHTML = footerBtns;
  }
}

/**
 * Приводит DOM-контейнер карточек колонки к желаемому состоянию (reconcile).
 * Сравнивает текущие DOM-элементы с массивом cards:
 *   - Создаёт новые элементы для карточек, которых нет в DOM.
 *   - Обновляет существующие через updateCardElement().
 *   - Переставляет элементы для правильного порядка.
 *   - Удаляет элементы карточек, которых больше нет в данных.
 *   - Показывает/скрывает подсказку «Перетащите сюда карточку».
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
 * Автоматически подстраивает высоту textarea-ввода названия колонки
 * под содержимое (autosize). Устанавливает height: auto, затем
 * устанавливает scrollHeight.
 * @param {HTMLTextAreaElement} labelInput — textarea заголовка колонки
 */
function autosizeColumnLabel(labelInput) {
  if (!labelInput) return;
  labelInput.style.height = 'auto';
  labelInput.style.height = (labelInput.scrollHeight) + 'px';
}

/**
 * Создаёт DOM-элемент колонки с заголовком, телом (карточки + форма добавления).
 * Содержит: точку-индикатор цвета, textarea для названия, бейдж-счётчик,
 * кнопку удаления, кнопку «Добавить карточку», контейнер карточек.
 * @param {Object} col   — объект колонки { id, label, s }
 * @param {Array}  cards — массив карточек колонки
 * @returns {HTMLElement} — DOM-элемент .column
 */
function createColumnElement(col, cards) {
  const wrap = document.createElement('div');
  wrap.className = 'column';
  wrap.dataset.col = col.id;
  wrap.innerHTML = `
    <div class="col-head" style="${schemeHeadStyle(col.s)}">
      <div class="col-dot" style="${schemeDotStyle(col.s)}" title="Изменить цвет" onclick="openColSchemePopup(event,'${col.id}')"></div>
      <textarea class="col-label-input" id="cli-${col.id}" rows="1"
        style="${schemeLabelStyle(col.s)}"
        onchange="renameCol('${col.id}',this.value)"
        onblur="renameCol('${col.id}',this.value)"
        oninput="this.style.height='auto';this.style.height=(this.scrollHeight)+'px';">${esc(col.label)}</textarea>
      <div class="col-badge" style="${schemeBadgeStyle(col.s)}">${cards.length}</div>
      <button class="col-del-btn" onclick="confirmDelCol('${col.id}')" title="Удалить колонку">
        <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="col-body" id="cb-${col.id}">
      <div class="add-wrap">
        <button class="add-trigger" id="at-${col.id}" onclick="openAdd('${col.id}')">
          <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Добавить карточку
        </button>
        <div class="add-form" id="af-${col.id}">
          <textarea id="atx-${col.id}" placeholder="Введите текст…" rows="3"></textarea>
          <div class="add-form-actions">
            <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px" onclick="closeAdd('${col.id}')">Отмена</button>
            <button class="btn btn-primary" style="padding:4px 10px;font-size:12px" onclick="addCard('${col.id}')">Добавить</button>
          </div>
        </div>
      </div>
      <div class="cards-list">
        ${cards.length === 0 ? '<div class="empty-hint">Перетащите сюда карточку или добавьте новую</div>' : cards.map(cardHTML).join('')}
      </div>
    </div>`;
  const labelInput = wrap.querySelector('.col-label-input');
  if (labelInput) autosizeColumnLabel(labelInput);
  return wrap;
}

/**
 * Обновляет существующий DOM-элемент колонки.
 * Обновляет: стили заголовка (фон, точка, текст), бейдж-счётчик,
 * а также выполняет reconcile карточек внутри колонки.
 * @param {HTMLElement} colEl — существующий DOM-элемент .column
 * @param {Object}      col   — объект колонки
 * @param {Array}       cards — массив карточек
 */
function updateColumnElement(colEl, col, cards) {
  const head = colEl.querySelector('.col-head');
  if (head) head.style.cssText = schemeHeadStyle(col.s);

  const dot = colEl.querySelector('.col-dot');
  if (dot) dot.style.cssText = schemeDotStyle(col.s);

  const labelInput = colEl.querySelector('.col-label-input');
  if (labelInput) {
    if (document.activeElement !== labelInput) {
      labelInput.value = col.label;
    }
    labelInput.style.cssText = schemeLabelStyle(col.s);
    // autosize
    labelInput.style.height = 'auto';
    labelInput.style.height = (labelInput.scrollHeight) + 'px';
  }

  const badge = colEl.querySelector('.col-badge');
  if (badge) {
    badge.style.cssText = schemeBadgeStyle(col.s);
    badge.textContent = cards.length;
  }

  const colBody = colEl.querySelector('.col-body');
  if (!colBody) return;
  const cardsContainer = ensureCardsContainer(colBody);
  reconcileColumnCards(cardsContainer, cards);
}

/**
 * Главная функция рендеринга доски.
 * Определяет все колонки текущей доски и выполняет reconcile:
 *   - Создаёт новые DOM-элементы колонок, которых нет на странице.
 *   - Обновляет существующие через updateColumnElement().
 *   - Переставляет колонки для правильного порядка.
 *   - Удаляет колонки, которых больше нет в данных.
 *   - Добавляет кнопку «Добавить колонку» в конец.
 * Сохраняет и восстанавливает состояние input'ов (если preserveInputState = true).
 * Если drag активен — ставит флаг _pendingBoardRender и выходит (отложенная перерисовка).
 * @param {Object} options
 * @param {boolean} options.preserveInputState — сохранять ли состояние input'ов (по умолчанию true)
 */
function renderBoard({ preserveInputState = true } = {}) {
  const shouldRestoreInput = preserveInputState && state.activeBoardId === lastRenderedBoardId;
  const inputState = shouldRestoreInput ? captureBoardInputState() : null;
  if (state.dnd && state.dnd.active) {
    state._pendingBoardRender = true;
    return;
  }
  state._pendingBoardRender = false;

  const b = curBoard();
  if (!b) return;
  const inner = document.getElementById('boardInner');
  if (!inner) return;

  let addColumnButton = inner.querySelector('.add-col-btn');
  if (!addColumnButton) {
    addColumnButton = document.createElement('button');
    addColumnButton.className = 'add-col-btn';
    addColumnButton.onclick = () => {
      if (window.openAddCol) window.openAddCol();
    };
    addColumnButton.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
      </svg>Добавить колонку`;
    inner.appendChild(addColumnButton);
  }

  const existingCols = Array.from(inner.children).filter(child => child.classList.contains('column'));
  const existingMap = new Map(existingCols.map(el => [el.dataset.col, el]));

  b.cols.forEach((col, index) => {
    const cards = getCardsForColumn(col.id);
    let colEl = existingMap.get(col.id);
    if (!colEl) {
      colEl = createColumnElement(col, cards);
    } else {
      updateColumnElement(colEl, col, cards);
    }

    const nextCol = b.cols[index + 1] ? existingMap.get(b.cols[index + 1].id) : null;
    const referenceNode = nextCol && referenceNodeIsInParent(nextCol, inner) ? nextCol : addColumnButton;
    if (colEl !== referenceNode.previousElementSibling) {
      inner.insertBefore(colEl, referenceNode);
    }
    const labelInput = colEl.querySelector('.col-label-input');
    if (labelInput) autosizeColumnLabel(labelInput);
  });

  existingCols.forEach(colEl => {
    if (!b.cols.some(col => col.id === colEl.dataset.col)) {
      colEl.remove();
    }
  });

  if (addColumnButton.parentElement !== inner) {
    inner.appendChild(addColumnButton);
  } else {
    inner.appendChild(addColumnButton);
  }

  if (shouldRestoreInput) {
    restoreBoardInputState(inputState);
  }

  lastRenderedBoardId = state.activeBoardId;
}

/**
 * Проверяет, что узел является дочерним элементом заданного родителя.
 * @param {HTMLElement} node   — проверяемый узел
 * @param {HTMLElement} parent — предполагаемый родитель
 * @returns {boolean} — true если node.parentElement === parent
 */
function referenceNodeIsInParent(node, parent) {
  return node && node.parentElement === parent;
}
