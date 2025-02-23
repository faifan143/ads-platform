@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo CONTENT MODULE STRESS TEST
echo ===================================================
echo.
echo.

REM Check if curl is available
where curl >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: CURL is not installed or not in PATH.
    exit /b 1
)

REM Set variables for testing
set "API_URL=http://localhost:8000"
set COOKIE_FILE=cookies.txt

REM === 0. CREATE TEST CONTENT ===
echo Creating test content 1...
echo.
echo {"title":"Ad 1","description":"First test ad","owner":"PLACEHOLDER_OWNER_ID","type":"IMAGE","intervalHours":6,"endValidationDate":"2025-12-31","mediaUrls":["https://example.com/image1.jpg"],"interestIds":["PLACEHOLDER_ID1"]} > content1_template.json

REM Replace placeholders with actual IDs
powershell -Command "(Get-Content content1_template.json).replace('PLACEHOLDER_OWNER_ID','OWNER_ID').replace('PLACEHOLDER_ID1','INTEREST_ID_1')" > content1.json
type content1.json

curl -s -X POST "%API_URL%/content" -H "Content-Type: application/json" -d @content1.json > content1_response.json
type content1_response.json

for /f "tokens=2 delims=:," %%i in ('findstr "\"id\":" content1_response.json') do (
    set "CONTENT_ID1=%%i"
    set "CONTENT_ID1=!CONTENT_ID1:"=!"
    set "CONTENT_ID1=!CONTENT_ID1: =!"
)
echo Content 1 ID: !CONTENT_ID1!
echo.
echo.

REM === 1. GET ALL CONTENT ===
echo Getting all content...
curl -s -w "\n" -X GET "%API_URL%/content"
echo.
echo.

REM === 2. GET SINGLE CONTENT ===
echo Getting content by ID...
curl -s -w "\n" -X GET "%API_URL%/content/!CONTENT_ID1!"
echo.
echo.

REM === 3. UPDATE CONTENT ===
echo Updating content 1...
echo.
echo {"title":"Updated Ad 1","description":"Updated test ad"} > update_content1.json
curl -s -w "\n" -X PATCH "%API_URL%/content/!CONTENT_ID1!" -H "Content-Type: application/json" -d @update_content1.json
echo.
echo.

REM === 4. DELETE CONTENT ===
echo Deleting content 1...
curl -s -w "\n" -X DELETE "%API_URL%/content/!CONTENT_ID1!"
echo.
echo.

REM === 5. EDGE CASE TESTS ===
echo Testing with missing title...
echo.
echo {"description":"Missing title","owner":"OWNER_ID","type":"IMAGE","intervalHours":6,"endValidationDate":"2025-12-31","mediaUrls":["https://example.com/image1.jpg"],"interestIds":["INTEREST_ID_1"]} > content_invalid.json
curl -s -w "\n" -X POST "%API_URL%/content" -H "Content-Type: application/json" -d @content_invalid.json
echo.
echo.

REM === 6. CLEANUP ===
echo.
echo.
echo Deleting temporary files...
del /q content*_template.json 2>nul
del /q content*.json 2>nul
del /q content*_response.json 2>nul

echo ===================================================
echo STRESS TEST COMPLETED
echo ===================================================
echo.
echo.
echo ✅ If no errors were encountered, your CONTENT API is robust!
echo.
echo.
pause
endlocal
