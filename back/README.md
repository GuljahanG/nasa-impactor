## 🚀 Quickstart

### Prerequisites
- Node.js 18+ and npm (or pnpm/yarn)
- Python 3.10+ and pip
- Git

### 1) Backend (Flask)
```bash
cd back
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env  # fill your keys
python app.py
# → http://localhost:5000