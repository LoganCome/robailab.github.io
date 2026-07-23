param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-LastCommand([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE."
  }
}

function Set-WorkerSecret([string]$Name, [string]$Value) {
  $Value | & npx.cmd --yes wrangler secret put $Name
  Assert-LastCommand "Setting $Name"
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot '..\static\admin\config.yml'))

Write-Host 'RobAI-Club CMS one-time owner setup' -ForegroundColor Cyan
Write-Host 'A browser will open for Cloudflare authentication.'
& npx.cmd --yes wrangler login
Assert-LastCommand 'Cloudflare login'

Write-Host 'Deploying the login service shell to obtain its permanent URL...'
$deployText = (& npx.cmd --yes wrangler deploy 2>&1 | Out-String)
Assert-LastCommand 'Initial Worker deployment'
Write-Host $deployText

$workerMatch = [regex]::Match($deployText, 'https://[a-zA-Z0-9.-]+\.workers\.dev')
if (-not $workerMatch.Success) {
  $workerOrigin = Read-Host 'Paste the exact https://...workers.dev URL printed above'
} else {
  $workerOrigin = $workerMatch.Value.TrimEnd('/')
}

$homeUrl = 'https://logancome.github.io/robailab.github.io/'
$callbackUrl = "$workerOrigin/callback"
Write-Host "GitHub OAuth Homepage URL: $homeUrl" -ForegroundColor Yellow
Write-Host "GitHub OAuth callback URL: $callbackUrl" -ForegroundColor Yellow
Write-Host 'Create the OAuth App in the browser, then return here.'
Start-Process 'https://github.com/settings/applications/new'

$clientId = (Read-Host 'GitHub OAuth Client ID').Trim()
if (-not $clientId) { throw 'Client ID cannot be empty.' }
$secureClientSecret = Read-Host 'GitHub OAuth Client Secret (input is hidden)' -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureClientSecret)

try {
  $clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  if (-not $clientSecret) { throw 'Client Secret cannot be empty.' }

  $stateBytes = New-Object byte[] 48
  $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomGenerator.GetBytes($stateBytes)
  } finally {
    $randomGenerator.Dispose()
  }
  $stateSecret = [Convert]::ToBase64String($stateBytes)

  Set-WorkerSecret 'GITHUB_CLIENT_ID' $clientId
  Set-WorkerSecret 'GITHUB_CLIENT_SECRET' $clientSecret
  Set-WorkerSecret 'STATE_SECRET' $stateSecret
} finally {
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }
  $clientSecret = $null
  $secureClientSecret = $null
}

Write-Host 'Deploying the configured login service...'
& npx.cmd --yes wrangler deploy
Assert-LastCommand 'Final Worker deployment'

$configText = [System.IO.File]::ReadAllText($configPath)
$updatedConfig = $configText -replace 'https://REPLACE-WITH-YOUR-WORKER\.workers\.dev', $workerOrigin
if ($updatedConfig -eq $configText -and -not $configText.Contains($workerOrigin)) {
  throw "Could not find the Worker placeholder in $configPath."
}
[System.IO.File]::WriteAllText($configPath, $updatedConfig, [System.Text.UTF8Encoding]::new($false))

Write-Host 'Setup completed.' -ForegroundColor Green
Write-Host "Worker health check: $workerOrigin/health"
Write-Host "Updated CMS config: $configPath"
Write-Host 'Ask the site maintainer to review, commit, build, and deploy the updated config.'
