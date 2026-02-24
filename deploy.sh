#!/usr/bin/env bash
# deploy.sh — Build and deploy dgvcl_go to Google Cloud Run
# Usage: ./deploy.sh [--project PROJECT_ID] [--region REGION] [--service SERVICE_NAME]
set -euo pipefail

# ── Default configuration ────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT:-}"          # override via env or --project flag
REGION="${GCP_REGION:-asia-south1}"    # Mumbai — closest to Gujarat
SERVICE="${GCP_SERVICE:-daily-go}"
IMAGE_NAME="daily-go"
# ────────────────────────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 [--project PROJECT_ID] [--region REGION] [--service SERVICE_NAME]"
  exit 1
}

# Parse optional CLI flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --region)  REGION="$2";     shift 2 ;;
    --service) SERVICE="$2";    shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown flag: $1"; usage ;;
  esac
done

# Validate required config
if [[ -z "$PROJECT_ID" ]]; then
  echo "❌  GCP project ID is required."
  echo "    Set it via:  export GCP_PROJECT=your-project-id"
  echo "    Or pass it:  ./deploy.sh --project your-project-id"
  exit 1
fi

IMAGE="gcr.io/${PROJECT_ID}/${IMAGE_NAME}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Service : $SERVICE"
echo "  Image   : $IMAGE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Authenticate / set project ────────────────────────────────────────────
echo ""
echo "▶ Setting active GCP project..."
gcloud config set project "$PROJECT_ID"

# ── 2. Enable required APIs (idempotent) ─────────────────────────────────────
echo ""
echo "▶ Enabling Cloud Run & Container Registry APIs..."
gcloud services enable run.googleapis.com containerregistry.googleapis.com --quiet

# ── 3. Configure Docker to push to GCR ──────────────────────────────────────
echo ""
echo "▶ Configuring Docker auth for GCR..."
gcloud auth configure-docker --quiet

# ── 4. Build & push the image ────────────────────────────────────────────────
echo ""
echo "▶ Building Docker image..."
docker build --platform linux/amd64 -t "${IMAGE}:latest" .

echo ""
echo "▶ Pushing image to Google Container Registry..."
docker push "${IMAGE}:latest"

# ── 5. Deploy to Cloud Run ───────────────────────────────────────────────────
echo ""
echo "▶ Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "${IMAGE}:latest" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1 \
  --quiet

# ── 6. Print the live URL ────────────────────────────────────────────────────
echo ""
SERVICE_URL=$(gcloud run services describe "$SERVICE" \
  --platform managed \
  --region "$REGION" \
  --format "value(status.url)")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deployment complete!"
echo "  🌐 Service URL: $SERVICE_URL"
echo "  🏥 Health check: ${SERVICE_URL}/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
