/* Sidebar weather widget for the lesson pages.
   Open-Meteo is used rather than an embedded third-party widget: it needs no API
   key, sets CORS headers, and returns plain JSON, so the pages stay free of
   trackers and iframes. The markup ships with a placeholder and this script only
   ever fills it in — if the request fails the widget removes itself rather than
   leaving a broken box in the sidebar. */

const LODZ = { latitude: 51.7592, longitude: 19.456 };

const ENDPOINT =
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${LODZ.latitude}&longitude=${LODZ.longitude}` +
  '&current=temperature_2m,apparent_temperature,weather_code' +
  '&timezone=Europe%2FWarsaw';

/* WMO weather interpretation codes, grouped — the API returns one integer and
   the neighbouring codes in each band differ only by intensity. Both languages
   share the same bands, so a code that reads as one word in Ukrainian reads as
   one word in Polish; only the words differ. */
const CONDITIONS = [
  [[0], 'ясно', 'bezchmurnie'],
  [[1], 'переважно ясно', 'przeważnie bezchmurnie'],
  [[2], 'мінлива хмарність', 'częściowe zachmurzenie'],
  [[3], 'хмарно', 'pochmurno'],
  [[45, 48], 'туман', 'mgła'],
  [[51, 53, 55], 'мряка', 'mżawka'],
  [[56, 57], 'крижана мряка', 'marznąca mżawka'],
  [[61, 63, 65], 'дощ', 'deszcz'],
  [[66, 67], 'крижаний дощ', 'marznący deszcz'],
  [[71, 73, 75], 'сніг', 'śnieg'],
  [[77], 'снігова крупа', 'krupa śnieżna'],
  [[80, 81, 82], 'зливи', 'przelotny deszcz'],
  [[85, 86], 'снігові зливи', 'przelotny śnieg'],
  [[95], 'гроза', 'burza'],
  [[96, 99], 'гроза з градом', 'burza z gradem'],
];

/* The page's own lang attribute picks the words, so a new page needs no wiring
   here beyond <html lang>; anything unrecognised falls back to Ukrainian, which
   is what every page was before the Polish ones existed. */
const LOCALES = {
  uk: { column: 1, fallback: 'без опадів', feelsLike: (t) => `відчувається як ${t}` },
  pl: { column: 2, fallback: 'bez opadów', feelsLike: (t) => `odczuwalna ${t}` },
};

const locale = LOCALES[document.documentElement.lang] || LOCALES.uk;

function describe(code) {
  const hit = CONDITIONS.find(([codes]) => codes.includes(code));
  return hit ? hit[locale.column] : locale.fallback;
}

/* Math.round rather than toFixed: the sidebar is 214px wide and a decimal place
   buys nothing at that size. */
function formatTemp(celsius) {
  return `${Math.round(celsius)}°C`;
}

async function render(box) {
  const response = await fetch(ENDPOINT, { cache: 'no-store' });
  if (!response.ok) throw new Error(`open-meteo ${response.status}`);

  const { current } = await response.json();
  if (!current) throw new Error('open-meteo returned no current block');

  box.querySelector('.weather-temp').textContent = formatTemp(current.temperature_2m);
  box.querySelector('.weather-desc').textContent = describe(current.weather_code);
  box.querySelector('.weather-meta').textContent =
    locale.feelsLike(formatTemp(current.apparent_temperature));
  box.dataset.state = 'ready';
}

const box = document.getElementById('weather');

if (box) {
  render(box).catch(() => {
    /* A stale or empty box is worse than none: drop the whole window so the
       sidebar closes up cleanly. */
    box.closest('.window')?.remove();
  });
}
