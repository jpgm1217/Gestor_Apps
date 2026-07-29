param(
  [Parameter(Mandatory = $true)]
  [string]$Destino
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot 'aurea'
$destinationPath = [System.IO.Path]::GetFullPath(
  (Join-Path (Get-Location).Path $Destino)
)

if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
  throw "No se encontró la carpeta fuente: $sourcePath"
}

if (Test-Path -LiteralPath $destinationPath) {
  $existingItems = Get-ChildItem -LiteralPath $destinationPath -Force
  if ($existingItems.Count -gt 0) {
    throw "El destino ya existe y no está vacío: $destinationPath"
  }
} else {
  New-Item -ItemType Directory -Path $destinationPath | Out-Null
}

Copy-Item -Path (Join-Path $sourcePath '*') -Destination $destinationPath -Recurse
New-Item -ItemType File -Path (Join-Path $destinationPath '.nojekyll') -Force | Out-Null

Write-Host "Aurea independiente preparada en:"
Write-Host $destinationPath
Write-Host ''
Write-Host 'Siguiente paso: inicializa Git, sube a jpgm1217/aurea y activa GitHub Pages.'
