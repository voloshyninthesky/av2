/* Sidebar weather widget for the /uk pages.
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
   the neighbouring codes in each band differ only by intensity. */
const CONDITIONS = [
  [[0], 'ясно'],
  [[1], 'переважно ясно'],
  [[2], 'мінлива хмарність'],
  [[3], 'хмарно'],
  [[45, 48], 'туман'],
  [[51, 53, 55], 'мряка'],
  [[56, 57], 'крижана мряка'],
  [[61, 63, 65], 'дощ'],
  [[66, 67], 'крижаний дощ'],
  [[71, 73, 75], 'сніг'],
  [[77], 'снігова крупа'],
  [[80, 81, 82], 'зливи'],
  [[85, 86], 'снігові зливи'],
  [[95], 'гроза'],
  [[96, 99], 'гроза з градом'],
];

function describe(code) {
  const hit = CONDITIONS.find(([codes]) => codes.includes(code));
  return hit ? hit[1] : 'без опадів';
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
    `відчувається як ${formatTemp(current.apparent_temperature)}`;
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
