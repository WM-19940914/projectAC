@echo off
REM Enable UTF-8 defaults for the current shell by delegating to the PowerShell setup script.

powershell -ExecutionPolicy Bypass -File "%~dp0enable-utf8.ps1"
