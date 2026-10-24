$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$secret=Read-Host 'Paste your Google Maps Places API key (hidden)' -AsSecureString
$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try{$value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
if($value -notmatch '^AIza[A-Za-z0-9_-]+$'){throw 'Please use a Google Maps API key, not the Google sign-in client ID.'}
$path=Join-Path $projectRoot '.env'
$lines=@()
if(Test-Path $path){$lines=@(Get-Content $path | Where-Object {$_ -notmatch '^\s*GOOGLE_PLACES_KEY\s*='})}
[IO.File]::WriteAllLines($path,@($lines)+@('GOOGLE_PLACES_KEY='+$value),(New-Object System.Text.UTF8Encoding($false)))
$value=$null
Write-Host 'Saved locally. Restart start-imaging.bat; keep the PHP website running. The key was not added to git.' -ForegroundColor Green
