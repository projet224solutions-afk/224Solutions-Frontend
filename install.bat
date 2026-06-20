@echo off
echo ========================================
echo INSTALLATION VISTA FLOWS - 224SOLUTIONS
echo ========================================
echo.

REM Vérifier Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe!
    echo Telechargez-le sur: https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js detecte
node --version
echo.

REM Installer les dépendances
echo Installation des dependances...
call npm install
if %errorlevel% neq 0 (
    echo [ERREUR] Installation echouee
    pause
    exit /b 1
)

echo.
echo ========================================
echo INSTALLATION TERMINEE AVEC SUCCES!
echo ========================================
echo.
echo Prochaines etapes:
echo 1. Creer un fichier .env avec vos cles Supabase
echo 2. Executer: npm run dev
echo 3. Ouvrir: http://localhost:8080
echo.
echo Consultez INSTALLATION_CLIENT.md pour plus de details
echo.
pause
