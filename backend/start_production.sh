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

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo -e "${YELLOW}Please create .env file with your configuration${NC}"
    exit 1
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
