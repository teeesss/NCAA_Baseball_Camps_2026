<?php
/**
 * COMMUNITY HUMAN VERIFICATION HANDLER  v2
 * =========================================
 * Manages crowd-sourced "Human Verified" counts for each school.
 *
 * ENDPOINTS:
 *   GET  ?action=get                         → Returns all verification counts
 *   GET  ?action=get&school=Air+Force        → Returns count for one school
 *   POST { schoolName, action: "verify" }    → Increment human verification count
 *   POST { schoolName, action: "unverify" }  → Decrement (admin use only)
 *
 * RATE LIMITING:
 *   - One verification per IP per school per 24h (stored in ip_log.json)
 *   - Max 100 verifications per school (spam cap)
 *
 * DATA FILE:
 *   human_verifications.json → { "Air Force": 3, "Alabama": 7, ... }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

// ── File paths ────────────────────────────────────────────────
$countFile  = __DIR__ . '/human_verifications.json';
$ipLogFile  = __DIR__ . '/human_verifications_ip.json';

// ── Initialize files ─────────────────────────────────────────
foreach ([$countFile, $ipLogFile] as $f) {
    if (!file_exists($f)) file_put_contents($f, '{}');
}

$counts = json_decode(file_get_contents($countFile), true) ?: [];
$ipLog  = json_decode(file_get_contents($ipLogFile), true)  ?: [];

// ── Helper: get client IP ─────────────────────────────────────
function getClientIp(): string {
    return $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['HTTP_CLIENT_IP']
        ?? $_SERVER['REMOTE_ADDR']
        ?? 'unknown';
}

// ── GET requests ─────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $school = $_GET['school'] ?? null;
    if ($school) {
        echo json_encode([
            'school' => $school,
            'count'  => $counts[$school] ?? 0,
        ]);
    } else {
        echo json_encode($counts);
    }
    exit;
}

// ── POST requests ─────────────────────────────────────────────
$input  = json_decode(file_get_contents('php://input'), true);
$school = trim($input['schoolName'] ?? '');
$action = $input['action'] ?? 'verify';

if (empty($school)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing schoolName']);
    exit;
}

// ── Rate limit: 1 vote per IP per school per 24h ─────────────
$ip       = getClientIp();
$ipKey    = md5($ip); // hash for privacy
$now      = time();
$windowSec = 86400; // 24 hours

$ipEntry  = $ipLog[$ipKey][$school] ?? 0;
if ($action === 'verify' && ($now - $ipEntry) < $windowSec) {
    $remaining = $windowSec - ($now - $ipEntry);
    $hours     = ceil($remaining / 3600);
    echo json_encode([
        'success'     => false,
        'rateLimited' => true,
        'message'     => "You already verified {$school}. Try again in ~{$hours}h.",
        'count'       => $counts[$school] ?? 0,
    ]);
    exit;
}

// ── Update count ──────────────────────────────────────────────
if (!isset($counts[$school])) $counts[$school] = 0;

if ($action === 'verify') {
    $counts[$school] = min(100, $counts[$school] + 1);

    // Log IP + timestamp
    if (!isset($ipLog[$ipKey])) $ipLog[$ipKey] = [];
    $ipLog[$ipKey][$school] = $now;

} elseif ($action === 'unverify') {
    $counts[$school] = max(0, $counts[$school] - 1);
}

// ── Save ──────────────────────────────────────────────────────
file_put_contents($countFile, json_encode($counts, JSON_PRETTY_PRINT));
file_put_contents($ipLogFile, json_encode($ipLog,  JSON_PRETTY_PRINT));

echo json_encode([
    'success' => true,
    'school'  => $school,
    'action'  => $action,
    'count'   => $counts[$school],
]);
