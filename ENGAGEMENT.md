# Learning hub, leaderboard and Claude guide

After sign-in, the skin homepage now reveals an optional learning hub below the profile/context cards. Open “quests, leaderboard & AI guide”. None of these features blocks camera access or changes model scores, screening data or medical next steps.

## Learning quests

Three short multiple-choice questions cover model limitations (10 points), capture privacy (10), and breast-model inputs (15). Each correct quest awards points once per account through a unique database constraint. The server validates the answer and never accepts a client-provided point total. Total possible points are 35; Curious Learner/Informed Explorer badges reflect quiz completion. No rewards for positive/negative disease scores, repeated scans, delaying care, sharing health information, or streaks.

Points and completion records persist in the existing ignored account SQLite database. They are not evidence of health status, cancer risk, clinical knowledge certification or improved outcomes. Quiz completion is an educational interaction, not an anti-cheat competition.

## Optional leaderboard

Private by default. Join explicitly to display a randomly generated Explorer alias and learning-point total. Leave to remove the entry immediately. No name, email, age, ZIP, race, gender, BMI, medical result or image appears in leaderboard responses. Entries are actual opted-in accounts only; the application invents no competitors. The list shows up to 20 aliases ordered by points then alias. Account deletion also removes achievements, visibility and assistant-usage counters.

## Claude guide

The assistant is now wired to the existing server, not just an API smoke test. Authentication, CSRF and separate question-sharing consent are required. Only the current typed question (up to 1000 characters) plus a fixed product/limitations system prompt goes to Anthropic; the account email/profile, photos, pulse samples, model results and chat history are not attached. Each question is independent. Responses are rendered as plain text, marked AI-generated, and never executed as HTML. Chat lives only in the tab and clears on sign-out/navigation. Clearing/consent withdrawal aborts the client request and ignores late replies. A server request already sent to Anthropic may still finish and incur usage.

The system prompt limits the guide to app navigation, explaining limitations and general educational support. It forbids diagnoses, ranking cancers, personal cancer probabilities, fabricated model/vital results or claiming to see images. The assistant has no diagnostic, image, browsing or action tools. A system prompt is not a clinical validation or a guarantee of perfect answers; model responses can still be wrong. Medical diagnoses belong with professionals.

Default model is claude-opus-5-5; ANTHROPIC_MODEL can override it server-side. The new API version is 2026-10-21. Output is capped at 400 tokens. The database reserves attempts before network calls, capped at 20 per account/day, 50 total/day, and two seconds between requests per account. Daily buckets use UTC. A separate aggregate counter survives account deletion, so deleting/recreating an account does not reset the total allowance; it contains no account identifiers. Failed attempts also count. These are request limits, not a guaranteed dollar spending cap; configure account billing limits independently. No typed questions or answers are stored in the app database. Provider retention is governed by the Anthropic account settings/terms.

## Windows update

```powershell
cd C:\Users\rishi\Downloads\Lungitude-Training
git fetch origin
git merge --no-ff --no-edit origin/codex/model-training-and-signal-research
powershell -ExecutionPolicy Bypass -File .\scripts\Set-ClaudeKey.ps1
```

Paste the working key at the hidden prompt if it is not already configured on Windows. A key tested in the development checkout does not install itself on your computer. Stop the existing Python service with Ctrl+C and restart start-imaging.bat. Keep PHP and any Cloudflare tunnel running; no tunnel restart is required for these code changes. If using the public demo URL, preserve its public-origin/secure-cookie configuration and Google authorized origin. Refresh with Ctrl+Shift+R, sign in, and expand the learning hub.

No real key is committed to GitHub. Saving a key enables the guide only when the backend restarts and the provider account has API access/credits. Missing key, exhausted allowance or failed upstream request produces no fabricated answer. Learning quests remain usable independently of Anthropic.

## Verification

API tests cover repeated-award prevention, correct-answer validation, authentication/CSRF, opt-in/opt-out and private leaderboard fields, deletion cleanup, separate assistant consent, missing-key refusal, fixed provider request structure without profile data and pre-call daily limits. UI state tests cover authenticated display, ignored late replies after consent is withdrawn/rechecked, and conversation cleanup on sign-out. A small general-education request is tested separately against the actual Claude endpoint with a temporary synthetic account. These checks do not establish clinical safety/performance or physical-device/browser layout correctness.

Existing pulse pages/navigation from the repository were preserved; the learning hub does not alter their measurement algorithms.
