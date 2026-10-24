$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$secret=Read-Host 'Paste your Claude API key (hidden)' -AsSecureString
$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try{$value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
if($value -notmatch '^sk-ant-[A-Za-z0-9_-]+$'){throw 'Please use a Claude API key starting with sk-ant-.'}
$path=Join-Path $projectRoot '.env'
$lines=@()
if(Test-Path $path){$lines=@(Get-Content $path | Where-Object {$_ -notmatch '^\s*ANTHROPIC_API_KEY\s*='})}
[IO.File]::WriteAllLines($path,@($lines)+@('ANTHROPIC_API_KEY='+$value),(New-Object System.Text.UTF8Encoding($false)))
$value=$null
Write-Host 'Saved Claude key locally. Restart start-imaging.bat to connect the AI guide. The key was not added to git.' -ForegroundColor Green
