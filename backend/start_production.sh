#!/bin/bash
# start_production.sh - Start the application with Gunicorn in production mode

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting LinkedIn Job Assistant in Production Mode${NC}"

# Change to backend directory
cd "$(dirname "$0")"

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Virtual environment not found. Creating...${NC}"
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to create virtual environment!${NC}"
        echo -e "${YELLOW}Please ensure Python 3 is installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Virtual environment created successfully${NC}"
fi

# Activate virtual environment
echo -e "${YELLOW}📦 Activating virtual environment...${NC}"
source venv/bin/activate

# Check if .env file exists, create if not
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📄 .env file not found. Creating with default production values...${NC}"
    cat > .env << 'EOF'
# LinkedIn Job Assistant Backend Configuration - Production

# Production Configuration
DEBUG=False
PORT=5000

# OpenAI API Configuration (Optional - for enhanced AI analysis)
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# Groq API Configuration (Optional - alternative to OpenAI)
# Get your API key from: https://console.groq.com/keys
GROQ_API_KEY=your_groq_api_key_here

# Email Configuration (Required for automatic email sending)
# For Gmail, you need to:
# 1. Enable 2-factor authentication
# 2. Generate an App Password: https://myaccount.google.com/apppasswords
# 3. Use the App Password (not your regular password)
EMAIL_ADDRESS=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password_here
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587

# Gunicorn Configuration (Production)
GUNICORN_WORKERS=2
GUNICORN_ACCESS_LOG=logs/access.log
GUNICORN_ERROR_LOG=logs/error.log
GUNICORN_LOG_LEVEL=info
GUNICORN_RELOAD=False

# Logging Configuration
LOG_FILE=logs/app.log
LOG_MAX_BYTES=10485760
LOG_BACKUP_COUNT=10

# Security Configuration (Optional)
# SECRET_KEY=your-secret-key-here
# CORS_ORIGINS=chrome-extension://*

# Database Configuration (Future use)
# DATABASE_URL=sqlite:///app.db

# Environment Info
ENV=production
APP_NAME=LinkedIn Job Assistant
APP_VERSION=1.0.0
EOF
    echo -e "${GREEN}✅ .env file created with default values${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env file and update the following:${NC}"
    echo -e "   - EMAIL_ADDRESS: Your Gmail address"
    echo -e "   - EMAIL_PASSWORD: Your Gmail App Password"
    echo -e "   - OPENAI_API_KEY: Your OpenAI API key (optional)"
    echo -e "   - GROQ_API_KEY: Your Groq API key (optional)"
    echo ""
    echo -e "${YELLOW}The application will start with default values, but email and AI features may not work without proper configuration.${NC}"
    echo ""
fi

# Set production environment
export DEBUG=False

# Create necessary directories
mkdir -p logs uploads

# Install/update dependencies
echo -e "${YELLOW}📚 Installing dependencies...${NC}"
pip install -r requirements.txt

# Start with Gunicorn
echo -e "${GREEN}🌟 Starting Gunicorn server...${NC}"
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  - Config file: gunicorn.conf.py"
echo -e "  - Workers: 2"
echo -e "  - Port: 5000 (from .env)"
echo -e "  - Debug: False"
echo -e "  - Access log: logs/access.log"
echo -e "  - Error log: logs/error.log"
echo ""

# Start Gunicorn with configuration file
exec gunicorn -c gunicorn.conf.py app:app
