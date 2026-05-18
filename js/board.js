
function getScheme(schemeId) {
  return COL_SCHEMES[schemeId] || COL_SCHEMES[0];
}

function schemeHeadStyle(s) {
  return `background:${getScheme(s).bg}`;
}

function schemeDotStyle(s) {
  return `background:${getScheme(s).dot}`;
}

function schemeLabelStyle(s) {
  return `color:${getScheme(s).text}`;
}

function schemeBadgeStyle(s) {
  const sc = getScheme(s);
  return `background:${sc.tag};color:${sc.tt}`;
}

function cardHTML(card) {
  const contrastText = card.color ? getContrastColor(card.color) : null;
  const btnBg = contrastText === '#fff' ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.7)';
  const bgStyle = card.color ? `style="--card-bg:${card.color};--card-text:${contrastText};--card-btn-bg:${btnBg};--card-btn-fg:${contrastText}"` : '';
  const comments = card.comments || [];
  const count = comments.length;
  const commentCount = count ? `<span class="comment-count">${count}</span>` : '';
  const openClass = state.commentOpenState.has(card.id) ? ' open' : '';
  const voteLabel = card.votes > 0 ? `${card.votes}` : '';
  const userVoted = state.userVotes.has(card.id);

  return `<div class="card" id="card-${card.id}" ${bgStyle} onmousedown="onCardDown(event, ${card.id})">
    <div class="card-text">${esc(card.text)}</div>
    <div class="card-footer">
      <button class="vote-btn ${userVoted ? 'voted' : ''}" onclick="vote(${card.id})">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
        ${voteLabel}
      </button>
      <button class="comment-btn${state.commentOpenState.has(card.id) ? ' active' : ''}" onclick="toggleComments(${card.id})" title="Комментарии">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        ${commentCount}
      </button>
      <div class="card-spacer"></div>
      <button class="card-color-btn" onclick="openCardColorPopup(event, ${card.id})" title="Цвет карточки">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M12 2a10 10 0 1 0 10 10"/>
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
      </button>
      <button class="card-del-btn" onclick="delCard(${card.id})" title="Удалить">
        <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/>
          <path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
    <div class="comment-section${openClass}" id="comments-${card.id}">
      <div class="comments-list">
        ${count ? comments.map(comment => `
          <div class="comment-item">
            <div class="comment-text">${esc(comment.text)}</div>
          </div>
        `).join('') : '<div class="comment-empty">Нет комментариев</div>'}
      </div>
      <div class="comment-form">
        <textarea id="comment-input-${card.id}" placeholder="Напишите комментарий" rows="3"></textarea>
        <button class="btn btn-primary" onclick="saveComment(${card.id})">Сохранить</button>
      </div>
    </div>
  </div>`;
}

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

function renderBoard() {
  const b = curBoard();
  if (!b) return;
  const inner = document.getElementById('boardInner');
  inner.innerHTML = '';

  b.cols.forEach(col => {
    const cards = b.cards[col.id] || [];
    const wrap = document.createElement('div');
    wrap.className = 'column';
    wrap.dataset.col = col.id;
    wrap.innerHTML = `
      <div class="col-head" style="${schemeHeadStyle(col.s)}">
        <div class="col-dot" style="${schemeDotStyle(col.s)}" title="Изменить цвет" onclick="openColSchemePopup(event,'${col.id}')"></div>
        <input class="col-label-input" id="cli-${col.id}" value="${esc(col.label)}"
          style="${schemeLabelStyle(col.s)}"
          onchange="renameCol('${col.id}',this.value)"
          onblur="renameCol('${col.id}',this.value)" />
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
        ${cards.length === 0 ? '<div class="empty-hint">Перетащите сюда карточку или добавьте новую</div>' : ''}
        ${cards.map(cardHTML).join('')}
      </div>`;
    inner.appendChild(wrap);
  });

  const addColumnButton = document.createElement('button');
  addColumnButton.className = 'add-col-btn';
  addColumnButton.onclick = () => window.openAddCol?.();
  addColumnButton.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>Добавить колонку`;
  inner.appendChild(addColumnButton);
}
