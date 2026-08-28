param([string]$Query = "Tauri v2 React")
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$encoded = [System.Uri]::EscapeDataString($Query)
$url = "https://html.duckduckgo.com/html/?q=$encoded"
$wc = New-Object System.Net.WebClient
$wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
$html = ""
try {
    $html = $wc.DownloadString($url)
} catch {
    Write-Output "[]"
    exit 0
}

$results = @()
$pattern = 'class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>'
$regex = New-Object System.Text.RegularExpressions.Regex($pattern)
$match = $regex.Match($html)

while ($match.Success -and $results.Count -lt 5) {
    $rawUrl = $match.Groups[1].Value
    $title = [System.Net.WebUtility]::HtmlDecode($match.Groups[2].Value) -replace '<[^>]+>', ''
    $snippet = [System.Net.WebUtility]::HtmlDecode($match.Groups[3].Value) -replace '<[^>]+>', ''
    
    $realUrl = $rawUrl
    if ($rawUrl -match 'uddg=([^&]+)') {
        $realUrl = [System.Uri]::UnescapeDataString($matches[1])
    }
    
    $results += @{
        title = $title.Trim()
        snippet = $snippet.Trim()
        url = $realUrl.Trim()
        source = "DuckDuckGo"
    }
    $match = $match.NextMatch()
}

$results | ConvertTo-Json -Compress
