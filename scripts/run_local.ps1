# Open two PowerShell windows. In both, start from the project root.
# Window 1: .\.venv\Scripts\Activate.ps1; python -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000
# Window 2: cd apps\web; npm run dev -- --host 0.0.0.0
# If .env does not exist, copy it first: Copy-Item .env.example .env
