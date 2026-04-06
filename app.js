// ── Config (defaults, overridden by saved settings) ─────────────────────────
const CONFIG = {
  name: 'Friend',
  mantra: 'Move with wonder. Act with intent.',
  weather: {
    city: 'Queenstown',
    country: 'NZ',
    apiKey: ''
  },
  nasa: {
    apiKey: 'DEMO_KEY',
    apodEnabled: true
  },
  countdowns: [],
  worldClocks: [
    { label: 'London', timezone: 'Europe/London' }
  ],
  priceTickers: [
    { label: 'BTC', id: 'bitcoin', decimals: 0 },
    { label: 'ETH', id: 'ethereum', decimals: 0 }
  ],
  customFeeds: [],
  refreshIntervals: {
    clock: 1000,
    crypto: 5 * 60 * 1000,
    weather: 30 * 60 * 1000,
    blockHeight: 60 * 1000
  }
};

// User image URLs (loaded from storage)
let userImages = [];

// ── Storage helper (browser/chrome storage.sync with localStorage fallback) ──
const extensionApi = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

const store = {
  async get(key) {
    if (extensionApi && extensionApi.storage && extensionApi.storage.sync) {
      const result = await extensionApi.storage.sync.get(key);
      return result[key];
    }
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : undefined;
  },
  async set(obj) {
    if (extensionApi && extensionApi.storage && extensionApi.storage.sync) {
      await extensionApi.storage.sync.set(obj);
    } else {
      for (const [k, v] of Object.entries(obj)) {
        localStorage.setItem(k, JSON.stringify(v));
      }
    }
  }
};

// ── Settings ─────────────────────────────────────────────────────────────────
async function loadSettings() {
  const settings = await store.get('settings');
  if (settings) {
    if (settings.name) CONFIG.name = settings.name;
    if (typeof settings.mantra === 'string') CONFIG.mantra = settings.mantra;
    if (settings.weatherCity) CONFIG.weather.city = settings.weatherCity;
    if (settings.weatherCountry) CONFIG.weather.country = settings.weatherCountry;
    if (settings.weatherApiKey) CONFIG.weather.apiKey = settings.weatherApiKey;
    if (settings.nasaApiKey) CONFIG.nasa.apiKey = settings.nasaApiKey;
    if (typeof settings.apodEnabled === 'boolean') CONFIG.nasa.apodEnabled = settings.apodEnabled;
  }

  // Load world clocks from storage
  const savedClocks = await store.get('worldClocks');
  if (savedClocks) {
    CONFIG.worldClocks = savedClocks;
  }

  // Load countdowns from storage, or seed default on first run
  const savedCountdowns = await store.get('countdowns');
  if (savedCountdowns) {
    CONFIG.countdowns = savedCountdowns;
  } else {
    // First run: Memento Mori set to 50 years from now
    const fiftyYears = new Date();
    fiftyYears.setFullYear(fiftyYears.getFullYear() + 50);
    const date = fiftyYears.toISOString().split('T')[0];
    CONFIG.countdowns = [{ label: 'Memento Mori', date }];
    await store.set({ countdowns: CONFIG.countdowns });
  }

  // Load price tickers from storage
  const savedTickers = await store.get('priceTickers');
  if (savedTickers) {
    CONFIG.priceTickers = savedTickers;
  }

  // Load custom feeds from storage
  const savedFeeds = await store.get('customFeeds');
  if (savedFeeds) {
    CONFIG.customFeeds = savedFeeds;
  }

  // Load user images from storage
  const saved = await store.get('userImages');
  if (saved && saved.length) {
    userImages = saved;
  } else if (typeof BACKGROUNDS !== 'undefined' && BACKGROUNDS.length) {
    // One-time seed: import local images on first run (backgrounds.js is gitignored)
    userImages = BACKGROUNDS.map(f => `images/${f}`);
    await store.set({ userImages });
  }

  // Update weather label to match city
  const weatherLabel = document.querySelector('#weather .top-label');
  if (weatherLabel) weatherLabel.textContent = CONFIG.weather.city;
}

// Temporary lists for settings editing (so cancel works)
let pendingImages = [];
let pendingCountdowns = [];
let pendingClocks = [];
let pendingTickers = [];
let pendingFeeds = [];

