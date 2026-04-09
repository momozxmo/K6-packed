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
// Configuration from Environment Variables
// ──────────────────────────────────────────────
const TARGET_URL = __ENV.TARGET_URL || 'https://app.example.com';
const USERNAME = __ENV.USERNAME || '';
const PASSWORD = __ENV.PASSWORD || '';
const TEST_DURATION = __ENV.TEST_DURATION || '1m';
const VUS = parseInt(__ENV.VUS) || 10;
const RAMP_UP = __ENV.RAMP_UP || '30s';
const AUTH_DOMAIN = __ENV.AUTH_DOMAIN || '';
const POST_LOGIN_URLS = JSON.parse(__ENV.POST_LOGIN_URLS || '[]');
const LOGIN_FIELD_USERNAME = __ENV.LOGIN_FIELD_USERNAME || 'username';
const LOGIN_FIELD_PASSWORD = __ENV.LOGIN_FIELD_PASSWORD || 'password';
const ASPNET_MODE = __ENV.ASPNET_MODE === 'true';
const DRY_RUN = __ENV.DRY_RUN === 'true';

const APP_BASE_URL = getAppBaseUrl(TARGET_URL);
const LOGIN_PAGE_URL = getLoginPageUrl(TARGET_URL);
const LANDING_PAGE_URL = getLandingPageUrl(TARGET_URL);
const AUTH_PAGE_URL = getAuthPageUrl();

export const options = {
    scenarios: {
        load_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: RAMP_UP, target: VUS },
                { duration: TEST_DURATION, target: VUS },
                { duration: '10s', target: 0 },
            ],
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<3000', 'p(99)<5000'],
        errors: ['rate<0.1'],
    },
};

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────
export function setup() {
    console.log(`🎯 Target: ${TARGET_URL}`);
    console.log(`👤 User: ${USERNAME}`);
    console.log(`👥 VUs: ${VUS}`);
    console.log(`⏱️ Duration: ${TEST_DURATION}`);

    const loginResult = performLogin();
    if (!loginResult.success) {
        throw new Error(`❌ Login failed during setup: ${loginResult.error}`);
    }
    console.log('✅ Setup login successful');

    return {
        setupTime: new Date().toISOString(),
        dryRun: DRY_RUN,
    };
}

// ──────────────────────────────────────────────
// Main VU Function
// ──────────────────────────────────────────────
export default function (data) {
    if (data && data.dryRun) {
        successfulLogins.add(1);
        console.log('✅ Dry run completed — login validated');
        return;
    }

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

    group('02_Post_Login_Actions', function () {
        // Access landing page
        const landingRes = http.get(LANDING_PAGE_URL, {
            headers: loginResult.headers || {},
            redirects: 10,
        });

        check(landingRes, {
            'Landing page status 200': (r) => r.status === 200,
            'Landing page has content': (r) => r.body && r.body.length > 0,
        });

        pageLoadDuration.add(landingRes.timings.duration);
        errorRate.add(landingRes.status !== 200);

        sleep(1);

        // Access additional post-login URLs
        for (const urlPath of POST_LOGIN_URLS) {
            const fullUrl = resolveAppUrl(urlPath);
            const res = http.get(fullUrl, {
                headers: loginResult.headers || {},
                redirects: 10,
            });

            check(res, {
                [`${urlPath} status 200`]: (r) => r.status === 200,
            });

            pageLoadDuration.add(res.timings.duration);
            errorRate.add(res.status !== 200);

            sleep(0.5);
        }
    });

    sleep(Math.random() * 3 + 1);
}

