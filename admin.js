const {
  CLIENT_HOME_URL,
  approveClientRequest,
  declineClientRequest,
  findUser,
  formatCurrency,
  formatDate,
  getDb,
  publishAnnouncement,
  readSession,
  resetPasswordWithSupabase,
  signInWithSupabase,
  signOutFromSupabase,
  syncSessionFromSupabase,
  updateClientSettings,
  updateUserStatus
} = window.ZenturoShared;

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

const adminAuthGate = $("#adminAuthGate");
const adminDashboardShell = $("#adminDashboardShell");
const adminSigninForm = $("#adminSigninForm");
const adminSigninMessage = $("#adminSigninMessage");
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

function toggleAdminView(isAuthenticated) {
  if (adminAuthGate) adminAuthGate.style.display = isAuthenticated ? "none" : "block";
  if (adminDashboardShell) adminDashboardShell.style.display = isAuthenticated ? "block" : "none";
}

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
    throw new Error("No active admin session");
  }
  if (user.role !== "admin") {
    window.location.href = user.role === "client" ? CLIENT_HOME_URL : "index.html";
    throw new Error("Non-admin session detected");
  }
  return { db, user };
}

function setSigninMessage(message, type = "error") {
  if (!adminSigninMessage) return;
  adminSigninMessage.textContent = message;
  adminSigninMessage.className = "login-message";
  if (type === "info") adminSigninMessage.classList.add("info");
  if (type === "success") adminSigninMessage.classList.add("success");
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
    button.addEventListener("click", async () => {
      try {
        const result = await updateUserStatus(button.dataset.approveUser, "approved");
        if (result) showToast(`${result.user.name} approved.`);
        renderAdminPage();
      } catch (error) {
        showToast(error?.message || "We could not approve this client.");
      }
    });
  });

  $$("[data-suspend-user]").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        const result = await updateUserStatus(button.dataset.suspendUser, "suspended");
        if (result) showToast(`${result.user.name} suspended.`);
        renderAdminPage();
      } catch (error) {
        showToast(error?.message || "We could not suspend this client.");
      }
    });
  });

  $$("[data-approve-request]").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        const result = await approveClientRequest(button.dataset.approveRequest);
        if (result) showToast(`${result.request.type} request approved.`);
        renderAdminPage();
      } catch (error) {
        showToast(error?.message || "We could not approve this request.");
      }
    });
  });

  $$("[data-decline-request]").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        const result = await declineClientRequest(button.dataset.declineRequest);
        if (result) showToast(`${result.request.type} request declined.`);
        renderAdminPage();
      } catch (error) {
        showToast(error?.message || "We could not decline this request.");
      }
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

adminClientForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearMessage(adminClientMessage);
  const clientId = adminClientForm.elements.clientId.value;
  if (!clientId) {
    setMessage(adminClientMessage, "Select a client to update.");
    return;
  }
  try {
    await updateClientSettings(clientId, {
      name: String(adminClientForm.elements.name.value || "").trim(),
      plan: adminClientForm.elements.plan.value,
      status: adminClientForm.elements.status.value,
      balance: Number(adminClientForm.elements.balance.value || 0),
      performance: Number(adminClientForm.elements.performance.value || 0),
      kyc: adminClientForm.elements.kyc.value,
      note: String(adminClientForm.elements.note.value || "").trim()
    });
    setMessage(adminClientMessage, "Client settings saved successfully.", "info");
    showToast("Client settings updated.");
    renderAdminPage();
  } catch (error) {
    setMessage(adminClientMessage, error?.message || "We could not update this client.");
  }
});

adminAnnouncementForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearMessage(adminAnnouncementMessage);
  const headline = String(adminAnnouncementForm.elements.headline.value || "").trim();
  const message = String(adminAnnouncementForm.elements.message.value || "").trim();
  if (!headline || !message) {
    setMessage(adminAnnouncementMessage, "Add both a headline and message for the broadcast.");
    return;
  }
  try {
    await publishAnnouncement(headline, message);
    setMessage(adminAnnouncementMessage, "Announcement published to all client dashboards.", "info");
    showToast("Announcement published.");
    adminAnnouncementForm.reset();
    renderAdminPage();
  } catch (error) {
    setMessage(adminAnnouncementMessage, error?.message || "We could not publish this announcement.");
  }
});

$("#adminHomeBtn").addEventListener("click", () => {
  window.location.href = "index.html";
});

$("#adminSignOutBtn").addEventListener("click", async () => {
  await signOutFromSupabase();
  toggleAdminView(false);
  setSigninMessage("Signed out. Sign in again to reopen the admin desk.", "info");
});

if (adminSigninForm) {
  adminSigninForm.addEventListener("submit", async event => {
    event.preventDefault();
    setSigninMessage("");

    const formData = new FormData(adminSigninForm);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "").trim();
    const remember = Boolean(formData.get("remember"));

    if (!email || !password) {
      setSigninMessage("Enter your admin email and password.");
      return;
    }

    try {
      const { user } = await signInWithSupabase(email, password, remember);
      if (user.role !== "admin") {
        await signOutFromSupabase();
        setSigninMessage("That account is not an admin account.");
        return;
      }
      adminSigninForm.reset();
      toggleAdminView(true);
      renderAdminPage();
    } catch (error) {
      setSigninMessage(error?.message || "Admin sign in failed.");
    }
  });
}

$("#adminForgotPasswordBtn")?.addEventListener("click", async () => {
  const email = String(adminSigninForm?.elements?.email?.value || "").trim().toLowerCase();
  if (!email) {
    setSigninMessage("Enter your admin email first.");
    return;
  }

  try {
    await resetPasswordWithSupabase(email);
    setSigninMessage(`Password reset instructions sent to ${email}.`, "info");
  } catch (error) {
    setSigninMessage(error?.message || "We could not send a reset email right now.");
  }
});

$("#adminBackToLoginBtn")?.addEventListener("click", () => {
  window.location.href = "login.html";
});

async function init() {
  try {
    const user = await syncSessionFromSupabase();
    if (user?.role === "admin") {
      toggleAdminView(true);
      renderAdminPage();
      return;
    }
    if (user?.role === "client") {
      window.location.href = CLIENT_HOME_URL;
      return;
    }
  } catch (error) {
    setSigninMessage(error?.message || "We could not restore the admin session.");
  }

  toggleAdminView(false);
}

void init();
