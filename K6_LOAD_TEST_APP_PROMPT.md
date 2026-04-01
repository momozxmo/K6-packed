# 🚀 K6 Load Test Dashboard — Full-Stack Web Application

## Project Overview

สร้าง **Internal Web Application** สำหรับทำ **Load Testing** ด้วย k6 โดยผู้ใช้แค่กรอก URL, Username, Password และตั้งค่า Virtual Users (VUs) แล้วระบบจะรัน k6 ให้อัตโนมัติ พร้อมแสดงผลลัพธ์เป็น **Dashboard กราฟสวยงาม**

> ⚠️ ระบบนี้เป็น **Internal Tool** ใช้งาน **localhost เท่านั้น** — ไม่ต้องมีระบบ Login

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Test Form │  │ Live Status  │  │  Dashboard   │  │
│  │ (Config)  │  │  (Progress)  │  │  (Results)   │  │
│  └───────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────▼──────────────────────────────┐
│                Backend (Node.js / Express)            │
│  ┌───────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ API Routes│  │ k6 Runner    │  │ Result Parser│  │
│  │           │  │ (child_proc) │  │              │  │
│  └───────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │     SQLite Database          │
        │  (test configs + results)    │
        └──────────────────────────────┘
```

---

## 📁 Project Structure

```
k6-load-test-app/
├── README.md
├── package.json                  # Root workspace
├── docker-compose.yml            # (Optional) สำหรับรัน k6 ใน container
│
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.ts              # Express app entry
│   │   ├── routes/
│   │   │   ├── test.routes.ts    # POST /api/tests, GET /api/tests, GET /api/tests/:id
│   │   │   └── result.routes.ts  # GET /api/results/:testId
│   │   ├── services/
│   │   │   ├── k6-runner.service.ts    # สั่งรัน k6 script via child_process
│   │   │   ├── result-parser.service.ts # Parse k6 JSON output
│   │   │   └── db.service.ts           # SQLite operations
│   │   ├── k6-scripts/
│   │   │   └── cross-domain-login.js   # ★ k6 script หลัก (รองรับ cross-domain login)
│   │   ├── models/
│   │   │   └── schema.ts         # DB schema definitions
│   │   └── websocket/
│   │       └── progress.ts       # WebSocket สำหรับ realtime progress
│   └── tsconfig.json
│
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── pages/
│   │   │   ├── HomePage.tsx           # กรอกฟอร์มเริ่มเทส
│   │   │   ├── TestRunningPage.tsx     # แสดง progress ระหว่างรัน
│   │   │   ├── ResultDashboard.tsx     # แสดงผลลัพธ์กราฟ
│   │   │   └── HistoryPage.tsx        # ดูประวัติเทสทั้งหมด
│   │   ├── components/
│   │   │   ├── TestConfigForm.tsx     # ฟอร์มตั้งค่าเทส
│   │   │   ├── LiveProgressPanel.tsx  # แถบ progress realtime
│   │   │   ├── charts/
│   │   │   │   ├── ResponseTimeChart.tsx    # กราฟ response time
│   │   │   │   ├── ThroughputChart.tsx      # กราฟ requests/sec
│   │   │   │   ├── ErrorRateChart.tsx       # กราฟ error rate
│   │   │   │   ├── VUChart.tsx              # กราฟ virtual users over time
│   │   │   │   └── LatencyPercentiles.tsx   # P50, P90, P95, P99
│   │   │   ├── SummaryCards.tsx       # การ์ดสรุปตัวเลขหลัก
│   │   │   └── TestHistoryTable.tsx   # ตารางประวัติ
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts        # Hook สำหรับ WS connection
│   │   │   └── useTestResults.ts      # Hook สำหรับ fetch results
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript types
│   │   └── lib/
│   │       └── api.ts                # API client
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── tsconfig.json
│
└── scripts/
    └── setup.sh                  # ติดตั้ง k6 + dependencies
