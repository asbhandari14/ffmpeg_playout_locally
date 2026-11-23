# FFmpeg Playout System (Docker Setup)

A unified broadcast playout and linear channel streaming system powered by Node.js, FFmpeg, ZeroMQ, MongoDB, and React.

---

## Architecture Overview

Both the **Frontend (React SPA)** and **Backend Engine (Node.js + FFmpeg + ZeroMQ)** are packaged together using the root `Dockerfile`.

```
                      ┌────────────────────────────────┐
                      │     Web Browser / Client       │
                      └──────────────┬─────────────────┘
                                     │ Port 5000 (HTTP)
                                     ▼
             ┌──────────────────────────────────────────────────┐
             │          playout_server (Unified Container)      │
             │  - Serves React SPA (Static assets & routing)    │
             │  - REST API (/api/v1/...)                        │
             │  - Static Media & Graphics (/uploads/...)        │
             │  - Live HLS Streaming (/streams/...)             │
             │  - Embedded FFmpeg + FFprobe Engine              │
             │  - ZeroMQ filter control (live DVE, ticker, bug) │
             │  - Mounted: ./server/uploads & ./server/streams  │
             └───────────────────────┬──────────────────────────┘
                                     │ Port 27017
                                     ▼
             ┌──────────────────────────────────────────────────┐
             │          playout_mongodb (MongoDB 7.0)           │
             │  - Database volume: mongodb_data                 │
             └──────────────────────────────────────────────────┘
```

---

## Quick Start with Docker

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 2. Configure Environment
Ensure `server/.env` exists (copied from `server/.env.example` if not already present).

### 3. Build & Run
Run the full stack:
```powershell
docker compose up --build -d
```

### 4. Access the Application
- **Unified Web UI & API**: [http://localhost:5000](http://localhost:5000)
- **API Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)
- **MongoDB**: `localhost:27017`

### 5. Default Administrator Credentials
- **Email**: `example@mail.com`
- **Password**: `123456`

---

## Service Management Commands

| Task | Command |
| :--- | :--- |
| **Check container status** | `docker compose ps` |
| **View live logs** | `docker compose logs -f` |
| **View playout server logs** | `docker compose logs -f playout` |
| **Stop all containers** | `docker compose down` |
| **Stop and wipe database volumes** | `docker compose down -v` |
| **Rebuild from scratch** | `docker compose build --no-cache` |
| **Open terminal inside container** | `docker compose exec playout bash` |
| **Verify FFmpeg inside container** | `docker compose exec playout ffmpeg -version` |

---

## Volumes & Storage

1. **`./server/uploads`** mounted to `/app/server/uploads`: Stores uploaded videos, branding assets, logos, and overlays directly on your host machine.
2. **`./server/streams`** mounted to `/app/server/streams`: Stores active HLS video segments and stream manifests.
3. **`mongodb_data`**: Stores local MongoDB collections (if using local database).
