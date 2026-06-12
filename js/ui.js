/**
 * Экранирует спецсимволы HTML в строке для безопасной вставки в DOM.
 * Заменяет: & → &amp;, < → &lt;, > → &gt;, " → &quot.
 * Защищает от XSS-атак при выводе пользовательского текста.
 * @param {*} value — исходное значение (любой тип, приводится к строке)
 * @returns {string} — экранированная строка
 */
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Преобразует URL-адреса в тексте в кликабельные ссылки <a>.
 * Сначала экранирует HTML, затем находит все URL (http/https/www)
 * и оборачивает их в тег <a> с target="_blank" и rel="noopener noreferrer".
 * Если URL не начинается с http://, добавляет http:// автоматически.
 * @param {string} value — текст для обработки
 * @returns {string} — HTML-строка с кликабельными ссылками
 */
function linkify(value) {
  const text = String(value);
  const escaped = esc(text);
  const urlRegex = /((https?:\/\/|www\.)[\w\-\.@:%_\+~#=\/\?&;,]+[\w\-\/%#=\?&;])/gi;
  return escaped.replace(urlRegex, match => {
    let href = match;
    if (!/^https?:\/\//i.test(href)) href = 'http://' + href;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });
}

/**
 * Закрывает (скрывает) оверлей (модальное окно) по его DOM-id.
 * Удаляет CSS-класс 'open', что скрывает элемент через CSS.
 * @param {string} id — ID HTML-элемента оверлея
 */
function closeOverlay(id) {
  document.getElementById(id)?.classList.remove('open');
}

window.closeOverlay = closeOverlay;

/**
 * Показывает всплывающее уведомление (toast) с заданным сообщением.
 * Добавляет класс 'show' к элементу #toast, через 2.6 секунды убирает его.
 * @param {string} message — текст уведомления
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

/**
 * Обновляет badge-индикатор состояния синхронизации с Firebase.
 * Устанавливает CSS-класс (ok/syncing/offline) и текст.
 * @param {string} cls  — CSS-класс ('ok' = подключено, 'syncing' = синхронизация, 'offline' = оффлайн)
 * @param {string} text — отображаемый текст рядом с индикатором
 */
function setSyncBadge(cls, text) {
  const badge = document.getElementById('syncBadge');
  if (!badge) return;
  badge.className = 'sync-badge ' + cls;
  document.getElementById('syncText').textContent = text;
}

/**
 * Позиционирует всплывающую палитру цветов (colorPopup) рядом с кликом мыши.
 * Вычисляет позицию так, чтобы палитра не выходила за границы окна браузера.
 * Ширина палитры 220px, высота 120px. Добавляет отступ 8px от курсора.
 * @param {MouseEvent} event — событие клика
 */
function positionPopup(event) {
  const popup = document.getElementById('colorPopup');
  if (!popup) return;
  popup.classList.add('open');
  const pw = 220;
  const ph = 120;
  let x = event.clientX + 8;
  let y = event.clientY + 8;
  if (x + pw > window.innerWidth - 8) x = event.clientX - pw - 8;
  if (y + ph > window.innerHeight - 8) y = event.clientY - ph - 8;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
}

/**
 * Закрывает палитру выбора цветов и сбрасывает связанное состояние.
 * Снимает класс 'open' с #colorPopup, обнуляет _colPickerTarget и _cardPickerCardId.
 */
function closeColorPopup() {
  const popup = document.getElementById('colorPopup');
  popup?.classList.remove('open');
  state._colPickerTarget = null;
  state._cardPickerCardId = null;
}
