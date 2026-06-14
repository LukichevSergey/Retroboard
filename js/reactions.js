/**
 * Переключает реакцию пользователя на карточке.
 * @param {number} cardId — ID карточки
 * @param {string} emoji  — эмодзи реакции
 */
function toggleReaction(cardId, emoji) {
  const board = curBoard();
  if (!board) return;
  const card = state.cards[cardId];
  if (!card) return;

  if (!card.reactions) card.reactions = {};
  if (!card.reactions[emoji]) card.reactions[emoji] = { count: 0, users: [] };

  if (!state.userReactions[cardId]) state.userReactions[cardId] = new Set();
  const userSet = state.userReactions[cardId];

  const clientId = getClientId();
  const reaction = card.reactions[emoji];

  if (userSet.has(emoji)) {
    reaction.users = reaction.users.filter(u => u !== clientId);
    reaction.count = reaction.users.length;
    userSet.delete(emoji);
    if (reaction.users.length === 0) delete card.reactions[emoji];
    fbUpdateReaction(board.id, cardId, emoji, false, clientId);
  } else {
    reaction.users.push(clientId);
    reaction.count = reaction.users.length;
    userSet.add(emoji);
    fbUpdateReaction(board.id, cardId, emoji, true, clientId);
  }

  lsSave();
  lsSaveUserReactions();
  renderBoard();
}

/**
 * Открывает попап выбора эмодзи для реакции.
 * @param {MouseEvent} event — событие клика
 * @param {number} cardId    — ID карточки
 */
function openEmojiPicker(event, cardId) {
  event.stopPropagation();

  const existing = document.getElementById('emojiPicker');
  if (existing) { closeEmojiPicker(); return; }

  const picker = document.createElement('div');
  picker.className = 'emoji-picker';
  picker.id = 'emojiPicker';

  const userSet = state.userReactions[cardId] || new Set();

  picker.innerHTML = EMOJI_SET.map(item => {
    const picked = userSet.has(item.emoji) ? ' picked' : '';
    return `<button class="emoji-picker-btn${picked}" title="${item.label}" onclick="addReactionFromPicker('${cardId}','${item.emoji}')">${item.emoji}</button>`;
  }).join('');

  const btn = event.currentTarget;
  document.body.appendChild(picker);

  const btnRect = btn.getBoundingClientRect();
  const pickerW = 160;
  const pickerH = 160;

  let x = btnRect.left + btnRect.width / 2 - pickerW / 2;
  let y = btnRect.top - pickerH - 6;

  if (y < 8) y = btnRect.bottom + 6;
  if (x + pickerW > window.innerWidth - 8) x = window.innerWidth - pickerW - 8;
  if (x < 8) x = 8;

  picker.style.left = x + 'px';
  picker.style.top = y + 'px';

  setTimeout(() => {
    document.addEventListener('click', closeEmojiPickerOnOutside, { once: true });
    document.addEventListener('keydown', closeEmojiPickerOnEsc, { once: true });
  }, 0);
}

function closeEmojiPicker() {
  const existing = document.getElementById('emojiPicker');
  if (existing) existing.remove();
}

function closeEmojiPickerOnOutside(e) {
  const picker = document.getElementById('emojiPicker');
  if (picker && !picker.contains(e.target)) closeEmojiPicker();
}

function closeEmojiPickerOnEsc(e) {
  if (e.key === 'Escape') closeEmojiPicker();
}

function addReactionFromPicker(cardId, emoji) {
  closeEmojiPicker();
  toggleReaction(cardId, emoji);
}

window.toggleReaction = toggleReaction;
window.openEmojiPicker = openEmojiPicker;
window.closeEmojiPicker = closeEmojiPicker;
window.addReactionFromPicker = addReactionFromPicker;
