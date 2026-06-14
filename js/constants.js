/**
 * Конфигурация Firebase для подключения к бэкенду.
 * Содержит ключи API, ID проекта, authDomain и прочие параметры,
 * необходимые для инициализации Firebase SDK и работы с Firestore.
 */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyArRKIb9uRRCHKKmUSI3XDMAkbqBXrSOxs",
  authDomain: "retroboard-b2f7c.firebaseapp.com",
  projectId: "retroboard-b2f7c",
  storageBucket: "retroboard-b2f7c.firebasestorage.app",
  messagingSenderId: "445885996354",
  appId: "1:445885996354:web:49918467ee620d7c5b3cdb",
};

/**
 * Массив цветовых схем для заголовков колонок.
 * Каждая схема содержит:
 *   id      — уникальный числовой идентификатор схемы (индекс в массиве),
 *   name    — название отображаемое в палитре выбора цвета,
 *   bg      — цвет фона заголовка колонки,
 *   text    — цвет текста в заголовке,
 *   dot     — цвет точки-индикатора в заголовке,
 *   tag     — фон бейджа счётчика карточек,
 *   tt      — цвет текста бейджа счётчика.
 *
 * Пример: схема 0 (Зелёный) — зелёный фон, тёмно-зелёный текст, светло-зелёный бейдж.
 */
const COL_SCHEMES = [
  { id: 0, name: 'Зелёный', bg: '#EAF3DE', text: '#3B6D11', dot: '#639922', tag: '#C0DD97', tt: '#27500A' },
  { id: 1, name: 'Красный', bg: '#FCEBEB', text: '#A32D2D', dot: '#E24B4A', tag: '#F7C1C1', tt: '#501313' },
  { id: 2, name: 'Синий', bg: '#E6F1FB', text: '#185FA5', dot: '#378ADD', tag: '#B5D4F4', tt: '#042C53' },
  { id: 3, name: 'Оранжевый', bg: '#FAEEDA', text: '#854F0B', dot: '#EF9F27', tag: '#FAC775', tt: '#412402' },
  { id: 4, name: 'Фиолетов.', bg: '#EEEDFE', text: '#534AB7', dot: '#7F77DD', tag: '#CECBF6', tt: '#26215C' },
  { id: 5, name: 'Бирюзовый', bg: '#E1F5EE', text: '#085041', dot: '#1D9E75', tag: '#9FE1CB', tt: '#04342C' },
  { id: 6, name: 'Розовый', bg: '#FDE8F3', text: '#8B1A5A', dot: '#D94F9A', tag: '#F5B8DA', tt: '#4A0D30' },
  { id: 7, name: 'Жёлтый', bg: '#FEFBD8', text: '#6B5E00', dot: '#D4B800', tag: '#F0E070', tt: '#3A3300' },
];

/**
 * Массив доступных цветов фона для карточек.
 * Используется в палитре выбора цвета карточки.
 * Каждый элемент содержит:
 *   hex   — HEX-код цвета фона,
 *   label — человекочитаемое название цвета (отображается как tooltip).
 *
 * Всего 12 цветов от белого до нефритового.
 */
const CARD_COLORS = [
  { hex: '#FFFFFF', label: 'Белый' },
  { hex: '#EFEDE8', label: 'Песочный' },
  { hex: '#FFF8E6', label: 'Кремовый' },
  { hex: '#FEF3DC', label: 'Персик' },
  { hex: '#FDEBD0', label: 'Абрикос' },
  { hex: '#FDE8E8', label: 'Розовый' },
  { hex: '#FDE8F3', label: 'Пудра' },
  { hex: '#E8F4E8', label: 'Мята' },
  { hex: '#E6F1FB', label: 'Лазурь' },
  { hex: '#EDE8FE', label: 'Лаванда' },
  { hex: '#FFFBCC', label: 'Лимон' },
  { hex: '#E8F8F2', label: 'Нефрит' },
];

/**
 * Массив колонок по умолчанию для новой доски.
 * Каждая колонка содержит:
 *   id    — уникальный строковый идентификатор (c1..c5),
 *   label — название колонки (отображается в заголовке),
 *   s     — индекс цветовой схемы из COL_SCHEMES.
 *
 * По умолчанию создаётся 5 колонок типичной ретроспективы:
 *   1) Прошлая ретроспектива (зелёная)
 *   2) Мне понравилось (красная)
 *   3) Мы могли бы улучшить (синяя)
 *   4) Теперь я знаю, что... (оранжевая)
 *   5) Действия (фиолетовая)
 */
const COL_SCHEMES_DARK = [
  { id: 0, name: 'Зелёный', bg: '#1E2E15', text: '#A3D47A', dot: '#6BBF3A', tag: '#2A4418', tt: '#8CC85F' },
  { id: 1, name: 'Красный', bg: '#2E1515', text: '#E88A8A', dot: '#E25454', tag: '#441818', tt: '#D47A7A' },
  { id: 2, name: 'Синий', bg: '#152030', text: '#7AB8E8', dot: '#4A9BE0', tag: '#182A44', tt: '#7AB8E8' },
  { id: 3, name: 'Оранжевый', bg: '#2E2510', text: '#E8B86A', dot: '#EFB040', tag: '#443510', tt: '#D4A050' },
  { id: 4, name: 'Фиолетов.', bg: '#1E1D30', text: '#A09BE0', dot: '#8A85DD', tag: '#2A2944', tt: '#A09BE0' },
  { id: 5, name: 'Бирюзовый', bg: '#102E22', text: '#5ECFAB', dot: '#2AC08A', tag: '#184430', tt: '#5ECFAB' },
  { id: 6, name: 'Розовый', bg: '#2E1528', text: '#E08AB8', dot: '#D95FA0', tag: '#441830', tt: '#E08AB8' },
  { id: 7, name: 'Жёлтый', bg: '#2E2C10', text: '#D4C850', dot: '#D4C020', tag: '#444010', tt: '#D4C850' },
];

const DEFAULT_COLS = [
  { id: 'c1', label: 'Прошлая ретроспектива', s: 0 },
  { id: 'c2', label: 'Мне понравилось... 🥰', s: 1 },
  { id: 'c3', label: 'Мы могли бы улучшить?', s: 2 },
  { id: 'c4', label: 'Теперь я знаю, что...🤓', s: 3 },
  { id: 'c5', label: 'Действия 🏃‍♂️', s: 4 },
];

/**
 * Набор доступных эмодзи для реакций на карточки.
 * Каждый элемент содержит: emoji — символ, label — название для tooltip.
 */
const EMOJI_SET = [
  { emoji: '👍', label: 'thumbs up' },
  { emoji: '👎', label: 'thumbs down' },
  { emoji: '❤️', label: 'heart' },
  { emoji: '🎉', label: 'celebration' },
  { emoji: '🚀', label: 'rocket' },
  { emoji: '😢', label: 'crying' },
  { emoji: '🔥', label: 'fire' },
  { emoji: '👀', label: 'eyes' },
  { emoji: '✅', label: 'done' },
  { emoji: '😭', label: 'sobbing' },
  { emoji: '💯', label: 'hundred' },
  { emoji: '🤔', label: 'thinking' },
  { emoji: '👏', label: 'clap' },
  { emoji: '😊', label: 'smile' },
  { emoji: '🤝', label: 'handshake' },
  { emoji: '💪', label: 'strong' },
];

/**
 * Пустой объект карточек по умолчанию для новой доски.
 * Ключи — ID колонок, значения — пустые массивы (карточек нет).
 * Заполняется при создании доски через doCreateBoard().
 */
const DEFAULT_CARDS = { };
