<p align="center">
  <img src="https://img.shields.io/badge/K6-Mission_Control-00d4ff?style=for-the-badge&logo=k6&logoColor=white" alt="K6 Mission Control" />
  <img src="https://img.shields.io/badge/React-18+-61dafb?style=for-the-badge&logo=react&logoColor=white" alt="React 18+" />
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js 20+" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
</p>

# 🚀 K6 Load Test Dashboard — Mission Control

> **Internal Web Application** สำหรับรัน **k6 Load Testing** แบบ Cross-Domain Login พร้อม Real-Time Dashboard สไตล์ Mission Control

แอปพลิเคชัน Full-Stack ที่ช่วยให้ทีม QA/DevOps สามารถทำ Load Test ได้ง่ายๆ ผ่านหน้าเว็บ — แค่กรอก URL, Username, Password และตั้งค่า Virtual Users แล้วระบบจะรัน k6 ให้อัตโนมัติ พร้อมแสดงผลลัพธ์เป็น **Dashboard กราฟสวยงาม** แบบ Real-Time

---

## 📑 สารบัญ

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [📁 Project Structure](#-project-structure)
- [🛠️ Tech Stack](#️-tech-stack)
- [⚡ Quick Start](#-quick-start)
- [⚙️ Configuration](#️-configuration)
- [📖 API Reference](#-api-reference)
- [🖥️ หน้าจอต่างๆ](#️-หน้าจอต่างๆ)
- [🔐 Security](#-security)
- [🧪 Cross-Domain Login Flow](#-cross-domain-login-flow)
- [📝 License](#-license)

---

## ✨ Features

### 🎯 Core Features
- **One-Click Load Testing** — กรอกแค่ URL + Credentials แล้วกด Start
- **Cross-Domain Login Support** — รองรับระบบที่มี Login คนละ Domain (เช่น SSO, OAuth redirect)
- **ASP.NET WebForms Compatibility** — รองรับ `__VIEWSTATE`, `__EVENTVALIDATION` อัตโนมัติ
- **Real-Time Monitoring** — ดู Live Metrics ผ่าน WebSocket ระหว่างรันเทส
- **Beautiful Dashboard** — กราฟ Response Time, Throughput, Error Rate, VU Count และอื่นๆ
- **Test History & Comparison** — ดูประวัติเทสทั้งหมดและเปรียบเทียบ side-by-side

### 🛡️ Security Features
- **AES Password Encryption** — เข้ารหัส Password ก่อนเก็บลง Database
- **Localhost Only** — Bind เฉพาะ `127.0.0.1` ไม่เปิดให้เข้าจากภายนอก
- **No Credential Logging** — ไม่ Log Password ใน Console หรือ File
- **Rate Limiting** — จำกัดจำนวน Test ที่รันพร้อมกัน (Max 3)

### 📊 Dashboard & Visualization
- **Summary Cards** — Total Requests, Avg Response Time, P95, P99, Error Rate, Throughput
- **Response Time Over Time** — Line Chart แสดง Avg, P50, P90, P95, P99
- **Throughput Chart** — Requests/sec ตลอดการทดสอบ
- **Virtual Users Over Time** — Ramp-up → Steady → Ramp-down
- **Error Rate Chart** — Success vs Error ต่อช่วงเวลา
- **Latency Percentiles** — P50, P90, P95, P99 เปรียบเทียบกัน
- **Login Duration Metrics** — เวลา Login เฉลี่ย, Login Success Rate
- **Export** — JSON / CSV export

### ⚙️ Test Configuration
- **Dry Run** — ทดสอบ Login ก่อน 1 ครั้งโดยไม่รัน Load Test
- **Save/Load Configs** — บันทึกค่า Config ไว้ใช้ซ้ำ
- **Re-run Tests** — รันเทสซ้ำจากประวัติ
- **Post-Login URLs** — ระบุ URL paths เพิ่มเติมที่ต้องการเทสหลัง Login
- **Custom Login Fields** — กำหนดชื่อ Field ของ Form Login ได้เอง
- **Configurable VUs** — 1-500 Virtual Users พร้อม Slider
- **Multiple Durations** — 30s, 1m, 5m, 10m, 30m

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)           │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Test Form │  │ Live Monitor │  │  Dashboard   │  │
│  │ (Config)  │  │ (WebSocket)  │  │  (Recharts)  │  │
│  └───────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────▼──────────────────────────────┐
│               Backend (Node.js + Express)            │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ API Routes│  │ k6 Runner    │  │ Result Parser│  │
│  │ (Express) │  │(child_process│  │ (JSON Parse) │  │
│  └───────────┘  └──────────────┘  └──────────────┘  │
│  ┌───────────┐  ┌──────────────┐                    │
│  │ WebSocket │  │  Encryption  │                    │
│  │ (ws)      │  │  (AES-256)   │                    │
│  └───────────┘  └──────────────┘                    │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │     SQLite Database          │
        │  (sql.js — In-process)       │
        │  tests | results | metrics   │
        │  configs                     │
        └──────────────────────────────┘
```

### Data Flow

1. ผู้ใช้กรอก Config ผ่านหน้าเว็บ → **REST API** ส่ง Config ไป Backend
2. Backend สร้าง Test Record ใน SQLite → **Spawn k6 Process** พร้อม Environment Variables
3. k6 Process รัน Cross-Domain Login Script → **stdout/stderr Stream** ส่งผ่าน WebSocket กลับ Frontend
4. k6 Process เสร็จ → Backend **Parse JSON Summary** → บันทึก Results + Time-Series Metrics ลง SQLite
5. Frontend ดึง Results ผ่าน REST API → **Recharts** แสดง Dashboard

---

## 📁 Project Structure

```
k6-load-test-app/
├── 📄 README.md                      # ไฟล์นี้
├── 📄 package.json                   # Root workspace (npm workspaces)
├── 📄 .env                           # Environment variables
│
├── 📂 backend/                       # Node.js + Express Backend
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   ├── 📂 data/                      # SQLite database file
│   │   └── 📄 k6-dashboard.db
│   └── 📂 src/
│       ├── 📄 index.ts               # Express app entry point
│       ├── 📂 routes/
│       │   ├── 📄 test.routes.ts     # Test CRUD + Start/Stop/DryRun
│       │   ├── 📄 result.routes.ts   # Results + Export (JSON/CSV)
│       │   └── 📄 config.routes.ts   # Saved Configurations CRUD
│       ├── 📂 services/
│       │   ├── 📄 k6-runner.service.ts    # k6 Process Management
│       │   ├── 📄 result-parser.service.ts # Parse k6 JSON Output
│       │   ├── 📄 db.service.ts           # SQLite Operations (sql.js)
│       │   └── 📄 encryption.service.ts   # AES Password Encryption
│       ├── 📂 models/
│       │   └── 📄 schema.ts          # Database Schema & Init
│       ├── 📂 websocket/
│       │   └── 📄 progress.ts        # WebSocket Live Progress
│       └── 📂 k6-scripts/
│           └── 📄 cross-domain-login.js  # ★ k6 Test Script หลัก
│
└── 📂 frontend/                      # React + Vite Frontend
    ├── 📄 package.json
    ├── 📄 index.html                 # HTML Entry (Google Fonts, Material Icons)
    ├── 📄 vite.config.ts             # Vite Config + API/WS Proxy
    ├── 📄 tailwind.config.js         # Tailwind CSS Config (Mission Control theme)
    ├── 📄 tsconfig.json
    └── 📂 src/
        ├── 📄 App.tsx                # Main App + Sidebar Navigation + Routing
        ├── 📄 main.tsx               # React Entry Point
        ├── 📄 index.css              # Global Styles + Design Tokens
        ├── 📂 pages/
        │   ├── 📄 HomePage.tsx            # Test Configuration Form
        │   ├── 📄 TestRunningPage.tsx     # Live Monitor (WebSocket)
        │   ├── 📄 ResultDashboard.tsx     # Results Dashboard (Charts)
        │   ├── 📄 ResultsPage.tsx         # Results Archive
        │   ├── 📄 HistoryPage.tsx         # Test History Table
        │   └── 📄 CompareResultsPage.tsx  # Side-by-Side Comparison
        ├── 📂 hooks/
        │   ├── 📄 useWebSocket.ts    # WebSocket Connection Hook
        │   └── 📄 useTestResults.ts  # Fetch Results Hook
        ├── 📂 lib/
        │   └── 📄 api.ts             # REST API Client
        └── 📂 types/
            └── 📄 index.ts           # TypeScript Type Definitions
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI Framework |
| **TypeScript 5.7** | Type Safety |
| **Vite 6** | Build Tool & Dev Server |
| **Tailwind CSS 3** | Utility-First Styling |
| **Recharts** | Charts & Data Visualization |
| **React Router 7** | Client-Side Routing |
| **Lucide React** | Icon Library |
| **Material Symbols** | Google Material Icons |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js 20+** | Runtime |
| **Express 4** | HTTP Server & REST API |
| **TypeScript 5.7** | Type Safety |
| **sql.js** | SQLite Database (In-Process, No Native Deps) |
| **ws** | WebSocket Server |
| **tsx** | TypeScript Execution (Dev) |
| **uuid** | Unique ID Generation |
| **dotenv** | Environment Variables |

### Testing Tool
| Technology | Purpose |
|---|---|
| **Grafana k6** | Load Testing Engine |

---

## ⚡ Quick Start

### Prerequisites

- **Node.js** 20+ — [Download](https://nodejs.org/)
- **k6** — Grafana k6 Load Testing Tool

#### ติดตั้ง k6

```bash
# Windows (Chocolatey)
choco install k6

# Windows (winget)
winget install k6 --source winget

# macOS (Homebrew)
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
    --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
    sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker (Alternative)
docker pull grafana/k6
```

### Installation

```bash
# 1. Clone repository
git clone https://github.com/<your-username>/k6-load-test-dashboard.git
cd k6-load-test-dashboard

# 2. Install dependencies (ทั้ง frontend + backend ผ่าน npm workspaces)
npm install

# 3. ตั้งค่า Environment Variables
cp .env.example .env    # หรือแก้ไข .env ตามต้องการ

# 4. Start development (frontend + backend พร้อมกัน)
npm run dev
```

### Access the App

| Service | URL |
|---|---|
| 🖥️ **Frontend** | http://127.0.0.1:5173 |
| ⚙️ **Backend API** | http://127.0.0.1:3001 |
| 🔌 **WebSocket** | ws://127.0.0.1:3001/ws/test/:id |
| ❤️ **Health Check** | http://127.0.0.1:3001/api/health |

### Available Scripts

```bash
# รัน Frontend + Backend พร้อมกัน
npm run dev

# รัน Backend อย่างเดียว
npm run dev:backend

# รัน Frontend อย่างเดียว
npm run dev:frontend

# Build Frontend สำหรับ Production
npm run build
```

---

## ⚙️ Configuration

### Environment Variables (`.env`)

```env
# ─── Backend ──────────────────────────────────
PORT=3001                                  # Backend port
HOST=127.0.0.1                             # Bind address (localhost only)
DB_PATH=./data/k6-dashboard.db            # SQLite database path
K6_SCRIPT_PATH=k6-scripts/cross-domain-login.js  # k6 script path
K6_BINARY_PATH=k6                          # k6 binary (หรือ full path เช่น /usr/local/bin/k6)
MAX_CONCURRENT_TESTS=3                     # จำกัดจำนวนเทสที่รันพร้อมกัน
ENCRYPTION_KEY=your-32-char-key-here!      # AES encryption key สำหรับเข้ารหัส password

# ─── Frontend ─────────────────────────────────
VITE_API_URL=http://127.0.0.1:3001        # Backend API URL
VITE_WS_URL=ws://127.0.0.1:3001           # WebSocket URL
```

> ⚠️ **สำคัญ:** `ENCRYPTION_KEY` ต้องมีความยาว 32 ตัวอักษร สำหรับ AES-256 encryption

---

## 📖 API Reference

### Tests

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/tests` | สร้างและเริ่ม Test ใหม่ |
| `GET` | `/api/tests` | ดึงรายการ Test ทั้งหมด (พร้อม Result Metrics) |
| `GET` | `/api/tests/:id` | ดึงข้อมูล Test เฉพาะ |
| `DELETE` | `/api/tests/:id` | ลบ Test |
| `POST` | `/api/tests/:id/stop` | หยุด Test ที่กำลังรัน (SIGINT) |
| `POST` | `/api/tests/dry-run` | ทดสอบ Login อย่างเดียว (ไม่รัน Load Test) |

### Results

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/results/:testId` | ดึง Summary + Time-Series Metrics |
| `GET` | `/api/results/:testId/export/json` | Export ผลลัพธ์เป็น JSON |
| `GET` | `/api/results/:testId/export/csv` | Export ผลลัพธ์เป็น CSV |

### Configurations

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/configs` | บันทึก Test Config |
| `GET` | `/api/configs` | ดึง Saved Configs ทั้งหมด |
| `DELETE` | `/api/configs/:id` | ลบ Config |

### WebSocket

| Endpoint | Description |
|---|---|
| `ws://host:port/ws/test/:id` | Live Progress Stream |

#### WebSocket Message Types

```typescript
interface WsMessage {
  type: 'connected' | 'log' | 'metric' | 'progress' | 'complete';
  testId: string;
  data?: any;          // Log output หรือ Metric data
  timestamp: string;
  exitCode?: number;   // เฉพาะ type: 'complete'
}
```

### Request/Response Examples

<details>
<summary><b>POST /api/tests</b> — สร้างและเริ่ม Test</summary>

**Request Body:**
```json
{
  "targetUrl": "https://app.example.com",
  "authDomain": "https://auth.example.com/login",
  "username": "testuser",
  "password": "testpass",
  "vus": 50,
  "duration": "5m",
  "rampUp": "30s",
  "postLoginUrls": ["/Dashboard", "/Search"],
  "loginFields": {
    "username": "txtUsername",
    "password": "txtPassword"
  },
  "aspnetMode": true
}
```

**Response (201):**
```json
{
  "id": 1,
  "target_url": "https://app.example.com",
  "auth_domain": "https://auth.example.com/login",
  "username": "testuser",
  "vus": 50,
  "duration": "5m",
  "ramp_up": "30s",
  "status": "pending",
  "started_at": "2026-04-01T08:00:00.000Z",
  "created_at": "2026-04-01T08:00:00.000Z"
}
```
</details>

<details>
<summary><b>GET /api/results/:testId</b> — ดึงผลลัพธ์</summary>

**Response (200):**
```json
{
  "summary": {
    "id": 1,
    "test_id": 1,
    "total_requests": 5240,
    "avg_response_time": 245.67,
    "min_response_time": 12.3,
    "max_response_time": 3421.0,
    "p50_response_time": 180.5,
    "p90_response_time": 450.2,
    "p95_response_time": 620.8,
    "p99_response_time": 1250.3,
    "throughput": 17.46,
    "error_rate": 0.02,
    "error_count": 105,
    "total_data_received": 15728640,
    "total_data_sent": 1048576,
    "login_success_rate": 0.98,
    "avg_login_duration": 850.5,
    "successful_logins": 490,
    "failed_logins": 10
  },
  "metrics": {
    "http_req_duration": [
      { "timestamp": "2026-04-01T08:00:01Z", "value": 230.5 },
      { "timestamp": "2026-04-01T08:00:02Z", "value": 245.1 }
    ],
    "http_reqs": [...],
    "vus": [...]
  }
}
```
</details>

---

## 🖥️ หน้าจอต่างๆ

### 1. 🏠 New Load Test (`/`)
หน้าแรกสำหรับกรอก Config และเริ่มเทส:

- **Target Configuration** — กรอก URL, Auth Domain, Username, Password
- **Test Settings** — ตั้ง Virtual Users (Slider 1-500), Duration, Ramp-up
- **ASP.NET Mode Toggle** — เปิดเพื่อรองรับ __VIEWSTATE อัตโนมัติ
- **Advanced Parameters** — Post-Login URLs, Custom Login Field Names
- **Actions** — 🚀 Start Test, 🧪 Dry Run, 💾 Save Config, 📂 Load Config
- **Estimated Load** — แสดง ~REQ/MIN ที่คาดว่าจะเกิดขึ้น

### 2. 📡 Live Monitor (`/test/:id/running`)
แสดง Progress ระหว่างรัน k6 แบบ Real-Time:

- **Progress Bar** — แสดง % ของเวลาที่ผ่านไป
- **Live Metrics** — Current VUs, Requests/sec, Avg Response Time, Error Count
- **Log Stream** — k6 stdout/stderr แบบ Terminal (ผ่าน WebSocket)
- **Stop Button** — หยุดเทสก่อนเวลา (ส่ง SIGINT)
- **Auto-Navigate** — เทสเสร็จจะไปหน้า Results อัตโนมัติ

### 3. 📊 Result Dashboard (`/test/:id/results`)
แสดงผลลัพธ์เทสเป็น Dashboard สวยงาม:

- **Summary Cards** — Total Requests, Avg/P95/P99 Response Time, Error Rate, Throughput, Login Metrics
- **Response Time Chart** — Line Chart (Avg, P50, P90, P95, P99 over time)
- **Throughput Chart** — Area Chart (Requests/sec)
- **VU Chart** — Virtual Users over time
- **Error Rate Chart** — Bar Chart (Success vs Error)
- **Latency Percentiles** — Visual comparison
- **Export Buttons** — Download JSON / CSV

### 4. 📋 Results Archive (`/results`)
รายการผลลัพธ์ทั้งหมด พร้อม Quick Summary

### 5. 🕐 Test History (`/history`)
ตารางประวัติเทสทั้งหมด:

- **Columns** — Test ID, Target URL, VUs, Duration, Avg RT, P95, Error Rate, Status, Date
- **Status Badges** — ✅ Completed / ❌ Failed / 🔄 Running / ⏹️ Stopped
- **Actions** — View Results, Re-run, Delete
- **Compare** — เลือก 2 Tests เพื่อเปรียบเทียบ side-by-side

### 6. ⚖️ Compare Results (`/results/compare`)
เปรียบเทียบ 2 Tests แบบ Side-by-Side:

- Summary Metrics เทียบกัน
- Charts ซ้อนทับ
- Highlight ตัวที่ดีกว่า/แย่กว่า

---

## 🔐 Security

แม้เป็น Internal Tool ระบบมีมาตรการรักษาความปลอดภัยดังนี้:

| มาตรการ | รายละเอียด |
|---|---|
| 🔒 **Password Encryption** | เข้ารหัส Password ด้วย AES-256 ก่อนเก็บลง Database |
| 🏠 **Localhost Binding** | Express bind เฉพาะ `127.0.0.1` ไม่เปิดให้เข้าจากภายนอก |
| 🚫 **No Credential Logging** | ไม่ Log Password ใน Console, File หรือ API Response |
| ⏱️ **Concurrent Test Limit** | จำกัดจำนวน Test ที่รันพร้อมกัน (Default: 3) |
| ✅ **Input Validation** | Validate URL format, VUs range (1-500), Required fields |
| 🛡️ **Process Isolation** | k6 Process ถูกจัดการผ่าน `child_process.spawn` พร้อม timeout |
| 🗑️ **Password Stripping** | API Response ไม่ส่ง Password กลับมาที่ Frontend |

---

## 🧪 Cross-Domain Login Flow

ระบบรองรับ Login Flow แบบ **Cross-Domain** ซึ่งพบบ่อยในระบบ Enterprise:

```
Step 1: GET  https://app.example.com/Login.aspx
        → โหลดหน้า Login + ดึง Hidden Fields

Step 2: Resolve Auth Domain
        → จาก AUTH_DOMAIN env, 302 redirect, หรือ <form action="...">

Step 3: GET  https://auth.another-domain.com/login
        → โหลดหน้า Auth + ดึง Hidden Fields / Cookies

Step 4: POST https://auth.another-domain.com/login
        → ส่ง Username + Password + Hidden Fields
        → ได้ Session Cookie

Step 5: GET  https://app.example.com/Index.aspx
        → Verify Login สำเร็จ (ไม่ใช่หน้า Login)
        → Login สำเร็จ ✅
```

### k6 Script Features

Script (`cross-domain-login.js`) รองรับ:

- ✅ **Auto-detect Auth URL** — จาก 302 Redirect หรือ `<form action="...">`
- ✅ **Hidden Field Extraction** — ดึง `<input type="hidden">` ทั้งหมดส่งไปกับ Form
- ✅ **ASP.NET Mode** — ดึง `__VIEWSTATE`, `__EVENTVALIDATION`, `__RequestVerificationToken`
- ✅ **Custom Login Fields** — เปลี่ยนชื่อ Username/Password field ได้
- ✅ **Post-Login Verification** — ตรวจสอบว่าหน้า Index ไม่ใช่หน้า Login
- ✅ **Post-Login URL Testing** — วนเข้า URL paths ที่กำหนด หลัง Login
- ✅ **Dry Run Mode** — ทดสอบ Login 1 ครั้งแล้วหยุด
- ✅ **Custom Metrics** — `login_duration`, `page_load_duration`, `errors`, `successful_logins`, `failed_logins`
- ✅ **Ramping VUs** — Ramp-up → Steady State → Ramp-down

---

## 🗄️ Database Schema

```sql
-- Test Configurations & Status
tests        (id, target_url, auth_domain, username, password[encrypted],
              vus, duration, ramp_up, post_login_urls, login_fields,
              aspnet_mode, status, started_at, completed_at, created_at)

-- Test Result Summaries
results      (id, test_id, total_requests, avg/min/max/p50/p90/p95/p99_response_time,
              throughput, error_rate, error_count, total_data_received/sent,
              login_success_rate, avg_login_duration, successful/failed_logins,
              raw_summary, created_at)

-- Time-Series Metrics (for charts)
metrics      (id, test_id, timestamp, metric_name, metric_value, tags)

-- Saved Configurations
configs      (id, name, config[JSON], created_at, updated_at)
```

---

## 🎨 Design System — "Mission Control"

### Theme: Dark Industrial Dashboard

ออกแบบในสไตล์ **Mission Control** ที่ให้ความรู้สึก Premium และเป็นมืออาชีพ:

| Token | Value | Usage |
|---|---|---|
| Background | `#0a0a0f` | หน้าจอหลัก |
| Surface | `#12121a` | Cards, Panels |
| Primary Accent | `#00d4ff` | ปุ่ม, Link, Highlight |
| Success | `#00ff88` | สถานะสำเร็จ |
| Warning | `#ffaa00` | คำเตือน |
| Error | `#ff4466` | ข้อผิดพลาด |
| Text | `#e0e0e8` | ข้อความหลัก |

### Typography
- **JetBrains Mono** — ตัวเลข, Metrics, Code
- **Plus Jakarta Sans** — Text ทั่วไป
- **Space Grotesk** — Headings

### UI Elements
- **Glassmorphism** — `backdrop-blur` + semi-transparent backgrounds
- **Noise Texture** — Subtle grain overlay
- **Glow Effects** — Neon accent glow บน Interactive elements
- **Smooth Transitions** — 200-300ms ease-out-expo
- **Fixed Sidebar** — Navigation ซ้ายมือ
- **Status Bar** — Footer บอกสถานะระบบ

---

## 🔧 Troubleshooting

### k6 ไม่พบ
```bash
# ตรวจสอบว่าติดตั้ง k6 แล้ว
k6 version

# ถ้าไม่พบ ติดตั้งตาม Quick Start section
# หรือระบุ path เต็มใน .env
K6_BINARY_PATH=C:\tools\k6\k6.exe
```

### Database Error
```bash
# ลบ database เก่าแล้วเริ่มใหม่ (ข้อมูลจะหายไป)
rm backend/data/k6-dashboard.db
npm run dev
```

### Port ถูกใช้งาน
```bash
# เปลี่ยน Port ใน .env
PORT=3002
VITE_API_URL=http://127.0.0.1:3002
VITE_WS_URL=ws://127.0.0.1:3002
```

### WebSocket ไม่เชื่อมต่อ
- ตรวจสอบว่า Backend กำลังรันอยู่
- ตรวจสอบ Vite proxy config ใน `frontend/vite.config.ts`
- ตรวจสอบ Port ตรงกันใน `.env`

---

## 🚀 Future Roadmap

- [ ] **Custom k6 Script Editor** — แก้ k6 script ผ่านหน้าเว็บ (Monaco Editor)
- [ ] **Scheduled Tests** — ตั้งเวลาให้รัน Test อัตโนมัติ (Cron)
- [ ] **Alert / Notification** — แจ้งเตือนเมื่อ P95 เกิน Threshold
- [ ] **Multi-Scenario Support** — รัน Scenario หลายๆ แบบในเทสเดียว
- [ ] **Grafana Integration** — ส่ง Metrics ไป Grafana ด้วย InfluxDB
- [ ] **Docker Compose** — รัน k6 ใน Container พร้อม InfluxDB + Grafana
- [ ] **PDF Report** — สร้าง Report อัตโนมัติ
- [ ] **Test Templates** — เก็บ Template สำหรับ Login Flow ที่แตกต่างกัน (OAuth, SAML, Basic Auth)

---

## 📝 License

This project is for **internal use only**. Not intended for public distribution.

---

<p align="center">
  <b>Built with ❤️ for QA/DevOps Teams</b>
  <br/>
  <sub>K6 Load Test Dashboard — Mission Control v1.0.4</sub>
</p>
