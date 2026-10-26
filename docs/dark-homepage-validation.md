# Dark homepage restoration

The default index is restored from codex/model-training-and-signal-research, including its dark theme, accounts, camera capture and pulse interface. The previous survey is retained at survey.html. Existing trained weights, manifest hashes and model evaluations are unchanged. No raw research datasets or account databases were added.

The PWA uses a new static cache version, immediately activates and claims clients. API requests are not cached. Old /www homepage URLs redirect to /#capture. The research interface requires the separate local Python service for accounts and inference; PHP alone can render the homepage.

Validation: five mocked JavaScript state suites passed; 41 Python account/OAuth/engagement/care/breast service tests passed; four trained-artifact tests passed; both real skin checkpoints returned successful inference through /infer_all. JavaScript syntax, local page asset references and git whitespace checks passed. Python source compilation passed.

PHP CLI is unavailable in this runtime, so PHP syntax and HTTP serving were not executed. The two pulse-page DOM suites could not run because jsdom is unavailable. No browser screenshot, actual camera, Google/Apple login or live external AI call was verified. Those require local testing and provider configuration.
