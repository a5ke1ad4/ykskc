@echo off
rem YKS Kocu uygulamasini Google Chrome ile acar.
set "SAYFA=%~dp0index.html"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" goto bulundu1
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" goto bulundu2
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" goto bulundu3
start "" chrome "%SAYFA%"
if errorlevel 1 goto yok
exit /b
:bulundu1
start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%SAYFA%"
exit /b
:bulundu2
start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%SAYFA%"
exit /b
:bulundu3
start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%SAYFA%"
exit /b
:yok
echo Google Chrome bulunamadi. Chrome kurulu degilse BASLAT.bat ile Edge de acabilirsin.
pause
