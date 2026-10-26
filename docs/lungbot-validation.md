# LungBot addition — verification status

This addition was prepared while the execution workspace was disconnected. It has not been PHP-linted or browser-tested here. Four JavaScript files parsed successfully, and eleven LungBot interaction checks passed with a minimal DOM mock in the orchestration runtime; this is not a browser test. No live Claude request was made.

Run before use:

```powershell
Get-ChildItem -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName }
Get-ChildItem .\\js -Filter *.js | ForEach-Object { node --check $_.FullName }
php -l router.php
node --check sw.js
php tests/test_risk.php
php tests/test_survey.php
php tests/test_chat.php
```

The new chat test defines 21 checks with PDO SQLite enabled (17 without it). No pass result is claimed until it is run. Earlier README test counts refer to the previous revision.

Manual checks:
- Open both main pages and use the LungBot launcher, keyboard navigation, Escape and Clear chat at phone/desktop widths.
- Confirm no request is sent before consent. Confirm missing-key errors leave the survey usable.
- Configure a fresh private Claude API key, restart PHP, and verify an actual provider response. Test invalid-key, missing-credit, timeout and rate-limit paths.
- Type HTML-like text and confirm it appears as text, never markup.
- Clear or withdraw consent while a request is pending; stale replies must not repopulate chat.
- Check Network and Cache Storage: chat payloads must not include survey answers, photos or location, and no chat API response may be cached.
- Copy the actual supplied PNG to assets/lungitude-logo.png. The upload was inaccessible in the disconnected workspace, so no real logo bytes are included in this commit.

Limits: The provider uses a bounded system instruction but this is not a medical safety guarantee. Claude can give incorrect information. Request counts reduce abuse but do not replace provider billing controls. Provider retention is outside this app's control. No key from the conversation is embedded or published.

AI assistance: ChatGPT/Codex prepared the Claude proxy, chat UI, logo-slot loader, validation tests and documentation. This must be included in the student’s accurate AI-use disclosure.
