# Privacy Policy — Inline Question for ChatGPT

_Effective: September 29, 2026_

Inline Question for ChatGPT is a Chrome extension that lets you highlight text in a ChatGPT answer and ask a short side
question about it. This policy explains what data the extension handles, where it goes, and how to delete it.

**In short:** the extension has no server of its own. Your data is stored only in your browser, and it is sent only to
OpenAI, using your own API key, when you ask a side question.

This extension is an independent project and is not affiliated with, endorsed or sponsored by OpenAI.

## Data stored on your device

The extension saves the following with `chrome.storage.local`. It stays in your browser profile on this device and is
not synced to your Google account or sent to the developer.

- **Settings:** your OpenAI API key, the model name, question templates, highlight style and other options.
- **Highlights and side questions:** for each highlight, the selected text, the information needed to find it again on
  the page (ChatGPT message id, element selectors and character offsets), the question you asked, the answer, the
  ChatGPT conversation id and the time it was created.

## Data sent to OpenAI

When you ask a side question (by choosing a question template or typing your own question), the extension sends a
request to the OpenAI API (`https://api.openai.com`) with **your own API key**. The request contains:

- the text of the ChatGPT conversation shown on the page, from the start up to and including the answer you highlighted
  (limited to about the last 60,000 characters);
- the text you highlighted and the question, filled into your question template;
- the model name from your settings.

Nothing is sent until you ask a question. Selecting or hovering text sends nothing.

Each side question is a single, independent request; the extension never asks follow-up questions in the same side
conversation. Requests are therefore sent with response storage turned off (`store: false`), so OpenAI is asked not to
keep the response for later use. The answer is saved only in your browser, as described above, and shown from there
when you open the message box again, without sending a new request. OpenAI may still retain API data for a limited
time for abuse monitoring, as described in its policies. Your use of the API is governed by your agreement with OpenAI and the
[OpenAI Privacy Policy](https://openai.com/policies/privacy-policy).

## What the extension does not do

- It does not send any data to the developer or any other third party besides OpenAI.
- It does not use analytics, tracking or advertising.
- It does not sell or share your data, or use it for anything other than answering your side questions.
- It does not load or run code from the internet; all of its code is included in the extension package.
- It does not read pages other than ChatGPT (`chatgpt.com` and `chat.openai.com`).

## Permissions

| Permission | Why it's needed |
| --- | --- |
| `storage` | Save your settings, highlights and answers in your browser. |
| Host access to `https://api.openai.com/*` | Send your side questions to the OpenAI API. |
| Runs on `https://chatgpt.com/*` and `https://chat.openai.com/*` | Show the question menu, highlights and message boxes on ChatGPT, and read the conversation used as context. |

## Deleting your data

- **One highlight:** click the bin icon in its message box.
- **Everything:** open the extension's Options page and click **Clear all local storage**. This deletes all highlights,
  answers, templates and settings, including the API key.
- **Uninstalling** the extension also deletes everything it stored.

Data already sent to OpenAI is handled under your OpenAI account and OpenAI's policies.

## Changes

If this policy changes, the new version will be published in this file with a new effective date.

## Contact

Questions or concerns: please open an issue at <https://github.com/shironeko1337/inline-gpt/issues>.
