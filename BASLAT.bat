@echo off
rem YKS Kocu uygulamasini Microsoft Edge ile acar.
start "" msedge "%~dp0index.html"
if errorlevel 1 start "" "%~dp0index.html"
