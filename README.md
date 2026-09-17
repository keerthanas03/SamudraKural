# 🌊 Samudra Kural (சமுத்திர குரல்)

**Samudra Kural** (*Voice of the Ocean*) is a next-generation, AI-powered ocean intelligence, fisherman safety, and maritime navigation platform. Designed specifically for artisanal and commercial fishermen, coastal communities, and maritime security authorities, Samudra Kural combines **offline-first mobile GPS navigation**, **real-time emergency distress (SOS) broadcasting**, **multilingual AI voice assistance**, **Potential Fishing Zone (PFZ) analytics**, **smart net drift tracking**, and a **Coastal Guard command dashboard**.

---

## 📋 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Repository Layout](#-repository-layout)
- [API Classification & Handoff Matrix](#-api-classification--handoff-matrix)
- [Database Schema & PostGIS Spatial Design](#-database-schema--postgis-spatial-design)
- [Mobile Frontend Screens](#-mobile-frontend-screens)
- [Environment Variables](#-environment-variables)
- [Developer Setup & Quickstart](#-developer-setup--quickstart)
  - [1. Database & Spatial Extension Setup](#1-database--spatial-extension-setup)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
  - [4. Running with Docker Compose](#4-running-with-docker-compose)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [License](#-license)

---

## 🚀 Key Features

### 🧭 1. Offline-First Mobile GPS Navigation
- **Local Spatial Calculations**: Computes exact bearing, distance-to-shore, and cardinal directions using local PostGIS spatial functions and Haversine algorithms without relying on external mapping APIs.
- **Offline Coordinate Caching**: Mobile application caches critical shore coordinates and saved fishing spots, allowing continuous compass navigation even when cellular data is completely lost at deep sea.
- **Nearest Location Search**: Instantly identifies the closest saved fishing hotspot within a user-defined radius.

### 🚨 2. Emergency SOS & Maritime Safety
- **One-Touch SOS Broadcast**: Triggers real-time emergency signals with live GPS coordinates, battery level, and vessel information.
- **Distress Alert Lifecycle**: Manages active alerts, resolution workflows, and alert history.
- **Direct Coastal Guard Integration**: Emergency alerts are immediately pushed to the Coastal Guard monitoring command center.

### 🛡️ 3. International Maritime Boundary (IMBL) Alert System
- **Geofenced Border Warnings**: Calculates distance to international maritime boundaries (e.g., India-Sri Lanka IMBL).
- **Proximity Alerts**: Visual and audio warnings alert fishermen before accidental boundary line breaches.
- **Coastal Guard Monitoring**: Allows maritime authorities to monitor border proximity across active vessels.

### 🐟 4. Potential Fishing Zone (PFZ) & Species Advisory
- **Oceanographic Data Integration**: Ingests Sea Surface Temperature (SST), Chlorophyll-*a* concentration, ocean current velocity, and wave height data from **Copernicus Marine Service** and **INCOIS**.
- **Fish Density Forecasting**: Provides localized predictions for high-yield fishing zones and target species advisories.

### 🕸️ 5. Smart Net Drift & Lost Net Tracking
- **Spatial Drift Modeling**: Uses ocean current vectors and wind speed predictions to estimate net drift trajectories.
- **Lost Net Reporting & Recovery**: Enables fishermen to register deployed/lost nets, track movement, and receive spatial location updates for net retrieval.

### 🎙️ 6. Multilingual AI Voice Assistant ("Samudra Kural Bot")
- **Voice-to-Voice AI Queries**: Supports natural voice queries in **Tamil** and **English** powered by **Gemini 2.0 / Sarvam AI / ElevenLabs**.
- **Audio Weather & Safety Reports**: Delivers spoken ocean weather updates, wave forecasts, navigation guidance, and safety warnings for easy operation while onboard.

### 💂 7. Coastal Guard Command Center
- **Real-Time Vessel Map**: Provides maritime authorities with real-time tracking of active boats.
- **Emergency Broadcasts**: Allows authorities to dispatch weather warnings, cyclone alerts, or border notices directly to vessels.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Mobile Device ["📱 Mobile App (React Native / Expo)"]
        UI["React Native UI (Tamil / English)"]
        GPS["Device GPS / GNSS Sensor"]
        AUDIO["Expo Audio / Speech Engine"]
        CACHE["AsyncStorage Offline Cache"]
    end

    subgraph Backend Services ["⚡ FastAPI Backend (Python 3.13)"]
        API["REST API Router (/api/v1)"]
        AUTH["JWT & Password Hash (Argon2 / bcrypt)"]
        NAV_SVC["PostGIS Navigation Service"]
        PFZ_SVC["Copernicus & INCOIS Ingestion"]
        BOT_SVC["Multilingual AI Voice Engine (Gemini / Sarvam AI)"]
        SOS_SVC["Emergency SOS Dispatcher"]
    end

    subgraph Database Layer ["🐘 Database (PostgreSQL 18 + PostGIS)"]
        DB[(PostgreSQL Database)]
        SPATIAL["GeoAlchemy2 & Spatial Indices"]
    end

    subgraph External Services ["🌐 External Data & AI Services"]
        COP["Copernicus Marine Service"]
        INC["INCOIS Forecast API"]
        GEM["Google Gemini API"]
        SARVAM["Sarvam AI TTS/STT"]
    end

    GPS --> UI
    UI -->|REST / Bearer Token| API
    CACHE <--> UI
    AUDIO <--> UI

    API --> AUTH
    API --> NAV_SVC
    API --> PFZ_SVC
    API --> BOT_SVC
    API --> SOS_SVC

    NAV_SVC --> DB
    SOS_SVC --> DB
    DB --- SPATIAL

    PFZ_SVC --> COP
    PFZ_SVC --> INC
    BOT_SVC --> GEM
    BOT_SVC --> SARVAM
```

---

## 🛠️ Tech Stack

### Backend Framework & Database
- **Language**: Python 3.13
- **Web Framework**: FastAPI (Async Web Framework)
- **ASGI Server**: Uvicorn
- **Database**: PostgreSQL 18 with **PostGIS** geospatial extension
- **ORM & Geospatial Layer**: Async SQLAlchemy 2.x + `asyncpg` + `GeoAlchemy2` + `Shapely`
- **Database Migrations**: Alembic
- **Oceanographic Data Processing**: `xarray`, `netCDF4`, `scipy`, `numpy`, `copernicusmarine`
- **Security & Authentication**: PyJWT, Argon2 (`pwdlib`), `bcrypt`

### Mobile Frontend Framework
- **Framework**: React Native 0.86 + Expo 57
- **Language**: TypeScript 6.0
- **Navigation**: React Navigation (Native Stack)
- **State & Local Storage**: `@react-native-async-storage/async-storage`, `expo-secure-store`
- **Device Hardware APIs**: `expo-location`, `expo-audio`, `expo-speech`, `expo-battery`
- **UI Components**: `react-native-svg`, `react-native-safe-area-context`

---

## 📁 Repository Layout

```
SamudraKural/
├── backend/                        # FastAPI Backend Application
│   ├── alembic/                    # Database migration scripts
│   ├── alembic.ini                 # Alembic configuration
│   ├── app/
│   │   ├── api/v1/                 # REST API endpoints
│   │   │   ├── auth.py             # Authentication & user profile
│   │   │   ├── boats.py            # Boat registration & retrieval
│   │   │   ├── bot.py              # AI Voice/Chat Assistant
│   │   │   ├── coastal_guard.py    # Coastal Guard monitoring & broadcasts
│   │   │   ├── environment.py      # Ocean weather & wave forecasts
│   │   │   ├── fishermen.py        # Fisherman profile management
│   │   │   ├── health.py           # Health & PostGIS diagnostic checks
│   │   │   ├── locations.py        # Saved fishing spots & nearby search
│   │   │   ├── navigation.py       # Spatial navigation & bearing calculations
│   │   │   ├── nets.py             # Smart Net tracking & drift modeling
│   │   │   ├── pfz.py              # Potential Fishing Zones (PFZ)
│   │   │   └── sos.py              # Emergency distress SOS alerts
│   │   ├── core/                   # Security, JWT, & Application config
│   │   ├── db/                     # Async Database session & PostGIS connection
│   │   ├── models/                 # SQLAlchemy database models
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   ├── services/               # Navigation, PFZ, Drift, & AI business logic
│   │   └── main.py                 # FastAPI application initialization
│   └── tests/                      # Pytest suite
├── frontend/                       # Mobile App (React Native / Expo)
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   ├── navigation/             # App navigation stack
│   │   ├── screens/                # Mobile App Screens
│   │   │   ├── BotScreen.tsx       # AI Voice Bot interface
│   │   │   ├── FishingZonesScreen.tsx # PFZ map & advisories
│   │   │   ├── HomeScreen.tsx      # Dashboard & quick actions
│   │   │   ├── NavigationScreen.tsx# GPS Compass & bearing
│   │   │   ├── MyNetsScreen.tsx    # Net drift & lost net tracking
│   │   │   ├── WelcomeScreen.tsx   # Onboarding & language selector
│   │   │   └── coastal_guard/      # Coastal Guard command screens
│   │   ├── services/               # API clients & HTTP services
│   │   ├── sos/                    # SOS trigger & emergency management
│   │   └── types/                  # TypeScript interface definitions
│   ├── App.tsx                     # React Native root component
│   └── package.json                # Frontend dependencies
├── docker-compose.yml              # Container orchestration setup
├── MODEL_ASSUMPTIONS.md            # Physics & mathematical model documentation
├── requirements.txt                # Python backend dependencies
└── README.md                       # Main repository documentation
```

---

## 📊 API Classification & Handoff Matrix

### Public Endpoints (No Token Required)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/health` | `GET` | Service status check |
| `/api/v1/health/db` | `GET` | PostgreSQL database connection health |
| `/api/v1/health/postgis` | `GET` | PostGIS spatial extension verification |
| `/api/v1/auth/register` | `POST` | Register a new fisherman account |
| `/api/v1/auth/login` | `POST` | Authenticate fisherman & issue JWT access token |

### Authenticated Endpoints (`Authorization: Bearer <token>`)

| Category | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Profile** | `/api/v1/auth/me` | `GET` | Fetch authenticated fisherman profile |
| | `/api/v1/fishermen/{id}` | `GET` | Get fisherman details by ID |
| **Boats** | `/api/v1/boats` | `POST` | Register boat for authenticated fisherman |
| | `/api/v1/boats/{id}` | `GET` | Retrieve boat specs & registration |
| | `/api/v1/fishermen/{id}/boat` | `GET` | Get boat owned by fisherman |
| **Locations** | `/api/v1/locations` | `POST` | Save new fishing spot (GPS point) |
| | `/api/v1/locations/{id}` | `GET` | Retrieve saved fishing location |
| | `/api/v1/locations/{id}` | `DELETE` | Delete saved fishing location |
| | `/api/v1/locations/nearby` | `GET` | Query nearby saved locations via PostGIS |
| **Navigation** | `/api/v1/navigation/to-shore` | `GET` | Calculate distance, bearing & cardinal direction to shore |
| | `/api/v1/navigation/to-location/{id}` | `GET` | Navigate to saved fishing spot |
| | `/api/v1/navigation/nearest-location` | `GET` | Locate nearest saved spot within search radius |
| | `/api/v1/navigation/status` | `GET` | Fetch real-time navigational facts relative to shore |
| **Emergency SOS** | `/api/v1/sos/trigger` | `POST` | Broadcast emergency distress signal |
| | `/api/v1/sos/active` | `GET` | Fetch active distress alerts |
| | `/api/v1/sos/{id}/resolve` | `POST` | Mark emergency SOS alert as resolved |
| **PFZ Advisory** | `/api/v1/pfz/zones` | `GET` | Retrieve Potential Fishing Zones & species forecasts |
| **Smart Nets** | `/api/v1/nets` | `POST` | Register deployed fishing net |
| | `/api/v1/nets/drift` | `GET` | Calculate ocean current drift trajectory for net |
| | `/api/v1/nets/lost` | `POST` | Report lost net for community spatial tracking |
| **AI Voice Bot** | `/api/v1/bot/query` | `POST` | Process text or audio query in Tamil/English |

---

## 🗄️ Database Schema & PostGIS Spatial Design

Samudra Kural uses **PostgreSQL 18** with **PostGIS** to store spatial geometry (`POINT` features) using the standard **WGS84 (SRID 4326)** coordinate reference system.

```mermaid
erDiagram
    FISHERMEN ||--o{ BOATS : owns
    FISHERMEN ||--o{ FISHING_LOCATIONS : saves
    FISHERMEN ||--o{ SOS_ALERTS : triggers
    FISHERMEN ||--o{ SMART_NETS : deploys

    FISHERMEN {
        int id PK
        string phone_number UK
        string full_name
        string preferred_language
        datetime created_at
    }

    BOATS {
        int id PK
        int owner_id FK
        string boat_name
        string registration_number UK
        float length_meters
        string engine_type
    }

    FISHING_LOCATIONS {
        int id PK
        int fisherman_id FK
        string location_name
        geometry location_point "SRID 4326"
        float depth_meters
        datetime created_at
    }

    SOS_ALERTS {
        int id PK
        int fisherman_id FK
        geometry current_location "SRID 4326"
        string alert_type
        string status
        float battery_level
        datetime triggered_at
    }

    SMART_NETS {
        int id PK
        int fisherman_id FK
        string net_tag_id
        geometry deployment_point "SRID 4326"
        geometry last_known_point "SRID 4326"
        string status
        datetime deployed_at
    }
```

---

## 📱 Mobile Frontend Screens

The mobile application offers a rich, intuitive, touch-friendly UI optimized for outdoor visibility and single-handed operation on boats:

- **Welcome & Language Selector**: Single-tap toggle between **Tamil (தமிழ்)** and **English**.
- **Dashboard (Home Screen)**: Displays real-time weather summary, ocean condition alerts, wave height index, and quick-action SOS trigger.
- **GPS Compass & Navigation Screen**: Live directional needle, bearing angle, distance to shore in kilometers/nautical miles, and saved fishing spot navigation.
- **Potential Fishing Zones (PFZ) Screen**: Color-coded maps displaying sea surface temperature contours, chlorophyll concentrations, and predicted fish species.
- **Smart Net Manager**: Real-time position tracking of deployed nets with drift direction vectors and lost-net recovery requests.
- **AI Voice Assistant ("Samudra Kural Bot")**: Tap-to-speak interface allowing hands-free voice interaction in Tamil.
- **Coastal Guard Monitor**: Dedicated view for authorities showing live vessel clusters, boundary alerts, and distress calls.

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` in the root and backend directories before starting the application:

```ini
# Application Configuration
PROJECT_NAME="Samudra Kural Backend"
API_V1_STR="/api/v1"
ENVIRONMENT="development"
DEBUG=True

# Database Configuration (PostgreSQL + PostGIS)
POSTGRES_SERVER="localhost"
POSTGRES_PORT=5432
POSTGRES_USER="samudra"
POSTGRES_PASSWORD="samudra_dev_password"
POSTGRES_DB="samudra_kural"
ASYNC_DATABASE_URL="postgresql+asyncpg://samudra:samudra_dev_password@localhost:5432/samudra_kural"

# JWT Authentication
JWT_SECRET_KEY="your_secure_random_32_byte_secret_key"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Ocean Data Integration (Copernicus & INCOIS)
COPERNICUSMARINE_SERVICE_USERNAME="your_username"
COPERNICUSMARINE_SERVICE_PASSWORD="your_password"
INCOIS_BASE_URL="https://incois.gov.in"

# AI Voice & Language APIs
GEMINI_API_KEY="your_gemini_api_key"
SARVAM_API_KEY="your_sarvam_api_key"
ELEVENLABS_API_KEY="your_elevenlabs_api_key"
```

---

## 💻 Developer Setup & Quickstart

### Prerequisites
- **Python**: 3.13+
- **Node.js**: v18+ and `npm`
- **Database**: PostgreSQL 18 with PostGIS extension installed
- **Expo CLI**: `npm install -g expo-cli`

---

### 1. Database & Spatial Extension Setup

Ensure PostgreSQL is running and enable the PostGIS extension:

```sql
CREATE DATABASE samudra_kural;
CREATE USER samudra WITH PASSWORD 'samudra_dev_password';
GRANT ALL PRIVILEGES ON DATABASE samudra_kural TO samudra;

\c samudra_kural
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

### 2. Backend Setup

```bash
# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r ../requirements.txt

# Run Alembic migrations
alembic upgrade head

# Start FastAPI Uvicorn Development Server
uvicorn app.main:app --reload --port 8000
```

Once running, interactive API documentation is accessible at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install Node modules
npm install

# Start Expo development server
npm start
```

You can run the app on:
- **Android Emulator**: Press `a` in the Expo terminal or run `npm run android`
- **iOS Simulator**: Press `i` in the Expo terminal or run `npm run ios`
- **Web Browser**: Press `w` in the Expo terminal or run `npm run web`

---

### 4. Running with Docker Compose

To launch the complete backend stack (PostgreSQL + PostGIS database + FastAPI application) in containers:

```bash
# From project root directory
docker-compose up --build -d
```

---

## 🧪 Testing & Quality Assurance

The backend includes a comprehensive test suite powered by `pytest` and `httpx`:

```bash
cd backend
.venv\Scripts\pytest -v
```

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](file:///c:/Users/keert/OneDrive/Desktop/SamudraKural/LICENSE) file for complete details.

---

<p align="center">
  <b>Samudra Kural (சமுத்திர குரல்)</b> • Empowering Fishermen, Securing Oceans.
</p>