```

---

## ★ Critical Feature: Cross-Domain Login Flow ใน k6

### Login Flow ที่ต้องรองรับ

ระบบเป้าหมายมีขั้นตอน Login แบบ **Cross-Domain** ดังนี้:

```
Step 1: GET https://app.example.com/Login.aspx
        → แสดงหน้า Login พร้อมปุ่มเลือกช่องทาง Login

Step 2: User เลือกช่องทาง Login
        → Redirect ไปที่ https://auth.another-domain.com/login
        (คนละ domain กับ Step 1)

Step 3: POST https://auth.another-domain.com/login
        → ส่ง username + password
        → ได้รับ token/cookie กลับมา

Step 4: Redirect กลับมาที่ https://app.example.com/Index.aspx
        → พร้อม session/token ที่ได้จาก Step 3
        → Login สำเร็จ — พร้อมใช้งาน
```

### k6 Script Template (cross-domain-login.js)

```javascript
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ──────────────────────────────────────────────
// Custom Metrics
// ──────────────────────────────────────────────
const loginDuration = new Trend('login_duration', true);
const pageLoadDuration = new Trend('page_load_duration', true);
const errorRate = new Rate('errors');
const successfulLogins = new Counter('successful_logins');
const failedLogins = new Counter('failed_logins');

// ──────────────────────────────────────────────
// Configuration จาก Environment Variables
// ──────────────────────────────────────────────
const TARGET_URL = __ENV.TARGET_URL || 'https://app.example.com';
const USERNAME = __ENV.USERNAME || '';
const PASSWORD = __ENV.PASSWORD || '';
const TEST_DURATION = __ENV.TEST_DURATION || '1m';
const VUS = parseInt(__ENV.VUS) || 10;
const RAMP_UP = __ENV.RAMP_UP || '30s';

// URL ของ Auth Domain (ถ้าเป็นคนละ domain กับ TARGET_URL)
// ให้ Backend detect จาก redirect หรือให้ user กรอกเพิ่ม
const AUTH_DOMAIN = __ENV.AUTH_DOMAIN || '';

export const options = {
    scenarios: {
        load_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: RAMP_UP, target: VUS },          // Ramp-up
                { duration: TEST_DURATION, target: VUS },     // Steady state
                { duration: '10s', target: 0 },               // Ramp-down
            ],
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<3000'],  // 95% ของ request ต้องต่ำกว่า 3 วิ
        errors: ['rate<0.1'],                // Error rate ต้องต่ำกว่า 10%
    },
    // ★ สำคัญ: ต้องเปิด cookie jar เพื่อรองรับ cross-domain cookies
    httpDebug: 'full',  // เอาออกตอน production
};

// ──────────────────────────────────────────────
// Setup: ทำ Login ครั้งเดียวก่อนเริ่มเทส (ถ้าต้องการ shared session)
// ──────────────────────────────────────────────
export function setup() {
    console.log(`🎯 Target: ${TARGET_URL}`);
    console.log(`👤 User: ${USERNAME}`);
    console.log(`👥 VUs: ${VUS}`);
    console.log(`⏱️ Duration: ${TEST_DURATION}`);

    // ทดสอบ Login ก่อน 1 ครั้งเพื่อ validate credentials
    const loginResult = performLogin();
    if (!loginResult.success) {
        throw new Error(`❌ Login failed during setup: ${loginResult.error}`);
    }
    console.log('✅ Setup login successful');

    return { setupTime: new Date().toISOString() };
}

