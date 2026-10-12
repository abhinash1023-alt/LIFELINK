const GROUPS = new Set(["A+","A-","B+","B-","AB+","AB-","O+","O-"]);
const COMPONENTS = new Set(["Whole blood","Red cells","Platelets","Plasma"]);
const STATES = new Set([
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand",
  "Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands",
  "Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"
]);
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const HOUR = 60 * 60 * 1000;
let jwksCache;
let jwksCacheUntil = 0;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
      "Strict-Transport-Security": "max-age=31536000",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    }
  });
}

function fail(status, message) {
  throw new HttpError(status, message);
}

function ensureMethod(request, expected) {
  if (request.method !== expected) fail(405, "Method not allowed.");
}

function ensureDatabase(env) {
  if (!env.DB || !/^[0-9a-fA-F]{64}$/.test(env.DATA_ENCRYPTION_KEY || "")) fail(503, "Matching is being prepared. No information was saved.");
}

function firebaseConfig(env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const apiKey = env.FIREBASE_WEB_API_KEY;
  const authDomain = env.FIREBASE_AUTH_DOMAIN;
  const appId = env.FIREBASE_APP_ID;
  if (!projectId || projectId === "SET_ME" || !apiKey || apiKey === "SET_ME" || !authDomain || authDomain === "SET_ME" || !appId || appId === "SET_ME") {
    fail(503, "Secure sign-in is being prepared. No information was saved.");
  }
  return { apiKey, authDomain, projectId, appId };
}

function bytesFromBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) throw new Error("Invalid base64url value");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesFromBase64(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/_-]*={0,2}$/.test(value)) throw new Error("Invalid base64 value");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/=/g, "");
  if (normalized.length % 4 === 1) throw new Error("Invalid base64 value");
  const raw = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(bytesFromBase64Url(value)));
}

async function loadGoogleKeys(force) {
  if (!force && jwksCache && Date.now() < jwksCacheUntil) return jwksCache;
  const response = await fetch(JWKS_URL, force ? {} : { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!response.ok) fail(503, "Phone sign-in is temporarily unavailable.");
  const data = await response.json();
  if (!Array.isArray(data.keys)) fail(503, "Phone sign-in is temporarily unavailable.");
  jwksCache = data.keys;
  jwksCacheUntil = Date.now() + 5 * 60 * 1000;
  return jwksCache;
}

async function verifyIdentityToken(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = /^Bearer ([A-Za-z0-9._-]{100,8192})$/.exec(authHeader);
  if (!match) fail(401, "Sign in with your verified phone number first.");
  const parts = match[1].split(".");
  if (parts.length !== 3) fail(401, "Please sign in again.");
  let header;
  let claims;
  try {
    header = decodeJsonPart(parts[0]);
    claims = decodeJsonPart(parts[1]);
  } catch {
    fail(401, "Please sign in again.");
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string" || header.typ !== "JWT") fail(401, "Please sign in again.");
  const keys = await loadGoogleKeys(false);
  let jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) {
    const refreshed = await loadGoogleKeys(true);
    jwk = refreshed.find((key) => key.kid === header.kid && key.kty === "RSA");
  }
  if (!jwk) fail(401, "Please sign in again.");
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signed = new TextEncoder().encode(parts[0] + "." + parts[1]);
  let valid = false;
  try {
    valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, bytesFromBase64Url(parts[2]), signed);
  } catch {
    fail(401, "Please sign in again.");
  }
  if (!valid) fail(401, "Please sign in again.");

  const projectId = env.FIREBASE_PROJECT_ID;
  const now = Math.floor(Date.now() / 1000);
  const provider = claims.firebase && claims.firebase.sign_in_provider;
  if (
    !projectId ||
    claims.aud !== projectId ||
    claims.iss !== "https://securetoken.google.com/" + projectId ||
    typeof claims.sub !== "string" ||
    claims.sub.length < 1 ||
    claims.sub.length > 128 ||
    typeof claims.exp !== "number" ||
    claims.exp <= now ||
    typeof claims.iat !== "number" ||
    claims.iat > now + 60 ||
    typeof claims.auth_time !== "number" ||
    claims.auth_time > now + 60 ||
    provider !== "phone" ||
    typeof claims.phone_number !== "string" ||
    !/^\+[1-9][0-9]{7,14}$/.test(claims.phone_number)
  ) {
    fail(401, "Please sign in again with a verified phone number.");
  }
  return { uid: claims.sub, phone: claims.phone_number };
}

