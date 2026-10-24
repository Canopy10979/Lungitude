param(
  [string]$BreastInput = '',
  [string]$SkinMetadata = '',
  [string]$SkinImages = '',
  [ValidateRange(1,100)][int]$Epochs = 10,
  [switch]$BreastOnly,
  [switch]$SkinOnly,
  [ValidateSet("mobilenet_v3_small","efficientnet_b0","vit_b_16","resnet18","densenet121","convnext_tiny")][string[]]$SkinArchitectures = @("mobilenet_v3_small","efficientnet_b0","vit_b_16","resnet18","densenet121","convnext_tiny")
)
$ErrorActionPreference = 'Stop'
if ($BreastOnly -and $SkinOnly) { throw 'Choose BreastOnly or SkinOnly, not both.' }
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
function Run-Python {
  & $script:pythonExe @args
  if ($LASTEXITCODE -ne 0) { throw "Python command failed: $args" }
}
if (-not (Test-Path '.venv\Scripts\python.exe')) {
  & py -3 -m venv .venv
  if ($LASTEXITCODE -ne 0) { throw 'Install Python 3 and retry.' }
}
$script:pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not $SkinOnly) {
  if (-not $BreastInput) {
    $candidates = @('data\raw\Cancer_Data.csv','Cancer_Data.csv',(Join-Path (Split-Path $projectRoot -Parent) 'Cancer_Data.csv'),'data\raw\breast+cancer+wisconsin+diagnostic.zip')
    $BreastInput = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  }
  if (-not $BreastInput -or -not (Test-Path $BreastInput)) { throw 'Specify -BreastInput with Cancer_Data.csv or the Wisconsin diagnostic ZIP.' }
  Run-Python -m pip install -r ml/tabular/requirements.txt
  Run-Python ml/tabular/train.py --dataset breast --input $BreastInput --output ml/tabular/output_breast
  Write-Host 'Breast model saved. The image service loads it from ml/tabular/output_breast.'
}
if (-not $BreastOnly) {
  if (-not $SkinMetadata) { $SkinMetadata = 'data\pad_ufes20\metadata.csv' }
  if (-not $SkinImages) { $SkinImages = 'data\pad_ufes20\images' }
  if (-not (Test-Path $SkinMetadata) -or -not (Test-Path $SkinImages)) {
    throw 'Skin training needs PAD-UFES-20 images and metadata. Download them, then provide -SkinMetadata and -SkinImages. Breast/cervical tables cannot replace them.'
  }
  Run-Python -m pip install -r ml/skin/requirements.txt
  $architectures = @(@('mobilenet_v3_small','output_mobile',16),@('efficientnet_b0','output_efficient',16),@('vit_b_16','output_vit',4),@('resnet18','output_resnet',16),@('densenet121','output_dense',8),@('convnext_tiny','output_convnext',4))
  foreach ($modelSpec in $architectures) {
    if ($modelSpec[0] -notin $SkinArchitectures) { continue }
    Run-Python ml/skin/train.py --dataset pad_ufes20 --architecture $modelSpec[0] --metadata $SkinMetadata --images $SkinImages --epochs $Epochs --batch-size $modelSpec[2] --output (Join-Path 'ml/skin' $modelSpec[1])
  }
  Write-Host 'Selected skin checkpoints and train/validation/test audits saved. Restart the image service to load new checkpoints.'
}
Write-Host 'Training complete. This is research evaluation, not clinical validation.'