// ──────────────────────────────────────────────
// Main VU Function
// ──────────────────────────────────────────────
export default function (data) {
    // แต่ละ VU ต้อง Login เองเพราะ session เป็นของแต่ละ VU
    let loginResult;

    group('01_Login_Flow', function () {
        loginResult = performLogin();
    });

    if (!loginResult.success) {
        failedLogins.add(1);
        errorRate.add(1);
        console.error(`VU ${__VU}: Login failed`);
        sleep(1);
        return;
    }

    successfulLogins.add(1);

    // ★ หลัง Login สำเร็จ — ทำ Load Test ตรงนี้
    group('02_Post_Login_Actions', function () {
        // ตัวอย่าง: เข้าหน้า Index
        const indexRes = http.get(`${TARGET_URL}/Index.aspx`, {
            headers: loginResult.headers || {},
        });

        check(indexRes, {
            'Index page status 200': (r) => r.status === 200,
            'Index page has content': (r) => r.body && r.body.length > 0,
        });

        pageLoadDuration.add(indexRes.timings.duration);
        errorRate.add(indexRes.status !== 200);

        sleep(1); // Think time ระหว่าง action

        // ★ เพิ่ม actions อื่นๆ ที่ต้องการเทสหลัง login ได้ตรงนี้
        // เช่น: เข้าหน้า Dashboard, Search, Submit Form, etc.
        // ผู้ใช้สามารถเพิ่ม URL paths เพิ่มเติมผ่านหน้าเว็บได้
    });

    sleep(Math.random() * 3 + 1); // Random think time 1-4 วินาที
}

// ──────────────────────────────────────────────
// ★ Cross-Domain Login Function
// ──────────────────────────────────────────────
function performLogin() {
    try {
        // ★ Step 1: เปิดหน้า Login.aspx ของระบบหลัก
        const loginPageRes = http.get(`${TARGET_URL}/Login.aspx`, {
            redirects: 0, // ไม่ให้ redirect อัตโนมัติ เพราะต้องจัดการเอง
        });

        check(loginPageRes, {
            'Login page loaded': (r) => r.status === 200 || r.status === 302,
        });

        // ★ Step 2: หา Login form action URL หรือ redirect URL
        // กรณี 1: ถ้ามีปุ่มเลือกช่องทาง Login ที่ redirect ไปอีก domain
        // กรณี 2: ถ้าหน้า Login redirect เลย (302)

        let authUrl = AUTH_DOMAIN;

        // ถ้าไม่ได้กำหนด AUTH_DOMAIN มา ลองหาจาก redirect
        if (!authUrl && loginPageRes.status === 302) {
            authUrl = loginPageRes.headers['Location'];
        }

        // ถ้ายังหาไม่ได้ ลองหาจาก HTML form action
        if (!authUrl && loginPageRes.body) {
            const formMatch = loginPageRes.body.match(/action=["']([^"']+)["']/);
            if (formMatch) {
                authUrl = formMatch[1];
            }
        }

        if (!authUrl) {
            // Fallback: ส่ง POST ไปที่หน้า Login.aspx ตรงๆ
            authUrl = `${TARGET_URL}/Login.aspx`;
        }

        // ★ Step 3: POST credentials ไปที่ Auth Domain
        const loginStart = Date.now();

        const authRes = http.post(authUrl, {
            username: USERNAME,
            password: PASSWORD,
            // ★ ปรับ field names ตามระบบจริง เช่น:
            // txtUsername: USERNAME,
            // txtPassword: PASSWORD,
            // __VIEWSTATE: extractViewState(loginPageRes.body),
            // __EVENTVALIDATION: extractEventValidation(loginPageRes.body),
        }, {
            redirects: 5, // ให้ follow redirect กลับไปที่ domain หลักได้
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const loginEnd = Date.now();
        loginDuration.add(loginEnd - loginStart);

        // ★ Step 4: ตรวจสอบว่า Login สำเร็จหรือไม่
        const loginSuccess = check(authRes, {
            'Auth response OK': (r) => r.status === 200 || r.status === 302,
            'Redirected back to app': (r) =>
                r.url.includes('Index.aspx') ||
                r.url.includes(TARGET_URL) ||
                r.status === 200,
            'No login error': (r) => !r.body || !r.body.includes('Login failed'),
        });

        return {
            success: loginSuccess,
            headers: {}, // cookies ถูกเก็บใน cookie jar อัตโนมัติ
        };

    } catch (error) {
        console.error(`Login error: ${error.message}`);
        return {
            success: false,
            error: error.message,
        };
    }
}

// ──────────────────────────────────────────────
// ASP.NET Helper Functions
// ──────────────────────────────────────────────
// ★ ถ้าระบบเป้าหมายเป็น ASP.NET WebForms จะต้องส่ง __VIEWSTATE ด้วย

function extractViewState(html) {
    if (!html) return '';
    const match = html.match(/id="__VIEWSTATE"\s+value="([^"]*)"/);
    return match ? match[1] : '';
}

function extractEventValidation(html) {
    if (!html) return '';
    const match = html.match(/id="__EVENTVALIDATION"\s+value="([^"]*)"/);
    return match ? match[1] : '';
}

