# AppBrechó AI backend (Python)

FastAPI service the app calls when you tap the search button. For each photo it:

1. asks an OpenRouter vision model to identify the piece (type, brand, colors, material, era...),
2. crawls DuckDuckGo/Bing results on Enjoei, Repassa, Mercado Livre and OLX for similar listings and reads their prices,
3. asks OpenRouter again to write the final report (description, brechó price range, care tips) using those listings.

`POST /barcode` handles barcodes and QR codes for any product: it checks Open Food Facts and UPCitemdb (or opens the link in a QR code), searches stores for the product, then asks OpenRouter to summarise it. A photo taken at the same moment is sent along to help when the code is unknown.

## Run

One command (Windows, Mac or Linux):

```bash
python backend/run.py
```

The first time it creates `.venv`, installs the requirements, creates `backend/app_secrets.py` (asking for your OpenRouter key; press Enter for demo mode) and writes this computer's LAN IP into the app's `.env` as `EXPO_PUBLIC_API_URL`. After that it just starts the server.

Manual alternative:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp app_secrets.example.py app_secrets.py   # put your OPENROUTER_API_KEY in app_secrets.py
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

`DEMO_MODE = True` in `app_secrets.py` returns a sample result without calling OpenRouter, handy for testing the UI.

`app_secrets.py` is git-ignored, so the key never reaches GitHub. Environment variables with the same names override it.

Tests: `pytest -q`
