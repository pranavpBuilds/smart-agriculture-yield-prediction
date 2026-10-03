"""
build_notebooks.py — one-off generator for the 5 project notebooks.
Run: python build_notebooks.py
(Not needed to run the app itself; notebooks/*.ipynb are already generated.)
"""
import nbformat as nbf
import os

os.makedirs("notebooks", exist_ok=True)


def make_nb(cells):
    nb = nbf.v4.new_notebook()
    nb["cells"] = cells
    nb["metadata"] = {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.10"},
    }
    return nb


def md(text):
    return nbf.v4.new_markdown_cell(text)


def code(text):
    return nbf.v4.new_code_cell(text)


# ---------------- Notebook 1: Data Understanding ----------------
nb1 = make_nb([
    md("# 01 - Data Understanding\nSmart Agriculture Crop Yield Prediction System\n\n"
       "Loads `data/raw/yield_df.csv` and inspects its structure, without modifying it."),
    code("import pandas as pd\n\ndf = pd.read_csv('../data/raw/yield_df.csv')\ndf.head()"),
    code("df.shape"),
    code("df.dtypes"),
    code("df.isna().sum()"),
    code("df.duplicated().sum()"),
    code("df['Area'].nunique(), df['Item'].nunique(), df['Year'].min(), df['Year'].max()"),
    code("df.describe()"),
    md("**Observations:**\n- Target variable: `hg/ha_yield`\n"
       "- Categorical features: `Area`, `Item`\n"
       "- Numerical features: `Year`, `average_rain_fall_mm_per_year`, `pesticides_tonnes`, `avg_temp`\n"
       "- `Unnamed: 0` is a redundant index column and will be dropped during preprocessing."),
])

# ---------------- Notebook 2: Preprocessing ----------------
nb2 = make_nb([
    md("# 02 - Data Preprocessing\nCleans the raw dataset and prepares train/test splits using the "
       "shared `backend.preprocessing` module (same code path used by the production pipeline)."),
    code("import sys\nsys.path.append('..')\nimport pandas as pd\n"
         "from sklearn.model_selection import train_test_split\n"
         "from backend.preprocessing import FEATURE_COLUMNS, TARGET, build_preprocessor"),
    code("df = pd.read_csv('../data/raw/yield_df.csv')\n"
         "if 'Unnamed: 0' in df.columns:\n"
         "    df = df.drop(columns=['Unnamed: 0'])\n"
         "print('Missing values:', df.isna().sum().sum())\n"
         "print('Duplicate rows:', df.duplicated().sum())"),
    code("df = df.dropna().drop_duplicates()\ndf.shape"),
    code("X = df[FEATURE_COLUMNS]\ny = df[TARGET]\n"
         "X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)\n"
         "X_train.shape, X_test.shape"),
    code("# Example: build the tree-model preprocessor (no scaling) and fit on TRAIN ONLY\n"
         "pre = build_preprocessor(scale_numeric=False)\n"
         "pre.fit(X_train)\n"
         "X_train_enc = pre.transform(X_train)\n"
         "X_train_enc.shape"),
    md("Preprocessing is fit on the training split only, then applied to the test split — this avoids "
       "data leakage. The same `ColumnTransformer` logic is reused at prediction time via the saved "
       "`Pipeline` objects, so training and inference preprocessing can never drift apart."),
])

# ---------------- Notebook 3: EDA ----------------
nb3 = make_nb([
    md("# 03 - Exploratory Data Analysis"),
    code("import sys\nsys.path.append('..')\nimport pandas as pd\nimport matplotlib.pyplot as plt\nimport seaborn as sns\n"
         "df = pd.read_csv('../data/raw/yield_df.csv').drop(columns=['Unnamed: 0'])\n"
         "sns.set_theme(style='whitegrid')"),
    md("## Yield distribution"),
    code("plt.figure(figsize=(8,4))\nsns.histplot(df['hg/ha_yield'], bins=50, color='#2f8f4e')\nplt.title('Yield Distribution (hg/ha)')\nplt.show()"),
    md("## Average yield by crop"),
    code("df.groupby('Item')['hg/ha_yield'].mean().sort_values(ascending=False)"),
    md("## Average yield by area (top 10)"),
    code("df.groupby('Area')['hg/ha_yield'].mean().sort_values(ascending=False).head(10)"),
    md("## Yield trend over years"),
    code("trend = df.groupby('Year')['hg/ha_yield'].mean()\nplt.figure(figsize=(8,4))\ntrend.plot(marker='o', color='#2f8f4e')\nplt.title('Average Yield by Year')\nplt.show()"),
    md("## Rainfall / Temperature / Pesticides vs Yield"),
    code("fig, axes = plt.subplots(1, 3, figsize=(15,4))\n"
         "sns.scatterplot(data=df.sample(1000, random_state=42), x='average_rain_fall_mm_per_year', y='hg/ha_yield', ax=axes[0], color='#2f8f4e', alpha=0.5)\n"
         "sns.scatterplot(data=df.sample(1000, random_state=42), x='avg_temp', y='hg/ha_yield', ax=axes[1], color='#b8860b', alpha=0.5)\n"
         "sns.scatterplot(data=df.sample(1000, random_state=42), x='pesticides_tonnes', y='hg/ha_yield', ax=axes[2], color='#5b6b60', alpha=0.5)\n"
         "plt.tight_layout()\nplt.show()"),
    md("## Correlation heatmap"),
    code("corr_cols = ['hg/ha_yield','average_rain_fall_mm_per_year','pesticides_tonnes','avg_temp','Year']\n"
         "plt.figure(figsize=(6,5))\nsns.heatmap(df[corr_cols].corr(), annot=True, cmap='Greens')\nplt.show()"),
    md("## Top / bottom crops and areas by average yield"),
    code("means_crop = df.groupby('Item')['hg/ha_yield'].mean().sort_values(ascending=False)\n"
         "print('Top crops:\\n', means_crop.head(3))\nprint('\\nBottom crops:\\n', means_crop.tail(3))"),
    code("means_area = df.groupby('Area')['hg/ha_yield'].mean().sort_values(ascending=False)\n"
         "print('Top areas:\\n', means_area.head(3))\nprint('\\nBottom areas:\\n', means_area.tail(3))"),
])

