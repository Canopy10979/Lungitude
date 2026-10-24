$ErrorActionPreference='Continue'
$targets=@(
 @('Python account service','http://127.0.0.1:8010/account/health'),
 @('Website account proxy','http://localhost:8000/api/account.php?action=health')
)
foreach($item in $targets){
 try{$result=Invoke-RestMethod -Uri $item[1] -TimeoutSec 10;if($result.ready -eq $true){Write-Host "PASS: $($item[0])" -ForegroundColor Green}else{Write-Host "CHECK: $($item[0]) did not return ready=true" -ForegroundColor Yellow}}
 catch{Write-Host "FAIL: $($item[0])" -ForegroundColor Red;Write-Host $_.Exception.Message}
}
Write-Host 'If Python fails, restart start-imaging.bat. If only the proxy fails, verify PHP is serving this same updated folder and allow_url_fopen or curl is enabled.'