function renderImageList() {
  const list = document.getElementById('image-list');
  const count = document.getElementById('image-count');
  list.innerHTML = '';

  pendingImages.forEach((url, i) => {
    const row = document.createElement('div');
    row.className = 'image-entry';

    const thumb = document.createElement('img');
    thumb.className = 'image-thumb';
    thumb.src = url;
    thumb.onerror = () => { thumb.style.display = 'none'; };

    const label = document.createElement('span');
    label.className = 'image-url';
    // Show just the filename or last path segment
    try {
      const u = new URL(url, window.location.href);
      label.textContent = decodeURIComponent(u.pathname.split('/').pop());
    } catch {
      label.textContent = url;
    }
    label.title = url;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'image-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      pendingImages.splice(i, 1);
      renderImageList();
    });

    row.appendChild(thumb);
    row.appendChild(label);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });

  count.textContent = pendingImages.length
    ? `${pendingImages.length} image${pendingImages.length === 1 ? '' : 's'} · rotates daily`
    : 'No images · using NASA APOD';
}

function createReorderBtns(arr, index, renderFn) {
  const wrap = document.createElement('div');
  wrap.className = 'reorder-btns';

  const upBtn = document.createElement('button');
  upBtn.className = 'reorder-btn';
  upBtn.textContent = '▲';
  upBtn.disabled = index === 0;
  upBtn.addEventListener('click', () => {
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    renderFn();
  });

  const downBtn = document.createElement('button');
  downBtn.className = 'reorder-btn';
  downBtn.textContent = '▼';
  downBtn.disabled = index === arr.length - 1;
  downBtn.addEventListener('click', () => {
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    renderFn();
  });

  wrap.appendChild(upBtn);
  wrap.appendChild(downBtn);
  return wrap;
}

function renderWorldClocksBar() {
  const container = document.getElementById('world-clocks-container');
  const divider = document.getElementById('clocks-divider');
  container.innerHTML = '';

  if (CONFIG.worldClocks.length === 0) {
    divider.style.display = 'none';
    return;
  }

  divider.style.display = '';
  CONFIG.worldClocks.forEach(({ label, timezone }) => {
    const item = document.createElement('div');
    item.className = 'top-item';

    const lbl = document.createElement('span');
    lbl.className = 'top-label';
    lbl.textContent = label;

    const value = document.createElement('span');
    value.className = 'top-value';
    value.id = `clock-${label.toLowerCase()}-value`;
    value.textContent = '...';

    item.appendChild(lbl);
    item.appendChild(value);
    container.appendChild(item);
  });
}

function renderClockSettings() {
  const list = document.getElementById('world-clocks-list');
  list.innerHTML = '';

  pendingClocks.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'clock-entry';

    const label = document.createElement('span');
    label.className = 'clock-entry-label';
    label.textContent = c.label;

    const tz = document.createElement('span');
    tz.className = 'clock-entry-tz';
    tz.textContent = c.timezone;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'clock-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      pendingClocks.splice(i, 1);
      renderClockSettings();
    });

    row.appendChild(label);
    row.appendChild(tz);
    row.appendChild(createReorderBtns(pendingClocks, i, renderClockSettings));
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

