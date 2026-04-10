const {
  CLIENT_HOME_URL,
  approveClientRequest,
  clearSession,
  declineClientRequest,
  findUser,
  formatCurrency,
  formatDate,
  getDb,
  publishAnnouncement,
  readSession,
  updateClientSettings,
  updateUserStatus
} = window.ZenturoShared;

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

const adminAvatar = $("#adminAvatar");
const adminUserName = $("#adminUserName");
const adminUserMeta = $("#adminUserMeta");
const adminStatusValue = $("#adminStatusValue");
const adminStatusCopy = $("#adminStatusCopy");
const adminPendingCount = $("#adminPendingCount");
const adminApprovedCount = $("#adminApprovedCount");
const adminRequestCount = $("#adminRequestCount");
const adminPendingList = $("#adminPendingList");
const adminRequestsList = $("#adminRequestsList");
const adminClientForm = $("#adminClientForm");
const adminClientSelect = $("#adminClientSelect");
const adminClientMessage = $("#adminClientMessage");
const adminAnnouncementForm = $("#adminAnnouncementForm");
const adminAnnouncementMessage = $("#adminAnnouncementMessage");
const adminToast = $("#adminToast");

function showToast(message) {
  adminToast.textContent = message;
  adminToast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => adminToast.classList.remove("is-visible"), 3200);
}

function setMessage(target, message, type = "error") {
  target.textContent = message;
  target.dataset.state = type;
}

function clearMessage(target) {
  target.textContent = "";
  target.dataset.state = "";
}

function pillClass(status) {
  return (
    {
      pending: "pill pill--pending",
      approved: "pill pill--approved",
      suspended: "pill pill--suspended",
      deposit: "pill pill--deposit",
      withdrawal: "pill pill--withdrawal",
      verified: "pill pill--verified",
      declined: "pill pill--suspended"
    }[status] || "pill"
  );
}

function getAdminContext() {
  const db = getDb();
  const user = findUser(db, readSession());
  if (!user) {
    window.location.href = "index.html";
    throw new Error("No active session");
  }
  if (user.role !== "admin") {
    window.location.href = user.role === "client" ? CLIENT_HOME_URL : "index.html";
    throw new Error("Non-admin session detected");
  }
  return { db, user };
}

function populateAdminClientForm(userId, db) {
  const user = db.users.find(item => item.id === userId);
  if (!user) return;
  adminClientSelect.value = user.id;
  adminClientForm.elements.clientId.value = user.id;
  adminClientForm.elements.name.value = user.name;
  adminClientForm.elements.plan.value = user.plan;
  adminClientForm.elements.status.value = user.status;
  adminClientForm.elements.balance.value = user.balance;
  adminClientForm.elements.performance.value = user.performance;
  adminClientForm.elements.kyc.value = user.kyc;
  adminClientForm.elements.note.value = "";
}

function attachActions() {
  $$("[data-approve-user]").forEach(button => {
    button.addEventListener("click", () => {
      const result = updateUserStatus(button.dataset.approveUser, "approved");
      if (result) showToast(`${result.user.name} approved.`);
      renderAdminPage();
    });
  });

  $$("[data-suspend-user]").forEach(button => {
    button.addEventListener("click", () => {
      const result = updateUserStatus(button.dataset.suspendUser, "suspended");
      if (result) showToast(`${result.user.name} suspended.`);
      renderAdminPage();
    });
  });

  $$("[data-approve-request]").forEach(button => {
    button.addEventListener("click", () => {
      const result = approveClientRequest(button.dataset.approveRequest);
      if (result) showToast(`${result.request.type} request approved.`);
      renderAdminPage();
    });
  });

  $$("[data-decline-request]").forEach(button => {
    button.addEventListener("click", () => {
      const result = declineClientRequest(button.dataset.declineRequest);
      if (result) showToast(`${result.request.type} request declined.`);
      renderAdminPage();
    });
  });
}

