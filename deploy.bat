@echo off
echo ========================================
echo   Color Trading Platform - Git Deploy
echo ========================================
echo.

set /p GITHUB_USERNAME=Apna GitHub username enter karo: 

echo.
echo [1/4] Git initialize kar raha hai...
git init
git add .
git commit -m "Deploy color trading platform"

echo.
echo [2/4] GitHub se connect ho raha hai...
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USERNAME%/colortrading-backend.git

echo.
echo [3/4] Code upload ho raha hai...
git push -u origin main

echo.
echo ========================================
echo   DONE! Ab Render.com par deploy karo:
echo   1. render.com par jaao
echo   2. New Web Service banana
echo   3. GitHub repo: colortrading-backend
echo   4. Build: npm install
echo   5. Start: node server.js
echo ========================================
pause
