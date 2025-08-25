@echo off
echo 🎁 Creating Chrome Extension Package...

REM Create a temporary directory for packaging
if exist "extension-package" rmdir /s /q "extension-package"
mkdir "extension-package"

REM Copy extension files
echo 📁 Copying extension files...
xcopy "extension\*" "extension-package\" /E /Y

REM Create a timestamp for the package
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "datestamp=%YYYY%-%MM%-%DD%"

REM Create ZIP file
echo 📦 Creating ZIP package...
powershell -command "Compress-Archive -Path 'extension-package\*' -DestinationPath 'scroll-tracker-extension-%datestamp%.zip' -Force"

REM Cleanup
rmdir /s /q "extension-package"

echo ✅ Extension package created: scroll-tracker-extension-%datestamp%.zip
echo 🚀 Ready for Chrome Web Store upload!
pause
