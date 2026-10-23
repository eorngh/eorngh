param(
    [Parameter(Mandatory=$true)][string]$KeyStorePath,
    [Parameter(Mandatory=$true)][string]$CredentialPath,
    [string]$KeyAlias='upload'
)
$ErrorActionPreference='Stop'
$taskVariables=@('TRAVEL_DDAK_KEYSTORE','TRAVEL_DDAK_STORE_PASSWORD','TRAVEL_DDAK_KEY_ALIAS','TRAVEL_DDAK_KEY_PASSWORD')
$taskPrevious=@{}
foreach($taskName in $taskVariables){$taskPrevious[$taskName]=[Environment]::GetEnvironmentVariable($taskName,'Process')}
try {
    $taskCredential=Import-Clixml -LiteralPath $CredentialPath
    if($taskCredential -isnot [PSCredential]){throw 'Credential file must be a Windows-encrypted PSCredential.'}
    $env:TRAVEL_DDAK_KEYSTORE=(Resolve-Path -LiteralPath $KeyStorePath).Path
    $env:TRAVEL_DDAK_KEY_ALIAS=$KeyAlias
    $env:TRAVEL_DDAK_STORE_PASSWORD=$taskCredential.GetNetworkCredential().Password
    $env:TRAVEL_DDAK_KEY_PASSWORD=$env:TRAVEL_DDAK_STORE_PASSWORD
    & "$PSScriptRoot/../android/gradlew.bat" -p "$PSScriptRoot/../android" assembleRelease bundleRelease --console=plain
    if($LASTEXITCODE -ne 0){throw "Android release build failed (exit $LASTEXITCODE)."}
} finally {
    foreach($taskName in $taskVariables){[Environment]::SetEnvironmentVariable($taskName,$taskPrevious[$taskName],'Process')}
    $taskCredential=$null
}
