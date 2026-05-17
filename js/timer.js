
function computeRemainingSeconds(data) {
  if (!data || !data.running) return data?.durationSec || 300;
  if (!data.startTimestamp) return data.durationSec;
  const now = Date.now();
  const startTime = data.startTimestamp.toMillis ? data.startTimestamp.toMillis() : data.startTimestamp;
  const elapsed = (now - startTime) / 1000;
  const remaining = data.durationSec - elapsed;
  return remaining > 0 ? remaining : 0;
}

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

function openTimerModal() {
  const minutes = Math.max(1, Math.ceil(state.localTimerSeconds / 60));
  const input = document.getElementById('timerMinInput');
  if (input) input.value = minutes;
  const actionBtn = document.getElementById('timerActionBtn');
  if (actionBtn) actionBtn.textContent = state.timerRunning ? 'Остановить' : 'Запустить';
  document.getElementById('timerOverlay').classList.add('open');
}

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

function initGlobalTimer() {
  if (firebaseOk) {
    subscribeGlobalTimer();
  } else {
    state.localTimerSeconds = 300;
    state.timerRunning = false;
    updateGlobalTimerUI(state.localTimerSeconds);
  }
}

function closeOverlay(id) {
  document.getElementById(id)?.classList.remove('open');
}

window.openTimerModal = openTimerModal;
window.handleTimerAction = handleTimerAction;
