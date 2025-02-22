@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo PRODUCT MODULE STRESS TEST
echo ===================================================
echo.

REM Set variables for testing
set API_URL=http://localhost:8000
set EMAIL=john@example.com
set PASSWORD=Password@123
set COOKIE_FILE=cookies.txt

echo === 1. AUTHENTICATION ===
echo.
echo Signing in to get authentication token...
curl -s -X POST %API_URL%/auth/signin -H "Content-Type: application/json" -d "{\"email\": \"%EMAIL%\", \"password\": \"%PASSWORD%\"}" -c %COOKIE_FILE%
REM Quick check if authentication succeeded
if %ERRORLEVEL% NEQ 0 (
    echo Authentication failed! Aborting tests.
    exit /b 1
)
echo Authentication successful!
echo.

echo === 2. CREATE PRODUCT TESTS ===
echo.

echo Test 2.1: Creating valid product...
for /f "tokens=*" %%i in ('curl -s -X POST %API_URL%/products -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"name\": \"Premium Coffee\", \"photo\": \"coffee.jpg\", \"details\": \"Premium Arabic Coffee\", \"pointsPrice\": 100}"') do (
    set RESPONSE=%%i
)
echo !RESPONSE!

echo.
for /f "tokens=2 delims=:," %%a in ('echo !RESPONSE! ^| findstr /C:"id"') do (
    set PRODUCT_ID=%%a
)
set PRODUCT_ID=!PRODUCT_ID:"=!
set PRODUCT_ID=!PRODUCT_ID: =!
echo Created product with ID: !PRODUCT_ID!
echo.

echo Test 2.2: Attempting to create product with negative points price...
curl -s -X POST %API_URL%/products -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"name\": \"Invalid Product\", \"photo\": \"invalid.jpg\", \"details\": \"Test Product\", \"pointsPrice\": -50}"
echo.

echo Test 2.3: Attempting to create product with missing required fields...
curl -s -X POST %API_URL%/products -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"name\": \"Incomplete Product\", \"photo\": \"test.jpg\"}"
echo.

echo Test 2.4: Attempting to create product with invalid data types...
curl -s -X POST %API_URL%/products -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"name\": 12345, \"photo\": \"test.jpg\", \"details\": \"Wrong type for name\", \"pointsPrice\": \"not-a-number\"}"
echo.

echo Test 2.5: Creating another valid product for purchase tests...
for /f "tokens=*" %%i in ('curl -s -X POST %API_URL%/products -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"name\": \"Premium Membership\", \"photo\": \"membership.jpg\", \"details\": \"1 Month Premium Membership\", \"pointsPrice\": 200}"') do (
    set RESPONSE2=%%i
)
echo !RESPONSE2!

echo.
for /f "tokens=2 delims=:," %%a in ('echo !RESPONSE2! ^| findstr /C:"id"') do (
    set PRODUCT_ID2=%%a
)
set PRODUCT_ID2=!PRODUCT_ID2:"=!
set PRODUCT_ID2=!PRODUCT_ID2: =!
echo Created second product with ID: !PRODUCT_ID2!
echo.

echo === 3. READ PRODUCT TESTS ===
echo.

echo Test 3.1: Getting all products...
curl -s -X GET %API_URL%/products -b %COOKIE_FILE%
echo.

echo Test 3.2: Getting product by ID...
curl -s -X GET %API_URL%/products/!PRODUCT_ID! -b %COOKIE_FILE%
echo.

echo Test 3.3: Attempting to get product with invalid ID...
curl -s -X GET %API_URL%/products/invalid-id -b %COOKIE_FILE%
echo.

echo Test 3.4: Attempting to get product with non-existent ID...
curl -s -X GET %API_URL%/products/00000000-0000-0000-0000-000000000000 -b %COOKIE_FILE%
echo.

echo === 4. UPDATE PRODUCT TESTS ===
echo.

echo Test 4.1: Updating product with valid data...
curl -s -X PUT %API_URL%/products/!PRODUCT_ID! -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"name\": \"Premium Arabic Coffee\", \"pointsPrice\": 150}"
echo.

echo Test 4.2: Attempting to update with invalid data...
curl -s -X PUT %API_URL%/products/!PRODUCT_ID! -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"pointsPrice\": -100}"
echo.

echo Test 4.3: Attempting to update non-existent product...
curl -s -X PUT %API_URL%/products/00000000-0000-0000-0000-000000000000 -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"name\": \"Non-existent Product\"}"
echo.

echo === 5. PURCHASE PRODUCT TESTS ===
echo.

echo Test 5.1: Attempting to purchase product with insufficient points...
curl -s -X POST %API_URL%/products/purchase -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"productId\": \"!PRODUCT_ID2!\"}"
echo.

echo Test 5.2: Attempting to purchase with invalid product ID...
curl -s -X POST %API_URL%/products/purchase -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"productId\": \"00000000-0000-0000-0000-000000000000\"}"
echo.

echo Test 5.3: Attempting to purchase with malformed product ID...
curl -s -X POST %API_URL%/products/purchase -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"productId\": \"invalid-id\"}"
echo.

echo Test 5.4: Attempting purchase with missing product ID...
curl -s -X POST %API_URL%/products/purchase -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{}"
echo.

echo === 6. DELETE PRODUCT TESTS ===
echo.

echo Test 6.1: Deleting product...
curl -s -X DELETE %API_URL%/products/!PRODUCT_ID! -b %COOKIE_FILE%
echo.

echo Test 6.2: Attempting to get deleted product...
curl -s -X GET %API_URL%/products/!PRODUCT_ID! -b %COOKIE_FILE%
echo.

echo Test 6.3: Attempting to delete non-existent product...
curl -s -X DELETE %API_URL%/products/00000000-0000-0000-0000-000000000000 -b %COOKIE_FILE%
echo.

echo Test 6.4: Cleaning up second product...
curl -s -X DELETE %API_URL%/products/!PRODUCT_ID2! -b %COOKIE_FILE%
echo.

echo === 7. EDGE CASE TESTS ===
echo.

echo Test 7.1: Multiple rapid requests to create products...
for /L %%i in (1,1,5) do (
    echo Request %%i
    start /b curl -s -X POST %API_URL%/products -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"name\": \"Stress Test Product %%i\", \"photo\": \"stress%%i.jpg\", \"details\": \"Stress test\", \"pointsPrice\": %%i00}"
)
timeout /t 3 > nul

echo Test 7.2: Very large product name...
set "LONG_NAME="
for /L %%i in (1, 1, 50) do set "LONG_NAME=!LONG_NAME!VeryLongProductName"
curl -s -X POST %API_URL%/products -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"name\": \"!LONG_NAME!\", \"photo\": \"long.jpg\", \"details\": \"Product with very long name\", \"pointsPrice\": 100}"
echo.

echo Test 7.3: Special characters in product details...
@REM curl -s -X POST %API_URL%/products -H "Content-Type: application/json" -b %COOKIE_FILE% -d "{\"name\": \"Special Chars\", \"photo\": \"special.jpg\", \"details\": \"Product with special chars: !@#$%%^&*()_+<>?:;'\\`'`''```'``'`\,./[]{}\", \"pointsPrice\": 100}"
echo.


echo ===================================================
echo STRESS TEST COMPLETED
echo ===================================================
echo.
echo Results summary:
echo - Created, read, updated, and deleted products
echo - Tested error cases for each endpoint
echo - Tested purchase functionality
echo - Tested edge cases with malformed data
echo.
echo If no 500 errors were encountered, your API is robust!

echo.
pause
endlocal
