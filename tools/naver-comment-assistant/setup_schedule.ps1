# Run via: powershell -ExecutionPolicy Bypass -File setup_schedule.ps1
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $dir 'comment_assistant.py'
if (!(Test-Path $script)) { throw "comment_assistant.py not found." }
$exe = (& py -3 -c "import sys; print(sys.executable)" | Select-Object -Last 1)
if (!$exe) { throw "Python 3 not found. Install it first." }
$exe = $exe.Trim()
$inputTime = Read-Host "Daily draft generation time HH:mm (default 09:30)"
if ([string]::IsNullOrWhiteSpace($inputTime)) { $inputTime = '09:30' }
try {
    $time = [datetime]::ParseExact($inputTime, 'HH:mm', [System.Globalization.CultureInfo]::InvariantCulture)
} catch { throw "Time must look like 09:30 or 18:00." }
$action = New-ScheduledTaskAction -Execute $exe -Argument ('"' + $script + '" --daily') -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'NaverBlogCommentAssistantDrafts' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host ""
Write-Host "Schedule registered: Daily at $inputTime (local PC time)." -ForegroundColor Green
Write-Host "IMPORTANT: This generates draft replies only. Naver publishing requires manual review."
Write-Host "Your PC needs to be powered on. Check Task Scheduler for run history."
Read-Host "Press Enter to close"