# ---------------- Notebook 4: Model Training ----------------
nb4 = make_nb([
    md("# 04 - Model Training\nThis mirrors `train_models.py` at the project root; run that script for the "
       "authoritative, saved artifacts used by the API. This notebook demonstrates the same steps interactively."),
    code("import sys\nsys.path.append('..')\nimport pandas as pd, numpy as np\n"
         "from sklearn.model_selection import train_test_split\n"
         "from sklearn.linear_model import LinearRegression\n"
         "from sklearn.ensemble import RandomForestRegressor\n"
         "from xgboost import XGBRegressor\n"
         "from sklearn.pipeline import Pipeline\n"
         "from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score\n"
         "from backend.preprocessing import FEATURE_COLUMNS, TARGET, build_preprocessor"),
    code("df = pd.read_csv('../data/raw/yield_df.csv').drop(columns=['Unnamed: 0']).dropna().drop_duplicates()\n"
         "X, y = df[FEATURE_COLUMNS], df[TARGET]\n"
         "X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)"),
    code("def evaluate(y_true, y_pred):\n"
         "    return {\n"
         "        'MAE': mean_absolute_error(y_true, y_pred),\n"
         "        'RMSE': float(np.sqrt(mean_squared_error(y_true, y_pred))),\n"
         "        'R2': r2_score(y_true, y_pred),\n"
         "    }"),
    code("lr = Pipeline([('pre', build_preprocessor(True)), ('model', LinearRegression())])\n"
         "lr.fit(X_train, y_train)\n"
         "evaluate(y_test, lr.predict(X_test))"),
    code("rf = Pipeline([('pre', build_preprocessor(False)), ('model', RandomForestRegressor(n_estimators=300, random_state=42, n_jobs=-1))])\n"
         "rf.fit(X_train, y_train)\n"
         "evaluate(y_test, rf.predict(X_test))"),
    code("xgb = Pipeline([('pre', build_preprocessor(False)), ('model', XGBRegressor(n_estimators=400, max_depth=8, learning_rate=0.08, random_state=42, n_jobs=-1))])\n"
         "xgb.fit(X_train, y_train)\n"
         "evaluate(y_test, xgb.predict(X_test))"),
    md("All metrics above are computed directly from the actual dataset — nothing here is hardcoded. "
       "For the artifacts actually served by the API, run `python train_models.py` from the project root."),
])

# ---------------- Notebook 5: Model Comparison ----------------
nb5 = make_nb([
    md("# 05 - Model Comparison\nReads the metrics produced by `train_models.py` (`reports/metrics.json`) "
       "and visualizes the comparison — no numbers are re-entered by hand."),
    code("import json\nimport pandas as pd\nimport matplotlib.pyplot as plt\n\n"
         "with open('../reports/metrics.json') as f:\n"
         "    report = json.load(f)\n"
         "metrics = report['metrics']\n"
         "best = report['best_model']\n"
         "print('Best model:', best)"),
    code("comparison = pd.DataFrame({m: metrics[m]['test'] for m in metrics}).T\ncomparison"),
    code("fig, axes = plt.subplots(1, 3, figsize=(14,4))\n"
         "comparison['MAE'].plot(kind='bar', ax=axes[0], color='#2f8f4e', title='MAE')\n"
         "comparison['RMSE'].plot(kind='bar', ax=axes[1], color='#4cae6a', title='RMSE')\n"
         "comparison['R2'].plot(kind='bar', ax=axes[2], color='#1f6b38', title='R2')\n"
         "plt.tight_layout()\nplt.show()"),
    md("The model with the lowest test RMSE (`" + "` / `".join(["see report['best_model']"]) + "`) is selected "
       "as the production model used by the FastAPI backend and saved as `models/<best>_pipeline.joblib`, "
       "referenced by `models/best_model.json`."),
])

notebooks = {
    "01_data_understanding.ipynb": nb1,
    "02_data_preprocessing.ipynb": nb2,
    "03_eda.ipynb": nb3,
    "04_model_training.ipynb": nb4,
    "05_model_comparison.ipynb": nb5,
}

for name, nb in notebooks.items():
    path = os.path.join("notebooks", name)
    with open(path, "w") as f:
        nbf.write(nb, f)
    print("Wrote", path)
