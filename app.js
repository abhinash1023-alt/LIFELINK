const STORAGE_KEYS = {
    requests: "lifelink_requests",
    donors: "lifelink_donors"
};

const bloodRequestForm = document.getElementById("bloodRequestForm");
const donorForm = document.getElementById("donorForm");
const requestResult = document.getElementById("requestResult");
const donorResult = document.getElementById("donorResult");

const totalRequests = document.getElementById("totalRequests");
const totalDonors = document.getElementById("totalDonors");
const criticalRequests = document.getElementById("criticalRequests");
const availableDonors = document.getElementById("availableDonors");
const activityList = document.getElementById("activityList");
const clearDemoData = document.getElementById("clearDemoData");

document.getElementById("currentYear").textContent = new Date().getFullYear();

function getStoredData(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
        console.error("Unable to read stored data:", error);
        return [];
    }
}

function saveStoredData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function createRequestId() {
    const datePart = new Date()
        .toISOString()
        .slice(0, 10)
        .replaceAll("-", "");

    const randomPart = Math.floor(1000 + Math.random() * 9000);

    return `LL-${datePart}-${randomPart}`;
}

function createDonorId() {
    const randomPart = Math.floor(10000 + Math.random() * 90000);

    return `DONOR-${randomPart}`;
}

function showResult(element, title, message) {
    element.classList.remove("hidden");

    element.innerHTML = `
        <strong>${title}</strong>
        <p>${message}</p>
    `;
}

function formatDate(dateValue) {
    const date = new Date(dateValue);

    return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function updateDashboard() {
    const requests = getStoredData(STORAGE_KEYS.requests);
    const donors = getStoredData(STORAGE_KEYS.donors);

    totalRequests.textContent = requests.length;
    totalDonors.textContent = donors.length;

    criticalRequests.textContent = requests.filter(
        (request) => request.urgency === "Critical"
    ).length;

    availableDonors.textContent = donors.filter(
        (donor) =>
            donor.availability === "Available now" ||
            donor.availability === "Available today"
    ).length;

    renderActivity(requests, donors);
}

function renderActivity(requests, donors) {
    const activities = [];

    requests.forEach((request) => {
        activities.push({
            type: "request",
            title: `Blood request created for ${request.bloodGroup}`,
            description: `${request.patientName} needs ${request.units} unit(s) at ${request.hospitalName}. Request ID: ${request.id}`,
            date: request.createdAt
        });
    });

    donors.forEach((donor) => {
        activities.push({
            type: "donor",
            title: `${donor.name} registered as a donor`,
            description: `${donor.bloodGroup} donor from ${donor.city}. Availability: ${donor.availability}.`,
            date: donor.createdAt
        });
    });

    activities.sort(
        (first, second) =>
            new Date(second.date).getTime() - new Date(first.date).getTime()
    );

    if (activities.length === 0) {
        activityList.innerHTML = `
            <div class="empty-state">
                No demo activity yet. Create a blood request or register as
                a donor to see activity here.
            </div>
        `;

        return;
    }

    activityList.innerHTML = activities
        .slice(0, 10)
        .map((activity) => {
            const icon = activity.type === "request" ? "!" : "♥";

            return `
                <div class="activity-item">
                    <div class="activity-icon">${icon}</div>

                    <div>
                        <h4>${escapeHtml(activity.title)}</h4>
                        <p>${escapeHtml(activity.description)}</p>
                    </div>

                    <span class="activity-meta">
                        ${escapeHtml(formatDate(activity.date))}
                    </span>
                </div>
            `;
        })
        .join("");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function findMatchingDonors(bloodGroup) {
    const donors = getStoredData(STORAGE_KEYS.donors);

    return donors.filter(
        (donor) =>
            donor.bloodGroup === bloodGroup &&
            (donor.availability === "Available now" ||
                donor.availability === "Available today")
    );
}

bloodRequestForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const patientName = document.getElementById("patientName").value.trim();
    const bloodGroup = document.getElementById("bloodGroup").value;
    const units = Number(document.getElementById("units").value);
    const urgency = document.getElementById("urgency").value;
    const hospitalName = document.getElementById("hospitalName").value.trim();
    const city = document.getElementById("city").value.trim();
    const contactNumber = document
        .getElementById("contactNumber")
        .value.trim();
    const requestNote = document.getElementById("requestNote").value.trim();

    const request = {
        id: createRequestId(),
        patientName,
        bloodGroup,
        units,
        urgency,
        hospitalName,
        city,
        contactNumber,
        requestNote,
        status: "Created",
        createdAt: new Date().toISOString()
    };

    const requests = getStoredData(STORAGE_KEYS.requests);

    requests.push(request);
    saveStoredData(STORAGE_KEYS.requests, requests);

    const matchingDonors = findMatchingDonors(bloodGroup);

    showResult(
        requestResult,
        "Emergency request created",
        `
            Your request ID is <strong>${escapeHtml(request.id)}</strong>.
            ${matchingDonors.length} matching demo donor(s) found for
            blood group ${escapeHtml(bloodGroup)}.
            The request is currently marked as
            <strong>Created</strong>.
        `
    );

    bloodRequestForm.reset();
    updateDashboard();

    document.getElementById("dashboard").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

donorForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const donor = {
        id: createDonorId(),
        name: document.getElementById("donorName").value.trim(),
        bloodGroup: document.getElementById("donorBloodGroup").value,
        city: document.getElementById("donorCity").value.trim(),
        phone: document.getElementById("donorPhone").value.trim(),
        availability: document.getElementById("donorAvailability").value,
        createdAt: new Date().toISOString()
    };

    const donors = getStoredData(STORAGE_KEYS.donors);

    donors.push(donor);
    saveStoredData(STORAGE_KEYS.donors, donors);

    showResult(
        donorResult,
        "Donor registration completed",
        `
            Thank you, ${escapeHtml(donor.name)}.
            Your demo donor ID is
            <strong>${escapeHtml(donor.id)}</strong>.
            You are registered with blood group
            <strong>${escapeHtml(donor.bloodGroup)}</strong>.
        `
    );

    donorForm.reset();
    updateDashboard();

    document.getElementById("dashboard").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

clearDemoData.addEventListener("click", function () {
    const shouldClear = window.confirm(
        "Do you want to clear all LifeLink demo requests and donor data?"
    );

    if (!shouldClear) {
        return;
    }

    localStorage.removeItem(STORAGE_KEYS.requests);
    localStorage.removeItem(STORAGE_KEYS.donors);

    requestResult.classList.add("hidden");
    donorResult.classList.add("hidden");

    updateDashboard();
});

updateDashboard();
