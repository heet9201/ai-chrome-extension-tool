#!/bin/bash

# LinkedIn Job Assistant - Development Setup Script
# This script sets up the development environment for both frontend and backend

echo "🚀 LinkedIn Job Assistant - Development Setup"
echo "============================================="

# Check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Setup Frontend
echo ""
print_info "Setting up Frontend (Chrome Extension)..."

if [ ! -d "node_modules" ]; then
    print_info "Installing Node.js dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        print_status "Node.js dependencies installed"
    else
        print_error "Failed to install Node.js dependencies"
        exit 1
    fi
else
    print_status "Node.js dependencies already installed"
fi

# Setup Backend
echo ""
print_info "Setting up Backend (Python Flask API)..."

cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_info "Creating Python virtual environment..."
    python3 -m venv venv
    print_status "Virtual environment created"
fi

# Activate virtual environment
print_info "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
print_info "Installing Python dependencies..."
pip install -r requirements.txt
if [ $? -eq 0 ]; then
    print_status "Python dependencies installed"
else
    print_error "Failed to install Python dependencies"
    exit 1
fi

# Create necessary directories
mkdir -p logs uploads

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from template..."
    cp .env.example .env
    print_info "Please edit backend/.env file with your configuration"
fi

cd ..

# Create icons directory if it doesn't exist
if [ ! -d "icons" ]; then
    mkdir -p icons
    print_info "Created icons directory. Please add extension icons (16x16, 32x32, 48x48, 128x128)"
fi

echo ""
print_status "Setup completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. 🔧 Configure backend/.env file with your settings:"
echo "   - OpenAI API key (optional, for enhanced AI)"
echo "   - Email credentials (for automatic sending)"
echo ""
echo "2. 🎨 Add extension icons to the icons/ directory"
echo ""
echo "3. 🚀 Start the development servers:"
echo "   Backend:  cd backend && source venv/bin/activate && python app.py"
echo "   Frontend: npm run dev (or load unpacked extension in Chrome)"
echo ""
echo "4. 🌐 Load extension in Chrome:"
echo "   - Open Chrome Extensions (chrome://extensions/)"
echo "   - Enable Developer mode"
echo "   - Click 'Load unpacked' and select this directory"
echo ""
echo "📖 Documentation:"
echo "=================="
echo "• Backend API will run on: http://localhost:5000"
echo "• Chrome extension will communicate with the backend"
echo "• Check logs/ directory for application logs"
echo ""
print_status "Happy coding! 🎉"
