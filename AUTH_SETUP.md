# Sign-in setup and troubleshooting

## Email sign-in fix

The exact earlier text "Sign-in is temporarily unavailable. Please try again later." was emitted by api/account.php when PHP's curl extension was disabled. The updated proxy uses curl when available and otherwise PHP's built-in HTTP stream, which works on stock PHP with allow_url_fopen enabled. It still needs the Python account service running. This fixes that transport dependency; it does not start an offline service on the user's computer.

From Lungitude-Training, install current dependencies and start the service:

```powershell
.\.venv\Scripts\python.exe -m pip install -r ml/skin/requirements.txt -r ml/tabular/requirements.txt
.\start-imaging.bat
```

In another terminal, keep `php -S localhost:8000 router.php` running. Check both layers:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Check-Services.ps1
```

Both checks should pass. A wrong password returns a sign-in error; an absent account must be created first. Local accounts persist in the ignored data/accounts.sqlite file. Developer health endpoints contain readiness and provider-configuration flags only, never credentials or health profiles. Actual Windows/PHP execution remains unverified in this environment.

## Configure Google web sign-in

The pasted GetSignInIntentRequest example is for Android, not this browser application. This app uses Google Identity Services' official web button and ID-token callback, with no prompt()/One Tap or automatic account selection. The provider only prompts after the user clicks its button. Initialization may load the SDK/render the button; it never opens sign-in automatically.

1. Create a **Web application** OAuth client in Google Cloud Console and configure its consent screen.
2. Register the exact JavaScript origins used by the app: for local testing, http://localhost:8000 and/or http://127.0.0.1:8000. Register the real HTTPS origin for deployment.
3. Copy .env.example to .env without overwriting any existing .env. Set GOOGLE_WEB_CLIENT_ID to your public Web client ID ending in .apps.googleusercontent.com. A Maps API key or Android client ID cannot substitute for it.
4. Restart start-imaging.bat, which loads .env when present. Refresh the sign-in page.

No Google client secret is needed for this ID-token-only flow. Server verification uses google-auth for signature, audience, issuer and expiry, plus a server-bound nonce/state attempt. Do not decode JWT payloads and treat them as authentication without verification. Do not paste credentials or tokens into chat/logs.

## Configure Apple web sign-in

1. In an Apple Developer account, configure Sign in with Apple, a web Services ID, domain and Return URL. Follow Apple's current account/setup requirements.
2. Use a registered **HTTPS domain**; Apple web Return URLs cannot use localhost or an IP address. The app uses popup mode, with user-clicked AppleID.auth.signIn().
3. Set APPLE_SERVICES_ID and APPLE_REDIRECT_URI in .env; the redirect must match Apple's registered Return URL. Configure the domain/Return URL with the actual deployment; merely putting an arbitrary URL in .env will not activate Apple.
4. Set LUNGITUDE_PUBLIC_ORIGIN to the exact HTTPS origin and LUNGITUDE_SECURE_COOKIES=1 for production. Restart the service.

The server verifies Apple's signed ID token against Apple's keys, checks issuer/audience/expiry/nonce and consumes state attempts once. Users are keyed by provider + subject. Apple name/profile data may only be returned on first authorization; this app does not require or promise a profile photo or name. Provider token validation is not an end-to-end provider certification; code exchange/refresh-token lifecycle and Apple token revocation on deletion need production implementation before public launch.

## Identity and lifecycle limits

Existing email/password accounts are **not automatically linked by matching email**. This prevents silently attaching an external identity to another account. Use the original sign-in method for an existing account. Explicit authenticated provider-linking is not yet implemented. New provider accounts use verified email and provider-subject identity records. Password sign-in is rejected cleanly for provider-only accounts.

An identity attempt expires after 10 minutes and is consumed once. Refresh the page before retrying an expired or failed provider attempt. Provider buttons are only displayed when configured; missing credentials never produce a simulated sign-in. Google setup now has the app owner's public client identifier (see below); provider-console registration and actual Google authorization remain unverified here. Apple configuration has not been supplied.

Source documentation:
- https://developers.google.com/identity/gsi/web/guides/display-button
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple

Validation for this update: 35 Python tests passed, including failed token verification, state mismatch, one-time callback replay protection, no automatic email linking, provider-only password rejection and absent provider configuration. PHP files were syntax-parsed with php-parser; actual PHP runtime transport and real Google/Apple authorization were not tested here.

## Diagnose credential/session errors

The account page now separates Create account from Sign in. Create an account first; an email/password form does not accept a Google or Apple password. A late startup session check cannot erase a successful new sign-in. Invalid or malformed password records fail safely without resetting accounts.

The service loads the repository .env even when launched manually with uvicorn. Restart after changing configuration. Existing process environment variables take precedence.

With both website and Python service running, execute this from the project folder:

```powershell
.\.venv\Scripts\python.exe tools/check_auth.py --base http://localhost:8000
```

This creates a temporary diagnostic account, checks the PHP proxy, registration, session cookies, logout and password login, then deletes the temporary account. It never changes existing accounts or prints passwords/tokens. Keep localhost consistent across browser and commands; localhost and 127.0.0.1 have different cookies. Secure cookies require HTTPS; use LUNGITUDE_SECURE_COOKIES=0 for HTTP localhost. Share only the PASS/FAIL lines. A successful diagnostic does not verify an existing account's credentials or actual Google/Apple authorization.

## Project Google client configured

The app owner supplied this public Web client ID, now used as the default OAuth audience:

```text
88220152196-ue6q7abumts1jhb9jkf43rqlkd4veegm.apps.googleusercontent.com
```

A nonempty GOOGLE_WEB_CLIENT_ID environment value overrides it. A blank or absent value uses the project default, so an older blank .env does not hide the button. Set LUNGITUDE_GOOGLE_SIGNIN=0 to disable Google explicitly. Apple still requires its own configuration. The Google Cloud Console must authorize the browser origin (http://localhost:8000 or http://127.0.0.1:8000 locally). The current popup/callback flow requires no redirect URI or Google client secret. Push/pull and restarting the service activate this configuration; an actual Google account authorization has not been tested here.

## Google button does not appear

From the running project, check the Python service and actual website proxy independently:

```powershell
Invoke-RestMethod http://127.0.0.1:8010/account/health | ConvertTo-Json -Depth 4
(Invoke-RestMethod 'http://localhost:8000/api/account.php?action=oauth_config').providers.google | Format-List
```

The proxy must return enabled=True and the project client ID. Do not share the whole OAuth config response: it contains a short-lived state and nonce. If Python reports readiness but the proxy/config fails, check that PHP and Python both serve this updated worktree. Restart the existing service after updates rather than launching a second process on the same port.

The page now reveals Google's container before rendering its official button and offers Retry sign-in options if the SDK/config fails. Google and Apple SDK failures are isolated from one another. If config is enabled but the button still fails, allow https://accounts.google.com/gsi/client in browser/network blockers and check the Console for the exact error; do not paste tokens. Google Console authorized origins must match the website origin.
