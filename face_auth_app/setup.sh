#!/bin/bash

# Face Recognition Authentication App - Setup Script

echo "🚀 Setting up Face Recognition Authentication App..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Set up environment variables
if [ ! -f ".env" ]; then
    echo "⚙️ Setting up environment variables..."
    cp .env.example .env
    echo "✏️ Please edit .env file with your configuration"
fi

# Create directories
echo "📁 Creating required directories..."
mkdir -p chroma_db
mkdir -p media
mkdir -p static

# Database setup
echo "🗄️ Setting up database..."
python manage.py makemigrations
python manage.py migrate

# Create superuser (optional)
echo "👤 Create superuser? (y/n)"
read -r create_superuser
if [ "$create_superuser" = "y" ]; then
    python manage.py createsuperuser
fi

# Collect static files
echo "📦 Collecting static files..."
python manage.py collectstatic --noinput

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Start Redis: brew services start redis (macOS) or sudo systemctl start redis (Linux)"
echo "2. Edit .env file with your settings"
echo "3. Run the server: python manage.py runserver"
echo "4. Access demo: http://localhost:8000/demo/"
echo ""
echo "📚 See README.md for more information"