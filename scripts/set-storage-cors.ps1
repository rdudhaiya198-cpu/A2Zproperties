param(
  [string]$Bucket = "$(Read-Host 'Enter Firebase storage bucket (e.g. myproject.appspot.com)')",
  [string]$CorsFile = "cors.json"
)

if (-not (Get-Command gsutil -ErrorAction SilentlyContinue)) {
  Write-Error "gsutil not found. Install Google Cloud SDK (gcloud) which includes gsutil: https://cloud.google.com/sdk/docs/install"
  exit 1
}

if (-not (Test-Path $CorsFile)) {
  Write-Error "CORS file '$CorsFile' not found in current directory."
  exit 1
}

Write-Output "Setting CORS for bucket: $Bucket using file: $CorsFile"
gsutil cors set $CorsFile gs://$Bucket
