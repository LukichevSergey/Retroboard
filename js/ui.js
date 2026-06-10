
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

function closeOverlay(id) {
  document.getElementById(id)?.classList.remove('open');
}

window.closeOverlay = closeOverlay;

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function setSyncBadge(cls, text) {
  const badge = document.getElementById('syncBadge');
  if (!badge) return;
  badge.className = 'sync-badge ' + cls;
  document.getElementById('syncText').textContent = text;
}

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

function closeColorPopup() {
  const popup = document.getElementById('colorPopup');
  popup?.classList.remove('open');
  state._colPickerTarget = null;
  state._cardPickerCardId = null;
}