function extractRequestVerificationToken(html) {
    if (!html) return '';
    const match = html.match(/name="__RequestVerificationToken"\s+value="([^"]*)"/);
    return match ? match[1] : '';
}

// ──────────────────────────────────────────────
// Teardown
// ──────────────────────────────────────────────
export function teardown(data) {
    console.log('🏁 Test completed');
    console.log(`Setup time: ${data.setupTime}`);
}

// ──────────────────────────────────────────────
// Custom Summary (JSON output สำหรับ Backend parse)
// ──────────────────────────────────────────────
export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: '  ', enableColors: true }),
        '/tmp/k6-result.json': JSON.stringify(data, null, 2),
    };
}

// k6 built-in text summary
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';
```

---

## 🖥️ Frontend Specifications

### Tech Stack
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts (เหมาะกับ React) หรือ Chart.js
- **State Management**: Zustand หรือ React Query
- **WebSocket**: native WebSocket API
- **Icons**: Lucide React

### หน้าจอที่ต้องมี

#### 1. Home Page — Test Configuration Form (`/`)

ฟอร์มสำหรับตั้งค่าเทส ประกอบด้วย:

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| Target URL | text input | URL ของระบบที่จะเทส เช่น `https://app.example.com` | ✅ |
| Auth Domain | text input | URL ของระบบ Login (ถ้าคนละ domain) เช่น `https://auth.another.com/login` | ❌ (ถ้าไม่กรอก k6 จะหาเองจาก redirect) |
| Username | text input | Username สำหรับ Login เข้าระบบเป้าหมาย | ✅ |
| Password | password input | Password สำหรับ Login | ✅ |
| Virtual Users (VUs) | number input / slider | จำนวน concurrent users (1-500) | ✅ (default: 10) |
| Test Duration | select / input | ระยะเวลาเทส: 30s, 1m, 5m, 10m, 30m | ✅ (default: 1m) |
| Ramp-up Time | select / input | เวลา ramp-up: 10s, 30s, 1m, 2m | ✅ (default: 30s) |
| Post-Login URLs | dynamic list | รายการ URL paths ที่ต้องการเทสหลัง login (เช่น `/Dashboard`, `/Search`) | ❌ |
| Login Form Fields | key-value pairs | ชื่อ field ของฟอร์ม login (เช่น `txtUsername`, `txtPassword`) ถ้าไม่ใช่ค่า default | ❌ |
| ASP.NET Mode | checkbox | ✅ = เปิดโหมด extract __VIEWSTATE, __EVENTVALIDATION | ❌ (default: off) |

**ปุ่ม Actions:**
- 🚀 **Start Test** — เริ่มรันเทส
- 🧪 **Dry Run** — ทดสอบ Login ก่อน 1 ครั้ง (ไม่รัน load test) เพื่อ validate config
- 📋 **Save Config** — บันทึก config ไว้ใช้ซ้ำ
- 📂 **Load Config** — โหลด config ที่เคยบันทึก

#### 2. Test Running Page (`/test/:id/running`)

แสดง **Live Progress** ระหว่างรัน k6:

- **Progress Bar** — แสดง % ของเวลาที่ผ่านไป
- **Live Metrics Panel** (update ผ่าน WebSocket):
  - Current VUs
  - Requests/sec (throughput)
  - Average Response Time
  - Error Count
  - Running Duration
