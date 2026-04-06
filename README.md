# Self-Sovereign Space

A browser extension for Chrome and Firefox that replaces your new tab page with a self-sovereign personal dashboard focused on crypto, countdowns and intentional living.

No tracking. No analytics. No accounts. Your data stays in your browser.

## Features

- **Large clock** with time-based greeting (GM/GN)
- **Personal mantra** displayed front and centre
- **Bitcoin block height** and halving countdown via mempool.space
- **Crypto price tickers** via CoinGecko (default: BTC, ETH — fully customisable)
- **Custom API data feeds** — pull any numeric value from any JSON API
- **Weather** via OpenWeatherMap
- **World clocks** across multiple timezones
- **Countdown timers** (e.g. Memento Mori)
- **Daily quote** rotation from a curated collection
- **Daily background** from NASA Astronomy Picture of the Day or your own image collection
- **Settings modal** with tabbed UI for easy configuration

## Install

### Chrome

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the `Self Sovereign Space` folder
6. Open a new tab — your dashboard is ready

To update after pulling changes, go back to `chrome://extensions` and click the refresh icon on the extension card.

### Firefox

1. Clone or download this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select the `manifest.json` file inside the `Self Sovereign Space` folder
5. Open a new tab — your dashboard is ready

Note: Temporary add-ons are removed when Firefox closes. For a permanent install, the extension needs to be signed via [addons.mozilla.org](https://addons.mozilla.org).

## Settings

Click the gear icon in the bottom-right corner to open the settings modal. Settings are organised into five tabs:

### Personal

| Setting | Description |
|---------|-------------|
| **Name** | Your name, used in the greeting (e.g. "GM Daniel") |
| **Mantra** | A personal mantra displayed below the clock |
| **Weather City** | City name for weather data (e.g. Queenstown) |
| **Weather Country** | Country code for weather data (e.g. NZ) |

### Display

| Setting | Description |
|---------|-------------|
| **Background Images** | Add image URLs for a daily-rotating background collection |
| **NASA APOD** | Toggle NASA Astronomy Picture of the Day as your background (overrides custom images when enabled) |

### Time

| Setting | Description |
|---------|-------------|
| **World Clocks** | Add clocks for any timezone. Use [IANA timezone names](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) (e.g. `Europe/London`, `Asia/Tokyo`) |
| **Countdown Timers** | Add countdown timers to any future date. A Memento Mori countdown (50 years out) is created on first run |

All items can be reordered with the arrow buttons or removed with the x button.

### Crypto

| Setting | Description |
|---------|-------------|
| **Price Tickers** | Add any cryptocurrency tracked by CoinGecko. Provide a display label (e.g. SOL), the CoinGecko ID (e.g. `solana`), and decimal places for rounding |

Find CoinGecko IDs at [coingecko.com](https://www.coingecko.com) — the ID is in the coin's URL (e.g. `https://www.coingecko.com/en/coins/bitcoin` → `bitcoin`).

### APIs

| Setting | Description |
|---------|-------------|
| **OpenWeatherMap API Key** | Required for weather data. [Get a free key](https://home.openweathermap.org/api_keys) |
| **NASA APOD API Key** | For higher rate limits on background images. [Get a free key](https://api.nasa.gov/). Works without one using the demo key |
| **Custom Data Feeds** | Pull any numeric value from a JSON API endpoint. Configure the URL, a display label, the JSON path using dot notation (e.g. `data.amount`), and decimal places |

#### Custom Data Feed Example

Any public JSON API that returns a numeric value will work. Configure the URL, a label for the top bar, and the dot-notation path to the value in the response.

For example, given an API that returns:

```json
{"result": {"price": 42.5, "volume": 1000}}
```

Set the JSON path to `result.price` to extract `42.5`. Use the decimal place selector to control rounding — `0dp` would display `43`, `1dp` would display `42.5`, and so on up to `8dp`.

## Data Sources

| Data | Source | Refresh |
|------|--------|---------|
| Crypto prices | [CoinGecko API](https://www.coingecko.com/en/api) | 5 min |
| Block height & halving | [mempool.space](https://mempool.space/docs/api) | 1 min |
| Weather | [OpenWeatherMap](https://openweathermap.org/api) | 30 min |
| Background image | [NASA APOD](https://api.nasa.gov/) | Daily |
| Custom feeds | User-configured URLs | 5 min |

## Storage

All settings are saved to the browser's extension storage API (`chrome.storage.sync` on Chrome, `browser.storage.sync` on Firefox), which syncs across browser instances if you're signed in. Falls back to `localStorage` when running outside of a supported browser.

## File Structure

```
├── manifest.json       Extension manifest (v3, Chrome + Firefox)
├── defaults.js          Fallback defaults for optional files
├── fonts/               Bundled Inter font (SIL Open Font License)
├── newtab.html          Dashboard HTML
├── app.js               Application logic
├── styles.css           Styles
├── quotes.js            Curated quote collection
├── backgrounds.js       Local background image references (gitignored)
├── images/              Personal background images (gitignored)
└── icons/               Extension icons
```

## Tech

Vanilla JavaScript, HTML, and CSS. No frameworks, no build step, no dependencies.

## License

MIT