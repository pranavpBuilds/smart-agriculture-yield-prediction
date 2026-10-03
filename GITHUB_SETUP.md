# GitHub Upload Steps

```bash
git init
git add .
git commit -m "Initial commit: Smart Agriculture Crop Yield Prediction System"
git branch -M main
git remote add origin https://github.com/<your-username>/smart-agriculture-yield-prediction.git
git push -u origin main
```

## Dataset size note
`yield_df.csv` for this dataset is small (a few MB), well under GitHub's
100MB hard limit and its 50MB "are you sure" warning — so it's fine to commit
directly (do **not** add it to `.gitignore`). If you ever swap in a much
larger dataset, use [Git LFS](https://git-lfs.com/) instead:
```bash
git lfs install
git lfs track "data/raw/*.csv"
git add .gitattributes
```

## What `.gitignore` excludes
`venv/`, `__pycache__/`, `*.pyc`, `.ipynb_checkpoints/`, `.env`, `*.log` —
everything else, including the dataset and trained models, is committed so
graders can run the project without retraining if they choose to.
