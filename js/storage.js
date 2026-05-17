
function lsSave() {
  if (firebaseOk) return;
  try {
    localStorage.setItem('rb_v4', JSON.stringify({ boards: state.boards, activeBoardId: state.activeBoardId }));
  } catch (e) {
    console.warn('LS save failed', e);
  }
}

function lsLoad() {
  try {
    const saved = JSON.parse(localStorage.getItem('rb_v4') || 'null');
    if (!saved) return false;
    state.boards = saved.boards || {};
    state.activeBoardId = saved.activeBoardId || null;
    return true;
  } catch (e) {
    return false;
  }
}
