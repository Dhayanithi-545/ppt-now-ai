# Render every slide of a .pptx to PNG with Microsoft PowerPoint (COM), for visual QA of the export.
# Usage: powershell -File scripts\render_pptx.ps1 -Pptx "path\deck.pptx" -Out "path\folder"
param([Parameter(Mandatory)][string]$Pptx, [Parameter(Mandatory)][string]$Out)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $Out | Out-Null
$app = New-Object -ComObject PowerPoint.Application
try {
  # ReadOnly, Untitled, WithWindow = false
  $pres = $app.Presentations.Open((Resolve-Path $Pptx).Path, $true, $false, $false)
  $i = 0
  foreach ($s in $pres.Slides) {
    $i++
    $s.Export((Join-Path (Resolve-Path $Out).Path ("{0:D2}.png" -f $i)), 'PNG', 1280, 720)
  }
  $pres.Close()
  "rendered $i slides"
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}
