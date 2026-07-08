#!/bin/bash

# Manager Reports Deployment Script
# This script automates the deployment of all 41 manager reports

echo "🚀 Starting Manager Reports Deployment..."
echo ""

# Step 1: Backup current schema
echo "📦 Step 1/5: Backing up current schema..."
cp prisma/schema.prisma prisma/schema.prisma.backup
echo "✅ Schema backed up to prisma/schema.prisma.backup"
echo ""

# Step 2: Validate schema-extension.prisma exists
echo "🔍 Step 2/5: Validating schema extension..."
if [ ! -f "prisma/schema-extension.prisma" ]; then
    echo "❌ Error: schema-extension.prisma not found!"
    exit 1
fi
echo "✅ Schema extension found"
echo ""

# Step 3: Generate Prisma Client
echo "⚙️  Step 3/5: Generating Prisma Client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Error: Prisma generate failed!"
    exit 1
fi
echo "✅ Prisma Client generated"
echo ""

# Step 4: Create migration
echo "🗄️  Step 4/5: Creating database migration..."
echo "Choose migration method:"
echo "1) Create migration (recommended for production)"
echo "2) Push to database (quick, no migration files)"
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    npx prisma migrate dev --name add_manager_reports_models
    if [ $? -ne 0 ]; then
        echo "❌ Error: Migration failed!"
        echo "💡 Tip: Check for schema errors or database connection issues"
        exit 1
    fi
    echo "✅ Migration created and applied"
elif [ "$choice" = "2" ]; then
    npx prisma db push
    if [ $? -ne 0 ]; then
        echo "❌ Error: Database push failed!"
        exit 1
    fi
    echo "✅ Database schema updated"
else
    echo "❌ Invalid choice"
    exit 1
fi
echo ""

# Step 5: Validate schema
echo "✅ Step 5/5: Validating schema..."
npx prisma validate
if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Schema validation failed"
    echo "💡 Tip: Check schema-extension.prisma for errors"
else
    echo "✅ Schema validated successfully"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 What's Available:"
echo "  • 41 Manager Reports"
echo "  • 18 API Endpoints"
echo "  • 14 New Database Models"
echo ""
echo "📝 Next Steps:"
echo "  1. Test reports: npm run dev"
echo "  2. Check API: curl http://localhost:3000/api/v1/reports/transactions/sequence-session"
echo "  3. Review docs: See artifacts folder"
echo ""
echo "📚 Documentation:"
echo "  • Quick Start: quick_start.md"
echo "  • API Reference: api_reference.md"
echo "  • Full Guide: final_summary.md"
echo ""
echo "✨ Happy reporting!"
