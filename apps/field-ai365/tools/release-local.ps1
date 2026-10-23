$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$jdkPath = 'C:\Users\eorng\Documents\Codex\2026-10-05\new-chat-4\work\tools\jdk-17.0.20.1+1'
$gradlePath = 'C:\Users\eorng\Documents\Codex\2026-10-05\new-chat-4\work\tools\gradle-8.13\bin\gradle.bat'
$keyPath = Join-Path $taskRoot '.local\upload-key.jks'
$taskPassword = $null
$passwordPointer = [IntPtr]::Zero
try {
 Set-Location -LiteralPath $taskRoot
 Write-Host 'HyeonjangAI365 release signing - password stays on this computer.'
 if (Test-Path -LiteralPath $keyPath) { Write-Host 'Enter the password of the existing upload key. The key will NOT be replaced.' }
 else { Write-Host 'Use a new upload-key password (at least 8 characters) and keep it safely.' }
 $taskPassword = Read-Host 'Upload keystore password' -AsSecureString
 if ($taskPassword.Length -lt 8) { throw 'Password must contain at least 8 characters.' }
 $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskPassword)
 $env:HJ365_STORE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
 $env:HJ365_KEY_PASSWORD = $env:HJ365_STORE_PASSWORD
 $env:HJ365_KEYSTORE = $keyPath
 $env:HJ365_KEY_ALIAS = 'upload'
 $env:JAVA_HOME = $jdkPath
 # Windows PowerShell treats native stderr warnings as errors under Stop.
 # Native tools are checked by exit code instead; JKS warnings are not failures.
 $ErrorActionPreference = 'Continue'
 if (!(Test-Path -LiteralPath $keyPath)) {
  & "$jdkPath\bin\keytool.exe" -genkeypair -keystore $keyPath -alias upload -keyalg RSA -keysize 2048 -validity 10000 -storetype JKS -storepass:env HJ365_STORE_PASSWORD -keypass:env HJ365_KEY_PASSWORD -dname 'CN=HyeonjangAI365 Upload, O=Gyeongil, C=KR'
  if ($LASTEXITCODE -ne 0) { throw 'Keystore creation failed.' }
 }
 & "$jdkPath\bin\keytool.exe" -list -keystore $keyPath -alias upload -storepass:env HJ365_STORE_PASSWORD *> $null
 if ($LASTEXITCODE -ne 0) { throw 'Keystore password check failed.' }
 & node tools/build.mjs
 if ($LASTEXITCODE -ne 0) { throw 'Current Android web asset refresh failed.' }
 $previousBundle = Join-Path $taskRoot 'dist\HyeonjangAI365-v0.2.0.aab'
 if (Test-Path -LiteralPath $previousBundle) {
  $previousBackup = Join-Path $taskRoot ('.local\previous-release-' + [DateTime]::Now.ToString('yyyyMMdd-HHmmss') + '.aab')
  Copy-Item -LiteralPath $previousBundle -Destination $previousBackup -ErrorAction Stop
 }
 & $gradlePath -p (Join-Path $taskRoot 'android') bundleRelease --no-daemon *> (Join-Path $taskRoot 'evidence\release-build.log')
 if ($LASTEXITCODE -ne 0) { throw 'Release build failed. See evidence/release-build.log.' }
 $bundlePath = Join-Path $taskRoot 'android\app\build\outputs\bundle\release\app-release.aab'
 & "$jdkPath\bin\jarsigner.exe" -verify $bundlePath *> (Join-Path $taskRoot 'evidence\release-signature.log')
 if ($LASTEXITCODE -ne 0) { throw 'Bundle signature verification failed.' }
 $ErrorActionPreference = 'Stop'
 $distPath = Join-Path $taskRoot 'dist'
 New-Item -ItemType Directory -Path $distPath -Force | Out-Null
 $outputPath = Join-Path $distPath 'HyeonjangAI365-v0.2.0.aab'
 Copy-Item -LiteralPath $bundlePath -Destination $outputPath
 $hashStream = [IO.File]::OpenRead($outputPath)
 $hashAlgorithm = [Security.Cryptography.SHA256]::Create()
 try { $bundleHash = [BitConverter]::ToString($hashAlgorithm.ComputeHash($hashStream)).Replace('-','') }
 finally { $hashStream.Dispose(); $hashAlgorithm.Dispose() }
 [IO.File]::WriteAllText($outputPath + '.sha256.txt', $bundleHash + '  HyeonjangAI365-v0.2.0.aab' + [Environment]::NewLine)
 $ErrorActionPreference = 'Continue'
 & "$jdkPath\bin\keytool.exe" -exportcert -rfc -keystore $keyPath -alias upload -storepass:env HJ365_STORE_PASSWORD -file (Join-Path $distPath 'upload-certificate.pem')
 if ($LASTEXITCODE -ne 0) { throw 'Public certificate export failed.' }
 $ErrorActionPreference = 'Stop'
 Write-Host 'SIGNED BUILD SUCCESS. This is NOT a deployment or final test completion.'
 Write-Host $outputPath
} catch {
 Write-Host ('FAILED: ' + $_.Exception.Message) -ForegroundColor Red
} finally {
 foreach ($envName in @('HJ365_STORE_PASSWORD','HJ365_KEY_PASSWORD','HJ365_KEYSTORE','HJ365_KEY_ALIAS')) { [Environment]::SetEnvironmentVariable($envName,$null,'Process') }
 if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
 if ($taskPassword) { $taskPassword.Dispose() }
 Read-Host 'Press Enter to close'
}
