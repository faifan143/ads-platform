@echo off
setlocal EnableDelayedExpansion

REM Set variables for testing
set "API_URL=http://localhost:8000"
set "COOKIE_FILE=cookies.txt"

REM Generate timestamp for unique names
for /f "tokens=2-4 delims=/ " %%a in ('echo %date%') do (
    set "date_stamp=%%c%%a%%b"
)
for /f "tokens=1-4 delims=:,." %%a in ('echo %time%') do (
    set "time_stamp=%%a%%b%%c%%d"
)

REM Save test credentials for reuse
set "TEST_EMAIL=test!time_stamp!@example.com"
set "TEST_PASSWORD=P@ssword123"

echo ===================================================
echo CONTENT MODULE STRESS TEST
echo ===================================================

echo === 1. Setup: Create Test Interests ===
echo Creating interest 1...
curl -s -X POST "%API_URL%/interests" -H "Content-Type: application/json" -d "{\"name\": \"Test Interest 1 !date_stamp!!time_stamp!\", \"targetedGender\": \"MALE\", \"minAge\": 13, \"maxAge\": 65}" > interest1.json
type interest1.json
echo.

REM Extract interest ID
for /f "tokens=2 delims=:," %%i in ('findstr "\"id\":" interest1.json') do (
    set "ID1=%%i"
    set "ID1=!ID1:"=!"
    set "ID1=!ID1: =!"
)
echo Interest ID: !ID1!

echo === 2. Setup: Create and Sign In Test User ===
echo Creating test user...
curl -s -X POST "%API_URL%/auth/signup" -H "Content-Type: application/json" -d "{\"name\": \"Test User\", \"email\": \"!TEST_EMAIL!\", \"phone\": \"0912345678\", \"password\": \"!TEST_PASSWORD!\", \"dateOfBirth\": \"2000-01-01\", \"gender\": \"MALE\", \"providence\": \"ALEPPO\", \"interestIds\": [\"!ID1!\"]}" > user.json
type user.json
echo.

echo Signing in...
curl -s -X POST "%API_URL%/auth/signin" -H "Content-Type: application/json" -d "{\"phone\": \"0912345678\", \"password\": \"!TEST_PASSWORD!\"}" -c %COOKIE_FILE%
echo.

echo === 3. Testing Content Creation ===
echo Test 3.1: Create Valid Content
curl -s -w "\nStatus: %%{http_code}\n" -X POST "%API_URL%/content" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"title\": \"Test Content !time_stamp!\", \"description\": \"Test Description\", \"ownerName\": \"Test Owner\", \"ownerNumber\": \"0912345678\", \"type\": \"STORY\", \"intervalHours\": 24, \"endValidationDate\": \"2025-12-31\", \"mediaUrls\": [\"https://example.com/image1.jpg\"], \"interestIds\": [\"!ID1!\"]}" > content.json
type content.json
echo.

REM Extract content ID
for /f "tokens=2 delims=:," %%i in ('findstr "\"id\":" content.json') do (
    set "CONTENT_ID=%%i"
    set "CONTENT_ID=!CONTENT_ID:"=!"
    set "CONTENT_ID=!CONTENT_ID: =!"
)
echo Content ID: !CONTENT_ID!

echo === 4. Testing Content Retrieval ===
echo Test 4.1: Get All Content
curl -s -w "\nStatus: %%{http_code}\n" -X GET "%API_URL%/content" -b %COOKIE_FILE%
echo.

echo Test 4.2: Get Content by ID
curl -s -w "\nStatus: %%{http_code}\n" -X GET "%API_URL%/content/!CONTENT_ID!" -b %COOKIE_FILE%
echo.

echo Test 4.3: Get Relevant Content
curl -s -w "\nStatus: %%{http_code}\n" -X GET "%API_URL%/content/user/relevant" -b %COOKIE_FILE%
echo.

echo === 5. Testing Content Interactions ===
echo Test 5.1: Mark Content as Viewed
curl -s -w "\nStatus: %%{http_code}\n" -X POST "%API_URL%/content/!CONTENT_ID!/view" -b %COOKIE_FILE%
echo.

