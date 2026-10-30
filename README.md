# NIVI — AI Reality Reconstructor

NIVI is an AI-assisted forensic investigation workspace for reviewing evidence, exploring timelines, and reconstructing scenes in 3D.

## GitHub Pages demo

The dashboard is published at <https://dradya.github.io/NIVI-HACKATHON/>.
Use **Load Demo Case** to explore the full built-in sample investigation. Uploading files requires the separate Python API because GitHub Pages only hosts the browser frontend.

The `main` branch automatically builds `member_1_frontend` and deploys it to GitHub Pages through `.github/workflows/pages.yml`.
The dashboard uses `member_6_backend`'s `/api/v1` case API when a backend URL is configured. Without one, it explains that uploads are unavailable instead of trying to contact `localhost` on a visitor's computer.

## Run the upload pipeline locally

Start the backend from the repository root in one PowerShell window:

```powershell
py -3.12 -m venv member_6_backend\.venv
member_6_backend\.venv\Scripts\Activate.ps1
python -m pip install -r member_6_backend\requirements.txt
python -m uvicorn member_6_backend.main:app --reload
```

In another window, start the frontend:

```powershell
cd member_1_frontend
npm ci
npm run dev
```

The local dashboard connects to `http://localhost:8000` automatically. Uploads are stored by the backend and passed through its processing pipeline. The default mock adapters deliberately produce no forensic findings or scene claims; the UI labels unscored evidence and does not invent results. The separate **Load Demo Case** button shows the complete sample experience.

## Connect a deployed backend to GitHub Pages

Deploy `member_6_backend` to a Python host with HTTPS, a PostgreSQL `DATABASE_URL`, and durable storage mounted at `/var/data`. Set `STORAGE_DIR=/var/data/evidence`, `CORS_ORIGINS=https://dradya.github.io`, and a suitable `MAX_UPLOAD_BYTES` on the API host. The backend supports hosted PostgreSQL URLs and converts them to its installed psycopg v3 driver.

Then add the deployed API origin (for example, `https://your-api.example.com`, with no `/api/v1` suffix) as the `VITE_API_URL` **Actions variable** in the GitHub repository's Settings → Secrets and variables → Actions. Rerun the Pages workflow so Vite builds the dashboard with that URL.

The API currently has no authentication or authorization, and the default adapters do not perform AI analysis. Do not expose it to the public internet with real or sensitive evidence until access controls are added. A durable database and file store are also required for evidence to survive backend restarts.

## Run the dashboard locally

```powershell
cd member_1_frontend
npm ci
npm run dev
```

## Repository layout

- `member_1_frontend/` — main React, TypeScript, Vite dashboard
- `member_2_evidence/` — evidence processing
- `member_3_timeline/` — temporal analysis
- `member_4_investigation/` — investigation engine
- `member_5_scene/` — scene reconstruction
- `member_6_backend/` — API and orchestration backend
- `member_7_3dor3js_visualization/` — interactive 3D visualization
- `sample_data/`, `mock_outputs/`, `real_outputs/`, `shared/`, `tests/` — fixtures and shared project resources