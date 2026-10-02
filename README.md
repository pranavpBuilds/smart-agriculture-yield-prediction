# Smart Agriculture Crop Yield Prediction System

A data analytics + machine learning web application that analyzes historical
agricultural data and predicts crop yield, built as a final-year academic project.

> ⚠️ **Dataset notice:** This repository ships with a **structurally-identical
> placeholder** `data/raw/yield_df.csv` (same 8 columns, ~28,242 rows, same
> Area/Item/Year structure) because the build environment could not reach
> kaggle.com. **Before treating any numbers here as final/citable, download the
> real dataset** from Kaggle and replace the file (see [Installation](#installation)).
> Everything else — pipeline, backend, dashboard — works identically with the real file.

---

## 1. Project Overview

The system ingests historical crop yield records (area, crop, year, rainfall,
pesticide use, temperature) and:
- Cleans and explores the data
- Trains and compares three regression models
- Serves predictions and analytics through a FastAPI backend
- Presents everything in an interactive, theme-able web dashboard
- Explicitly contextualizes results against previously published research
  using the same dataset

## 2. Problem Statement

Crop yield is influenced by climatic and agronomic factors that vary by
region and year. Manually correlating these factors is slow and error-prone.
This project builds a reproducible, data-driven pipeline to estimate yield
and surface which factors matter most, using publicly available historical data.

## 3. Objectives

1. Clean and understand the Patel/Kaggle crop yield dataset.
2. Perform exploratory data analysis (EDA) to uncover patterns.
3. Train and fairly compare Linear Regression, Random Forest, and XGBoost.
4. Serve predictions through a documented REST API.
5. Build an interactive dashboard for exploration and prediction.
6. Contextualize results against previously published research on the same dataset.

## 4. Dataset

- **Name:** Crop Yield Prediction Dataset (`yield_df.csv`)
- **Source:** https://www.kaggle.com/datasets/patelris/crop-yield-prediction-dataset
- **Records:** ~28,242 | **Areas:** ~101–103 | **Crops:** 10 | **Years:** ~1990–2013 (2003 absent)
- **Referenced research:**
  - "Forecasting Crop Yield Anomalies on Panel Data via Spatially Demeaned Ensembles", Springer, 2026 — https://link.springer.com/article/10.1007/s13253-026-00743-8
  - Scientific Reports, 2025 — https://www.nature.com/articles/s41598-025-03935-3
  - Reference implementation — https://github.com/pabodaR/crop-yield-prediction

### 4.1 Dataset Features

| Column | Type | Role |
|---|---|---|
| `Unnamed: 0` | index | dropped during preprocessing |
| `Area` | categorical | feature |
| `Item` (crop) | categorical | feature |
| `Year` | numerical | feature |
| `hg/ha_yield` | numerical | **target** |
| `average_rain_fall_mm_per_year` | numerical | feature |
| `pesticides_tonnes` | numerical | feature |
| `avg_temp` | numerical | feature |

No columns beyond these 8 are used — no soil pH, nitrogen, humidity, or sensor data.

## 5. Methodology

```
Raw Dataset → Cleaning/Preprocessing → EDA → Encoding → Train/Test Split
  → ML Models (LR / RF / XGBoost) → Evaluation → Best Model Selection
  → FastAPI Backend → Interactive Dashboard → Insights
```

- Preprocessing is **fit on the training split only** and applied to the test
  split, to avoid data leakage (`backend/preprocessing.py`).
- Categorical features (`Area`, `Item`) are one-hot encoded.
- Numerical features are scaled only for Linear Regression (tree-based models
  don't need it).
- Each model is saved as a single `sklearn.Pipeline` (preprocessing + model),
  so prediction-time preprocessing is guaranteed identical to training-time
  preprocessing.

## 6. Exploratory Data Analysis

See `notebooks/03_eda.ipynb` for the full analysis, and the **Yield Analysis**
dashboard page for interactive versions covering: yield distribution, yield by
crop/area, yield trend over years, rainfall/temperature/pesticides vs yield,
and a correlation heatmap.

## 7. Machine Learning Models

| Model | Why used |
|---|---|
| Linear Regression | Simple, interpretable baseline |
| Random Forest | Captures non-linear relationships, robust to outliers |
| XGBoost | Gradient boosting, typically strongest tabular performance |

All metrics below are **computed dynamically** by `train_models.py` from the
CSV currently in `data/raw/` — nothing is hardcoded. Run the script yourself
to regenerate `reports/metrics.json`.

## 8. Evaluation Metrics

- **MAE** (Mean Absolute Error) — average magnitude of error, same unit as yield
- **RMSE** (Root Mean Squared Error) — penalizes large errors more heavily
- **R²** (coefficient of determination) — proportion of variance explained

Best model is selected by **lowest test-set RMSE** (see `reports/metrics.json`
after training; also shown on the Model Comparison dashboard page).

## 9. System Architecture

```
smart-agriculture-yield-prediction/
├── data/raw/yield_df.csv          # dataset (placeholder — replace with real file)
├── data/processed/yield_clean.csv # cleaned dataset written by train_models.py
├── notebooks/                     # 5 analysis notebooks
├── models/                        # saved model pipelines (.joblib) + best_model.json
├── reports/                       # metrics.json, feature_importance.json, etc.
├── backend/
│   ├── main.py                    # FastAPI app + routes
│   ├── schemas.py                 # Pydantic request/response models
│   ├── preprocessing.py           # shared preprocessing pipeline builder
│   └── model_service.py           # loads models/data, serves predictions & analytics
├── frontend/
│   ├── index.html
│   ├── style.css                  # light + dark theme via CSS variables
│   └── script.js                  # fetch() calls to backend, Plotly charts
├── train_models.py                # end-to-end training script
├── generate_placeholder_dataset.py# only needed if data/raw/yield_df.csv is missing
├── build_notebooks.py             # regenerates notebooks/*.ipynb
├── requirements.txt
└── README.md
```

## 10. Dashboard Features

- **Overview** — dynamic KPIs, yield-by-crop chart, yield trend, distribution, auto-generated insight text
- **Data Explorer** — searchable/filterable data table with live stats
- **Yield Analysis** — filterable charts: yield by crop/area, trend, rainfall/temp/pesticides vs yield, correlation heatmap
- **Prediction** — form-based prediction using the same pipeline trained on the data, no fake confidence scores
- **Model Comparison** — dynamic MAE/RMSE/R² table, actual-vs-predicted scatter, residual histogram
- **Feature Importance** — tree-based model importances with correctly labeled encoded categorical features
- **Research Benchmark** — published research vs our implementation, explicitly marking non-comparable results
- **Insights** — correlational (not causal) observations derived from actual computed statistics
- **Light / Dark theme toggle** (persisted via `localStorage`)

## 11. API

FastAPI backend, interactive docs at `/docs`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/summary` | KPI summary |
| GET | `/api/crops` | list of crops |
| GET | `/api/areas` | list of areas |
| GET | `/api/data` | filterable/paginated data table |
| GET | `/api/yield-trends` | yield trend over years (optional area/item filters) |
| GET | `/api/crop-analysis` | EDA aggregates (by crop/area, correlations, distributions) |
| GET | `/api/model-metrics` | model metrics + actual-vs-predicted sample |
| GET | `/api/feature-importance` | tree-model feature importances |
| POST | `/api/predict` | yield prediction |

`POST /api/predict` request/response:
```json
// request
{ "area": "India", "item": "Maize", "year": 2012,
  "average_rainfall": 1000, "pesticides": 500, "avg_temp": 20 }

// response
{ "predicted_yield": 63612.09, "unit": "hg/ha", "model": "XGBoost",
  "input_summary": { ... } }
```

## 12. Installation

**Windows:**
```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
**macOS/Linux:**
```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Replace the placeholder dataset with the real one:**
1. Download `yield_df.csv` from https://www.kaggle.com/datasets/patelris/crop-yield-prediction-dataset
2. Overwrite `data/raw/yield_df.csv` with it.

## 13. How to Run

```bash
# 1. Train models (writes models/*.joblib and reports/*.json)
python train_models.py

# 2. Start the backend
uvicorn backend.main:app --reload
# -> API:  http://127.0.0.1:8000
# -> Docs: http://127.0.0.1:8000/docs

# 3. In a second terminal, serve the frontend
cd frontend
python -m http.server 8080
# -> Dashboard: http://127.0.0.1:8080
```

Open `http://127.0.0.1:8080` in a browser. The dashboard calls the API at
`http://127.0.0.1:8000` (edit `API_BASE` in `frontend/script.js` if you change ports).

## 14. Project Structure

See [System Architecture](#9-system-architecture) above.

## 15. Research Benchmark

See the **Research Benchmark** dashboard page and `README` §4 for full detail.
In short: this project uses the same dataset as the cited papers, but trains
its own models with its own preprocessing/validation, so raw metric values
are **not directly comparable** to the published papers' numbers unless
methodology is verified to match. The dashboard never fabricates published
numbers — anything not independently verifiable is labeled "Not directly comparable."

## 16. Limitations

- Dataset is historical and aggregated at the country/crop/year level — not
  farm-level or real-time.
- No IoT sensors, live weather feeds, or satellite/remote-sensing data are used.
- Predictions reflect statistical patterns in historical data, not guaranteed
  real-world outcomes.
- Placeholder dataset in this build must be replaced with the real Kaggle CSV
  before results are meaningful for a report or viva.

## 17. Future Scope

- IoT soil sensors, live weather APIs, satellite/remote-sensing data
- Regional (e.g. India-specific) datasets and more recent years
- Mobile application, cloud deployment
- Additional crops, uncertainty estimation, explainable AI (SHAP, etc.)

## 18. References

1. Patel, R. — Crop Yield Prediction Dataset, Kaggle.
2. "Forecasting Crop Yield Anomalies on Panel Data via Spatially Demeaned Ensembles", Springer, 2026.
3. Scientific Reports, 2025 article on the same dataset.
4. https://github.com/pabodaR/crop-yield-prediction (reference implementation).

---
See also: `TESTING_CHECKLIST.md`, `GITHUB_SETUP.md`, `VIVA_QUESTIONS.md`.
