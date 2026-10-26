$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
function Test-LungitudeEndpoint($url) {
    try { return (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { return $false }
}
if (-not (Test-LungitudeEndpoint 'http://127.0.0.1:8010/status')) {
    $pythonPath = (Get-Command python).Source
    $localPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
    if (Test-Path -LiteralPath $localPython) { $pythonPath = $localPython }
    Start-Process -FilePath $pythonPath -ArgumentList @('-m', 'uvicorn', 'service:app', '--app-dir', ('"' + (Join-Path $projectRoot 'ml\skin') + '"'), '--host', '127.0.0.1', '--port', '8010') -WorkingDirectory $projectRoot -WindowStyle Hidden
    $serviceReady = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if (Test-LungitudeEndpoint 'http://127.0.0.1:8010/status') { $serviceReady = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $serviceReady) { throw 'AI service did not start. Run start-imaging.bat to see the error.' }
}
if (-not (Test-LungitudeEndpoint 'http://127.0.0.1:8002/')) {
    Start-Process -FilePath (Get-Command php).Source -ArgumentList @('-d','extension=C:\php\ext\php_pdo_sqlite.dll','-d','upload_max_filesize=8M','-d','post_max_size=40M','-S','127.0.0.1:8002','-t',('"' + $projectRoot + '"'),('"' + (Join-Path $projectRoot 'router.php') + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden
}
Write-Host 'Dark Lungitude and local AI service are ready: http://127.0.0.1:8002/'