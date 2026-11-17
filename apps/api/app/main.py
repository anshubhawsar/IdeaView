import json
import os
import asyncio
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)


class AnalysisRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    idea: str = Field(min_length=1, max_length=12000)


class Metric(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    direction: Literal["up", "down", "target"]
    target: str = Field(min_length=1, max_length=300)


class AnalysisResponse(BaseModel):
    summary: str
    problem: str
    features: list[str] = Field(min_length=1, max_length=20)
    metrics: list[Metric] = Field(min_length=1, max_length=20)
    assumptions: list[str] = Field(min_length=1, max_length=20)
    tests: list[str] = Field(min_length=1, max_length=20)
    references: list[dict] = Field(default_factory=list, max_length=20)


class BenchmarkRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    idea: str = Field(min_length=1, max_length=12000)
    benchmarkTypes: list[str] = Field(min_length=1, max_length=6)


class BenchmarkResponse(BaseModel):
    competitors: list[str] = Field(min_length=1, max_length=5)
    summary: str
    rows: list[dict] = Field(min_length=1, max_length=30)
    references: list[dict] = Field(default_factory=list, max_length=20)


class CopilotRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    context: dict = Field(default_factory=dict)


class CopilotResponse(BaseModel):
    answer: str


app = FastAPI(title="Praxis analysis proxy", version="0.1.0")
origins = [item.strip() for item in os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "provider": "gemini" if os.getenv("GEMINI_API_KEY") else "unconfigured"}


@app.post("/api/product-copilot", response_model=CopilotResponse)
async def product_copilot(request: CopilotRequest) -> CopilotResponse:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured on the API server.")
    context_json = json.dumps(request.context, ensure_ascii=False, separators=(",", ":"))
    prompt = f"""You are Product Copilot inside IdeaView. Answer the user's question using ONLY the supplied product workspace context.
Be concise but useful, clearly distinguish facts from hypotheses, and reference the current Canvas idea, House of Quality, Kano model, and main report when relevant.
Suggest concrete next actions or decisions when asked. Never invent customer evidence, competitor facts, measurements, or model values. If context is missing, say what is missing.
Return plain text with short paragraphs or bullets; do not return JSON.

USER QUESTION:
{request.question}

OPTIMIZED WORKSPACE CONTEXT:
{context_json}"""
    payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.25}}
    configured_model = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")
    models = list(dict.fromkeys([configured_model, "gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-3.8-flash"]))
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            provider_payload = None
            last_error = "Gemini did not return a Copilot answer."
            for model in models:
                for attempt in range(2):
                    response = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                        headers={"x-goog-api-key": api_key},
                        json=payload,
                    )
                    if not response.is_error:
                        provider_payload = response.json()
                        break
                    try:
                        provider_error = response.json().get("error", {}).get("message", "Gemini rejected the request.")
                    except (ValueError, AttributeError):
                        provider_error = "Gemini rejected the request without a readable error."
                    last_error = f"Gemini HTTP {response.status_code}: {provider_error}"
                    if response.status_code not in (400, 404, 429, 503):
                        raise HTTPException(status_code=502, detail=last_error)
                    if attempt == 0:
                        await asyncio.sleep(2)
                if provider_payload is not None:
                    break
            if provider_payload is None:
                raise HTTPException(status_code=502, detail=last_error)
    except HTTPException:
        raise
    except httpx.RequestError as error:
        raise HTTPException(status_code=502, detail="Could not reach Gemini.") from error
    try:
        answer = provider_payload["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError, AttributeError) as error:
        raise HTTPException(status_code=502, detail="Gemini returned no Copilot content.") from error
    return CopilotResponse(answer=answer)


def extract_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        cleaned = cleaned.rsplit("```", 1)[0].strip()
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail="Gemini returned invalid JSON.") from error
    if not isinstance(value, dict):
        raise HTTPException(status_code=502, detail="Gemini returned a non-object response.")
    return value


