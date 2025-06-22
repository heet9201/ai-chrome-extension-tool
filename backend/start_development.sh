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
