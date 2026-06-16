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

function _rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

function _hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [Math.round(hue2rgb(p, q, h + 1/3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1/3) * 255)];
}

/**
 * Затемняет HEX-цвет для тёмной темы.
 * Смешивает в HSL-пространстве с тёмным синеватым базовым тоном,
 * сохраняя насыщенность цвета (35% исходный + 65% тёмный).
 * @param {string} hex — HEX-код цвета (#RGB или #RRGGBB)
 * @returns {string} — затемнённый HEX-код
 */
function dimColor(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const [hs, ss, ls] = _rgbToHsl(r, g, b);
  const mix = (a, b, t) => a + (b - a) * t;
  const [fr, fg, fb] = _hslToRgb(hs, mix(ss, 0.14, 0.65), mix(ls, 0.15, 0.65));
  return '#' + [fr, fg, fb].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
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