@app.post("/api/idea-analysis", response_model=AnalysisResponse)
async def analyze_idea(request: AnalysisRequest) -> AnalysisResponse:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured on the API server.")

    configured_model = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")
    if configured_model == "gemini-2.0-flash":
        configured_model = "gemini-3.1-pro-preview"
    models = list(dict.fromkeys([configured_model, "gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-3.8-flash"]))
    prompt = f"""You are a skeptical senior product-development researcher.
Analyze this idea as a comprehensive product-development report and return ONLY valid JSON matching this schema:
{{
  "summary": "string",
  "problem": "string",
  "features": ["exactly 10 distinct, testable candidate customer needs or product features"],
  "metrics": [{{"name": "exactly 10 measurable engineering metric", "direction": "up|down|target", "target": "specific proposed target or measurement plan"}}],
  "assumptions": ["exactly 8 assumptions that could invalidate the idea"],
  "tests": ["exactly 8 prioritized, useful tests grounded in past behavior or observation"],
  "references": [{{"title":"source title","url":"https://...","relevance":"claim or decision this source can verify"}}]
}}
Do not return fewer than the requested item counts. Make every item materially different and specific to this idea.
Return 3 to 8 credible references when relevant. Prefer official standards, government data, peer-reviewed research, or clearly identified industry sources. Do not invent URLs; return an empty array if no source is available.
Do not invent customer evidence. Label uncertain claims as hypotheses in the wording.
Make features specific enough to become House of Quality customer-need rows, and make metrics measurable enough to become engineering-metric columns. Explain trade-offs and uncertainty in the summary and problem fields.
Project title: {request.title}
Idea brief: {request.idea}"""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.25, "maxOutputTokens": 8192, "responseMimeType": "application/json"},
    }
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            provider_payload = None
            last_error = "Gemini did not return an analysis."
            for model in models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                for attempt in range(2):
                    response = await client.post(url, headers={"x-goog-api-key": api_key}, json=payload)
                    if not response.is_error:
                        provider_payload = response.json()
                        break
                    try:
                        provider_error = response.json().get("error", {}).get("message", "Gemini rejected the request.")
                    except (ValueError, AttributeError):
                        provider_error = "Gemini rejected the request without a readable error."
                    last_error = f"Gemini HTTP {response.status_code}: {provider_error}"
                    if response.status_code not in (400, 404, 429, 503):
                        raise HTTPException(status_code=502, detail=last_error)
                    if attempt == 0:
                        await asyncio.sleep(2)
                if provider_payload is not None:
                    break
            if provider_payload is None:
                raise HTTPException(status_code=502, detail=last_error)
    except HTTPException:
        raise
    except httpx.RequestError as error:
        raise HTTPException(status_code=502, detail="Could not reach Gemini.") from error

    try:
        text = provider_payload["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as error:
        raise HTTPException(status_code=502, detail="Gemini returned no analysis content.") from error
    return AnalysisResponse.model_validate(extract_json(text))


@app.post("/api/benchmark-analysis", response_model=BenchmarkResponse)
async def analyze_benchmark(request: BenchmarkRequest) -> BenchmarkResponse:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured on the API server.")
    prompt = f"""You are a skeptical product benchmarking researcher. Return ONLY valid JSON.
Schema: {{"competitors":["2 to 4 named or clearly labeled industry competitors"],"summary":"string","rows":[{{"criterion":"string","current":"current product assessment","competitors":[{{"name":"competitor name","value":"comparable value or unknown"}}],"gap":"evidence-based gap or unknown","opportunity":"actionable opportunity","importance":1,"metric":{{"name":"measurable engineering metric","direction":"up|down|target","target":"target or measurement plan"}}}}],"references":[{{"title":"source title","url":"https://...","relevance":"claim or comparison this source can verify"}}]}}
Benchmark only these dimensions: {", ".join(request.benchmarkTypes)}. Do not invent verified facts, prices, or specifications; label estimates as hypotheses and use unknown where needed. Make each row useful for House of Quality.
Return 3 to 8 credible references when relevant. Prefer official competitor pages, technical documentation, standards, government data, or research. Do not invent URLs; return an empty array if no source is available.
Project title: {request.title}
Current product and competitor instruction: {request.idea}"""
    payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}}
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            configured_model = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")
            models = list(dict.fromkeys([configured_model, "gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-3.8-flash"]))
            provider_payload = None
            last_error = "Gemini did not return a benchmark."
            for model in models:
                for attempt in range(2):
                    response = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                        headers={"x-goog-api-key": api_key},
                        json=payload,
                    )
                    if not response.is_error:
                        provider_payload = response.json()
                        break
                    try:
                        provider_error = response.json().get("error", {}).get("message", "Gemini rejected the request.")
                    except (ValueError, AttributeError):
                        provider_error = "Gemini rejected the request without a readable error."
                    last_error = f"Gemini HTTP {response.status_code}: {provider_error}"
                    if response.status_code not in (400, 404, 429, 503):
                        break
                    if attempt == 0:
                        await asyncio.sleep(2)
                if provider_payload is not None:
                    break
            if provider_payload is None:
                raise HTTPException(status_code=502, detail=last_error)
    except HTTPException:
        raise
    except httpx.RequestError as error:
        raise HTTPException(status_code=502, detail="Could not reach Gemini.") from error
    try:
        text = provider_payload["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as error:
        raise HTTPException(status_code=502, detail="Gemini returned no benchmark content.") from error
    return BenchmarkResponse.model_validate(extract_json(text))
