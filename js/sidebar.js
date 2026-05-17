
function renderSidebar() {
  const container = document.getElementById('sbBoards');
  const list = Object.values(state.boards).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--hint);font-style:italic">Нет досок</div>';
    return;
  }
  container.innerHTML = list.map(board => `
    <div class="board-item ${board.id === state.activeBoardId ? 'active' : ''}" onclick="selectBoard('${board.id}')">
      <div class="bi-dot"></div>
      <span class="bi-name">${board.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</span>
      <div class="bi-actions">
        <button class="bi-icon-btn danger" onclick="event.stopPropagation();confirmDelBoard('${board.id}')" title="Удалить">
          <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>`).join('');
}

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
  renderBoard();
}

function renameCurBoard(value) {
  const board = curBoard();
  if (!board) return;
  board.name = value.trim() || board.name;
  fbSave(board);
  lsSave();
  renderSidebar();
}

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

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const collapsed = sidebar.classList.toggle('collapsed');
  localStorage.setItem('rb_sidebar_collapsed', collapsed ? '1' : '0');
  updateSidebarToggleButton(collapsed);
}

function updateSidebarToggleButton(collapsed) {
  const btn = document.getElementById('sidebarToggleBtn');
  if (!btn) return;
  btn.title = collapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель';
  btn.querySelector('.toggle-label').textContent = collapsed ? 'Развернуть' : 'Свернуть';
  btn.querySelector('svg path').setAttribute('d', collapsed ? 'M8 6l6 6-6 6' : 'M16 6l-6 6 6 6');
}

function initSidebarState() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const saved = localStorage.getItem('rb_sidebar_collapsed');
  const collapsed = saved === '1';
  if (collapsed) sidebar.classList.add('collapsed');
  updateSidebarToggleButton(collapsed);
}

window.selectBoard = selectBoard;
window.toggleSidebar = toggleSidebar;
window.renameCurBoard = renameCurBoard;
