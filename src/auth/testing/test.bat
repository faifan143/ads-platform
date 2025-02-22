@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo AUTH MODULE STRESS TEST
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

echo === 0. CREATING TEST INTERESTS ===
echo.
echo Creating interest 1: Sports...
curl -s -X POST "%API_URL%/interests" -H "Content-Type: application/json" -d "{\"name\": \"Sports\", \"targetedGender\": \"MALE\", \"minAge\": 13, \"maxAge\": 65}" > interest1.json
type interest1.json
echo.
echo.
echo.
echo.

echo Creating interest 2: Fashion...
curl -s -X POST "%API_URL%/interests" -H "Content-Type: application/json" -d "{\"name\": \"Fashion\", \"targetedGender\": \"FEMALE\", \"minAge\": 13, \"maxAge\": 65}" > interest2.json
type interest2.json
echo.
echo.
echo.
echo.

echo Creating interest 3: Technology...
curl -s -X POST "%API_URL%/interests" -H "Content-Type: application/json" -d "{\"name\": \"Technology\", \"targetedGender\": null, \"minAge\": 15, \"maxAge\": 70}" > interest3.json
type interest3.json
echo.
echo.
echo.
echo.




REM Extract interest IDs from the saved response files
echo Extracting interest IDs...

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

for /f "tokens=2 delims=:," %%i in ('findstr "\"id\":" interest3.json') do (
    set "ID3=%%i"
    set "ID3=!ID3:"=!"
    set "ID3=!ID3: =!"
)

echo Interest 1 ID: !ID1!
echo Interest 2 ID: !ID2!
echo Interest 3 ID: !ID3!
echo.


echo === 1. SIGN UP TESTS ===
echo.
echo.

REM Create JSON files with PowerShell variable substitution
echo Creating payload for John Doe...
echo {"name":"John Doe","email":"john@example.com","phone":"0934567890","password":"Password@123","dateOfBirth":"2000-01-01","gender":"MALE","providence":"ALEPPO","interestIds":["PLACEHOLDER_ID1","PLACEHOLDER_ID3"]} > user1_template.json
powershell -Command "(Get-Content user1_template.json).replace('PLACEHOLDER_ID1','%ID1%').replace('PLACEHOLDER_ID3','%ID3%')" > user1.json
type user1.json
echo.
echo Test 1.1: Signing up a valid user...
curl -s -w "\n" -X POST "%API_URL%/auth/signup" -H "Content-Type: application/json" -d @user1.json
echo.
echo.
echo.
echo.




echo Creating payload for duplicate email test...
echo {"name":"John Doe 2","email":"john@example.com","phone":"0945678902","password":"Password@123","dateOfBirth":"2000-03-01","gender":"MALE","providence":"DAMASCUS","interestIds":["PLACEHOLDER_ID1"]} > user2_template.json
powershell -Command "(Get-Content user2_template.json).replace('PLACEHOLDER_ID1','%ID1%')" > user2.json
type user2.json
echo.
echo Test 1.2: Attempting to sign up with duplicate email...
curl -s -w "\n" -X POST "%API_URL%/auth/signup" -H "Content-Type: application/json" -d @user2.json
echo.
echo.
echo.
echo.




echo Creating payload for invalid email test...
echo {"name":"David Miller","email":"invalid-email","phone":"0945678905","password":"Password@123","dateOfBirth":"2000-05-01","gender":"MALE","providence":"HAMA","interestIds":["PLACEHOLDER_ID3"]} > user3_template.json
powershell -Command "(Get-Content user3_template.json).replace('PLACEHOLDER_ID3','%ID3%')" > user3.json
type user3.json
echo.

echo Test 1.3: Attempting to sign up with invalid email format...
curl -s -w "\n" -X POST "%API_URL%/auth/signup" -H "Content-Type: application/json" -d @user3.json
echo.
echo.
echo.
echo.




echo Creating payload for female user...
echo {"name":"Jane Smith","email":"jane@example.com","phone":"0934567891","password":"Password@123","dateOfBirth":"1995-05-15","gender":"FEMALE","providence":"DAMASCUS","interestIds":["PLACEHOLDER_ID2"]} > user4_template.json
powershell -Command "(Get-Content user4_template.json).replace('PLACEHOLDER_ID2','%ID2%')" > user4.json
type user4.json
echo.

echo Test 1.4: Signing up a valid female user...
curl -s -w "\n" -X POST "%API_URL%/auth/signup" -H "Content-Type: application/json" -d @user4.json
echo.
echo.
echo.
echo.




echo === 2. SIGN IN TESTS ===
echo.
echo.

echo Creating signin payload...
echo {"email":"john@example.com","password":"Password@123"} > signin1.json
echo Test 2.1: Signing in with valid credentials...
curl -s -w "\n" -X POST "%API_URL%/auth/signin" -H "Content-Type: application/json" -d @signin1.json -c %COOKIE_FILE%
echo.
echo.
echo.
echo.




