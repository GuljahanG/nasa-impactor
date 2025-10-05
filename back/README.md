# Backend Setup Guide

This backend uses Flask. Follow these steps to run the code:

## Prerequisites

- Python 3.8+
- `pip` package manager
- `venv` module for python

## Installation

1. **Navigate to the backend folder**

2. **Create and activate a virtual environment (optional but recommended):**
    
    For Linux:
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```

    For Windows:
    ```bash
    python -m venv venv
    venv\Scripts\activate
    ```

3. **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

## Running the Flask App

1. **Set the Flask app environment variable:**
    ```bash
    export FLASK_APP=app.py
    export FLASK_ENV=development
    ```

2. **Start the server:**
    ```bash
    flask run
    ```

The backend will be available at `http://127.0.0.1:5000/`.

## Troubleshooting

- Ensure all dependencies in `requirements.txt` are installed.
- Check that `app.py` exists and contains your Flask application.