function renderCountdownSettings() {
  const list = document.getElementById('countdown-list');
  list.innerHTML = '';

  pendingCountdowns.forEach((cd, i) => {
    const row = document.createElement('div');
    row.className = 'countdown-entry';

    const label = document.createElement('span');
    label.className = 'countdown-label';
    label.textContent = cd.label;

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'countdown-date-input';
    dateInput.value = cd.date;
    dateInput.addEventListener('change', () => {
      pendingCountdowns[i].date = dateInput.value;
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'countdown-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      pendingCountdowns.splice(i, 1);
      renderCountdownSettings();
    });

    row.appendChild(label);
    row.appendChild(dateInput);
    row.appendChild(createReorderBtns(pendingCountdowns, i, renderCountdownSettings));
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

function renderTickersBar() {
  const container = document.getElementById('price-tickers-container');
  const divider = document.getElementById('tickers-divider');
  container.innerHTML = '';
  const hasTickers = CONFIG.priceTickers.length > 0;
  divider.style.display = hasTickers ? '' : 'none';
  container.style.display = hasTickers ? '' : 'none';

  CONFIG.priceTickers.forEach(({ label, id }) => {
    const item = document.createElement('div');
    item.className = 'top-item';

    const lbl = document.createElement('span');
    lbl.className = 'top-label';
    lbl.textContent = label;

    const value = document.createElement('span');
    value.className = 'top-value';
    value.id = `ticker-${id}-value`;
    value.textContent = '...';

    item.appendChild(lbl);
    item.appendChild(value);
    container.appendChild(item);
  });
}

function renderTickerSettings() {
  const list = document.getElementById('tickers-list');
  list.innerHTML = '';

  pendingTickers.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'ticker-entry';

    const label = document.createElement('span');
    label.className = 'ticker-entry-label';
    label.textContent = t.label;

    const id = document.createElement('span');
    id.className = 'ticker-entry-id';
    id.textContent = t.id;

    const decSelect = document.createElement('select');
    for (let d = 0; d <= 8; d++) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d + 'dp';
      if (d === (t.decimals || 0)) opt.selected = true;
      decSelect.appendChild(opt);
    }
    decSelect.addEventListener('change', () => {
      pendingTickers[i].decimals = parseInt(decSelect.value);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'ticker-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      pendingTickers.splice(i, 1);
      renderTickerSettings();
    });

    row.appendChild(label);
    row.appendChild(id);
    row.appendChild(decSelect);
    row.appendChild(createReorderBtns(pendingTickers, i, renderTickerSettings));
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

function renderFeedsBar() {
  const container = document.getElementById('custom-feeds-container');
  const divider = document.getElementById('feeds-divider');
  container.innerHTML = '';
  const hasFeeds = CONFIG.customFeeds.length > 0;
  divider.style.display = hasFeeds ? '' : 'none';
  container.style.display = hasFeeds ? '' : 'none';

  CONFIG.customFeeds.forEach((feed, i) => {
    const item = document.createElement('div');
    item.className = 'top-item';

    const lbl = document.createElement('span');
    lbl.className = 'top-label';
    lbl.textContent = feed.label;

    const value = document.createElement('span');
    value.className = 'top-value';
    value.id = `feed-${i}-value`;
    value.textContent = '...';

    item.appendChild(lbl);
    item.appendChild(value);
    container.appendChild(item);
  });
}

function renderFeedSettings() {
  const list = document.getElementById('feeds-list');
  list.innerHTML = '';

  pendingFeeds.forEach((f, i) => {
    const card = document.createElement('div');
    card.className = 'feed-entry';

    const header = document.createElement('div');
    header.className = 'feed-entry-header';

    const label = document.createElement('span');
    label.className = 'feed-entry-label';
    label.textContent = f.label;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'ticker-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      pendingFeeds.splice(i, 1);
      renderFeedSettings();
    });

    header.appendChild(label);
    header.appendChild(createReorderBtns(pendingFeeds, i, renderFeedSettings));
    header.appendChild(removeBtn);

    const urlRow = document.createElement('div');
    urlRow.className = 'feed-entry-detail';
    urlRow.innerHTML = `<span class="feed-detail-label">URL</span><span class="feed-detail-value" title="${f.url}">${truncateUrl(f.url)}</span>`;

    const pathRow = document.createElement('div');
    pathRow.className = 'feed-entry-detail';
    pathRow.innerHTML = `<span class="feed-detail-label">Path</span><span class="feed-detail-value">${f.path}</span>`;

    const metaRow = document.createElement('div');
    metaRow.className = 'feed-entry-detail';

    const decSelect = document.createElement('select');
    for (let d = 0; d <= 8; d++) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d + 'dp';
      if (d === (f.decimals || 0)) opt.selected = true;
      decSelect.appendChild(opt);
    }
    decSelect.addEventListener('change', () => {
      pendingFeeds[i].decimals = parseInt(decSelect.value);
    });

    metaRow.appendChild(decSelect);

    card.appendChild(header);
    card.appendChild(urlRow);
    card.appendChild(pathRow);
    card.appendChild(metaRow);
    list.appendChild(card);
  });
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    const display = u.hostname + u.pathname;
    return display.length > 35 ? display.slice(0, 35) + '...' : display;
  } catch {
    return url;
  }
}

