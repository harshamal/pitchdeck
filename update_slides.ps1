
$files = Get-ChildItem "slides (*).html"
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if ($null -eq $content) { $content = "" }
    
    if ($content -notmatch "navigation.js") {
        # Insert before </body> if exists, else append
        if ($content -match "</body>") {
            $content = $content -replace "</body>", "<script src='navigation.js'></script>`n</body>"
        } else {
            $content += "`n<script src='navigation.js'></script>"
        }
        Set-Content -Path $file.FullName -Value $content
        Write-Host "Updated $($file.Name)"
    } else {
        Write-Host "Skipping $($file.Name), script already present."
    }
}
Write-Host "All slides updated with navigation script."
