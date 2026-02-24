# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Download dependencies first (layer-cache friendly)
COPY go.mod ./
RUN go mod download

# Copy only the Go source — no HTML/CSS/JS needed
COPY main.go .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o server .

# ── Stage 2: Minimal runtime image ──────────────────────────────────────────
FROM gcr.io/distroless/static-debian12

COPY --from=builder /app/server /server

# Cloud Run injects PORT; default to 8080 locally
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/server"]