// ──────────────────────────────────────────────
// Cross-Domain Login Function
// ──────────────────────────────────────────────
function performLogin() {
    try {
        // Step 1: Load login page
        const loginPageRes = http.get(LOGIN_PAGE_URL, {
            redirects: 0,
        });

        check(loginPageRes, {
            'Login page loaded': (r) => r.status === 200 || r.status === 302,
        });

        // Step 2: Resolve and load auth page so hidden fields/cookies come from the real auth form
        const initialAuthUrl =
            AUTH_DOMAIN ||
            loginPageRes.headers['Location'] ||
            extractFormAction(loginPageRes.body) ||
            LOGIN_PAGE_URL;

        const authPageUrl = resolveAbsoluteUrl(initialAuthUrl, LOGIN_PAGE_URL);
        const authPageRes = http.get(authPageUrl, {
            redirects: 10,
        });

        check(authPageRes, {
            'Auth page loaded': (r) => r.status === 200,
        });

        const authFormAction = extractFormAction(authPageRes.body);
        const authPostUrl = resolveAbsoluteUrl(authFormAction || authPageUrl, authPageUrl);

        // Step 3: Build form data from the real auth page
        const formData = extractHiddenFields(authPageRes.body);
        formData[LOGIN_FIELD_USERNAME] = USERNAME;
        formData[LOGIN_FIELD_PASSWORD] = PASSWORD;

        // ASP.NET mode: ensure key ASP.NET fields are included
        if (ASPNET_MODE && authPageRes.body) {
            const viewState = extractViewState(authPageRes.body);
            const eventValidation = extractEventValidation(authPageRes.body);
            const reqToken = extractRequestVerificationToken(authPageRes.body);

            if (viewState) formData['__VIEWSTATE'] = viewState;
            if (eventValidation) formData['__EVENTVALIDATION'] = eventValidation;
            if (reqToken) formData['__RequestVerificationToken'] = reqToken;
        }

        // Step 4: POST credentials to auth endpoint
        const loginStart = Date.now();

        const authRes = http.post(authPostUrl, formData, {
            redirects: 10,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Referer: authPageUrl,
            },
        });

        const loginEnd = Date.now();
        loginDuration.add(loginEnd - loginStart);

        // Step 5: Verify auth response is not an auth/logout/login screen
        const authResponseOk = check(authRes, {
            'Auth response OK': (r) => r.status === 200 || r.status === 302,
            'No login error': (r) => !hasLoginError(r.body),
        });

        // Step 6: Verify app landing page is actually reachable after auth
        const landingRes = http.get(LANDING_PAGE_URL, {
            redirects: 10,
            headers: {
                Referer: authRes.url || authPageUrl,
            },
        });

        const landingOk = check(landingRes, {
            'Redirected back to app': (r) =>
                r.status === 200 &&
                isAppUrl(r.url),
            'Landing page status 200': (r) => r.status === 200,
            'Landing page has content': (r) => r.body && r.body.length > 0,
            'Landing page is not login form': (r) => !looksLikeLoginPage(r.body),
        });

        pageLoadDuration.add(landingRes.timings.duration);
        errorRate.add(!(authResponseOk && landingOk));

        return {
            success: authResponseOk && landingOk,
            headers: {},
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
function getAppBaseUrl(targetUrl) {
    const cleanUrl = stripQueryAndHash(targetUrl);
    const origin = getOrigin(cleanUrl);
    let pathPart = cleanUrl.slice(origin.length);

    if (!pathPart || pathPart === '/') {
        return `${origin}/`;
    }

    if (!pathPart.startsWith('/')) {
        pathPart = `/${pathPart}`;
    }

    if (!pathPart.endsWith('/')) {
        const lastSlash = pathPart.lastIndexOf('/');
        const lastSegment = lastSlash >= 0 ? pathPart.slice(lastSlash + 1) : pathPart;
        if (lastSegment.includes('.')) {
            pathPart = pathPart.slice(0, lastSlash + 1);
        } else {
            pathPart = `${pathPart}/`;
        }
    }

    return `${origin}${pathPart}`;
}

function getLandingPageUrl(targetUrl) {
    if (/\/Login\.aspx([?#].*)?$/i.test(targetUrl)) {
        return joinUrl(getAppBaseUrl(targetUrl), 'Index.aspx');
    }
    const cleanUrl = stripQueryAndHash(targetUrl);
    if (cleanUrl.endsWith('/')) {
        return joinUrl(cleanUrl, 'Index.aspx');
    }
    return cleanUrl;
}

function getLoginPageUrl(targetUrl) {
    if (/\/Login\.aspx([?#].*)?$/i.test(targetUrl)) {
        return targetUrl;
    }
    return joinUrl(getAppBaseUrl(targetUrl), 'Login.aspx');
}

function getAuthPageUrl() {
    return AUTH_DOMAIN ? resolveAbsoluteUrl(AUTH_DOMAIN, LOGIN_PAGE_URL) : LOGIN_PAGE_URL;
}

function resolveAbsoluteUrl(url, baseUrl) {
    if (!url) return baseUrl;
    if (/^https?:\/\//i.test(url)) return url;

    const origin = getOrigin(baseUrl);

    if (url.startsWith('//')) {
        const schemeMatch = baseUrl.match(/^(https?):/i);
        const scheme = schemeMatch ? schemeMatch[1] : 'https';
        return `${scheme}:${url}`;
    }

    if (url.startsWith('/')) {
        return `${origin}${url}`;
    }

    return joinUrl(getDirectoryUrl(baseUrl), url);
}

function resolveAppUrl(urlPath) {
    return resolveAbsoluteUrl(urlPath, APP_BASE_URL);
}

function stripQueryAndHash(url) {
    return url.split('#')[0].split('?')[0];
}

function getOrigin(url) {
    const match = url.match(/^(https?:\/\/[^/]+)/i);
    return match ? match[1] : '';
}

function getDirectoryUrl(url) {
    const cleanUrl = stripQueryAndHash(url);
    if (cleanUrl.endsWith('/')) return cleanUrl;
    const lastSlash = cleanUrl.lastIndexOf('/');
    if (lastSlash < 0) return `${cleanUrl}/`;
    return `${cleanUrl.slice(0, lastSlash + 1)}`;
}

function joinUrl(base, path) {
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    return `${normalizedBase}${normalizedPath}`;
}

function extractFormAction(html) {
    if (!html) return '';
    const match = html.match(/<form[^>]*action=["']([^"']+)["']/i);
    return match ? match[1] : '';
}

function extractHiddenFields(html) {
    const fields = {};
    if (!html) return fields;

    const regex = /<input[^>]*type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
        fields[match[1]] = match[2];
    }

    return fields;
}

function hasLoginError(html) {
    if (!html) return false;
    return /login failed|invalid password|invalid username|incorrect|เข้าสู่ระบบไม่สำเร็จ/i.test(html);
}

function looksLikeLoginPage(html) {
    if (!html) return false;
    return /type=["']password["']|login_default|authen_gateway|name=["'](?:username|email|userid|user_id|login|txtUser|txtPass)["']|เข้าสู่ระบบ|sign in/i.test(html);
}

function isAuthOrLogoutUrl(url) {
    if (!url) return false;
    return /authen_gateway|login_default|logout\.aspx/i.test(url);
}

function isAppUrl(url) {
    if (!url) return false;
    return getOrigin(url) === getOrigin(APP_BASE_URL);
}

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
// Custom Summary (JSON output for Backend to parse)
// ──────────────────────────────────────────────
export function handleSummary(data) {
    return {
        stdout: textSummary(data, { indent: '  ', enableColors: true }),
    };
}

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';