function resolvePath(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
}

async function fetchCustomFeeds() {
  for (let i = 0; i < CONFIG.customFeeds.length; i++) {
    const feed = CONFIG.customFeeds[i];
    const el = document.getElementById(`feed-${i}-value`);
    if (!el) continue;

    try {
      const resp = await fetch(feed.url);
      const data = await resp.json();
      const raw = resolvePath(data, feed.path);

      if (raw === null || raw === undefined) {
        el.textContent = 'N/A';
        continue;
      }

      const num = Number(raw);
      if (!isNaN(num)) {
        const d = typeof feed.decimals === 'number' ? feed.decimals : 2;
        el.textContent = num.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
      } else {
        el.textContent = String(raw);
      }
    } catch (e) {
      console.warn(`Feed "${feed.label}" fetch failed:`, e);
      el.textContent = 'Error';
    }
  }
}

function initSettings() {
  const btn = document.getElementById('settings-btn');
  const overlay = document.getElementById('settings-overlay');
  const saveBtn = document.getElementById('settings-save');
  const cancelBtn = document.getElementById('settings-cancel');
  const addBtn = document.getElementById('add-image-btn');
  const newImageInput = document.getElementById('setting-new-image');
  const addCountdownBtn = document.getElementById('add-countdown-btn');
  const addClockBtn = document.getElementById('add-clock-btn');
  const addTickerBtn = document.getElementById('add-ticker-btn');
  const addFeedBtn = document.getElementById('add-feed-btn');

  // Tab switching
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  btn.addEventListener('click', () => {
    // Reset to first tab on open
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.settings-tab[data-tab="personal"]').classList.add('active');
    document.getElementById('tab-personal').classList.add('active');
    // Populate fields with current values
    document.getElementById('setting-name').value = CONFIG.name;
    document.getElementById('setting-mantra').value = CONFIG.mantra;
    document.getElementById('setting-weather-city').value = CONFIG.weather.city;
    document.getElementById('setting-weather-country').value = CONFIG.weather.country;
    document.getElementById('setting-weather-key').value = CONFIG.weather.apiKey;
    document.getElementById('setting-nasa-key').value =
      CONFIG.nasa.apiKey === 'DEMO_KEY' ? '' : CONFIG.nasa.apiKey;
    document.getElementById('setting-apod-enabled').checked = CONFIG.nasa.apodEnabled;

    // Clone lists for editing
    pendingImages = [...userImages];
    pendingCountdowns = CONFIG.countdowns.map(c => ({ ...c }));
    pendingClocks = CONFIG.worldClocks.map(c => ({ ...c }));
    pendingTickers = CONFIG.priceTickers.map(t => ({ ...t }));
    pendingFeeds = CONFIG.customFeeds.map(f => ({ ...f }));
    renderImageList();
    renderClockSettings();
    renderCountdownSettings();
    renderTickerSettings();
    renderFeedSettings();

    overlay.classList.remove('hidden');
  });

  // Add image URL
  function addImage() {
    const url = newImageInput.value.trim();
    if (url && !pendingImages.includes(url)) {
      pendingImages.push(url);
      renderImageList();
      newImageInput.value = '';
    }
  }

  addBtn.addEventListener('click', addImage);
  newImageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addImage(); }
  });

  // Add countdown
  function addCountdown() {
    const label = document.getElementById('setting-new-countdown-label').value.trim();
    const date = document.getElementById('setting-new-countdown-date').value;
    if (label && date) {
      pendingCountdowns.push({ label, date });
      renderCountdownSettings();
      document.getElementById('setting-new-countdown-label').value = '';
      document.getElementById('setting-new-countdown-date').value = '';
    }
  }

  addCountdownBtn.addEventListener('click', addCountdown);

  // Add world clock
  function addClock() {
    const label = document.getElementById('setting-new-clock-label').value.trim();
    const tz = document.getElementById('setting-new-clock-tz').value.trim();
    if (label && tz) {
      pendingClocks.push({ label, timezone: tz });
      renderClockSettings();
      document.getElementById('setting-new-clock-label').value = '';
      document.getElementById('setting-new-clock-tz').value = '';
    }
  }

  addClockBtn.addEventListener('click', addClock);

  // Add price ticker
  function addTicker() {
    const label = document.getElementById('setting-new-ticker-label').value.trim();
    const id = document.getElementById('setting-new-ticker-id').value.trim().toLowerCase();
    const decimals = parseInt(document.getElementById('setting-new-ticker-decimals').value) || 0;
    if (label && id) {
      pendingTickers.push({ label, id, decimals });
      renderTickerSettings();
      document.getElementById('setting-new-ticker-label').value = '';
      document.getElementById('setting-new-ticker-id').value = '';
      document.getElementById('setting-new-ticker-decimals').value = '0';
    }
  }

  addTickerBtn.addEventListener('click', addTicker);

  // Add custom feed
  function addFeed() {
    const label = document.getElementById('setting-new-feed-label').value.trim();
    const url = document.getElementById('setting-new-feed-url').value.trim();
    const path = document.getElementById('setting-new-feed-path').value.trim();
    const decimals = parseInt(document.getElementById('setting-new-feed-decimals').value) || 0;
    if (label && url && path) {
      pendingFeeds.push({ label, url, path, decimals });
      renderFeedSettings();
      document.getElementById('setting-new-feed-label').value = '';
      document.getElementById('setting-new-feed-url').value = '';
      document.getElementById('setting-new-feed-path').value = '';
      document.getElementById('setting-new-feed-decimals').value = '0';
    }
  }

  addFeedBtn.addEventListener('click', addFeed);

  cancelBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  saveBtn.addEventListener('click', async () => {
    const nasaKey = document.getElementById('setting-nasa-key').value.trim();

    const settings = {
      name: document.getElementById('setting-name').value.trim() || 'Daniel',
      mantra: document.getElementById('setting-mantra').value.trim(),
      weatherCity: document.getElementById('setting-weather-city').value.trim() || 'Queenstown',
      weatherCountry: document.getElementById('setting-weather-country').value.trim() || 'NZ',
      weatherApiKey: document.getElementById('setting-weather-key').value.trim(),
      nasaApiKey: nasaKey || 'DEMO_KEY',
      apodEnabled: document.getElementById('setting-apod-enabled').checked
    };

    // Capture any unsaved entries in the add rows
    addClock();
    addCountdown();
    addImage();
    addTicker();
    addFeed();

    // Save settings, images, clocks, countdowns, tickers, and feeds
    userImages = [...pendingImages];
    CONFIG.worldClocks = pendingClocks.map(c => ({ ...c }));
    CONFIG.countdowns = pendingCountdowns.map(c => ({ ...c }));
    CONFIG.priceTickers = pendingTickers.map(t => ({ ...t }));
    CONFIG.customFeeds = pendingFeeds.map(f => ({ ...f }));
    await store.set({ settings, userImages, worldClocks: CONFIG.worldClocks, countdowns: CONFIG.countdowns, priceTickers: CONFIG.priceTickers, customFeeds: CONFIG.customFeeds });

    // Apply immediately
    CONFIG.name = settings.name;
    CONFIG.mantra = settings.mantra;
    document.getElementById('mantra').textContent = CONFIG.mantra;
    CONFIG.weather.city = settings.weatherCity;
    CONFIG.weather.country = settings.weatherCountry;
    CONFIG.weather.apiKey = settings.weatherApiKey;
    CONFIG.nasa.apiKey = settings.nasaApiKey;
    CONFIG.nasa.apodEnabled = settings.apodEnabled;

    // Update UI
    const weatherLabel = document.querySelector('#weather .top-label');
    if (weatherLabel) weatherLabel.textContent = CONFIG.weather.city;
    updateClock();
    fetchWeather();
    renderWorldClocksBar();
    updateWorldClocks();
    renderCountdownsBar();
    updateCountdowns();
    renderTickersBar();
    fetchCryptoPrices();
    renderFeedsBar();
    fetchCustomFeeds();

    // Clear cached background so it re-evaluates source
    await store.set({ dailyBg: null });
    setDailyBackground();

    overlay.classList.add('hidden');
  });
}

