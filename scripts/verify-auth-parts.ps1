# Run from the bot folder, after scripts/split-auth.ps1:
#   powershell -ExecutionPolicy Bypass -File scripts/verify-auth-parts.ps1
# Checks: joining the parts gives back the original auth.tar.gz,
# and the tar lists creds.json. ASCII only, no else blocks.

$parts = Get-ChildItem auth_part*.txt | Sort-Object Name
if (-not $parts) {
  Write-Host "FAIL: no auth_part*.txt found"
  exit 1
}

Write-Host "Parts found:"
foreach ($p in $parts) {
  $content = Get-Content $p.FullName -Raw
  $len = $content.Length
  Write-Host $p.Name $len "chars"
}

$b64 = ""
foreach ($p in $parts) {
  $b64 = $b64 + (Get-Content $p.FullName -Raw)
}

$orig = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\auth.tar.gz"))
Write-Host "Joined length:" $b64.Length
Write-Host "Original length:" $orig.Length
if ($b64 -ne $orig) {
  Write-Host "FAIL: joined parts do not match auth.tar.gz - a part is missing, truncated, or out of order"
  exit 1
}
Write-Host "PASS: joined parts match auth.tar.gz exactly"

[IO.File]::WriteAllBytes("$PWD\verify-auth.tar.gz", [Convert]::FromBase64String($b64))
$list = tar -tzf verify-auth.tar.gz 2>&1
$listText = $list -join "`n"
Write-Host $listText
if ($listText -notmatch "creds.json") {
  Write-Host "FAIL: tar does not contain creds.json"
  exit 1
}
Write-Host "PASS: tar contains creds.json"
Remove-Item verify-auth.tar.gz
Write-Host "All parts OK - safe to paste them as AUTH_BASE64_1, AUTH_BASE64_2, ..."
