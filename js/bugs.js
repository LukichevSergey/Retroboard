function bugDocRef() {
  return db.collection('global').doc('bugReport');
}

async function fbSaveBugReport(text) {
  if (!firebaseOk) return;
  try {
    await bugDocRef().set({
      text: text || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('fbSaveBugReport error:', error);
    showToast('Не удалось сохранить баг-ноут на сервере.');
  }
}

function loadBugReportLocal() {
  try {
    const saved = localStorage.getItem('rb_bug_report') || '';
    state.bugReportText = saved;
  } catch (error) {
    console.warn('loadBugReportLocal:', error);
    state.bugReportText = '';
  }
}

function saveBugReportLocal(text) {
  try {
    localStorage.setItem('rb_bug_report', text || '');
  } catch (error) {
    console.warn('saveBugReportLocal:', error);
  }
}

function subscribeBugReport() {
  if (!firebaseOk) return;
  if (state.bugReportUnsub) state.bugReportUnsub();
  state.bugReportUnsub = bugDocRef().onSnapshot(doc => {
    const data = doc.exists ? doc.data() : null;
    state.bugReportText = (data && data.text) ? data.text : '';
    const textarea = document.getElementById('bugReportTextarea');
    if (textarea && document.getElementById('bugOverlay')?.classList.contains('open')) {
      textarea.value = state.bugReportText;
    }
  }, error => {
    console.error('subscribeBugReport error:', error);
  });
}

function openBugReportModal() {
  const textarea = document.getElementById('bugReportTextarea');
  if (textarea) textarea.value = state.bugReportText || '';
  document.getElementById('bugOverlay')?.classList.add('open');
  setTimeout(() => textarea?.focus(), 100);
}

function saveBugReport() {
  const textarea = document.getElementById('bugReportTextarea');
  const text = textarea?.value || '';
  state.bugReportText = text;
  if (firebaseOk) {
    fbSaveBugReport(text);
  } else {
    saveBugReportLocal(text);
    showToast('Баг-ноут сохранен локально');
  }
  closeOverlay('bugOverlay');
}

window.openBugReportModal = openBugReportModal;
window.saveBugReport = saveBugReport;
