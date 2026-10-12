const $ = (selector) => document.querySelector(selector);
const stateNames = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"];
let auth = null;
let authSdk = null;
let currentUser = null;
let confirmation = null;
let verifier = null;
let firebaseConfigured = false;

function setText(selector, message) {
  const node = $(selector);
  if (node) node.textContent = message || "";
}

function setStatus(selector, message, kind) {
  const node = $(selector);
  if (!node) return;
  node.textContent = message || "";
  node.classList.remove("status-error", "status-success", "status-info");
  if (kind) node.classList.add("status-" + kind);
}

async function readJsonResponse(response) {
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The service could not complete that action.");
  return data;
}

async function api(path, options) {
  if (!currentUser) throw new Error("Sign in with your phone number first.");
  const token = await currentUser.getIdToken();
  const init = Object.assign({ method: "GET", cache: "no-store", credentials: "same-origin" }, options || {});
  init.headers = Object.assign({}, init.headers || {}, { "Authorization": "Bearer " + token });
  if (init.body !== undefined) init.headers["Content-Type"] = "application/json";
  const response = await fetch(path, init);
  return readJsonResponse(response);
}

function showSignedIn(user) {
  currentUser = user;
  $("#sign-in-panel").hidden = Boolean(user);
  $("#matching-app").hidden = !user;
  if (!user) return;
  setText("#service-status", "");
  refreshData().catch((error) => setStatus("#app-status", error.message, "error"));
}

function localInputValue(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function setRequestTimeBounds() {
  const field = $("#request-needed-by");
  if (!field) return;
  const now = Date.now();
  field.min = localInputValue(new Date(now + 5 * 60 * 1000));
  field.max = localInputValue(new Date(now + 72 * 60 * 60 * 1000));
}

function dateLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date) + " IST";
}

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function emptyState(container, message) {
  container.replaceChildren(element("p", "empty-state", message));
}

async function refreshProfile() {
  const result = await api("/api/profile");
  const form = $("#profile-form");
  if (!result.profile) {
    form.reset();
    return;
  }
  form.elements.bloodGroup.value = result.profile.blood_group;
  form.elements.state.value = result.profile.state;
  form.elements.district.value = result.profile.district;
  form.elements.volunteerConsent.checked = true;
}

async function refreshMine() {
  const result = await api("/api/requests/mine");
  const list = $("#my-requests-list");
  list.replaceChildren();
  if (!result.requests.length) return emptyState(list, "No active requests.");
  for (const request of result.requests) {
    const card = element("article", "match-card");
    const heading = element("h4", "", request.blood_group + " · " + request.component);
    const details = element("p", "match-detail", request.units + " unit(s) · " + request.district + ", " + request.state);
    const hospital = element("p", "match-detail", request.hospital);
    const expiry = element("p", "match-meta", "Needed by " + dateLabel(request.needed_by) + " · closes " + dateLabel(request.expires_at));
    const button = element("button", "button button-light", "Close request");
    button.type = "button";
    button.addEventListener("click", async () => {
      if (!window.confirm("Close this request now? Its contact number will no longer be shown to new volunteers.")) return;
      try {
        await api("/api/requests/" + encodeURIComponent(request.id), { method: "DELETE" });
        setStatus("#app-status", "Request closed.", "success");
        await refreshData();
      } catch (error) { setStatus("#app-status", error.message, "error"); }
    });
    card.append(heading, details, hospital, expiry, button);
    list.append(card);
  }
}

