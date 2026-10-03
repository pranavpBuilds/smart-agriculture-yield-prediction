"""
preprocessing.py

Single source of truth for how raw input features are turned into model-ready
features. Used identically by train_models.py (training) and model_service.py
(prediction), so training and inference are guaranteed to match.
"""
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

CATEGORICAL_FEATURES = ["Area", "Item"]
NUMERICAL_FEATURES = ["Year", "average_rain_fall_mm_per_year", "pesticides_tonnes", "avg_temp"]
TARGET = "hg/ha_yield"

FEATURE_COLUMNS = CATEGORICAL_FEATURES + NUMERICAL_FEATURES

HUMAN_LABELS = {
    "hg/ha_yield": "Yield (hg/ha)",
    "average_rain_fall_mm_per_year": "Average Rainfall (mm/year)",
    "pesticides_tonnes": "Pesticides (tonnes)",
    "avg_temp": "Average Temperature (°C)",
    "Area": "Area / Country",
    "Item": "Crop",
    "Year": "Year",
}


def build_preprocessor(scale_numeric: bool) -> ColumnTransformer:
    """
    Build the ColumnTransformer for a given model type.

    scale_numeric=True  -> used for Linear Regression (numeric scaling helps
                            linear models and does not hurt correctness).
    scale_numeric=False -> used for tree-based models (Random Forest, XGBoost)
                            which do not need/benefit from feature scaling.
    Categorical columns are always one-hot encoded identically either way.
    """
    numeric_steps = [("scaler", StandardScaler())] if scale_numeric else []
    numeric_pipeline = Pipeline(numeric_steps) if numeric_steps else "passthrough"

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore"),
                CATEGORICAL_FEATURES,
            ),
            (
                "num",
                numeric_pipeline,
                NUMERICAL_FEATURES,
            ),
        ]
    )
    return preprocessor


def get_encoded_feature_names(preprocessor: ColumnTransformer) -> list:
    """Return human-readable encoded feature names after fitting, in output order."""
    cat_encoder = preprocessor.named_transformers_["cat"]
    cat_names = list(cat_encoder.get_feature_names_out(CATEGORICAL_FEATURES))
    num_names = list(NUMERICAL_FEATURES)
    return cat_names + num_names
