/**
 * Рендерит список досок в боковой панели (sidebar).
 * Сортирует доски по дате создания (новые сверху).
 * Для каждой доски создаёт элемент с названием, точкой-индикатором
 * и кнопкой удаления. Подсвечивает активную доску классом 'active'.
 * Если досок нет — показывает подсказку «Нет досок».
 */
function renderSidebar() {
  const container = document.getElementById('sbBoards');
  const list = Object.values(state.boards).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--hint);font-style:italic">Нет досок</div>';
    return;
  }

  const boardsHtml = list.map(board => `
    <div class="board-item ${board.id === state.activeBoardId ? 'active' : ''}" onclick="selectBoard('${board.id}')">
      <div class="bi-dot"></div>
      <span class="bi-name">${board.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</span>
      <div class="bi-actions">
        ${isAdmin() ? `<button class="bi-icon-btn danger" onclick="event.stopPropagation();confirmDelBoard('${board.id}')" title="Удалить">
          <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>` : ''}
      </div>
    </div>`).join('');

  const loadAllButton = (firebaseOk && !state.boardsLoadedAll && list.length >= 5) ? `
    <div class="board-item load-all ${state.boardsLoading ? 'loading' : ''}" onclick="if (!state.boardsLoading) loadAllBoards()">
      ${state.boardsLoading ? '<span class="sidebar-spinner"></span>' : ''}
      <span class="bi-name">${state.boardsLoading ? 'Загрузка...' : 'Загрузить все доски'}</span>
    </div>` : '';

  container.innerHTML = boardsHtml + loadAllButton;
}

/**
 * Выбирает доску по ID и отображает её.
 * Устанавливает state.activeBoardId, заполняет поле ввода названия в topbar,
 * скрывает пустое состояние, показывает boardInner и кнопку копирования.
 * Перерисовывает сайдбар и доску.
 * @param {string} id — ID доски для выбора
 */
function selectBoard(id) {
  if (!state.boards[id]) return;
  state.activeBoardId = id;
  const titleInput = document.getElementById('topbarName');
  if (titleInput) {
    titleInput.value = state.boards[id].name;
    titleInput.removeAttribute('readonly');
  }
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('boardInner').style.display = '';
  document.getElementById('copyBoardBtn').style.display = '';
  renderSidebar();
  subscribeBoardDoc(id, handleActiveBoardSnapshot, error => console.error(error));
  loadBoardCards(id);
}

/**
 * Переименовывает текущую активную доску.
 * Обновляет поле board.name, сохраняет в Firebase и localStorage,
 * перерисовывает сайдбар. Вызывается из onblur/topbar input.
 * @param {string} value — новое название доски
 */
function renameCurBoard(value) {
  const board = curBoard();
  if (!board) return;
  board.name = value.trim() || board.name;
  fbUpdateBoard(board.id, { name: board.name });
  lsSave();
  renderSidebar();
}

/**
 * Показывает пустое состояние (когда доска не выбрана).
 * Скрывает boardInner и кнопку копирования, показывает emptyState.
 * Устанавливает titleInput в readonly со значением «Выберите доску».
 */
function showEmpty() {
  document.getElementById('emptyState').style.display = '';
  document.getElementById('boardInner').style.display = 'none';
  const titleInput = document.getElementById('topbarName');
  if (titleInput) {
    titleInput.value = 'Выберите доску';
    titleInput.setAttribute('readonly', '');
  }
  document.getElementById('copyBoardBtn').style.display = 'none';
  renderSidebar();
}

/**
 * Переключает видимость боковой панели (свёрнута/развёрнута).
 * Добавляет/убирает CSS-класс 'collapsed', сохраняет состояние
 * в localStorage под ключом 'rb_sidebar_collapsed'. Обновляет
 * иконку и текст кнопки-переключателя.
 */
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const collapsed = sidebar.classList.toggle('collapsed');
  localStorage.setItem('rb_sidebar_collapsed', collapsed ? '1' : '0');
  updateSidebarToggleButton(collapsed);
}

/**
 * Обновляет кнопку-переключатель боковой панели в зависимости от состояния.
 * Меняет title, текст и направление стрелки SVG-иконки.
 * @param {boolean} collapsed — свёрнута ли панель
 */
function updateSidebarToggleButton(collapsed) {
  const btn = document.getElementById('sidebarToggleBtn');
  if (!btn) return;
  btn.title = collapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель';
  btn.querySelector('.toggle-label').textContent = collapsed ? 'Развернуть' : 'Свернуть';
  btn.querySelector('svg path').setAttribute('d', collapsed ? 'M8 6l6 6-6 6' : 'M16 6l-6 6 6 6');
}

/**
 * Восстанавливает состояние свёрнутости боковой панели из localStorage.
 * Вызывается при старте приложения. Если сохранено '1' — добавляет
 * класс 'collapsed'. Обновляет кнопку-переключатель.
 */
function initSidebarState() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const saved = localStorage.getItem('rb_sidebar_collapsed');
  const collapsed = saved === '1';
  if (collapsed) sidebar.classList.add('collapsed');
  updateSidebarToggleButton(collapsed);
}

/**
 * Экспорт функций сайдбара в глобальную область window.
 */
window.selectBoard = selectBoard;
window.toggleSidebar = toggleSidebar;
window.renameCurBoard = renameCurBoard;
