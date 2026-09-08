@echo off
title Hair Artisans - Save and Push

echo.
echo ==========================================
echo       HAIR ARTISANS - SAVE TO GITHUB
echo ==========================================
echo.

echo [1/3] Adding changes...
git add .

echo.
echo [2/3] Creating commit...
git commit -m "Update Hair Artisans website"

echo.
echo [3/3] Pushing to GitHub...
git push

echo.
echo ==========================================
echo              COMPLETE
echo ==========================================
echo.
echo Your changes are now on GitHub.
echo Vercel will automatically deploy them.
echo.

pause