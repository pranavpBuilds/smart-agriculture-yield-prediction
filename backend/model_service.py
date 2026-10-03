"""
model_service.py

Loads the trained model pipelines, the cleaned dataset, and pre-computed
reports (metrics, feature importance, dataset summary) once at startup, and
exposes helper functions used by backend/main.py's API endpoints.

Using the SAME pipeline object (preprocessor + model) that was saved during
training guarantees prediction-time preprocessing exactly matches training-time
preprocessing - there is no separate/manual preprocessing step for inference.
"""
import json
import os

import joblib
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
PROCESSED_DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "yield_clean.csv")

from backend.preprocessing import HUMAN_LABELS  # noqa: E402


class ModelService:
    def __init__(self):
        self.df = None
        self.best_model_name = None
        self.best_pipeline = None
        self.metrics = None
        self.feature_importance = None
        self.dropdown_options = None
        self.dataset_summary = None
        self.predictions_sample = None
        self._loaded = False
        self._load_error = None
        self._load()

    def _load(self):
        try:
            if not os.path.exists(PROCESSED_DATA_PATH):
                raise FileNotFoundError(
                    f"Processed dataset not found at {PROCESSED_DATA_PATH}. "
                    "Run `python train_models.py` first."
                )
            self.df = pd.read_csv(PROCESSED_DATA_PATH)

            best_model_meta_path = os.path.join(MODELS_DIR, "best_model.json")
            if not os.path.exists(best_model_meta_path):
                raise FileNotFoundError(
                    f"{best_model_meta_path} not found. Run `python train_models.py` first."
                )
            with open(best_model_meta_path) as f:
                best_meta = json.load(f)
            self.best_model_name = best_meta["best_model_name"]

            model_path = os.path.join(MODELS_DIR, best_meta["file"])
            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model file missing: {model_path}")
            self.best_pipeline = joblib.load(model_path)

            with open(os.path.join(REPORTS_DIR, "metrics.json")) as f:
                self.metrics = json.load(f)
            with open(os.path.join(REPORTS_DIR, "feature_importance.json")) as f:
                self.feature_importance = json.load(f)
            with open(os.path.join(REPORTS_DIR, "dropdown_options.json")) as f:
                self.dropdown_options = json.load(f)
            with open(os.path.join(REPORTS_DIR, "dataset_summary.json")) as f:
                self.dataset_summary = json.load(f)
            with open(os.path.join(REPORTS_DIR, "predictions_sample.json")) as f:
                self.predictions_sample = json.load(f)

            self._loaded = True
        except Exception as e:
            self._load_error = str(e)
            self._loaded = False

    def ensure_loaded(self):
        if not self._loaded:
            raise RuntimeError(
                self._load_error or "Model service failed to load. Run train_models.py first."
            )

    # ---------- Prediction ----------
    def predict(self, area: str, item: str, year: int, rainfall: float, pesticides: float, temp: float):
        self.ensure_loaded()

        if area not in self.dropdown_options["areas"]:
            raise ValueError(f"Unknown area '{area}'. It was not present in the training data.")
        if item not in self.dropdown_options["items"]:
            raise ValueError(f"Unknown crop '{item}'. It was not present in the training data.")

        input_df = pd.DataFrame([{
            "Area": area,
            "Item": item,
            "Year": year,
            "average_rain_fall_mm_per_year": rainfall,
            "pesticides_tonnes": pesticides,
            "avg_temp": temp,
        }])
        pred = self.best_pipeline.predict(input_df)[0]
        return float(pred)

    # ---------- Summary / KPIs ----------
    def get_summary(self):
        self.ensure_loaded()
        df = self.df
        best_crop = df.groupby("Item")["hg/ha_yield"].mean().idxmax()
        return {
            "total_records": int(len(df)),
            "num_areas": int(df["Area"].nunique()),
            "num_crops": int(df["Item"].nunique()),
            "year_min": int(df["Year"].min()),
            "year_max": int(df["Year"].max()),
            "average_yield": round(float(df["hg/ha_yield"].mean()), 2),
            "best_performing_crop": best_crop,
        }

    def get_crops(self):
        self.ensure_loaded()
        return self.dropdown_options["items"]

    def get_areas(self):
        self.ensure_loaded()
        return self.dropdown_options["areas"]

    # ---------- Data explorer ----------
    def query_data(self, area=None, item=None, year_min=None, year_max=None, search=None, page=1, page_size=25):
        self.ensure_loaded()
        df = self.df
        if area:
            df = df[df["Area"] == area]
        if item:
            df = df[df["Item"] == item]
        if year_min is not None:
            df = df[df["Year"] >= year_min]
        if year_max is not None:
            df = df[df["Year"] <= year_max]
        if search:
            s = search.lower()
            df = df[df["Area"].str.lower().str.contains(s) | df["Item"].str.lower().str.contains(s)]

        total = len(df)
        start = (page - 1) * page_size
        end = start + page_size
        page_df = df.iloc[start:end]

        stats = {
            "filtered_records": int(total),
            "avg_yield": round(float(df["hg/ha_yield"].mean()), 2) if total else None,
            "avg_rainfall": round(float(df["average_rain_fall_mm_per_year"].mean()), 2) if total else None,
            "avg_temp": round(float(df["avg_temp"].mean()), 2) if total else None,
        }
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "records": page_df.to_dict(orient="records"),
            "stats": stats,
        }

    # ---------- Yield analysis / EDA ----------
    def yield_trends(self, area=None, item=None):
        self.ensure_loaded()
        df = self.df
        if area:
            df = df[df["Area"] == area]
        if item:
            df = df[df["Item"] == item]
        trend = df.groupby("Year")["hg/ha_yield"].mean().reset_index()
        return trend.sort_values("Year").to_dict(orient="records")

    def crop_analysis(self, area=None, item=None, year_min=None, year_max=None):
        self.ensure_loaded()
        df = self.df
        if area:
            df = df[df["Area"] == area]
        if item:
            df = df[df["Item"] == item]
        if year_min is not None:
            df = df[df["Year"] >= year_min]
        if year_max is not None:
            df = df[df["Year"] <= year_max]

        by_crop = df.groupby("Item")["hg/ha_yield"].mean().sort_values(ascending=False).reset_index()
        by_area = df.groupby("Area")["hg/ha_yield"].mean().sort_values(ascending=False).reset_index()

        def corr_points(col):
            sample = df[[col, "hg/ha_yield"]].dropna()
            if len(sample) > 500:
                sample = sample.sample(500, random_state=42)
            return sample.rename(columns={col: "x", "hg/ha_yield": "y"}).to_dict(orient="records")

        return {
            "yield_by_crop": by_crop.to_dict(orient="records"),
            "yield_by_area": by_area.head(20).to_dict(orient="records"),
            "yield_distribution": df["hg/ha_yield"].round(0).tolist()[:2000],
            "rainfall_vs_yield": corr_points("average_rain_fall_mm_per_year"),
            "temp_vs_yield": corr_points("avg_temp"),
            "pesticides_vs_yield": corr_points("pesticides_tonnes"),
            "correlation_matrix": self._correlation_matrix(df),
            "top_crops": by_crop.head(5).to_dict(orient="records"),
            "bottom_crops": by_crop.tail(5).to_dict(orient="records"),
            "top_areas": by_area.head(5).to_dict(orient="records"),
            "bottom_areas": by_area.tail(5).to_dict(orient="records"),
        }

    def _correlation_matrix(self, df):
        cols = ["hg/ha_yield", "average_rain_fall_mm_per_year", "pesticides_tonnes", "avg_temp", "Year"]
        corr = df[cols].corr().round(3)
        labels = [HUMAN_LABELS.get(c, c) for c in cols]
        return {"labels": labels, "matrix": corr.values.tolist()}

    # ---------- Model metrics / importance ----------
    def get_model_metrics(self):
        self.ensure_loaded()
        return self.metrics

    def get_feature_importance(self):
        self.ensure_loaded()
        return self.feature_importance

    def get_predictions_sample(self):
        self.ensure_loaded()
        return self.predictions_sample


model_service = ModelService()