async function refreshMatches() {
  const list = $("#matches-list");
  list.replaceChildren();
  const profile = await api("/api/profile");
  if (!profile.profile) return emptyState(list, "Save a volunteer profile to see matching requests.");
  const result = await api("/api/matches");
  if (!result.matches.length) return emptyState(list, "No active requests currently match this recorded blood group and district.");
  for (const request of result.matches) {
    const card = element("article", "match-card");
    card.append(
      element("h4", "", request.blood_group + " · " + request.component),
      element("p", "match-detail", request.units + " unit(s) · " + request.district + ", " + request.state),
      element("p", "match-detail", request.hospital),
      element("p", "match-meta", "Needed by " + dateLabel(request.needed_by) + " · expires " + dateLabel(request.expires_at))
    );
    const contact = element("button", "button button-primary", "Reveal requester’s verified phone");
    contact.type = "button";
    contact.addEventListener("click", async () => {
      if (!window.confirm("The requester consented to sharing their verified number with matching volunteers. Reveal it now? Contact them only to coordinate through the treating hospital.")) return;
      contact.disabled = true;
      try {
        const data = await api("/api/matches/" + encodeURIComponent(request.id) + "/contact", { method: "POST", body: "{}" });
        if (typeof data.phone !== "string" || !/^\+[1-9][0-9]{7,14}$/.test(data.phone)) throw new Error("The returned contact number was invalid.");
        const phone = element("a", "revealed-phone", data.phone);
        phone.href = "tel:" + data.phone;
        const notice = element("p", "match-meta", "This number was shared with your signed-in account. Do not forward it without permission.");
        contact.replaceWith(phone, notice);
        setStatus("#app-status", "Contact details revealed. Use the hospital to confirm next steps.", "success");
      } catch (error) {
        setStatus("#app-status", error.message, "error");
        contact.disabled = false;
      }
    });
    card.append(contact);
    list.append(card);
  }
}

async function refreshData() {
  if (!currentUser) return;
  setStatus("#app-status", "Loading your secure matching data…", "info");
  await refreshProfile();
  await Promise.all([refreshMine(), refreshMatches()]);
  setStatus("#app-status", "", null);
}

function formPayload(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function createVerifier() {
  if (verifier) return verifier;
  const { RecaptchaVerifier } = await import("https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js");
  verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "normal",
    "expired-callback": () => setStatus("#phone-status", "The reCAPTCHA expired. Complete it again before requesting a code.", "error")
  });
  await verifier.render();
  return verifier;
}

function resetVerifier() {
  if (verifier) {
    verifier.clear();
    verifier = null;
  }
  $("#recaptcha-container").replaceChildren();
}

async function initializeFirebase() {
  try {
    const [configResponse, healthResponse] = await Promise.all([
      fetch("/api/config", { cache: "no-store", credentials: "same-origin" }),
      fetch("/api/health", { cache: "no-store", credentials: "same-origin" })
    ]);
    const config = await readJsonResponse(configResponse);
    await readJsonResponse(healthResponse);
    const appSdk = await import("https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js");
    authSdk = await import("https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js");
    const firebaseApp = appSdk.initializeApp(config);
    auth = authSdk.getAuth(firebaseApp);
    auth.languageCode = "en";
    await authSdk.setPersistence(auth, authSdk.browserSessionPersistence);
    authSdk.onAuthStateChanged(auth, (user) => showSignedIn(user));
    firebaseConfigured = true;
    $("#send-code").disabled = false;
    setStatus("#service-status", "Secure sign-in and matching service are ready.", "success");
  } catch {
    firebaseConfigured = false;
    $("#send-code").disabled = true;
    setStatus("#service-status", "Phone matching is not configured yet. No request or profile was saved. Use the official eRaktKosh service while setup is completed.", "info");
  }
}

$("#phone-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!firebaseConfigured || !authSdk || !auth) return;
  const phone = $("#phone-number").value.trim();
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
    setStatus("#phone-status", "Enter a valid international number, including the country code (for India, start with +91).", "error");
    return;
  }
  if (!$("#firebase-consent").checked) {
    setStatus("#phone-status", "Please accept the Firebase phone-sign-in notice before requesting an SMS.", "error");
    return;
  }
  const button = $("#send-code");
  button.disabled = true;
  try {
    const appVerifier = await createVerifier();
    confirmation = await authSdk.signInWithPhoneNumber(auth, phone, appVerifier);
    $("#phone-form").hidden = true;
    $("#code-form").hidden = false;
    $("#sms-code").focus();
    setStatus("#code-status", "Code sent. Enter the six digits from the SMS.", "success");
  } catch {
    resetVerifier();
    button.disabled = false;
    setStatus("#phone-status", "Firebase could not send a code. Check the number, reCAPTCHA, SMS region settings, and try again later.", "error");
  }
});

