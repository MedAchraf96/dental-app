#!/bin/bash

echo "Checking for virtual environment..."

if [ -d ".venv" ]; then
    echo "Activating .venv..."
    source .venv/bin/activate
elif [ -d "venv" ]; then
    echo "Activating venv..."
    source venv/bin/activate
else
    echo "[ERROR] Virtual environment not found (.venv or venv)."
    echo "Please create one using: python3 -m venv .venv"
    exit 1
fi

echo "Starting Flask server in debug mode..."
flask run
