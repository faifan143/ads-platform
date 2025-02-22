@echo off
setlocal EnableDelayedExpansion

REM Generate timestamp for unique naming
for /f "tokens=2-4 delims=/ " %%a in ('echo %date%') do (
    set "date_stamp=%%c%%a%%b"
)
for /f "tokens=1-4 delims=:,." %%a in ('echo %time%') do (
    set "time_stamp=%%a%%b%%c%%d"
)

REM Set test variables with timestamp
set "TEST_NAME=Sports Test !date_stamp!!time_stamp!"
set "ENCODED_NAME=!TEST_NAME: =%%20!"

echo === Creating initial interests ===
curl -s -X POST "http://localhost:8000/interests" -H "Content-Type: application/json" -d "{\"name\": \"Initial Interest !date_stamp!!time_stamp!\", \"targetedGender\": \"MALE\", \"minAge\": 13, \"maxAge\": 65}" > interest_response.json
type interest_response.json

REM Extract interest ID and validate response
for /f "tokens=2 delims=:," %%i in ('findstr "\"id\":" interest_response.json') do (
    set "INIT_ID=%%i"
    set "INIT_ID=!INIT_ID:"=!"
    set "INIT_ID=!INIT_ID: =!"
)
if "!INIT_ID!"=="" (
    echo ❌ Failed to create initial interest
    exit /b 1
)
echo Initial Interest ID: !INIT_ID!

echo === Create test user and sign in ===
curl -s -X POST "http://localhost:8000/auth/signup" -H "Content-Type: application/json" -d "{\"name\": \"Test User\", \"email\": \"test@example.com\", \"phone\": \"0912345678\", \"password\": \"P@ssword123\", \"dateOfBirth\": \"2000-01-01\", \"gender\": \"MALE\", \"providence\": \"ALEPPO\", \"interestIds\": [\"!INIT_ID!\"]}"
curl -s -X POST "http://localhost:8000/auth/signin" -H "Content-Type: application/json" -d "{\"email\": \"test@example.com\", \"password\": \"P@ssword123\"}" -c cookies.txt

echo === Testing Interest CRUD Operations ===

echo 1. Create Interest
echo Creating interest with name: "!TEST_NAME!"
curl -s -X POST "http://localhost:8000/interests" -H "Content-Type: application/json" -b cookies.txt -d "{\"name\": \"!TEST_NAME!\", \"targetedGender\": \"MALE\", \"minAge\": 15, \"maxAge\": 40}" > new_interest.json
type new_interest.json

REM Extract and validate new interest ID
for /f "tokens=2 delims=:," %%i in ('findstr "\"id\":" new_interest.json') do (
    set "INTEREST_ID=%%i"
    set "INTEREST_ID=!INTEREST_ID:"=!"
    set "INTEREST_ID=!INTEREST_ID: =!"
)
if "!INTEREST_ID!"=="" (
    echo ❌ Failed to create test interest
    exit /b 1
)
echo New Interest ID: !INTEREST_ID!

echo 2. Read Operations
echo === Get All ===
curl -s -X GET "http://localhost:8000/interests" -b cookies.txt
echo.

echo === Get by ID ===
curl -s -X GET "http://localhost:8000/interests/id/!INTEREST_ID!" -b cookies.txt
echo.

echo === Get by Name ===
curl -s -X GET "http://localhost:8000/interests/name/!ENCODED_NAME!" -b cookies.txt
echo.

echo 3. Update Interest
curl -s -X PUT "http://localhost:8000/interests/!INTEREST_ID!" -H "Content-Type: application/json" -b cookies.txt -d "{\"maxAge\": 45}"
echo.

echo === Testing Validation Rules ===

echo 1. Invalid Age Range
curl -s -X POST "http://localhost:8000/interests" -H "Content-Type: application/json" -b cookies.txt -d "{\"name\": \"Invalid Ages !date_stamp!!time_stamp!\", \"minAge\": 30, \"maxAge\": 20}"
echo.

echo 2. Duplicate Name
echo Testing duplicate creation with name: "!TEST_NAME!"
curl -s -X POST "http://localhost:8000/interests" -H "Content-Type: application/json" -b cookies.txt -d "{\"name\": \"!TEST_NAME!\", \"minAge\": 15, \"maxAge\": 40}"
echo.

echo 3. Invalid Gender
curl -s -X POST "http://localhost:8000/interests" -H "Content-Type: application/json" -b cookies.txt -d "{\"name\": \"New Interest !date_stamp!!time_stamp!\", \"targetedGender\": \"OTHER\", \"minAge\": 15, \"maxAge\": 40}"
echo.

echo === Cleanup ===
echo 1. Delete Test Interest
curl -s -X DELETE "http://localhost:8000/interests/!INTEREST_ID!" -b cookies.txt
echo.

echo 2. Verify Deletion
curl -s -X GET "http://localhost:8000/interests/id/!INTEREST_ID!" -b cookies.txt
echo.

echo === Removing Temporary Files ===
del /q interest_response.json new_interest.json cookies.txt 2>nul

echo === Test Complete ===
pause
endlocal