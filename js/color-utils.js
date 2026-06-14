/**
 * Возвращает объект цветовой схемы по её ID.
 * Если схема не найдена — возвращает дефолтную (индекс 0, зелёная).
 * @param {number} schemeId — индекс схемы в массиве COL_SCHEMES
 * @returns {Object} — объект схемы { bg, text, dot, tag, tt, ... }
 */
function getScheme(schemeId) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const list = isDark ? COL_SCHEMES_DARK : COL_SCHEMES;
  return list[schemeId] || list[0];
}

/**
 * Возвращает CSS-строку стиля фона заголовка колонки.
 * @param {number} s — ID цветовой схемы
 * @returns {string} — CSS-строка, например "background:#EAF3DE"
 */
function schemeHeadStyle(s) {
  return `background:${getScheme(s).bg}`;
}

/**
 * Возвращает CSS-строку стиля точки-индикатора в заголовке колонки.
 * @param {number} s — ID цветовой схемы
 * @returns {string} — CSS-строка, например "background:#639922"
 */
function schemeDotStyle(s) {
  return `background:${getScheme(s).dot}`;
}

/**
 * Возвращает CSS-строку стиля текста заголовка колонки.
 * @param {number} s — ID цветовой схемы
 * @returns {string} — CSS-строка, например "color:#3B6D11"
 */
function schemeLabelStyle(s) {
  return `color:${getScheme(s).text}`;
}

/**
 * Возвращает CSS-строку стиля бейджа-счётчика карточек в заголовке колонки.
 * @param {number} s — ID цветовой схемы
 * @returns {string} — CSS-строка с background и color
 */
function schemeBadgeStyle(s) {
  const sc = getScheme(s);
  return `background:${sc.tag};color:${sc.tt}`;
}

/**
 * Затемняет HEX-цвет для тёмной темы.
 * Смешивает исходный цвет с базовым тёмным фоном (30% исходный + 70% тёмный).
 * @param {string} hex — HEX-код цвета (#RGB или #RRGGBB)
 * @returns {string} — затемнённый HEX-код
 */
function dimColor(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  let r = parseInt(h.slice(0, 2), 16);
  let g = parseInt(h.slice(2, 4), 16);
  let b = parseInt(h.slice(4, 6), 16);
  const dr = 0x25, dg = 0x26, db = 0x2B;
  r = Math.round(r * 0.45 + dr * 0.55);
  g = Math.round(g * 0.45 + dg * 0.55);
  b = Math.round(b * 0.45 + db * 0.55);
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Вычисляет контрастный цвет текста для заданного фона карточки.
 * Парсит HEX или RGB формат цвета, вычисляет luminance по формуле WCAG.
 * Если luminance > 0.65 (светлый фон) — возвращает тёмный текст (#1A1916),
 * иначе — белый (#fff).
 * @param {string} color — HEX-код (#RRGGBB) или rgb() строка
 * @returns {string} — '#1A1916' или '#fff'
 */
function getContrastColor(color) {
  if (!color) return '#1A1916';
  let r, g, b;
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    }
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (color.startsWith('rgb')) {
    const nums = color.match(/\d+/g);
    if (!nums) return '#1A1916';
    [r, g, b] = nums.map(Number);
  } else {
    return '#1A1916';
  }
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.65 ? '#1A1916' : '#fff';
}
