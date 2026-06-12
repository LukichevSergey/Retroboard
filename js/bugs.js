/**
 * Возвращает ссылку на документ глобального баг-репорта в Firestore.
 * Хранится в коллекции 'global', документ 'bugReport'.
 * Содержит поля: text (текст баг-ноута), updatedAt.
 */
function bugDocRef() {
  return db.collection('global').doc('bugReport');
}

/**
 * Сохраняет текст баг-репорта в Firebase Firestore.
 * Перезаписывает поле text документа bugReport с серверным временем обновления.
 * @param {string} text — текст баг-репорта
 */
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

/**
 * Загружает текст баг-репорта из localStorage (оффлайн-режим).
 * Читает ключ 'rb_bug_report', записывает в state.bugReportText.
 * Используется при старте приложения, если Firebase недоступен.
 */
function loadBugReportLocal() {
  try {
    const saved = localStorage.getItem('rb_bug_report') || '';
    state.bugReportText = saved;
  } catch (error) {
    console.warn('loadBugReportLocal:', error);
    state.bugReportText = '';
  }
}

/**
 * Сохраняет текст баг-репорта в localStorage (оффлайн-режим).
 * @param {string} text — текст баг-репорта
 */
function saveBugReportLocal(text) {
  try {
    localStorage.setItem('rb_bug_report', text || '');
  } catch (error) {
    console.warn('saveBugReportLocal:', error);
  }
}

/**
 * Подписывается на обновления документа баг-репорта в Firebase Firestore.
 * При каждом изменении документа обновляет state.bugReportText и,
 * если модальное окно баг-репорта открыто — обновляет textarea.
 * Перед созданием новой подписки отменяет предыдущую (если есть).
 */
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

/**
 * Открывает модальное окно баг-репорта.
 * Заполняет textarea текущим текстом из state.bugReportText,
 * показывает оверлей, фокусирует textarea через 100мс.
 */
function openBugReportModal() {
  const textarea = document.getElementById('bugReportTextarea');
  if (textarea) textarea.value = state.bugReportText || '';
  document.getElementById('bugOverlay')?.classList.add('open');
  setTimeout(() => textarea?.focus(), 100);
}

/**
 * Сохраняет баг-репорт.
 * Читает текст из textarea, обновляет state.bugReportText.
 * Если Firebase доступен — сохраняет через fbSaveBugReport(),
 * иначе — через saveBugReportLocal() с toast «сохранен локально».
 * Закрывает модальное окно.
 */
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

/**
 * Экспорт функций баг-репорта в глобальную область window.
 */
window.openBugReportModal = openBugReportModal;
window.saveBugReport = saveBugReport;