async function readJson(request) {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) fail(415, "Send the form as JSON.");
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 8192) fail(413, "The form is too large.");
  if (!request.body) fail(400, "The form is empty.");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      fail(413, "The form is too large.");
    }
    chunks.push(item.value);
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(joined));
    if (!value || Array.isArray(value) || typeof value !== "object") fail(400, "The form is invalid.");
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    fail(400, "The form is invalid.");
  }
}

function textField(value, min, max, label) {
  if (typeof value !== "string") fail(400, "Enter a valid " + label + ".");
  const clean = value.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length < min || clean.length > max) fail(400, "Enter a valid " + label + ".");
  return clean;
}

function placeKey(value) {
  return value.normalize("NFKC").toLocaleLowerCase("en-IN").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function validateLocation(stateValue, districtValue) {
  const state = textField(stateValue, 2, 80, "state or union territory");
  const canonicalState = Array.from(STATES).find((name) => placeKey(name) === placeKey(state));
  if (!canonicalState) fail(400, "Choose an Indian state or union territory.");
  const district = textField(districtValue, 2, 60, "district");
  const districtKey = placeKey(district);
  if (!districtKey) fail(400, "Enter a district name using letters or numbers.");
  return {
    state: canonicalState,
    stateKey: placeKey(canonicalState),
    district,
    districtKey
  };
}

function parseGroup(value) {
  if (typeof value !== "string" || !GROUPS.has(value)) fail(400, "Choose a valid blood group.");
  return value;
}

function encryptionKey(env) {
  const hex = env.DATA_ENCRYPTION_KEY || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) fail(503, "Matching is being prepared. No information was saved.");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptPhone(phone, env) {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(phone));
  return { iv: toBase64(iv), cipher: toBase64(new Uint8Array(data)) };
}

async function decryptPhone(ivText, cipherText, env) {
  const key = await encryptionKey(env);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesFromBase64(ivText), tagLength: 128 },
    key,
    bytesFromBase64(cipherText)
  );
  return new TextDecoder().decode(plain);
}

async function requireProfile(env, uid) {
  const profile = await env.DB.prepare(
    "SELECT uid, blood_group, state, state_key, district, district_key FROM donor_profiles WHERE uid = ?"
  ).bind(uid).first();
  if (!profile) fail(403, "Set up a volunteer profile before viewing matches.");
  return profile;
}

async function getProfile(request, env, identity) {
  ensureMethod(request, "GET");
  ensureDatabase(env);
  const profile = await env.DB.prepare(
    "SELECT blood_group, state, district, created_at, updated_at FROM donor_profiles WHERE uid = ?"
  ).bind(identity.uid).first();
  return json({ profile: profile || null });
}

async function saveProfile(request, env, identity) {
  ensureMethod(request, "PUT");
  ensureDatabase(env);
  const body = await readJson(request);
  if (body.volunteerConsent !== true) fail(400, "Confirm the volunteer consent to save a profile.");
  const bloodGroup = parseGroup(body.bloodGroup);
  const location = validateLocation(body.state, body.district);
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO donor_profiles (uid,blood_group,state,state_key,district,district_key,consent_version,consented_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) " +
    "ON CONFLICT(uid) DO UPDATE SET blood_group=excluded.blood_group,state=excluded.state,state_key=excluded.state_key,district=excluded.district,district_key=excluded.district_key,consent_version=excluded.consent_version,consented_at=excluded.consented_at,updated_at=excluded.updated_at"
  ).bind(identity.uid, bloodGroup, location.state, location.stateKey, location.district, location.districtKey, "lifelink-volunteer-v1", now, now, now).run();
  return json({ ok: true, message: "Volunteer profile saved. Your phone number is not listed publicly." });
}

