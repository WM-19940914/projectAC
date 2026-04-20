# PowerShell UTF-8 설정 스크립트
# 이 파일을 PowerShell 프로필에 포함하면 UTF-8이 기본으로 설정됩니다

# 콘솔 코드 페이지를 UTF-8로 설정 (65001)
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Get-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$PSDefaultParameterValues['Set-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Add-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Select-String:Encoding'] = 'utf8'
$PSDefaultParameterValues['Import-Csv:Encoding'] = 'utf8'
$PSDefaultParameterValues['Export-Csv:Encoding'] = 'utf8'
$OutputEncoding = [System.Text.Encoding]::UTF8

# Node.js 관련 환경 변수
$env:LANG = 'ko_KR.UTF-8'
$env:LC_ALL = 'ko_KR.UTF-8'
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'

# 문자 인코딩 강제
chcp 65001 | Out-Null

Write-Host "[OK] PowerShell UTF-8 Mode Enabled" -ForegroundColor Green
