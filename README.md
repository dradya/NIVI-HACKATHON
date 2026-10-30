# NIVI — AI Reality Reconstructor

NIVI is an AI-assisted forensic investigation workspace for reviewing evidence, exploring timelines, and reconstructing scenes in 3D.

## GitHub Pages demo

The dashboard is published at <https://dradya.github.io/NIVI-HACKATHON/>.
The hosted demo runs entirely in the browser using the built-in demo case. Uploading evidence requires the Python backend, which is not hosted on GitHub Pages.

The `main` branch automatically builds `member_1_frontend` and deploys it to GitHub Pages through `.github/workflows/pages.yml`.

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