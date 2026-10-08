# Aira API: FastAPI + Gemini (Vertex AI) + headless Chromium for PDF export.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DATA_DIR=/data
WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && python -m playwright install --with-deps chromium \
 && chmod -R o+rx /ms-playwright

COPY app ./app

# Non-root; /data holds SQLite + cached images (mount a volume)
RUN useradd -m aira && mkdir -p /data && chown aira /data
USER aira
VOLUME ["/data"]

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
# One worker per container (in-process semaphores); scale with replicas, see README.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
