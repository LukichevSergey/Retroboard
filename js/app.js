
async function handleBoardSnapshot(snapshot) {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added' || change.type === 'modified') {
      state.boards[change.doc.id] = change.doc.data();
      if (state.activeBoardId === change.doc.id) renderBoard();
    }
    if (change.type === 'removed') {
      delete state.boards[change.doc.id];
      if (state.activeBoardId === change.doc.id) {
        state.activeBoardId = null;
        showEmpty();
      }
    }
  });
  renderSidebar();
}

async function boot() {
  initFirebase();
  lsLoadUserVotes();
  if (firebaseOk) {
    try {
      const snapshot = await boardsCol().get();
      snapshot.forEach(doc => {
        state.boards[doc.id] = doc.data();
      });
    } catch (error) {
      console.error(error);
    }
    subscribeBoards(handleBoardSnapshot, error => console.error(error));
    if (typeof subscribeBugReport === 'function') subscribeBugReport();
  } else {
    lsLoad();
    if (typeof loadBugReportLocal === 'function') loadBugReportLocal();
  }

  document.getElementById('loadingScreen')?.classList.add('hidden');
  document.getElementById('appShell').style.display = '';
  initGlobalTimer();
  initSidebarState();
  renderSidebar();

  const firstBoard = Object.values(state.boards).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  if (firstBoard) selectBoard(firstBoard.id);
}

function initializeShellEvents() {
  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.classList.remove('open');
    });
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      const board = curBoard();
      if (!board) return;
      board.cols.forEach(col => {
        const form = document.getElementById('af-' + col.id);
        if (form?.classList.contains('open')) addCard(col.id);
      });
    }

    if (event.key === 'Escape') {
      document.querySelectorAll('.overlay.open').forEach(overlay => overlay.classList.remove('open'));
      closeColorPopup();
      const board = curBoard();
      if (!board) return;
      board.cols.forEach(col => closeAdd(col.id));
    }
  });

  document.getElementById('newBoardName')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') window.confirmNewBoard();
  });

  document.getElementById('newColName')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') window.confirmNewCol();
  });
}

initializeShellEvents();
boot().catch(error => {
  console.error('Boot failed:', error);
  document.getElementById('loadingScreen')?.classList.add('hidden');
  document.getElementById('appShell').style.display = '';
});