function renderAdminPage() {
  const { db, user } = getAdminContext();
  adminAvatar.textContent = user.name.charAt(0).toUpperCase();
  adminUserName.textContent = user.name;
  adminUserMeta.textContent = `${user.email} - ${user.plan}`;
  adminStatusValue.textContent = "All controls available";
  adminStatusCopy.textContent =
    "Use the sidebar links to jump between approvals, funding requests, client settings, and announcements.";

  const clients = db.users.filter(item => item.role === "client");
  const pendingClients = clients.filter(item => item.status === "pending");
  const approvedClients = clients.filter(item => item.status === "approved");
  const pendingRequests = db.requests.filter(item => item.status === "pending");

  adminPendingCount.textContent = String(pendingClients.length);
  adminApprovedCount.textContent = String(approvedClients.length);
  adminRequestCount.textContent = String(pendingRequests.length);

  adminPendingList.innerHTML = pendingClients.length
    ? pendingClients
        .map(
          client => `
            <div class="table-row">
              <div class="table-row__top">
                <div>
                  <div class="table-row__title">${client.name}</div>
                  <div class="table-row__meta">${client.email} - ${client.plan} plan - joined ${formatDate(client.createdAt)}</div>
                </div>
                <div class="table-row__badges">
                  <span class="${pillClass("pending")}">Pending</span>
                  <span class="${pillClass(client.kyc?.toLowerCase() === "verified" ? "verified" : "pending")}">${client.kyc}</span>
                </div>
              </div>
              <div class="table-row__bottom">
                <div class="table-row__meta">${(client.activity || [])[0]?.detail || "No onboarding note yet."}</div>
                <div class="table-row__actions">
                  <button type="button" data-approve-user="${client.id}">Approve</button>
                  <button type="button" data-suspend-user="${client.id}">Suspend</button>
                </div>
              </div>
            </div>
          `
        )
        .join("")
    : '<div class="table-row"><div class="table-row__meta">No registrations are waiting for approval right now.</div></div>';

  adminRequestsList.innerHTML = pendingRequests.length
    ? pendingRequests
        .map(request => {
          const client = clients.find(item => item.id === request.userId);
          const detail =
            request.type === "deposit"
              ? `${request.assetLabel || request.asset} - ${request.walletAddress}`
              : request.notes || "Client requested a balance withdrawal.";
          return `
            <div class="table-row">
              <div class="table-row__top">
                <div>
                  <div class="table-row__title">${client?.name || "Unknown client"}</div>
                  <div class="table-row__meta">${request.type} request - ${formatCurrency(request.amount)} - ${formatDate(request.createdAt)}</div>
                </div>
                <div class="table-row__badges">
                  <span class="${pillClass(request.type)}">${request.type}</span>
                  <span class="${pillClass("pending")}">Pending</span>
                </div>
              </div>
              <div class="table-row__bottom">
                <div class="table-row__meta">${detail}</div>
                <div class="table-row__actions">
                  <button type="button" data-approve-request="${request.id}">Approve</button>
                  <button type="button" data-decline-request="${request.id}">Decline</button>
                </div>
              </div>
            </div>
          `;
        })
        .join("")
    : '<div class="table-row"><div class="table-row__meta">There are no pending deposit or withdrawal requests.</div></div>';

  adminClientSelect.innerHTML = clients.length
    ? clients.map(client => `<option value="${client.id}">${client.name} - ${client.plan} - ${client.status}</option>`).join("")
    : '<option value="">No clients yet</option>';

  if (clients.length) {
    populateAdminClientForm(adminClientSelect.value || clients[0].id, db);
  }

  attachActions();
}

adminClientSelect.addEventListener("change", event => {
  populateAdminClientForm(event.target.value, getDb());
  clearMessage(adminClientMessage);
});

adminClientForm.addEventListener("submit", event => {
  event.preventDefault();
  clearMessage(adminClientMessage);
  const clientId = adminClientForm.elements.clientId.value;
  const result = updateClientSettings(clientId, {
    name: String(adminClientForm.elements.name.value || "").trim(),
    plan: adminClientForm.elements.plan.value,
    status: adminClientForm.elements.status.value,
    balance: Number(adminClientForm.elements.balance.value || 0),
    performance: Number(adminClientForm.elements.performance.value || 0),
    kyc: adminClientForm.elements.kyc.value,
    note: String(adminClientForm.elements.note.value || "").trim()
  });
  if (!result) {
    setMessage(adminClientMessage, "Select a client to update.");
    return;
  }
  setMessage(adminClientMessage, "Client settings saved successfully.", "info");
  showToast("Client settings updated.");
  renderAdminPage();
});

adminAnnouncementForm.addEventListener("submit", event => {
  event.preventDefault();
  clearMessage(adminAnnouncementMessage);
  const headline = String(adminAnnouncementForm.elements.headline.value || "").trim();
  const message = String(adminAnnouncementForm.elements.message.value || "").trim();
  if (!headline || !message) {
    setMessage(adminAnnouncementMessage, "Add both a headline and message for the broadcast.");
    return;
  }
  publishAnnouncement(headline, message);
  setMessage(adminAnnouncementMessage, "Announcement published to all client dashboards.", "info");
  showToast("Announcement published.");
  adminAnnouncementForm.reset();
  renderAdminPage();
});

$("#adminHomeBtn").addEventListener("click", () => {
  window.location.href = "index.html";
});

$("#adminSignOutBtn").addEventListener("click", () => {
  clearSession();
  window.location.href = "index.html";
});

renderAdminPage();
