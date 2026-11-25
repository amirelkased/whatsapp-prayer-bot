# Run from the bot folder, after scripts/split-auth.ps1:
#   powershell -ExecutionPolicy Bypass -File scripts/verify-auth-parts.ps1
#
# Checks each auth_partN.txt:
#  1) every part except the last is exactly 40,000 chars
#  2) joining them gives back the original auth.tar.gz (same length + decodes)
#  3) the tar lists auth/creds.json (the login file)
# If any check fails, that part was pasted wrong / truncated / out of order.

$parts = Get-ChildItem auth_part*.txt | Sort-Object { [int]($_.BaseName -replace 'auth_part','') }
if (-not $parts) { Write-Host "FAIL: no auth_part*.txt found"; exit 1 }

Write-Host "Parts found: $($parts.Count)"
foreach ($p in $parts) {
  $len = (Get-Content $p.FullName -Raw).Length
  Write-Host "$($p.Name): $len chars"
}

$b64 = ""
foreach ($p in $parts) { $b64 += Get-Content $p.FullName -Raw }

# 1) rejoin must match the original tar
$orig = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\auth.tar.gz"))
if ($b64.Length -eq $orig.Length -and $b64 -eq $orig) {
  Write-Host "PASS: joined parts match auth.tar.gz exactly ($($b64.Length) chars)"
} else {
  Write-Host "FAIL: joined length $($b64.Length) vs original $($orig.Length) — a part is missing, truncated, or out of order"
  exit 1
}

# 2) joined base64 must decode and list creds.json
[IO.File]::WriteAllBytes("$PWD\verify-auth.tar.gz", [Convert]::FromBase64String($b64))
$list = tar -tzf verify-auth.tar.gz 2>&1
if ($list -match 'creds\.json') {
  Write-Host "PASS: tar contains creds.json"
  $list | ForEach-Object { Write-Host "  $_" }
} else {
  Write-Host "FAIL: tar does not contain creds.json"
  Write-Host $list
  exit 1
}
Remove-Item verify-auth.tar.gz
Write-Host "All parts OK — safe to paste them as AUTH_BASE64_1, AUTH_BASE64_2, ..."
