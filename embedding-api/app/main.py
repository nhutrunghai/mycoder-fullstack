from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer


DEFAULT_MODEL_ID = "dangvantuan/vietnamese-document-embedding"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MODEL_DIR = os.path.join(BASE_DIR, ".models", "dangvantuan__vietnamese-document-embedding")


def configure_env() -> str:
    model_dir = os.environ.get("MODEL_DIR", DEFAULT_MODEL_DIR)
    hf_home = os.environ.get("HF_HOME", os.path.join(BASE_DIR, ".cache", "huggingface"))
    hf_modules_cache = os.environ.get("HF_MODULES_CACHE", os.path.join(BASE_DIR, ".cache", "hf_modules"))
    torch_home = os.environ.get("TORCH_HOME", os.path.join(BASE_DIR, ".cache", "torch"))
    temp_dir = os.environ.get("TEMP", os.path.join(BASE_DIR, ".local_tmp"))

    os.environ.setdefault("HF_HOME", hf_home)
    os.environ.setdefault("HUGGINGFACE_HUB_CACHE", os.path.join(hf_home, "hub"))
    os.environ.setdefault("TRANSFORMERS_CACHE", os.path.join(hf_home, "transformers"))
    os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", os.path.join(hf_home, "sentence_transformers"))
    os.environ.setdefault("HF_MODULES_CACHE", hf_modules_cache)
    os.environ.setdefault("TORCH_HOME", torch_home)
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    os.environ.setdefault("TEMP", temp_dir)
    os.environ.setdefault("TMP", temp_dir)

    for path in [hf_home, hf_modules_cache, torch_home, temp_dir]:
        os.makedirs(path, exist_ok=True)

    return model_dir


MODEL_DIR = configure_env()
state: dict[str, Any] = {}


class EmbeddingRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1)


class EmbeddingResponse(BaseModel):
    model: str
    dimensions: int
    embeddings: list[list[float]]


def load_model() -> SentenceTransformer:
    if os.path.isdir(MODEL_DIR):
        local_files_only = os.environ.get("LOCAL_FILES_ONLY", "1").lower() not in {"0", "false", "no"}
        return SentenceTransformer(MODEL_DIR, trust_remote_code=True, local_files_only=local_files_only)

    local_files_only = os.environ.get("LOCAL_FILES_ONLY", "1").lower() not in {"0", "false", "no"}
    if not local_files_only:
        return SentenceTransformer(DEFAULT_MODEL_ID, trust_remote_code=True)

    raise RuntimeError(f"Model directory not found: {MODEL_DIR}")


@asynccontextmanager
async def lifespan(_: FastAPI):
    state["model"] = load_model()
    yield


app = FastAPI(title="JobGo Embedding API", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "model_dir": MODEL_DIR}


@app.post("/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(payload: EmbeddingRequest) -> EmbeddingResponse:
    model = state.get("model")
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")

    texts = [text.strip() for text in payload.texts if text and text.strip()]
    if not texts:
        raise HTTPException(status_code=400, detail="texts must contain at least one non-empty string")

    vectors = model.encode(texts)
    embeddings = [vector.tolist() for vector in vectors]
    return EmbeddingResponse(
        model=DEFAULT_MODEL_ID,
        dimensions=len(embeddings[0]),
        embeddings=embeddings
    )