- **Live Log Stream** — แสดง k6 stdout แบบ realtime (เหมือน terminal)
- **ปุ่ม Stop Test** — หยุดเทสก่อนเวลา (ส่ง SIGINT ให้ k6 process)

#### 3. Result Dashboard (`/test/:id/results`)

**Summary Cards** (ด้านบน):

| Card | Value | Description |
|------|-------|-------------|
| Total Requests | number | จำนวน HTTP requests ทั้งหมด |
| Avg Response Time | ms | ค่าเฉลี่ย response time |
| P95 Response Time | ms | Percentile 95 |
| P99 Response Time | ms | Percentile 99 |
| Max Response Time | ms | ค่าสูงสุด |
| Error Rate | % | เปอร์เซ็นต์ error |
| Throughput | req/s | จำนวน requests ต่อวินาที |
| Total Data | KB/MB | ข้อมูลที่รับส่งทั้งหมด |
| Login Success Rate | % | อัตราสำเร็จของ Login |
| Avg Login Duration | ms | เวลาเฉลี่ยในการ Login |

**Charts** (ด้านล่าง):

1. **Response Time Over Time** (Line Chart)
   - แกน X: เวลา
   - แกน Y: response time (ms)
   - เส้น: avg, P50, P90, P95, P99

2. **Throughput Over Time** (Area Chart)
   - แกน X: เวลา
   - แกน Y: requests/sec

3. **Virtual Users Over Time** (Area Chart)
   - แสดง VU count ตลอดการเทส (ramp-up → steady → ramp-down)

4. **Error Rate Over Time** (Bar Chart)
   - แสดง error count ต่อช่วงเวลา
   - สี: เขียว = success, แดง = error

5. **Response Time Distribution** (Histogram)
   - การกระจายของ response time

6. **Latency Percentiles** (Gauge / Bar)
   - แสดง P50, P90, P95, P99 เปรียบเทียบกัน

7. **Login Duration vs Page Load** (Grouped Bar)
   - เทียบเวลา login กับเวลาโหลดหน้า

**Export Options:**
- 📥 Download JSON (raw k6 result)
- 📥 Download CSV (summary)
- 📥 Download PDF Report (with charts)
- 🔗 Share Link (สร้าง shareable link ภายใน internal network)

#### 4. History Page (`/history`)

ตารางแสดงประวัติเทสทั้งหมด:

| Column | Description |
|--------|-------------|
| Test ID | Auto-increment |
| Target URL | URL ที่เทส |
| VUs | จำนวน virtual users |
| Duration | ระยะเวลาเทส |
| Avg Response Time | ค่าเฉลี่ย |
| P95 | Percentile 95 |
| Error Rate | % error |
| Status | ✅ Completed / ❌ Failed / 🔄 Running |
| Date | วันที่รัน |
| Actions | View / Re-run / Delete |

- **Compare Feature**: เลือก 2 test results แล้วเปรียบเทียบกัน side-by-side
- **Filter**: กรอง by URL, date range, status
- **Sort**: เรียงลำดับตาม column

---

## ⚙️ Backend Specifications

### Tech Stack
- **Runtime**: Node.js 20+
- **Framework**: Express.js with TypeScript
- **Database**: SQLite (via better-sqlite3)
- **WebSocket**: ws library
- **Process Management**: child_process (spawn) สำหรับรัน k6

### API Endpoints

```
POST   /api/tests              — สร้างและเริ่ม test ใหม่
GET    /api/tests              — ดึงรายการ test ทั้งหมด
GET    /api/tests/:id          — ดึงข้อมูล test เฉพาะ
DELETE /api/tests/:id          — ลบ test
POST   /api/tests/:id/stop     — หยุด test ที่กำลังรัน
POST   /api/tests/dry-run      — ทดสอบ Login อย่างเดียว

GET    /api/results/:testId    — ดึงผลลัพธ์ของ test
GET    /api/results/:testId/export/json  — Export JSON
GET    /api/results/:testId/export/csv   — Export CSV

POST   /api/configs            — บันทึก test config
GET    /api/configs            — ดึง saved configs
DELETE /api/configs/:id        — ลบ config

WS     /ws/test/:id            — WebSocket สำหรับ live progress
```

