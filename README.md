# Inline ChatGPT

Chrome extension (MV3) for asking quick side questions about highlighted text in ChatGPT answers.
See `features.txt` and `data structure.txt` for the spec.

## Build & install

```
npm install
npm run build
```

Open `chrome://extensions`, enable Developer mode, click **Load unpacked** and pick the `dist/` folder.
Then open the extension's **Options** and paste an OpenAI API key (https://platform.openai.com/api-keys).

## Layout

- `src/content/` – content script on chatgpt.com
  - `chatgptDom.ts` – every ChatGPT DOM selector (update here when ChatGPT's UI changes)
  - `menu.ts` – template buttons under "Ask ChatGPT" (fallback: own floating bar)
  - `anchors.ts` – Range <-> serializable TextAnchor (CSS selector, XPath fallback, text search last resort)
  - `highlights.ts` – CSS Custom Highlights, hover hit testing, persistence per conversation
  - `messagebox.ts` – the popup message box (Shadow DOM)
- `src/sidechat/openai.ts` – side chat via the OpenAI Responses API
- `src/background/` – service worker that calls the API
- `src/options/` – options page (React + HeroUI v3 + Tailwind v4)
