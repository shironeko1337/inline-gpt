# Inline Question for ChatGPT

Chrome extension (MV3) for asking quick side questions about highlighted text in ChatGPT answers.
See `features.txt` and `data structure.txt` for the spec.

_Not affiliated with, endorsed or sponsored by OpenAI. ChatGPT is a trademark of OpenAI._

## Build & install

```
npm install
npm run build
```

Open `chrome://extensions`, enable Developer mode, click **Load unpacked** and pick the `dist/` folder.
Then open the extension's **Options** and paste an OpenAI API key (https://platform.openai.com/api-keys).

## Package for the Chrome Web Store

```
npm run package
```

Builds and writes `release/inline-question-for-chatgpt-<version>.zip` (with `manifest.json` at the root of the zip).
Bump `version` in `public/manifest.json` before each upload.

## Privacy

- No server of our own, no analytics. Settings (including the API key) and highlights with their answers are stored
  only in `chrome.storage.local`.
- Only when you ask a side question, the conversation up to the highlighted answer plus the question is sent to the
  OpenAI API with your own key.
- Each side question is a single request with `store: false`, so OpenAI doesn't keep the response for later use. There
  are no follow-up questions; answers are shown again from local storage without a new request.
- Delete one highlight with its bin icon, or everything with **Clear all local storage** on the options page.

Full policy: [PRIVACY.md](PRIVACY.md).

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
