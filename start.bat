@echo off
echo ========================================
echo   Fullstack Auth App - Quick Start
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo [INFO] Creating .env file from template...
    copy .env.example .env
    echo.
    echo [WARNING] Please edit .env and update the following:
    echo   - JWT_SECRET: Change to a strong random value
    echo   - SESSION_SECRET: Change to a strong random value
    echo.
    echo Generate secrets using PowerShell:
    echo   [Convert]::ToBase64String((1..64 ^| ForEach-Object {Get-Random -Maximum 256}))
    echo.
    pause
)

echo [INFO] Starting all services with Docker Compose...
echo.

docker-compose up

echo.
echo ========================================
echo   Application stopped
echo ========================================
