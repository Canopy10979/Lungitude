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

Both checks should pass. A wrong password returns a sign-in error; an absent account must be created first. Local accounts persist in the ignored data/accounts.sqlite file. Developer health endpoints contain readiness only, never credentials or health profiles. Actual Windows/PHP execution remains unverified in this environment.

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

An identity attempt expires after 10 minutes and is consumed once. Refresh the page before retrying an expired or failed provider attempt. Provider buttons are only displayed when configured; missing credentials never produce a simulated sign-in. Google/Apple setup requires the app owner's public client identifiers and provider-console domain registration; these were not supplied, so actual provider sign-in could not be activated or verified here.

Source documentation:
- https://developers.google.com/identity/gsi/web/guides/display-button
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple

Validation for this update: 35 Python tests passed, including failed token verification, state mismatch, one-time callback replay protection, no automatic email linking, provider-only password rejection and absent provider configuration. PHP files were syntax-parsed with php-parser; actual PHP runtime transport and real Google/Apple authorization were not tested here.