### k6 Runner Service

```typescript
// services/k6-runner.service.ts — Pseudo code

class K6RunnerService {
    /**
     * สั่งรัน k6 script ด้วย child_process.spawn
     * ส่ง config ผ่าน environment variables
     */
    async runTest(config: TestConfig): Promise<void> {
        const k6Process = spawn('k6', [
            'run',
            '--out', 'json=/tmp/k6-metrics.json',  // ★ output metrics เป็น JSON stream
            '--summary-export', '/tmp/k6-summary.json',
            './k6-scripts/cross-domain-login.js',
        ], {
            env: {
                ...process.env,
                TARGET_URL: config.targetUrl,
                AUTH_DOMAIN: config.authDomain || '',
                USERNAME: config.username,
                PASSWORD: config.password,
                VUS: String(config.vus),
                TEST_DURATION: config.duration,
                RAMP_UP: config.rampUp,
                POST_LOGIN_URLS: JSON.stringify(config.postLoginUrls || []),
                LOGIN_FIELD_USERNAME: config.loginFieldUsername || 'username',
                LOGIN_FIELD_PASSWORD: config.loginFieldPassword || 'password',
                ASPNET_MODE: config.aspnetMode ? 'true' : 'false',
            },
        });

        // Stream stdout/stderr ไปให้ Frontend ผ่าน WebSocket
        k6Process.stdout.on('data', (data) => {
            this.broadcastProgress(testId, data.toString());
        });

        k6Process.stderr.on('data', (data) => {
            this.broadcastProgress(testId, data.toString());
        });

        k6Process.on('close', async (code) => {
            // Parse ผลลัพธ์แล้วบันทึกลง DB
            const results = await this.parseResults('/tmp/k6-summary.json');
            const metrics = await this.parseMetricsStream('/tmp/k6-metrics.json');
            await this.saveResults(testId, results, metrics);
            this.broadcastComplete(testId, code);
        });
    }

    /**
     * ★ Parse k6 JSON output stream
     * k6 --out json จะ output แต่ละ metric เป็น JSON line
     * ใช้สำหรับสร้างกราฟ time-series
     */
    async parseMetricsStream(filePath: string): Promise<TimeSeriesData[]> {
        // อ่าน NDJSON (newline-delimited JSON)
        // แต่ละบรรทัดจะเป็น metric data point
        // เช่น: {"type":"Point","metric":"http_req_duration","data":{"time":"...","value":123.45}}
    }

    /**
     * หยุด k6 process
     */
    async stopTest(testId: string): Promise<void> {
        const process = this.runningProcesses.get(testId);
        if (process) {
            process.kill('SIGINT'); // k6 จะ graceful shutdown
        }
    }
}
```

### Database Schema

