#!/bin/bash
# start_development.sh - Start the application in development mode

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Starting LinkedIn Job Assistant in Development Mode${NC}"

# Change to backend directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}❌ Virtual environment not found!${NC}"
    echo -e "${YELLOW}Please run: python -m venv venv && source venv/bin/activate && pip install -r requirements.txt${NC}"
    exit 1
fi

# Activate virtual environment
echo -e "${YELLOW}📦 Activating virtual environment...${NC}"
source venv/bin/activate

# Check if .env file exists, create if not
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📄 .env file not found. Creating with default development values...${NC}"
    cat > .env << 'EOF'
# LinkedIn Job Assistant Backend Configuration - Development

# Development Configuration
DEBUG=True
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

# Development-specific settings
FLASK_ENV=development
FLASK_DEBUG=True

# Logging Configuration (Development)
LOG_FILE=logs/app.log
LOG_MAX_BYTES=1048576
LOG_BACKUP_COUNT=5

# Environment Info
ENV=development
APP_NAME=LinkedIn Job Assistant
APP_VERSION=1.0.0-dev
EOF
    echo -e "${GREEN}✅ .env file created with default development values${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env file and update the following:${NC}"
    echo -e "   - EMAIL_ADDRESS: Your Gmail address"
    echo -e "   - EMAIL_PASSWORD: Your Gmail App Password"
    echo -e "   - OPENAI_API_KEY: Your OpenAI API key (optional)"
    echo -e "   - GROQ_API_KEY: Your Groq API key (optional)"
    echo ""
fi

# Set development environment
export DEBUG=True

# Create necessary directories
mkdir -p logs uploads

# Install/update dependencies
echo -e "${YELLOW}📚 Installing dependencies...${NC}"
pip install -r requirements.txt

# Start with Flask development server
echo -e "${GREEN}🌟 Starting Flask development server...${NC}"
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  - Debug: True"
echo -e "  - Auto-reload: Enabled"
echo -e "  - Port: 5000"
echo ""

# Start Flask development server
exec python app.py
