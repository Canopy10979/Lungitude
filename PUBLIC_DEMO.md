# GitHub source and a temporary HTTPS demo

GitHub stores Lungitude's source; it does not host the running localhost process. GitHub Pages serves static files and cannot execute this app's PHP proxy, Python inference, accounts or Google Places requests. Publishing the current app there would break those flows. The existing backend/Dockerfile is for an older signal sidecar, not a complete production deployment of this app. No public website has been deployed by adding this guide.

## Download published source and upload local commits

From the existing Windows training worktree:

```powershell
cd C:\Users\rishi\Downloads\Lungitude-Training
git status --short
git fetch origin
git merge --no-ff --no-edit origin/codex/model-training-and-signal-research
git push origin HEAD:codex/model-training-and-signal-research
```

This uploads commits from this worktree and keeps both local and remote histories. It does not commit uncommitted files. If Git reports conflicts or says local files would be overwritten, resolve those before continuing; do not reset/force-push. For new source edits, explicitly stage the intended files, inspect git diff --cached locally, then commit and push. Do not upload .env, api/secrets.php, credentials, account databases or personal images. Model binaries are ignored and are not automatically transferred through git. The current development branch has not been merged into main.

## Configure Claude on Windows (optional)

The API key tested in the development environment is not installed on your Windows computer. Set it using the hidden prompt:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Set-ClaudeKey.ps1
.\.venv\Scripts\python.exe tools/test_claude.py
```

The test is a small billable request sending only a fixed “Reply with only OK” message. It does not send images/health profiles or test the visitor UI. The signed-in learning hub now offers a separate consent-based Claude guide; restart Python after saving the key. The key remains in ignored local .env. requests/python-dotenv are installed with ml/skin/auth-requirements.txt. No real credentials are committed in this change.

## Share the working laptop app over HTTPS for a temporary demo

This requires your Windows laptop and both app servers to stay running. It is a temporary demo tunnel, not persistent hosting or a production security/clinical certification. Use demo profiles/inputs. Share only the demo URL with intended viewers and stop the tunnel afterward.

1. Keep PHP serving this project with its router in one terminal:

```powershell
cd C:\Users\rishi\Downloads\Lungitude-Training
php -S localhost:8000 router.php
```

If PHP is already running correctly, keep that terminal rather than starting a duplicate server.

2. Install Cloudflare's tunnel client:

```powershell
winget install --id Cloudflare.cloudflared --exact
```

After installation, open a new PowerShell terminal if cloudflared is not found. Start a tunnel to PHP (not to the private inference port):

```powershell
cloudflared tunnel --url http://localhost:8000
```

Keep this terminal running. It prints an actual https://...trycloudflare.com URL. That is the public demo link. Do not use an example URL. The URL can change after restarting the tunnel.

3. In the existing Python service terminal, press Ctrl+C. Set the exact public URL printed above, without a trailing slash, and enable HTTPS cookies before restarting:

```powershell
$env:LUNGITUDE_PUBLIC_ORIGIN = (Read-Host 'Paste the exact HTTPS demo URL').Trim().TrimEnd('/')
$env:LUNGITUDE_SECURE_COOKIES = '1'
.\start-imaging.bat
```

Use that HTTPS URL for the demo and sign in again there. localhost cookies do not transfer to the tunnel hostname. For local HTTP testing afterward, stop Python and restore LUNGITUDE_SECURE_COOKIES=0 in that terminal before restarting. These process variables take precedence over .env.

4. In Google Cloud's existing Web OAuth client, add the exact new HTTPS origin under Authorized JavaScript origins. Otherwise Google sign-in may reject it; email sign-in still uses the configured public origin. No redirect URI is required for the current Google popup callback. Apple web sign-in needs a separately registered domain/Return URL and is not activated by this tunnel.

5. On the iPhone, open the actual HTTPS demo URL, allow camera/location when requested, and verify the flow. A tunnel does not train/install missing skin models, fix disabled Google Places APIs, or bring a stopped backend online. Keep all three terminals running. No camera or account behavior on the user's phone has been verified in this environment.

For a permanent website, deploy the full PHP/Python stack to suitable hosting, configure persistent private storage and model weights, and register its stable domain with the sign-in providers. GitHub Pages alone is not a substitute.

Official references:
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
- https://developers.cloudflare.com/tunnel/downloads/
