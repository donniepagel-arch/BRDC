@echo off
REM Simple script to create a test user via the registerPlayerSimple cloud function
REM This method doesn't require service account keys!

echo Creating test user via cloud function...
echo.

curl -X POST https://us-central1-brdc-v2.cloudfunctions.net/registerPlayerSimple ^
  -H "Content-Type: application/json" ^
  -d "{\"first_name\": \"Test\", \"last_name\": \"User\", \"phone\": \"5555555555\", \"email\": \"testuser@example.com\"}"

echo.
echo.
echo Test user should be created!
echo.
echo Default PIN will be generated from phone (last 4 digits + random)
echo Check the function response above for the PIN
echo.
echo Share with tester:
echo   URL: https://brdc-v2.web.app/scorer
echo   PIN: (see response above)
echo.
echo Note: User will receive welcome SMS/email to test contacts
echo If you want to avoid this, use the Node.js script instead
echo.
pause
