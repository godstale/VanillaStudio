# Open a PPTX in PowerPoint (COM) and dump every shape (type, geometry in pt, text, font), exporting slide PNGs.
param([Parameter(Mandatory)][string]$Pptx, [Parameter(Mandatory)][string]$OutDir)

$path = (Resolve-Path $Pptx).Path
$out = Join-Path (Get-Location) $OutDir
New-Item -ItemType Directory -Force $out | Out-Null
$app = New-Object -ComObject PowerPoint.Application
try {
    $pres = $app.Presentations.Open($path, $true, $false, $false)
    $slides = @()
    $i = 0
    foreach ($s in $pres.Slides) {
        $i++
        $s.Export((Join-Path $out "slide-$i.png"), 'PNG', 1920, 1080)
        $shapes = foreach ($sh in $s.Shapes) {
            $text = $null; $font = $null
            if ($sh.HasTextFrame -and $sh.TextFrame.HasText) {
                $text = $sh.TextFrame.TextRange.Text
                $font = $sh.TextFrame.TextRange.Font.Name
            }
            [ordered]@{ type = $sh.Type; name = $sh.Name; left = [math]::Round($sh.Left, 1); top = [math]::Round($sh.Top, 1); width = [math]::Round($sh.Width, 1); height = [math]::Round($sh.Height, 1); text = $text; font = $font }
        }
        $slides += [ordered]@{ index = $i; shapes = @($shapes) }
    }
    $pres.Close()
    [ordered]@{ file = $Pptx; widthPt = $pres.PageSetup.SlideWidth; slides = $slides } | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8 (Join-Path $out 'shapes.json')
}
finally {
    $app.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}
