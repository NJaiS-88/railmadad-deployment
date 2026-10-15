@echo off
REM ==============================================================================
REM RailMadad Automated Production Deployment Script (Windows)
REM ==============================================================================
echo ==================================================================
echo   Starting RailMadad Deployment (Windows)
echo ==================================================================

IF NOT EXIST ".env" (
    IF EXIST ".env.example" (
        echo [INFO] No .env found. Copying from .env.example...
        copy .env.example .env
        echo [WARN] Please update .env with your real credentials!
    )
)

where docker >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo [INFO] Docker detected. Launching Docker Compose stack...
    docker compose up -d --build
    echo ==================================================================
    echo [SUCCESS] Docker deployment complete!
    echo   Gateway:           http://localhost
    echo   Passenger Portal:  http://localhost:5173
    echo   Officer Dashboard: http://localhost:5174
    echo   Staff Portal:      http://localhost:5175
    echo   Backend API:       http://localhost:5000/api
    echo   ML Service:        http://localhost:8000
    echo ==================================================================
    exit /b 0
)

echo [WARN] Docker not detected. Building frontends locally...
call npm --prefix rail-madad-frontend\frontend-passenger run build
call npm --prefix rail-madad-frontend\frontend-officer run build
call npm --prefix rail-madad-frontend\frontend-staff run build

where pm2 >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo [INFO] Starting PM2 process manager...
    pm2 start ecosystem.config.js
    pm2 status
) ELSE (
    echo [INFO] PM2 not installed. You can run 'npm run start:backend' and Python services manually.
)

echo ==================================================================
echo   Deployment script finished.
echo ==================================================================