```sql
-- ตาราง tests: เก็บ config และ status ของแต่ละ test run
CREATE TABLE tests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    target_url  TEXT NOT NULL,
    auth_domain TEXT,
    username    TEXT NOT NULL,
    vus         INTEGER NOT NULL DEFAULT 10,
    duration    TEXT NOT NULL DEFAULT '1m',
    ramp_up     TEXT NOT NULL DEFAULT '30s',
    post_login_urls TEXT,        -- JSON array
    login_fields    TEXT,        -- JSON object
    aspnet_mode     BOOLEAN DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed | stopped
    started_at  DATETIME,
    completed_at DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง results: เก็บผลลัพธ์สรุปของแต่ละ test
CREATE TABLE results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id         INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    total_requests  INTEGER,
    avg_response_time   REAL,
    min_response_time   REAL,
    max_response_time   REAL,
    p50_response_time   REAL,
    p90_response_time   REAL,
    p95_response_time   REAL,
    p99_response_time   REAL,
    throughput          REAL,        -- req/s
    error_rate          REAL,        -- 0.0 - 1.0
    error_count         INTEGER,
    total_data_received INTEGER,     -- bytes
    total_data_sent     INTEGER,     -- bytes
    login_success_rate  REAL,
    avg_login_duration  REAL,
    successful_logins   INTEGER,
    failed_logins       INTEGER,
    raw_summary         TEXT,        -- Full k6 summary JSON
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง metrics: เก็บ time-series data สำหรับกราฟ
CREATE TABLE metrics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id     INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    timestamp   DATETIME NOT NULL,
    metric_name TEXT NOT NULL,       -- http_req_duration, http_reqs, vus, etc.
    metric_value REAL NOT NULL,
    tags        TEXT                 -- JSON object for additional context
);

-- Index สำหรับ query เร็ว
CREATE INDEX idx_metrics_test_id ON metrics(test_id);
CREATE INDEX idx_metrics_timestamp ON metrics(test_id, timestamp);
CREATE INDEX idx_results_test_id ON results(test_id);

-- ตาราง configs: เก็บ saved configurations
CREATE TABLE configs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    config      TEXT NOT NULL,       -- JSON object of test config
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔒 Security Notes (Internal Use)

แม้เป็น internal tool แต่ควรมี:

- **Password Encryption**: เข้ารหัส password ใน database (ใช้ AES encryption) อย่าเก็บเป็น plaintext
- **Bind to localhost**: Express listen เฉพาะ `127.0.0.1` ไม่ใช่ `0.0.0.0`
- **Rate Limit**: จำกัดจำนวน concurrent tests (เช่น max 3 tests พร้อมกัน)
- **Input Validation**: validate URL format, VUs range, duration format
- **k6 Process Isolation**: จำกัด resource ของ k6 process (timeout, memory limit)
- **No credential logging**: อย่า log password ใน console หรือ file

---

## 🎨 UI/UX Design Direction

### Theme: **"Mission Control" — Dark Industrial Dashboard**

- **Dark mode** เป็นหลัก (เหมาะกับ dashboard monitoring)
- **Color Palette**:
  - Background: `#0a0a0f` (เกือบดำ)
  - Surface: `#12121a`
  - Primary Accent: `#00d4ff` (ฟ้านีออน)
  - Success: `#00ff88`
  - Warning: `#ffaa00`
  - Error: `#ff4466`
  - Text: `#e0e0e8`
- **Typography**: `JetBrains Mono` สำหรับตัวเลข/metrics, `Plus Jakarta Sans` สำหรับ text
- **Effects**: subtle glow effects บน metrics cards, smooth transitions
- **Charts**: ใช้สีเดียวกับ color palette, มี gradient fills

---

## 📦 Installation & Setup

### Prerequisites

```bash
# ติดตั้ง k6
# macOS
brew install k6

# Windows (choco)
choco install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
    --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
    sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker (alternative)
docker pull grafana/k6
```

### Project Setup

```bash
# Clone & install
git clone <repo-url>
cd k6-load-test-app

# Install dependencies (both frontend & backend)
npm install          # root workspace

# Start development
npm run dev          # starts both frontend (port 5173) + backend (port 3001)

# Or start separately
npm run dev:backend  # backend only
npm run dev:frontend # frontend only
```

### Environment Variables (.env)

```env
# Backend
PORT=3001
HOST=127.0.0.1
DB_PATH=./data/k6-dashboard.db
K6_SCRIPT_PATH=./src/k6-scripts/cross-domain-login.js
K6_BINARY_PATH=k6                    # หรือ path เต็ม เช่น /usr/local/bin/k6
MAX_CONCURRENT_TESTS=3
ENCRYPTION_KEY=your-32-char-key-here  # สำหรับเข้ารหัส password

# Frontend
VITE_API_URL=http://127.0.0.1:3001
VITE_WS_URL=ws://127.0.0.1:3001
```

---

## 🧪 Testing Checklist

ก่อน deploy ตรวจสอบ:

