"""
train_models.py

Runs the full ML pipeline described in the project spec:
  1. Load data/raw/yield_df.csv
  2. Clean (drop Unnamed: 0, verify no missing/duplicate values)
  3. Split into train/test
  4. Fit preprocessing on TRAIN ONLY, transform test with the same fitted transformer
  5. Train Linear Regression, Random Forest, XGBoost
  6. Evaluate with MAE / RMSE / R2 (computed, never hardcoded)
  7. Save each full pipeline (preprocessing + model) with joblib
  8. Save metrics.json and feature_importance.json for the backend/dashboard to read

Run:
    python train_models.py
"""
import json
import os
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from xgboost import XGBRegressor

from backend.preprocessing import (
    FEATURE_COLUMNS,
    TARGET,
    build_preprocessor,
    get_encoded_feature_names,
)

DATA_PATH = "data/raw/yield_df.csv"
MODELS_DIR = "models"
REPORTS_DIR = "reports"
RANDOM_STATE = 42

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)


def load_and_clean(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)

    if "Unnamed: 0" in df.columns:
        df = df.drop(columns=["Unnamed: 0"])

    missing = int(df.isna().sum().sum())
    duplicates = int(df.duplicated().sum())

    report = {
        "rows_loaded": int(len(df)),
        "missing_values_found": missing,
        "duplicate_rows_found": duplicates,
        "action_taken": "none required" if (missing == 0 and duplicates == 0)
        else "rows with missing values dropped / duplicates removed",
    }

    if missing > 0:
        df = df.dropna()
    if duplicates > 0:
        df = df.drop_duplicates()

    with open(os.path.join(REPORTS_DIR, "data_quality_report.json"), "w") as f:
        json.dump(report, f, indent=2)

    print("Data quality report:", report)
    return df


def evaluate(y_true, y_pred) -> dict:
    mae = mean_absolute_error(y_true, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = r2_score(y_true, y_pred)
    return {"MAE": round(float(mae), 4), "RMSE": round(rmse, 4), "R2": round(float(r2), 6)}


def main():
    df = load_and_clean(DATA_PATH)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )

    dataset_summary = {
        "total_records": int(len(df)),
        "num_areas": int(df["Area"].nunique()),
        "num_crops": int(df["Item"].nunique()),
        "year_min": int(df["Year"].min()),
        "year_max": int(df["Year"].max()),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
    }
    with open(os.path.join(REPORTS_DIR, "dataset_summary.json"), "w") as f:
        json.dump(dataset_summary, f, indent=2)

    model_specs = {
        "Linear Regression": {
            "scale_numeric": True,
            "estimator": LinearRegression(),
        },
        "Random Forest": {
            "scale_numeric": False,
            # max_depth/min_samples_leaf capped to keep the pickled model a
            # reasonable size for GitHub while still generalizing well; an
            # unbounded RandomForest on this many one-hot columns produces a
            # multi-hundred-MB file for no real accuracy gain.
            "estimator": RandomForestRegressor(
                n_estimators=150, max_depth=24, min_samples_leaf=1,
                random_state=RANDOM_STATE, n_jobs=-1
            ),
        },
        "XGBoost": {
            "scale_numeric": False,
            "estimator": XGBRegressor(
                n_estimators=400,
                max_depth=8,
                learning_rate=0.08,
                subsample=0.9,
                colsample_bytree=0.9,
                random_state=RANDOM_STATE,
                n_jobs=-1,
            ),
        },
    }

    all_metrics = {}
    feature_importance = {}
    predictions_for_plot = {}

    for name, spec in model_specs.items():
        print(f"\nTraining {name} ...")
        t0 = time.time()

        preprocessor = build_preprocessor(scale_numeric=spec["scale_numeric"])
        pipeline = Pipeline(steps=[("preprocessor", preprocessor), ("model", spec["estimator"])])
        pipeline.fit(X_train, y_train)

        y_pred_test = pipeline.predict(X_test)
        y_pred_train = pipeline.predict(X_train)

        test_metrics = evaluate(y_test, y_pred_test)
        train_metrics = evaluate(y_train, y_pred_train)
        all_metrics[name] = {"train": train_metrics, "test": test_metrics}

        elapsed = round(time.time() - t0, 2)
        print(f"  {name} test metrics: {test_metrics}  ({elapsed}s)")

        # Feature importance for tree-based models
        fitted_pre = pipeline.named_steps["preprocessor"]
        if hasattr(pipeline.named_steps["model"], "feature_importances_"):
            names = get_encoded_feature_names(fitted_pre)
            importances = pipeline.named_steps["model"].feature_importances_
            pairs = sorted(zip(names, importances.tolist()), key=lambda x: x[1], reverse=True)
            feature_importance[name] = [{"feature": n, "importance": round(v, 6)} for n, v in pairs[:20]]

        # Sample of actual vs predicted for plotting (cap at 300 points)
        sample_n = min(300, len(y_test))
        idx = np.random.RandomState(RANDOM_STATE).choice(len(y_test), sample_n, replace=False)
        predictions_for_plot[name] = {
            "actual": [round(v, 2) for v in np.array(y_test)[idx].tolist()],
            "predicted": [round(v, 2) for v in np.array(y_pred_test)[idx].tolist()],
        }

        model_filename = os.path.join(MODELS_DIR, f"{name.lower().replace(' ', '_')}_pipeline.joblib")
        joblib.dump(pipeline, model_filename, compress=3)
        print(f"  Saved -> {model_filename}")

    # Select best model by lowest test RMSE
    best_model_name = min(all_metrics, key=lambda m: all_metrics[m]["test"]["RMSE"])
    print(f"\nBest model (lowest test RMSE): {best_model_name}")

    with open(os.path.join(REPORTS_DIR, "metrics.json"), "w") as f:
        json.dump(
            {
                "metrics": all_metrics,
                "best_model": best_model_name,
                "selection_criterion": "Lowest RMSE on held-out test set (20% split, random_state=42)",
            },
            f,
            indent=2,
        )

    with open(os.path.join(REPORTS_DIR, "feature_importance.json"), "w") as f:
        json.dump(feature_importance, f, indent=2)

    with open(os.path.join(REPORTS_DIR, "predictions_sample.json"), "w") as f:
        json.dump(predictions_for_plot, f, indent=2)

    # Record which model file is "best" so the backend can load it by default
    with open(os.path.join(MODELS_DIR, "best_model.json"), "w") as f:
        json.dump({
            "best_model_name": best_model_name,
            "file": f"{best_model_name.lower().replace(' ', '_')}_pipeline.joblib",
        }, f, indent=2)

    # Save distinct dropdown values for the frontend
    with open(os.path.join(REPORTS_DIR, "dropdown_options.json"), "w") as f:
        json.dump({
            "areas": sorted(df["Area"].unique().tolist()),
            "items": sorted(df["Item"].unique().tolist()),
            "year_min": int(df["Year"].min()),
            "year_max": int(df["Year"].max()),
        }, f, indent=2)

    df.to_csv(os.path.join("data", "processed", "yield_clean.csv"), index=False)

    print("\nAll models trained and saved. Metrics written to reports/metrics.json")


if __name__ == "__main__":
    main()
