# ReportForge MVP

A Streamlit application that turns CSV/XLSX sales data into KPIs, tables, charts,
data-quality warnings, and a downloadable Excel report.

## Run locally

```bash
python -m venv .venv
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install and run:

```bash
pip install -r requirements.txt
streamlit run app.py
```

Then upload `sample_data/sample_sales.csv`.

## Expected fields

The app lets users map their own columns to:

- Date (required)
- Customer (required)
- Product/service (required)
- Revenue (required)
- Cost (optional)

## Run tests

```bash
pytest
```

## Important production notes

- Set a stricter upload-size limit before accepting public uploads.
- Do not persist customer files unless your privacy policy explains it.
- Add authentication, rate limiting, malware scanning, and retention controls
  before handling sensitive business data.
