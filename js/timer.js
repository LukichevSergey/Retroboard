/**
 * Вычисляет оставшееся время таймера на основе данных из Firebase.
 * Если таймер не запущен (running === false) или нет данных —
 * возвращает durationSec (номинальную длительность).
 * Если таймер запущен — вычисляет разницу между текущим временем
 * и стартовым временем, вычитает из общей длительности.
 * @param {Object} data — данные документа таймера из Firestore
 *   (running, durationSec, startTimestamp)
 * @returns {number} — оставшееся время в секундах (не меньше 0)
 */
function computeRemainingSeconds(data) {
  if (!data || !data.running) return data?.durationSec || 300;
  if (!data.startTimestamp) return data.durationSec;
  const now = Date.now();
  const startTime = data.startTimestamp.toMillis ? data.startTimestamp.toMillis() : data.startTimestamp;
  const elapsed = (now - startTime) / 1000;
  const remaining = data.durationSec - elapsed;
  return remaining > 0 ? remaining : 0;
}

/**
 * Обновляет отображение таймера на странице.
 * Форматирует время в MM:SS и обновляет текст #timerDisplay.
 * Меняет CSS-класс таймер-пилюли (#timerPill):
 *   - 'expired' — время вышло (<=0 и таймер запущен),
 *   - 'running' — таймер запущен и идёт,
 *   - по умолчанию — таймер остановлен.
 * @param {number} seconds — оставшееся время в секундах
 */
function updateGlobalTimerUI(seconds) {
  const rounded = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(rounded / 60);
  const secs = String(rounded % 60).padStart(2, '0');
  const display = document.getElementById('timerDisplay');
  if (display) display.textContent = `${mins}:${secs}`;
  const pill = document.getElementById('timerPill');
  if (!pill) return;
  if (rounded <= 0 && state.timerRunning) {
    pill.className = 'timer-pill expired';
  } else if (state.timerRunning) {
    pill.className = 'timer-pill running';
  } else {
    pill.className = 'timer-pill';
  }
}

/**
 * Подписывается на обновления документа таймера в Firebase Firestore.
 * При каждом изменении документа:
 *   1) Если таймер не запущен — останавливает локальный интервал,
 *      сбрасывает UI.
 *   2) Если таймер запущен и время ещё есть — запускает локальный
 *      интервал (setInterval 1 сек), который обновляет UI каждую секунду.
 *   3) Если время вышло — автоматически останавливает таймер через stopGlobalTimer().
 * Подписка работает в реальном времени: все клиенты видят одинаковое время.
 */
function subscribeGlobalTimer() {
  if (!firebaseOk) return;
  if (state.globalTimerUnsub) state.globalTimerUnsub();
  state.globalTimerUnsub = timerDocRef().onSnapshot(doc => {
    const data = doc.exists ? doc.data() : null;
    if (!data || !data.running) {
      if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
      }
      state.timerRunning = false;
      state.localTimerSeconds = data?.durationSec ?? 300;
      updateGlobalTimerUI(state.localTimerSeconds);
      return;
    }
    const remaining = computeRemainingSeconds(data);
    state.localTimerSeconds = remaining;
    updateGlobalTimerUI(state.localTimerSeconds);
    if (remaining <= 0) {
      if (state.timerRunning) stopGlobalTimer();
      return;
    }
    if (!state.timerRunning) {
      if (state.timerInterval) clearInterval(state.timerInterval);
      state.timerRunning = true;
      state.timerInterval = setInterval(() => {
        if (!state.timerRunning) return;
        if (state.localTimerSeconds > 0) {
          state.localTimerSeconds = Math.max(0, state.localTimerSeconds - 1);
          updateGlobalTimerUI(state.localTimerSeconds);
          if (state.localTimerSeconds <= 0) {
            stopGlobalTimer();
          }
        }
      }, 1000);
    }
  }, error => {
    console.error('Ошибка подписки таймера:', error);
  });
}

/**
 * Запускает глобальный таймер на заданное количество секунд.
 * Записывает в Firestore документ с running: true, durationSec и серверным временем старта.
 * Все подключённые клиенты увидят запуск таймера через подписку.
 * @param {number} durationSec — длительность таймера в секундах
 */
async function startGlobalTimer(durationSec) {
  if (!firebaseOk) {
    showToast('Нет соединения с Firebase, таймер не синхронизирован');
    return;
  }
  await timerDocRef().set({
    running: true,
    durationSec,
    startTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  showToast(`Таймер запущен на ${Math.floor(durationSec / 60)} мин`);
}

/**
 * Останавливает глобальный таймер.
 * Записывает в Firestore running: false (с merge: true, чтобы не стирать durationSec).
 * Останавливает локальный интервал и сбрасывает флаг timerRunning.
 * Показывает уведомление «Таймер остановлен».
 */
async function stopGlobalTimer() {
  if (!firebaseOk) return;
  await timerDocRef().set({
    running: false,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  state.timerRunning = false;
  showToast('Таймер остановлен');
}

/**
 * Открывает модальное окно настройки таймера.
 * Устанавливает значение input'а (в минутах) равным текущему времени,
 * меняет текст кнопки на «Остановить» если таймер запущен, иначе «Запустить».
 * Показывает оверлей #timerOverlay.
 */
function openTimerModal() {
  const minutes = Math.max(1, Math.ceil(state.localTimerSeconds / 60));
  const input = document.getElementById('timerMinInput');
  if (input) input.value = minutes;
  const actionBtn = document.getElementById('timerActionBtn');
  if (actionBtn) actionBtn.textContent = state.timerRunning ? 'Остановить' : 'Запустить';
  document.getElementById('timerOverlay').classList.add('open');
}

/**
 * Обрабатывает нажатие кнопки «Запустить» / «Остановить» в модальном окне таймера.
 * Если таймер запущен — останавливает его, иначе — запускает на указанное количество минут.
 * Закрывает модальное окно после действия.
 */
function handleTimerAction() {
  const minutes = parseInt(document.getElementById('timerMinInput').value) || 5;
  const seconds = minutes * 60;
  if (state.timerRunning) {
    stopGlobalTimer();
  } else {
    startGlobalTimer(seconds);
  }
  closeOverlay('timerOverlay');
}

/**
 * Инициализирует глобальный таймер при старте приложения.
 * Если Firebase доступен — подписывается на обновления таймера.
 * Если Firebase недоступен — устанавливает дефолтные 300 секунд (5 минут)
 * и обновляет UI.
 */
function initGlobalTimer() {
  if (firebaseOk) {
    subscribeGlobalTimer();
  } else {
    state.localTimerSeconds = 300;
    state.timerRunning = false;
    updateGlobalTimerUI(state.localTimerSeconds);
  }
}

/**
 * Экспорт функций таймера в глобальную область window,
 * чтобы они были доступны из HTML-атрибутов (onclick).
 */
window.openTimerModal = openTimerModal;
window.handleTimerAction = handleTimerAction;