async function deleteProfile(request, env, identity) {
  ensureMethod(request, "DELETE");
  ensureDatabase(env);
  await env.DB.prepare("DELETE FROM donor_profiles WHERE uid = ?").bind(identity.uid).run();
  await env.DB.prepare("DELETE FROM disclosures WHERE donor_uid = ?").bind(identity.uid).run();
  return json({ ok: true });
}

async function createRequest(request, env, identity) {
  ensureMethod(request, "POST");
  ensureDatabase(env);
  const body = await readJson(request);
  if (body.sharePhone !== true) fail(400, "Consent to share your verified number with matching volunteers is required for direct contact.");
  const bloodGroup = parseGroup(body.bloodGroup);
  if (typeof body.component !== "string" || !COMPONENTS.has(body.component)) fail(400, "Choose a valid blood component.");
  const units = Number(body.units);
  if (!Number.isInteger(units) || units < 1 || units > 20) fail(400, "Enter a number of units from 1 to 20.");
  const location = validateLocation(body.state, body.district);
  const hospital = textField(body.hospital, 2, 100, "hospital or blood-centre name");
  if (typeof body.neededBy !== "string") fail(400, "Choose when the blood is needed.");
  const neededByMs = Date.parse(body.neededBy);
  const now = Date.now();
  if (!Number.isFinite(neededByMs) || neededByMs <= now || neededByMs > now + 72 * HOUR) {
    fail(400, "Choose a time within the next 72 hours.");
  }
  const id = crypto.randomUUID();
  const expiresAt = Math.min(now + 72 * HOUR, neededByMs);
  const encrypted = await encryptPhone(identity.phone, env);
  const inserted = await env.DB.prepare(
    "INSERT INTO requests (id,owner_uid,blood_group,component,units,state,state_key,district,district_key,hospital,needed_by,expires_at,phone_cipher,phone_iv,share_phone,consent_version,consented_at,created_at) " +
    "SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM requests WHERE owner_uid = ? AND expires_at > ?) < 2"
  ).bind(
    id, identity.uid, bloodGroup, body.component, units, location.state, location.stateKey, location.district,
    location.districtKey, hospital, new Date(neededByMs).toISOString(), expiresAt, encrypted.cipher, encrypted.iv,
    1, "lifelink-contact-v1", now, now, identity.uid, now
  ).run();
  if (!inserted.meta || !inserted.meta.changes) fail(429, "Close an existing request before creating another.");
  return json({ ok: true, id, expiresAt });
}

async function listMyRequests(request, env, identity) {
  ensureMethod(request, "GET");
  ensureDatabase(env);
  const now = Date.now();
  const result = await env.DB.prepare(
    "SELECT id,blood_group,component,units,state,district,hospital,needed_by,expires_at,created_at " +
    "FROM requests WHERE owner_uid = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 5"
  ).bind(identity.uid, now).all();
  return json({ requests: result.results || [] });
}

async function deleteRequest(request, env, identity, id) {
  ensureMethod(request, "DELETE");
  ensureDatabase(env);
  const result = await env.DB.prepare(
    "DELETE FROM requests WHERE id = ? AND owner_uid = ?"
  ).bind(id, identity.uid).run();
  if (!result.meta || !result.meta.changes) fail(404, "Request not found.");
  return json({ ok: true });
}

async function listMatches(request, env, identity) {
  ensureMethod(request, "GET");
  ensureDatabase(env);
  const profile = await requireProfile(env, identity.uid);
  const now = Date.now();
  const result = await env.DB.prepare(
    "SELECT id,blood_group,component,units,state,district,hospital,needed_by,expires_at,created_at " +
    "FROM requests WHERE blood_group = ? AND state_key = ? AND district_key = ? AND owner_uid <> ? AND share_phone = 1 AND expires_at > ? " +
    "ORDER BY expires_at ASC LIMIT 30"
  ).bind(profile.blood_group, profile.state_key, profile.district_key, identity.uid, now).all();
  return json({ matches: result.results || [] });
}