// ── Utilities ────────────────────────────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function seededIndex(seed, length) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % length;
}

function formatPrice(price, decimals) {
  const d = typeof decimals === 'number' ? decimals : (price >= 1000 ? 0 : 2);
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function formatBlockHeight(height) {
  return height.toLocaleString('en-US');
}

// ── Clock & Greeting ─────────────────────────────────────────────────────────
let lastGreeting = '';

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('clock').textContent = `${h}:${m}`;

  const greeting = now.getHours() >= 20 ? 'GN' : 'GM';
  const text = `${greeting} ${CONFIG.name}`;
  if (text !== lastGreeting) {
    document.getElementById('greeting').textContent = text;
    lastGreeting = text;
  }
}

// ── World Clocks ─────────────────────────────────────────────────────────────
function updateWorldClocks() {
  CONFIG.worldClocks.forEach(({ label, timezone }) => {
    const el = document.getElementById(`clock-${label.toLowerCase()}-value`);
    if (!el) return;
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    el.textContent = time;
  });
}

// ── Daily Quote ──────────────────────────────────────────────────────────────
async function setDailyQuote() {
  const key = todayKey();
  const stored = await store.get('dailyQuote');

  if (stored && stored.day === key) {
    renderQuote(stored.quote);
    return;
  }

  const index = seededIndex(key, QUOTES.length);
  const quote = QUOTES[index];
  await store.set({ dailyQuote: { day: key, quote } });
  renderQuote(quote);
}

