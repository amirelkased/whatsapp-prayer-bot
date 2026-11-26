# Run from the bot folder, AFTER npm run login:
#   tar -czf auth.tar.gz -C auth .
#   powershell -ExecutionPolicy Bypass -File scripts/split-auth.ps1
#
# NOTE: use `-C auth .` (not `tar -czf auth.tar.gz auth`) so the tar
# contains creds.json at the top, not auth/creds.json — otherwise the
# workflow extracts it to auth/auth/creds.json and Baileys asks for a QR again.
# The workflow also flattens auth/auth/ if it happens, so old parts still work.
# GitHub Secrets are limited to 48 KB each, and the base64 of auth.tar.gz
# is usually bigger. This splits it into 40,000-character parts:
#   auth_part1.txt, auth_part2.txt, ...
# Paste each file's content as a GitHub Secret:
#   AUTH_BASE64_1, AUTH_BASE64_2, ...
# The workflow joins them back together. Do NOT commit these files.
# Delete them (and auth.tar.gz) after the secrets are saved.

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\auth.tar.gz"))
Write-Host "Total base64 length: $($b64.Length) chars"
$chunk = 40000
for ($i = 0; $i -lt $b64.Length; $i += $chunk) {
  $n = ($i / $chunk) + 1
  $len = [Math]::Min($chunk, $b64.Length - $i)
  $b64.Substring($i, $len) | Out-File "auth_part$n.txt" -NoNewline
  Write-Host "auth_part$n.txt : $len chars -> GitHub Secret AUTH_BASE64_$n"
}
Write-Host ""
Write-Host "To copy part 1 to clipboard: Get-Content auth_part1.txt -Raw | Set-Clipboard"
