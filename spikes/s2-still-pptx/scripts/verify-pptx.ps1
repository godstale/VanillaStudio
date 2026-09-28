# Open a PPTX in real PowerPoint (COM), report slide count/size and export each slide as PNG.
param([string]$Pptx = 'out/deck-image.pptx', [string]$OutDir = 'out/pptx-export')

$path = (Resolve-Path $Pptx).Path
$out = Join-Path (Get-Location) $OutDir
New-Item -ItemType Directory -Force $out | Out-Null
$app = New-Object -ComObject PowerPoint.Application
try {
    # ReadOnly, Untitled, WithWindow = false
    $pres = $app.Presentations.Open($path, $true, $false, $false)
    $info = [ordered]@{
        file        = $Pptx
        slides      = $pres.Slides.Count
        widthPt     = $pres.PageSetup.SlideWidth
        heightPt    = $pres.PageSetup.SlideHeight
        shapesPerSlide = @($pres.Slides | ForEach-Object { $_.Shapes.Count })
        textFrames  = @($pres.Slides | ForEach-Object { @($_.Shapes | Where-Object { $_.HasTextFrame -and $_.TextFrame.HasText }).Count })
    }
    $i = 0
    foreach ($s in $pres.Slides) {
        $i++
        $s.Export((Join-Path $out "slide-$i.png"), 'PNG', 1920, 1080)
    }
    $pres.Close()
    $info | ConvertTo-Json -Compress
}
finally {
    $app.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}