function renderQuote(q) {
  document.getElementById('quote').textContent = `"${q.quote}"`;
  document.getElementById('quote-author').textContent = `— ${q.author}`;
}

// ── Daily Background ─────────────────────────────────────────────────────────
function applyBackground(url) {
  const imgEl = document.getElementById('background-image');
  const img = new Image();
  img.src = url;

  if (img.complete) {
    // Cached — show instantly, no fade
    imgEl.style.transition = 'none';
    imgEl.style.backgroundImage = `url(${url})`;
    imgEl.style.opacity = '1';
  } else {
    // Loading — fade in over 1s
    imgEl.style.transition = 'opacity 1s ease';
    img.onload = () => {
      imgEl.style.backgroundImage = `url(${url})`;
      imgEl.style.opacity = '1';
    };
  }
}

async function fetchApod() {
  const key = todayKey();
  const cached = await store.get('apodCache');

  // Return cached APOD if it's from today
  if (cached && cached.day === key && cached.url) {
    return cached.url;
  }

  try {
    const resp = await fetch(
      `https://api.nasa.gov/planetary/apod?api_key=${CONFIG.nasa.apiKey}&thumbs=true`
    );
    const data = await resp.json();

    // Use the image URL (or video thumbnail)
    const url = data.media_type === 'video' ? data.thumbnail_url : data.hdurl || data.url;
    if (url) {
      await store.set({ apodCache: { day: key, url, title: data.title } });
      return url;
    }
  } catch (e) {
    console.warn('NASA APOD fetch failed:', e);
  }

  // Return cached URL from a previous day as last resort
  if (cached && cached.url) return cached.url;
  return null;
}

async function setDailyBackground() {
  // Priority: APOD (if enabled) → user images → gradient fallback (always visible via CSS)
  if (CONFIG.nasa.apodEnabled) {
    const apodUrl = await fetchApod();
    if (apodUrl) {
      applyBackground(apodUrl);
      return;
    }
  }

  if (userImages.length > 0) {
    const key = todayKey();
    const stored = await store.get('dailyBg');

    let url;
    if (stored && stored.day === key && stored.url) {
      url = stored.url;
    } else {
      const index = seededIndex(key + 'bg', userImages.length);
      url = userImages[index];
      await store.set({ dailyBg: { day: key, url } });
    }

    applyBackground(url);
  }
}

// ── Countdown ────────────────────────────────────────────────────────────────
function renderCountdownsBar() {
  const container = document.getElementById('countdowns-container');
  const divider = document.getElementById('countdown-divider');
  container.innerHTML = '';

  if (CONFIG.countdowns.length === 0) {
    divider.style.display = 'none';
    return;
  }

  divider.style.display = '';
  CONFIG.countdowns.forEach((cd, i) => {
    const item = document.createElement('div');
    item.className = 'top-item';
    item.id = `countdown-${i}`;

    const label = document.createElement('span');
    label.className = 'top-label';
    label.textContent = cd.label;

    const value = document.createElement('span');
    value.className = 'top-value';
    value.id = `countdown-${i}-value`;
    value.textContent = '...';

    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  });
}

