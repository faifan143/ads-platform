@echo off
setlocal EnableDelayedExpansion

REM Set variables for testing
set "API_URL=http://localhost:8000"
set "COOKIE_FILE=cookies.txt"

echo ===================================================
echo USER INTERESTS MANAGEMENT TEST
echo ===================================================

REM Generate timestamp for unique names
for /f "tokens=2-4 delims=/ " %%a in ('echo %date%') do (
    set "date_stamp=%%c%%a%%b"
)
for /f "tokens=1-4 delims=:,." %%a in ('echo %time%') do (
    set "time_stamp=%%a%%b%%c%%d"
)

echo === 1. Setup: Create Test Interests ===
echo Creating interest 1...
curl -s -X POST "%API_URL%/interests" -H "Content-Type: application/json" -d "{\"name\": \"Test Interest 1 !date_stamp!!time_stamp!\", \"targetedGender\": \"MALE\", \"minAge\": 13, \"maxAge\": 65}" > interest1.json
type interest1.json

echo Creating interest 2...
curl -s -X POST "%API_URL%/interests" -H "Content-Type: application/json" -d "{\"name\": \"Test Interest 2 !date_stamp!!time_stamp!\", \"targetedGender\": \"FEMALE\", \"minAge\": 13, \"maxAge\": 65}" > interest2.json
type interest2.json

REM Extract interest IDs
for /f "tokens=2 delims=:," %%i in ('findstr "\"id\":" interest1.json') do (
    set "ID1=%%i"
    set "ID1=!ID1:"=!"
    set "ID1=!ID1: =!"
)

for /f "tokens=2 delims=:," %%i in ('findstr "\"id\":" interest2.json') do (
    set "ID2=%%i"
    set "ID2=!ID2:"=!"
    set "ID2=!ID2: =!"
)

echo Interest 1 ID: !ID1!
echo Interest 2 ID: !ID2!

echo === 2. Setup: Create and Sign In Test User ===
curl -s -X POST "%API_URL%/auth/signup" -H "Content-Type: application/json" -d "{\"name\": \"Test User\", \"email\": \"test@example.com\", \"phone\": \"0912345678\", \"password\": \"P@ssword123\", \"dateOfBirth\": \"2000-01-01\", \"gender\": \"MALE\", \"providence\": \"ALEPPO\", \"interestIds\": []}" > user.json
type user.json

curl -s -X POST "%API_URL%/auth/signin" -H "Content-Type: application/json" -d "{\"email\": \"test@example.com\", \"password\": \"P@ssword123\"}" -c %COOKIE_FILE%

echo === 3. Testing Interest Management ===

echo Test 3.1: Add Interests
curl -s -X POST "%API_URL%/users/interests" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"interestIds\": [\"!ID1!\"]}"
echo.

echo Test 3.2: Add More Interests
curl -s -X POST "%API_URL%/users/interests" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"interestIds\": [\"!ID2!\"]}"
echo.

echo Test 3.3: Update All Interests
curl -s -X PUT "%API_URL%/users/interests" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"interestIds\": [\"!ID2!\"]}"
echo.

echo Test 3.4: Remove Interests
curl -s -X DELETE "%API_URL%/users/interests" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"interestIds\": [\"!ID2!\"]}"
echo.

echo === 4. Testing Error Cases ===

echo Test 4.1: Add Invalid Interest ID
curl -s -X POST "%API_URL%/users/interests" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"interestIds\": [\"invalid-uuid\"]}"
echo.

echo Test 4.2: Add Non-existent Interest ID
curl -s -X POST "%API_URL%/users/interests" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"interestIds\": [\"00000000-0000-0000-0000-000000000000\"]}"
echo.

echo Test 4.3: Update With Empty Interests Array
curl -s -X PUT "%API_URL%/users/interests" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"interestIds\": []}"
echo.

echo Test 4.4: Remove Non-existent Interest
curl -s -X DELETE "%API_URL%/users/interests" -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"interestIds\": [\"00000000-0000-0000-0000-000000000000\"]}"
echo.

echo Test 4.5: Add Without Authentication
curl -s -X POST "%API_URL%/users/interests" -H "Content-Type: application/json" -d "{\"interestIds\": [\"!ID1!\"]}"
echo.

echo === 5. Cleanup ===
echo Deleting temporary files...
del /q interest1.json interest2.json user.json %COOKIE_FILE% 2>nul

echo ===================================================
echo TEST COMPLETED
echo ===================================================

pause
endlocal