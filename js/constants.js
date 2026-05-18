const FIREBASE_CONFIG = {
  apiKey: "AIzaSyArRKIb9uRRCHKKmUSI3XDMAkbqBXrSOxs",
  authDomain: "retroboard-b2f7c.firebaseapp.com",
  projectId: "retroboard-b2f7c",
  storageBucket: "retroboard-b2f7c.firebasestorage.app",
  messagingSenderId: "445885996354",
  appId: "1:445885996354:web:49918467ee620d7c5b3cdb",
};

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

const DEFAULT_COLS = [
  { id: 'c1', label: 'Start', s: 0 },
  { id: 'c2', label: 'Stop', s: 1 },
  { id: 'c3', label: 'Continue', s: 2 },
];

const DEFAULT_CARDS = {
  c1: [{ id: 1, text: 'Ежедневные код-ревью по утрам', votes: 3, color: null, comments: [] }],
  c2: [{ id: 2, text: 'Затяжные встречи без повестки', votes: 5, color: null, comments: [] }],
  c3: [{ id: 3, text: 'Чёткие критерии готовности', votes: 4, color: null, comments: [] }],
};