function updateCountdowns() {
  CONFIG.countdowns.forEach(({ label, date }, i) => {
    const el = document.getElementById(`countdown-${i}-value`);
    if (!el) return;
    const now = new Date();
    const target = new Date(date + 'T00:00:00');
    const diff = target - now;

    if (diff <= 0) {
      el.textContent = 'Now!';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    el.textContent = `${days} Days`;
  });
}

// ── Crypto Prices (CoinGecko) ────────────────────────────────────────────────
async function fetchCryptoPrices() {
  if (CONFIG.priceTickers.length === 0) return;

  try {
    const ids = CONFIG.priceTickers.map(t => t.id).join(',');
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    );
    const data = await resp.json();

    CONFIG.priceTickers.forEach(({ id, decimals }) => {
      const el = document.getElementById(`ticker-${id}-value`);
      if (el && data[id]) {
        el.textContent = formatPrice(data[id].usd, decimals);
      }
    });
  } catch (e) {
    console.warn('Crypto price fetch failed:', e);
  }
}

// ── Bitcoin Block Height (mempool.space) ─────────────────────────────────────
async function fetchBlockHeight() {
  try {
    const resp = await fetch('https://mempool.space/api/blocks/tip/height');
    const height = await resp.json();
    document.getElementById('block-height-value').textContent = formatBlockHeight(height);

    // Next halving: every 210,000 blocks
    const HALVING_INTERVAL = 210000;
    const nextHalvingBlock = Math.ceil((height + 1) / HALVING_INTERVAL) * HALVING_INTERVAL;
    const blocksRemaining = nextHalvingBlock - height;
    // ~10 minutes per block
    const daysRemaining = Math.round(blocksRemaining * 10 / 1440);
    document.getElementById('halving-value').textContent = daysRemaining + ' days';
  } catch (e) {
    console.warn('Block height fetch failed:', e);
  }
}

// ── Weather (OpenWeatherMap) ─────────────────────────────────────────────────
async function fetchWeather() {
  const { city, country, apiKey } = CONFIG.weather;
  if (!apiKey) {
    document.getElementById('weather-value').textContent = 'No API key';
    return;
  }

  try {
    const resp = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city},${country}&units=metric&appid=${apiKey}`
    );
    const data = await resp.json();
    const temp = Math.round(data.main.temp);
    const desc = data.weather[0].main;
    document.getElementById('weather-value').textContent = `${temp}° ${desc}`;
  } catch (e) {
    console.warn('Weather fetch failed:', e);
  }
}

// ── Midnight Reset ───────────────────────────────────────────────────────────
function scheduleMidnightReset() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight - now;

  setTimeout(() => {
    setDailyQuote();
    setDailyBackground();
    scheduleMidnightReset();
  }, msUntilMidnight);
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  // Load saved settings before anything else
  await loadSettings();

  // Wire up settings panel
  initSettings();

  // Apply mantra
  document.getElementById('mantra').textContent = CONFIG.mantra;

  // Immediate updates
  updateClock();
  renderWorldClocksBar();
  updateWorldClocks();
  renderCountdownsBar();
  updateCountdowns();
  renderTickersBar();
  renderFeedsBar();
  setDailyQuote();
  setDailyBackground();
  fetchCryptoPrices();
  fetchCustomFeeds();
  fetchBlockHeight();
  fetchWeather();

  // Intervals
  setInterval(updateClock, CONFIG.refreshIntervals.clock);
  setInterval(updateWorldClocks, CONFIG.refreshIntervals.clock);
  setInterval(updateCountdowns, 60 * 1000);
  setInterval(fetchCryptoPrices, CONFIG.refreshIntervals.crypto);
  setInterval(fetchCustomFeeds, CONFIG.refreshIntervals.crypto);
  setInterval(fetchBlockHeight, CONFIG.refreshIntervals.blockHeight);
  setInterval(fetchWeather, CONFIG.refreshIntervals.weather);

  // Reset at midnight
  scheduleMidnightReset();
}

init();
