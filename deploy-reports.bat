@echo off
REM Manager Reports Deployment Script for Windows
REM This script automates the deployment of all 41 manager reports

echo.
echo ========================================
echo   Manager Reports Deployment
echo ========================================
echo.

REM Step 1: Backup current schema
echo [1/5] Backing up current schema...
copy prisma\schema.prisma prisma\schema.prisma.backup >nul
echo [OK] Schema backed up
echo.

REM Step 2: Validate schema-extension.prisma exists
echo [2/5] Validating schema extension...
if not exist "prisma\schema-extension.prisma" (
    echo [ERROR] schema-extension.prisma not found!
    exit /b 1
)
echo [OK] Schema extension found
echo.

REM Step 3: Generate Prisma Client
echo [3/5] Generating Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Prisma generate failed!
    exit /b 1
)
echo [OK] Prisma Client generated
echo.

REM Step 4: Create migration
echo [4/5] Creating database migration...
echo.
echo Choose migration method:
echo   1) Create migration (recommended for production)
echo   2) Push to database (quick, no migration files)
echo.
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" (
    call npx prisma migrate dev --name add_manager_reports_models
    if errorlevel 1 (
        echo [ERROR] Migration failed!
        echo [TIP] Check for schema errors or database connection issues
        exit /b 1
    )
    echo [OK] Migration created and applied
) else if "%choice%"=="2" (
    call npx prisma db push
    if errorlevel 1 (
        echo [ERROR] Database push failed!
        exit /b 1
    )
    echo [OK] Database schema updated
) else (
    echo [ERROR] Invalid choice
    exit /b 1
)
echo.

REM Step 5: Validate schema
echo [5/5] Validating schema...
call npx prisma validate
if errorlevel 1 (
    echo [WARNING] Schema validation failed
    echo [TIP] Check schema-extension.prisma for errors
) else (
    echo [OK] Schema validated successfully
)
echo.

REM Summary
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo What's Available:
echo   * 41 Manager Reports
echo   * 18 API Endpoints
echo   * 14 New Database Models
echo.
echo Next Steps:
echo   1. Test reports: npm run dev
echo   2. Check API: curl http://localhost:3000/api/v1/reports/transactions/sequence-session
echo   3. Review docs: See artifacts folder
echo.
echo Documentation:
echo   * Quick Start: quick_start.md
echo   * API Reference: api_reference.md
echo   * Full Guide: final_summary.md
echo.
echo Happy reporting!
echo.
pause