echo Creating invalid password payload...
echo {"email":"john@example.com","password":"Wrong@123"} > signin2.json
echo Test 2.2: Signing in with invalid password...
curl -s -w "\n" -X POST "%API_URL%/auth/signin" -H "Content-Type: application/json" -d @signin2.json
echo.
echo.
echo.
echo.




echo Creating non-existent user payload...
echo {"email":"nonexistent@example.com","password":"Password@123"} > signin3.json
echo Test 2.3: Signing in with non-existent user...
curl -s -w "\n" -X POST "%API_URL%/auth/signin" -H "Content-Type: application/json" -d @signin3.json
echo.
echo.
echo.
echo.




echo === 3. PROTECTED ROUTE TESTS ===
echo.

echo Test 3.1: Accessing protected route with valid session...
curl -s -w "\n" -X GET "%API_URL%/auth/me" -b %COOKIE_FILE%
echo.
echo.
echo.
echo.




echo Test 3.2: Accessing protected route without authentication...
curl -s -w "\n" -X GET "%API_URL%/auth/me"
echo.
echo.
echo.
echo.




echo === 4. SIGN OUT TESTS ===
echo.
echo.
echo.
echo.



echo Test 4.1: Signing out from current session...
curl -s -w "\n" -X POST "%API_URL%/auth/signout" -b %COOKIE_FILE%
del /q %COOKIE_FILE% 2>nul 
echo.
echo.
echo.




echo Test 4.2: Accessing protected route after sign out...
curl -s -w "\n" -X GET "%API_URL%/auth/me" -b %COOKIE_FILE%
echo.
echo.
echo.
echo.




echo === 5. EDGE CASE TESTS ===
echo.
echo.
echo.
echo.




echo Creating invalid gender payload...
echo {"name":"Alex Johnson","email":"alex@example.com","phone":"0945678901","password":"Password@123","dateOfBirth":"2000-02-01","gender":"OTHER","providence":"ALEPPO","interestIds":["PLACEHOLDER_ID2"]} > user5_template.json
powershell -Command "(Get-Content user5_template.json).replace('PLACEHOLDER_ID2','%ID2%')" > user5.json
type user5.json
echo.
echo.
echo.
echo.




echo Test 5.1: Signing up with invalid gender...
curl -s -w "\n" -X POST "%API_URL%/auth/signup" -H "Content-Type: application/json" -d @user5.json
echo.
echo.
echo.
echo.




echo Creating invalid date payload...
echo {"name":"Bob Wilson","email":"bob@example.com","phone":"0945678903","password":"Password@123","dateOfBirth":"invalid-date","gender":"MALE","providence":"LATAKIA","interestIds":["PLACEHOLDER_ID1","PLACEHOLDER_ID3"]} > user6_template.json
powershell -Command "(Get-Content user6_template.json).replace('PLACEHOLDER_ID1','%ID1%').replace('PLACEHOLDER_ID3','%ID3%')" > user6.json
type user6.json
echo.
echo.
echo.
echo.




echo Test 5.2: Signing up with invalid date of birth...
curl -s -w "\n" -X POST "%API_URL%/auth/signup" -H "Content-Type: application/json" -d @user6.json
echo.
echo.
echo.
echo.




echo Creating too young age payload...
echo {"name":"Young User","email":"young@example.com","phone":"0945678904","password":"Password@123","dateOfBirth":"2020-01-01","gender":"MALE","providence":"HAMA","interestIds":["PLACEHOLDER_ID3"]} > user7_template.json
powershell -Command "(Get-Content user7_template.json).replace('PLACEHOLDER_ID3','%ID3%')" > user7.json
type user7.json
echo.
echo.
echo.
echo.




echo Test 5.3: Signing up with too young age...
curl -s -w "\n" -X POST "%API_URL%/auth/signup" -H "Content-Type: application/json" -d @user7.json
echo.
echo.
echo.
echo.




echo Test 5.4: Multiple simultaneous sign-ins...
start /b curl -s -w "\n" -X POST "%API_URL%/auth/signin" -H "Content-Type: application/json" -d @signin1.json -c cookies1.txt
start /b curl -s -w "\n" -X POST "%API_URL%/auth/signin" -H "Content-Type: application/json" -d @signin1.json -c cookies2.txt
timeout /nobreak /t 2
echo.
echo.
echo.
echo.




echo Test 5.5: Signing out all sessions...
curl -s -w "\n" -X POST "%API_URL%/auth/signout" -b cookies1.txt
curl -s -w "\n" -X POST "%API_URL%/auth/signout" -b cookies2.txt
echo.
echo.
echo.
echo.




echo === 6. CLEANUP ===
echo.
echo.
echo.
echo.



echo Deleting temporary files...
del /q interest*.json 2>nul
del /q user*_template.json 2>nul
del /q user*.json 2>nul
del /q signin*.json 2>nul
del /q cookies*.txt 2>nul

echo ===================================================
echo STRESS TEST COMPLETED
echo ===================================================
echo.
echo.
echo.
echo.



echo ✅ If no 500 errors were encountered, your API is robust!
echo.
echo.
echo.
echo.



pause
endlocal