"""
main.py

FastAPI backend for the Smart Agriculture Crop Yield Prediction dashboard.

Run:
    uvicorn backend.main:app --reload
Docs:
    http://127.0.0.1:8000/docs
"""
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.model_service import model_service
from backend.schemas import PredictionRequest, PredictionResponse

app = FastAPI(
    title="Smart Agriculture Crop Yield Prediction API",
    description="Backend API for data exploration, model metrics, and yield prediction.",
    version="1.0.0",
)

# CORS is open for local development only (frontend served from a different port).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # must be False when allow_origins is "*" (browser CORS spec)
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Smart Agriculture Crop Yield Prediction API is running.",
        "docs": "/docs",
        "model_loaded": model_service._loaded,
    }


@app.get("/api/summary")
def summary():
    try:
        return model_service.get_summary()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/crops")
def crops():
    try:
        return {"crops": model_service.get_crops()}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/areas")
def areas():
    try:
        return {"areas": model_service.get_areas()}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/data")
def data(
    area: Optional[str] = None,
    item: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
):
    try:
        return model_service.query_data(area, item, year_min, year_max, search, page, page_size)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/yield-trends")
def yield_trends(area: Optional[str] = None, item: Optional[str] = None):
    try:
        return {"trend": model_service.yield_trends(area, item)}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/crop-analysis")
def crop_analysis(
    area: Optional[str] = None,
    item: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
):
    try:
        return model_service.crop_analysis(area, item, year_min, year_max)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/model-metrics")
def model_metrics():
    try:
        return {
            "metrics": model_service.get_model_metrics(),
            "predictions_sample": model_service.get_predictions_sample(),
        }
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/feature-importance")
def feature_importance():
    try:
        return model_service.get_feature_importance()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/api/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest):
    try:
        predicted = model_service.predict(
            area=payload.area,
            item=payload.item,
            year=payload.year,
            rainfall=payload.average_rainfall,
            pesticides=payload.pesticides,
            temp=payload.avg_temp,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return PredictionResponse(
        predicted_yield=round(predicted, 2),
        model=model_service.best_model_name,
        input_summary=payload.model_dump(),
    )