$("#send-code").addEventListener("click", () => $("#phone-form").requestSubmit());
$("#verify-code").addEventListener("click", () => $("#code-form").requestSubmit());
$("#save-profile").addEventListener("click", () => $("#profile-form").requestSubmit());
$("#post-request").addEventListener("click", () => $("#request-form").requestSubmit());

$("#code-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!confirmation) return;
  const code = $("#sms-code").value.trim();
  if (!/^[0-9]{6}$/.test(code)) return setStatus("#code-status", "Enter the six-digit code.", "error");
  try {
    await confirmation.confirm(code);
    confirmation = null;
    resetVerifier();
  } catch {
    setStatus("#code-status", "That code could not be verified. Check it or request a new one.", "error");
  }
});

$("#change-number").addEventListener("click", () => {
  confirmation = null;
  resetVerifier();
  $("#code-form").hidden = true;
  $("#phone-form").hidden = false;
  $("#phone-status").textContent = "";
});

$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formPayload(form);
  try {
    await api("/api/profile", { method: "PUT", body: JSON.stringify({
      bloodGroup: data.bloodGroup,
      state: data.state,
      district: data.district,
      volunteerConsent: form.elements.volunteerConsent.checked
    }) });
    setStatus("#profile-status", "Volunteer profile saved. Your phone is not shown to requesters.", "success");
    await refreshData();
  } catch (error) { setStatus("#profile-status", error.message, "error"); }
});

$("#request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formPayload(form);
  if (!form.elements.sharePhone.checked) return setStatus("#request-status", "Consent is required to share the verified number for direct contact.", "error");
  const neededBy = new Date(data.neededBy);
  if (!Number.isFinite(neededBy.getTime())) return setStatus("#request-status", "Choose a valid date and time.", "error");
  if (neededBy.getTime() > Date.now() + 72 * 60 * 60 * 1000) return setStatus("#request-status", "Choose a time within the next 72 hours.", "error");
  try {
    await api("/api/requests", { method: "POST", body: JSON.stringify({
      bloodGroup: data.bloodGroup,
      component: data.component,
      units: Number(data.units),
      state: data.state,
      district: data.district,
      hospital: data.hospital,
      neededBy: neededBy.toISOString(),
      sharePhone: form.elements.sharePhone.checked
    }) });
    form.reset();
    setRequestTimeBounds();
    setStatus("#request-status", "Request posted. It will close at the requested time or within 72 hours; you can close it sooner.", "success");
    await refreshData();
  } catch (error) { setStatus("#request-status", error.message, "error"); }
});

$("#refresh-matches").addEventListener("click", () => refreshMatches().catch((error) => setStatus("#app-status", error.message, "error")));
$("#sign-out").addEventListener("click", async () => {
  if (!authSdk || !auth) return;
  await authSdk.signOut(auth);
  setStatus("#service-status", "You are signed out.", "info");
});
$("#delete-account").addEventListener("click", async () => {
  if (!currentUser || !authSdk) return;
  const confirmed = window.confirm("Delete all your LifeLink requests, volunteer profile, and contact history, and remove this Firebase sign-in account? This cannot be undone.");
  if (!confirmed) return;
  const button = $("#delete-account");
  button.disabled = true;
  try {
    await api("/api/account", { method: "DELETE" });
    try {
      await authSdk.deleteUser(currentUser);
      currentUser = null;
      setStatus("#account-status", "Your LifeLink data and Firebase sign-in account were deleted.", "success");
    } catch {
      await authSdk.signOut(auth);
      setStatus("#account-status", "Your LifeLink data was deleted. Firebase could not remove the sign-in account because it may require a fresh SMS verification. Sign in again and repeat this action, or email abhinash1023@gmail.com.", "error");
    }
  } catch (error) {
    setStatus("#account-status", error.message, "error");
  } finally {
    button.disabled = false;
  }
});

setRequestTimeBounds();
initializeFirebase();
