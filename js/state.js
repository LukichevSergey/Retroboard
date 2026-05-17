const state = {
  boards: {},
  activeBoardId: null,
  commentOpenState: new Set(),
  _newBoardMode: 'create',
  _pendingDelBoard: null,
  _newColScheme: 0,
  _colPickerTarget: null,
  _cardPickerCardId: null,
  dnd: { active: false, cardId: null, ghost: null, ox: 0, oy: 0, targetCol: null, insertBefore: null },
  bugReportText: '',
  bugReportUnsub: null,
  localTimerSeconds: 300,
  timerRunning: false,
  timerInterval: null,
  globalTimerUnsub: null,
};

function curBoard() {
  return state.boards[state.activeBoardId] || null;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
