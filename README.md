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

The repository includes a Render Blueprint in `render.yaml` for a no-cost demo API. Open <https://dashboard.render.com/blueprints>, select this GitHub repository, and deploy the Blueprint. It starts the existing FastAPI backend at `https://nivi-hackathon-api.onrender.com`; the production dashboard is configured to use that URL. If Render assigns a different service URL, set that URL as the GitHub Actions variable `VITE_API_URL` instead.

This free demo uses SQLite and temporary file storage under `/tmp`. Render spins down idle free services, and the filesystem is erased on spin-down, restart, or redeploy; uploaded files and cases are not durable and the first request after idle can take about a minute. Use non-sensitive test evidence only.

The API currently has no authentication or authorization, and the default adapters do not perform AI analysis. This is a public demo endpoint, not a secure evidence repository. Do not upload real or sensitive forensic evidence. The mock pipeline accepts and stores uploads temporarily, then returns an explicit no-findings result; **Load Demo Case** remains the full sample investigation.

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