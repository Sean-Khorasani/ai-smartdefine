# SmartDefine Extension

## Overview
SmartDefine provides AI-powered definitions and explanations inside your browser. Right-click any selection on a web page and the extension displays an in-page modal with contextual information, word forms, and ways to remember the word. Explanations come from one of two LLM providers or, if those fail, a free dictionary API.

## Usage
1. Select a word on any webpage.
2. Right-click and choose **SmartDefine**.
3. A modal appears with a formatted explanation and options to save or export the word.

### Word List & Exports
- Save words into custom categories with personal notes.
- Export individual words to TXT, printable PDF, or flashcard HTML.
- Export full word lists to TXT, CSV, JSON, PDF, or interactive flashcards.

### Practice Modes
- Flashcard, quiz, and typing practice modes available in the extension tabs.
- Words become available for review based on a spaced repetition algorithm.
- Daily reminders and an overdue badge help keep track of study goals.

## Settings
Settings are managed from the **Settings** tab in `extension_tabs.html`:
- **Providers** – Configure API key, base URL, model, and enable state for Together.ai or OpenRouter.
- **Prompt** – Template containing the `X_WORD_X` placeholder used to request explanations.
- **Learning Settings** – Toggles for context-aware definitions, automatic saving, showing a save button, review reminders, and daily goal value.

### Learning Engine
- Implements a spaced repetition algorithm similar to SM‑2.
- Calculates next review interval, ease factor, and difficulty level.
- Tracks performance history and provides study statistics such as overdue words or daily reviews.
- Schedules alarms for daily review reminders and badge updates.
- Falls back to the free dictionary API when LLM providers fail.

---

