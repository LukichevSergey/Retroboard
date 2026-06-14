/**
 * Последний ID доски, которая была отрисована.
 * Используется для оптимизации input-состояния.
 */
let lastRenderedBoardId = null;

/**
 * Создаёт DOM-элемент колонки с заголовком, телом (карточки + форма добавления).
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
    autosizeColumnLabel(labelInput);
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

  inner.appendChild(addColumnButton);

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