echo Test 5.2: Like Content
curl -s -w "\nStatus: %%{http_code}\n" -X POST "%API_URL%/content/!CONTENT_ID!/like" -b %COOKIE_FILE%
echo.

echo Test 5.3: Get WhatsApp Link
curl -s -w "\nStatus: %%{http_code}\n" -X GET "%API_URL%/content/!CONTENT_ID!/whatsapp" -b %COOKIE_FILE%
echo.

echo === 6. Testing Content Updates ===
echo Test 6.1: Update Content
curl -s -w "\nStatus: %%{http_code}\n" -X PATCH "%API_URL%/content/!CONTENT_ID!" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"title\": \"Updated Content !time_stamp!\", \"intervalHours\": 48}"
echo.

echo === 7. Testing Filter and Search ===
echo Test 7.1: Filter by Type
curl -s -w "\nStatus: %%{http_code}\n" -X GET "%API_URL%/content?type=STORY" -b %COOKIE_FILE%
echo.

echo Test 7.2: Filter by Interest
curl -s -w "\nStatus: %%{http_code}\n" -X GET "%API_URL%/content?interestId=!ID1!" -b %COOKIE_FILE%
echo.

echo === 8. Testing Error Cases ===
echo Test 8.1: Create Content with Invalid Type
curl -s -w "\nStatus: %%{http_code}\n" -X POST "%API_URL%/content" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"title\": \"Invalid Type\", \"description\": \"Test\", \"ownerName\": \"Test Owner\", \"ownerNumber\": \"0912345678\", \"type\": \"INVALID\", \"intervalHours\": 24, \"endValidationDate\": \"2025-12-31\", \"mediaUrls\": [], \"interestIds\": [\"!ID1!\"]}"
echo.

echo Test 8.2: Get Non-existent Content
curl -s -w "\nStatus: %%{http_code}\n" -X GET "%API_URL%/content/00000000-0000-0000-0000-000000000000" -b %COOKIE_FILE%
echo.

echo Test 8.3: Test Unauthorized Access
set "TEMP_COOKIE=%COOKIE_FILE%.bak"
move /y %COOKIE_FILE% %TEMP_COOKIE% >nul 2>&1
curl -s -w "\nStatus: %%{http_code}\n" -X POST "%API_URL%/content/!CONTENT_ID!/like"
move /y %TEMP_COOKIE% %COOKIE_FILE% >nul 2>&1
echo.

echo === 9. Testing Delete and Cascade ===
echo Test 9.1: Delete Content
curl -s -w "\nStatus: %%{http_code}\n" -X DELETE "%API_URL%/content/!CONTENT_ID!" -b %COOKIE_FILE%
echo.

echo Test 9.2: Verify Deletion ^(should return 404^)
curl -s -w "\nStatus: %%{http_code}\n" -X GET "%API_URL%/content/!CONTENT_ID!" -b %COOKIE_FILE%
echo.

echo Test 9.3: Verify Cascade ^(likes, views should be gone^)
curl -s -w "\nStatus: %%{http_code}\n" -X POST "%API_URL%/content/!CONTENT_ID!/like" -b %COOKIE_FILE%
echo.

echo === 10. Testing Final Error Cases ===
echo Test 10.1: Try to update deleted content
curl -s -w "\nStatus: %%{http_code}\n" -X PATCH "%API_URL%/content/!CONTENT_ID!" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"title\": \"Should Fail\"}"
echo.

echo === 11. Cleanup ===
echo Deleting temporary files...
del /q interest*.json user.json content.json %COOKIE_FILE% 2>nul

echo ===================================================
echo TEST COMPLETED
echo ===================================================
echo.
echo Status Code Summary:
echo - 201: Expected for successful creation
echo - 200: Expected for successful operations
echo - 400: Expected for invalid input
echo - 401: Expected for unauthorized access
echo - 404: Expected for not found resources
echo ===================================================

pause
endlocal