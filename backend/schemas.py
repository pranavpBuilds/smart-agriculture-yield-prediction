from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class PredictionRequest(BaseModel):
    area: str = Field(..., description="Area / country name, must exist in training data")
    item: str = Field(..., description="Crop name, must exist in training data")
    year: int = Field(..., ge=1900, le=2100)
    average_rainfall: float = Field(..., ge=0, description="mm per year")
    pesticides: float = Field(..., ge=0, description="tonnes")
    avg_temp: float = Field(..., ge=-30, le=60, description="degrees Celsius")

    @field_validator("area", "item")
    @classmethod
    def not_blank(cls, v):
        if not v or not v.strip():
            raise ValueError("must not be blank")
        return v.strip()


class PredictionResponse(BaseModel):
    predicted_yield: float
    unit: str = "hg/ha"
    model: str
    input_summary: dict


class ErrorResponse(BaseModel):
    detail: str


class DataQueryParams(BaseModel):
    area: Optional[str] = None
    item: Optional[str] = None
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    search: Optional[str] = None
    page: int = 1
    page_size: int = 25
