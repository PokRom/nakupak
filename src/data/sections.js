// Výchozí sekce supermarketu v typickém pořadí průchodu (od vchodu k pokladnám).
export const DEFAULT_SECTIONS = [
  { id: 'zelenina', name: 'Ovoce a zelenina', icon: '🥕', color: '#4caf50' },
  { id: 'pecivo', name: 'Pečivo', icon: '🥖', color: '#c98a3a' },
  { id: 'maso', name: 'Maso a uzeniny', icon: '🥩', color: '#d84343' },
  { id: 'ryby', name: 'Ryby', icon: '🐟', color: '#3a8ed8' },
  { id: 'mlecne', name: 'Mléčné výrobky a vejce', icon: '🥛', color: '#7fb3d5' },
  { id: 'syry', name: 'Sýry', icon: '🧀', color: '#e8b923' },
  { id: 'trvanlive', name: 'Trvanlivé potraviny', icon: '🍝', color: '#b5835a' },
  { id: 'konzervy', name: 'Konzervy a omáčky', icon: '🥫', color: '#c0573c' },
  { id: 'koreni', name: 'Koření a ochucovadla', icon: '🧂', color: '#8d6e63' },
  { id: 'sladkosti', name: 'Sladkosti a slané pochutiny', icon: '🍫', color: '#a0522d' },
  { id: 'kava', name: 'Káva, čaj', icon: '☕', color: '#6d4c41' },
  { id: 'napoje', name: 'Nápoje', icon: '🧃', color: '#26a69a' },
  { id: 'alkohol', name: 'Alkohol', icon: '🍺', color: '#d4a017' },
  { id: 'mrazene', name: 'Mražené potraviny', icon: '❄️', color: '#5dade2' },
  { id: 'drogerie', name: 'Drogerie a hygiena', icon: '🧴', color: '#ab47bc' },
  { id: 'domacnost', name: 'Domácnost a čisticí prostředky', icon: '🧽', color: '#7e57c2' },
  { id: 'ostatni', name: 'Ostatní', icon: '📦', color: '#90a4ae' },
  { id: 'pokladna', name: 'Pokladna', icon: '🧾', color: '#607d8b' },
];

export const DEFAULT_LOCATIONS = [
  { id: 'lednice', name: 'Lednice', icon: '🧊' },
  { id: 'mrazak', name: 'Mrazák', icon: '❄️' },
  { id: 'spiz', name: 'Spíž', icon: '🥫' },
  { id: 'ostatni', name: 'Ostatní', icon: '📦' },
];

// Kam se položka z dané sekce obvykle ukládá doma.
export const SECTION_TO_LOCATION = {
  zelenina: 'lednice', maso: 'lednice', ryby: 'lednice', mlecne: 'lednice', syry: 'lednice',
  mrazene: 'mrazak', pecivo: 'spiz', trvanlive: 'spiz', konzervy: 'spiz', koreni: 'spiz',
  sladkosti: 'spiz', kava: 'spiz', napoje: 'spiz', alkohol: 'spiz',
};

export const UNITS = ['ks', 'g', 'kg', 'ml', 'l', 'bal', 'plech'];