- [ ] ฟอร์ม validation ทำงานถูกต้อง (URL format, VUs range, required fields)
- [ ] Dry Run สามารถทดสอบ Login ได้จริง
- [ ] k6 process ถูก spawn และ environment variables ส่งค่าถูกต้อง
- [ ] WebSocket ส่ง live progress กลับมาที่หน้าเว็บ
- [ ] ปุ่ม Stop Test สามารถหยุด k6 process ได้
- [ ] ผลลัพธ์ถูก parse จาก k6 JSON output อย่างถูกต้อง
- [ ] ข้อมูลถูกบันทึกลง SQLite
- [ ] กราฟทั้ง 7 แบบ แสดงผลถูกต้อง
- [ ] Export JSON/CSV ทำงานได้
- [ ] History page แสดง list และ filter ได้
- [ ] Compare feature ทำงานได้
- [ ] Password ไม่ถูก log ใน console หรือ file
- [ ] Application bind เฉพาะ localhost
- [ ] Error handling ครอบคลุม (k6 not installed, invalid credentials, network error)

---

## 🔄 Nice-to-Have (Phase 2)

สิ่งที่อาจเพิ่มเติมในอนาคต:

1. **Custom k6 Script Editor** — ให้ user แก้ k6 script ผ่านหน้าเว็บ (Monaco Editor)
2. **Scheduled Tests** — ตั้งเวลาให้รัน test อัตโนมัติ (cron)
3. **Alert / Notification** — แจ้งเตือนเมื่อ P95 เกิน threshold
4. **Multi-Scenario Support** — รัน scenario หลายๆ แบบในเทสเดียว
5. **Integration with Grafana** — ส่ง metrics ไป Grafana ด้วย InfluxDB
6. **Docker Compose** — รัน k6 ใน container พร้อม InfluxDB + Grafana
7. **Report Generation** — สร้าง PDF report อัตโนมัติ
8. **Test Templates** — เก็บ template สำหรับ login flow ที่แตกต่างกัน (OAuth, SAML, Basic Auth, Form-based)

---

## 💡 Implementation Priority

สร้างตามลำดับนี้:

### Sprint 1: Foundation
1. Backend: Express + SQLite setup
2. Backend: k6 runner service (child_process)
3. Frontend: Test config form
4. Frontend: Basic API integration

### Sprint 2: Core Features
5. k6 script: Cross-domain login flow
6. Backend: Result parser service
7. Frontend: Result dashboard with charts
8. Backend + Frontend: WebSocket live progress

### Sprint 3: Polish
9. Frontend: History page with filter/sort
10. Frontend: Compare feature
11. Backend: Export endpoints
12. Security: Password encryption, input validation

### Sprint 4: Enhancement
13. Dry Run feature
14. Saved configs
15. Error handling & edge cases
16. UI polish & responsive design

---

## ⚠️ Important Notes for AI Agent

1. **k6 ต้องติดตั้งแยก** — k6 ไม่ใช่ npm package, ต้องติดตั้งเป็น binary ผ่าน brew/apt/choco หรือใช้ Docker
2. **Cross-domain cookie handling** — k6 มี cookie jar built-in แต่ cross-domain อาจต้องจัดการ cookie manually
3. **ASP.NET WebForms** — ถ้าเป้าหมายเป็น ASP.NET ต้อง extract `__VIEWSTATE` และ `__EVENTVALIDATION` จาก HTML ก่อน POST
4. **k6 JSON output** — ใช้ `--out json=file.json` จะได้ NDJSON (1 JSON per line) เหมาะกับ time-series, ใช้ `--summary-export=file.json` จะได้ summary เป็น JSON object เดียว
5. **อย่า hardcode credentials** — ส่งผ่าน environment variables เสมอ
6. **Process cleanup** — ต้อง handle กรณี server restart/crash ให้ kill k6 process ที่ค้างอยู่
7. **k6 ไม่ใช่ browser** — k6 เป็น protocol-level tool ไม่ render JavaScript, ถ้า login flow ต้องใช้ JS rendering ให้ใช้ k6 browser module (`import { browser } from 'k6/browser'`) แทน