async function revealContact(request, env, identity, id) {
  ensureMethod(request, "POST");
  ensureDatabase(env);
  const profile = await requireProfile(env, identity.uid);
  const now = Date.now();
  const candidate = await env.DB.prepare(
    "SELECT id,owner_uid,phone_cipher,phone_iv FROM requests " +
    "WHERE id = ? AND blood_group = ? AND state_key = ? AND district_key = ? AND share_phone = 1 AND expires_at > ?"
  ).bind(id, profile.blood_group, profile.state_key, profile.district_key, now).first();
  if (!candidate) fail(404, "This request is no longer available.");
  if (candidate.owner_uid === identity.uid) fail(404, "This request is no longer available.");

  const recorded = await env.DB.prepare(
    "INSERT INTO disclosures (donor_uid,request_id,created_at) " +
    "SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM disclosures WHERE donor_uid = ? AND created_at > ?) < 5 " +
    "ON CONFLICT(donor_uid,request_id) DO NOTHING"
  ).bind(identity.uid, id, now, identity.uid, now - 24 * HOUR).run();
  if (!recorded.meta || !recorded.meta.changes) {
    const prior = await env.DB.prepare(
      "SELECT request_id FROM disclosures WHERE donor_uid = ? AND request_id = ?"
    ).bind(identity.uid, id).first();
    if (!prior) fail(429, "For privacy, you can contact up to five matching requests in 24 hours.");
  }

  const phone = await decryptPhone(candidate.phone_iv, candidate.phone_cipher, env);
  return json({ phone });
}

async function deleteAccount(request, env, identity) {
  ensureMethod(request, "DELETE");
  ensureDatabase(env);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM disclosures WHERE donor_uid = ? OR request_id IN (SELECT id FROM requests WHERE owner_uid = ?)").bind(identity.uid, identity.uid),
    env.DB.prepare("DELETE FROM requests WHERE owner_uid = ?").bind(identity.uid),
    env.DB.prepare("DELETE FROM donor_profiles WHERE uid = ?").bind(identity.uid)
  ]);
  return json({ ok: true });
}

async function routeApi(request, env) {
  const url = new URL(request.url);
  if (request.method !== "GET") {
    const origin = request.headers.get("Origin");
    if (origin !== url.origin) fail(403, "Request origin is not allowed.");
  }
  if (url.pathname === "/api/config") {
    ensureMethod(request, "GET");
    return json(firebaseConfig(env));
  }
  if (url.pathname === "/api/health") {
    ensureMethod(request, "GET");
    ensureDatabase(env);
    try {
      await env.DB.prepare("SELECT 1 FROM donor_profiles LIMIT 1").first();
    } catch {
      fail(503, "Matching is being prepared. No information was saved.");
    }
    return json({ status: "ok" });
  }

  const identity = await verifyIdentityToken(request, env);
  if (url.pathname === "/api/profile") {
    if (request.method === "GET") return getProfile(request, env, identity);
    if (request.method === "PUT") return saveProfile(request, env, identity);
    if (request.method === "DELETE") return deleteProfile(request, env, identity);
    fail(405, "Method not allowed.");
  }
  if (url.pathname === "/api/requests/mine") return listMyRequests(request, env, identity);
  if (url.pathname === "/api/requests") return createRequest(request, env, identity);
  if (url.pathname === "/api/account") return deleteAccount(request, env, identity);
  if (url.pathname === "/api/matches") return listMatches(request, env, identity);

  const deleteMatch = /^\/api\/requests\/([0-9a-f-]{36})$/.exec(url.pathname);
  if (deleteMatch) return deleteRequest(request, env, identity, deleteMatch[1]);
  const contactMatch = /^\/api\/matches\/([0-9a-f-]{36})\/contact$/.exec(url.pathname);
  if (contactMatch) return revealContact(request, env, identity, contactMatch[1]);
  fail(404, "That LifeLink service was not found.");
}

async function cleanExpired(env) {
  ensureDatabase(env);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM requests WHERE expires_at <= ?").bind(now),
    env.DB.prepare("DELETE FROM disclosures WHERE created_at <= ?").bind(now - 30 * 24 * HOUR)
  ]);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await routeApi(request, env);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : "LifeLink could not complete this request. Please try again.";
      return json({ error: message }, status);
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(cleanExpired(env).catch(() => undefined));
  }
};