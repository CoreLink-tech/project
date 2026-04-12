const {
  ADMIN_HOME_URL,
  CRYPTO_WALLETS,
  findUser,
  formatCurrency,
  formatDate,
  getDb,
  readSession,
  signOutFromSupabase,
  submitDepositRequest,
  submitWithdrawalRequest,
  syncSessionFromSupabase,
  updateClientProfile
} = window.ZenturoShared;

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

const PAGES = [
  { id: "dashboard", label: "Dashboard", href: "dashboard.html" },
  { id: "deposit", label: "Deposit", href: "deposit.html" },
  { id: "withdrawal", label: "Withdrawal", href: "withdrawal.html" },
  { id: "portfolio", label: "Portfolio", href: "portfolio.html" },
  { id: "activity", label: "Activity", href: "activity.html" },
  { id: "settings", label: "Settings", href: "settings.html" }
];

const toast = $("#clientToast");

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function setMessage(target, message, type = "error") {
  if (!target) return;
  target.textContent = message;
  target.dataset.state = type;
}

function clearMessage(target) {
  if (!target) return;
  target.textContent = "";
  target.dataset.state = "";
}

function getCurrentContext() {
  const db = getDb();
  const user = findUser(db, readSession());
  if (!user) {
    window.location.href = "index.html";
    throw new Error("No active session");
  }
  if (user.role === "admin") {
    window.location.href = ADMIN_HOME_URL;
    throw new Error("Admin session detected on client page");
  }
  return { db, user };
}

function renderSidebar(user) {
  const nav = $("#clientSidebarNav");
  const currentPage = document.body.dataset.clientPage;
  nav.innerHTML = PAGES.map(
    page => `
      <a href="${page.href}" class="${page.id === currentPage ? "is-active" : ""}">
        <span>${page.label}</span>
        <span>${page.id === currentPage ? "Open" : "Go"}</span>
      </a>
    `
  ).join("");

  $("#clientAvatar").textContent = user.name.charAt(0).toUpperCase();
  $("#clientUserName").textContent = user.name;
  $("#clientUserMeta").textContent = `${user.plan} plan - ${user.email}`;
  $("#clientStatusValue").textContent =
    user.status === "approved"
      ? "Approved and active"
      : user.status === "pending"
        ? "Awaiting approval"
        : "Account suspended";
  $("#clientStatusCopy").textContent =
    user.status === "approved"
      ? "Use the sidebar to navigate deposits, withdrawals, portfolio tracking, and account settings."
      : user.status === "pending"
        ? "You can still review your account details while the admin desk processes your registration."
        : "Some actions are disabled until the admin desk restores account access.";
}

function renderHeader(user) {
  const title = $("#pageTitle");
  const eyebrow = $("#pageEyebrow");
  const pageNames = {
    dashboard: ["Client Workspace", `${user.name.split(" ")[0]}'s dashboard`],
    deposit: ["Deposit", "Fund your account"],
    withdrawal: ["Withdrawal", "Request a payout"],
    portfolio: ["Portfolio", "View mandate allocation"],
    activity: ["Activity", "Review account history"],
    settings: ["Settings", "Update your profile"]
  };
  const [eyebrowText, titleText] = pageNames[document.body.dataset.clientPage] || [
    "Workspace",
    "Client workspace"
  ];
  eyebrow.textContent = eyebrowText;
  title.textContent = titleText;
}

function renderSummary(user) {
  const balance = $("#summaryBalance");
  const performance = $("#summaryPerformance");
  const status = $("#summaryStatus");
  if (!balance) return;
  balance.textContent = formatCurrency(user.balance);
  performance.textContent = `${Number(user.performance || 0).toFixed(1)}%`;
  status.textContent = user.status;
}

function renderDashboard(db, user) {
  $("#dashboardPlan").textContent = user.plan;
  $("#dashboardBalance").textContent = formatCurrency(user.balance);
  $("#dashboardPerformance").textContent = `${Number(user.performance || 0).toFixed(1)}%`;
  $("#dashboardKyc").textContent = user.kyc;
  $("#dashboardApproval").textContent = user.status;
  $("#dashboardAdvisor").textContent = user.advisor;
  $("#dashboardAnnouncement").innerHTML = `
    <h5>${db.announcement.headline}</h5>
    <p>${db.announcement.message}</p>
    <p>Updated ${formatDate(db.announcement.updatedAt)}</p>
  `;
  $("#dashboardPortfolio").innerHTML = user.portfolio
    .map(
      item => `
        <div class="data-list__item">
          <div>
            <div class="table-row__title">${item.name}</div>
            <div class="table-row__meta">${item.percent}% of mandate</div>
          </div>
          <div class="data-list__value">${formatCurrency(item.value)}</div>
        </div>
      `
    )
    .join("");
  $("#dashboardActivity").innerHTML = user.activity
    .slice(0, 6)
    .map(
      item => `
        <div class="timeline-item">
          <div class="timeline-item__title">${item.title}</div>
          <div class="timeline-item__meta">${item.detail}</div>
          <div class="timeline-item__meta">${formatDate(item.createdAt)}</div>
        </div>
      `
    )
    .join("");
}

function renderRequestRows(requests, filterFn) {
  return requests.filter(filterFn).length
    ? requests
        .filter(filterFn)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(
          request => `
            <div class="table-row">
              <div class="table-row__top">
                <div>
                  <div class="table-row__title">${request.type === "deposit" ? "Deposit" : "Withdrawal"} request</div>
                  <div class="table-row__meta">${formatCurrency(request.amount)} - ${formatDate(request.createdAt)}</div>
                </div>
                <div class="table-row__badges">
                  <span class="pill ${request.type === "deposit" ? "pill--deposit" : "pill--withdrawal"}">${request.type}</span>
                  <span class="pill ${request.status === "approved" ? "pill--approved" : request.status === "declined" ? "pill--suspended" : "pill--pending"}">${request.status}</span>
                </div>
              </div>
              <div class="table-row__bottom">
                <div class="table-row__meta">${request.notes || request.assetLabel || request.decisionNote || "No additional note."}</div>
                <div class="table-row__meta">${request.walletAddress || request.decisionNote || ""}</div>
              </div>
            </div>
          `
        )
        .join("")
    : '<div class="table-row"><div class="table-row__meta">No records yet.</div></div>';
}

function renderDepositPage(db, user) {
  const history = $("#depositHistory");
  history.innerHTML = renderRequestRows(db.requests, request => request.userId === user.id && request.type === "deposit");

  const form = $("#depositRequestForm");
  const message = $("#depositRequestMessage");
  const stepEntry = $("#depositStepEntry");
  const stepCheckout = $("#depositStepCheckout");
  const selectedAsset = $("#depositSelectedAsset");
  const selectedAmount = $("#depositSelectedAmount");
  const selectedNetwork = $("#depositSelectedNetwork");
  const walletAddress = $("#depositWalletAddress");
  const copyBtn = $("#depositCopyBtn");
  const backBtn = $("#depositBackBtn");
  const confirmBtn = $("#depositConfirmBtn");
  let draft = null;

  const disable = user.status !== "approved";
  Array.from(form.elements).forEach(field => {
    field.disabled = disable;
  });
  copyBtn.disabled = disable;
  backBtn.disabled = disable;
  confirmBtn.disabled = disable;
  if (disable) {
    setMessage(message, "Deposits unlock after your account is approved.", "info");
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    clearMessage(message);
    if (disable) return;

    const formData = new FormData(form);
    const asset = String(formData.get("asset") || "BTC");
    const amount = Number(formData.get("amount") || 0);
    const notes = String(formData.get("notes") || "").trim();
    const wallet = CRYPTO_WALLETS[asset];
    if (!wallet) {
      setMessage(message, "Select a cryptocurrency for this deposit.");
      return;
    }
    if (!amount || amount <= 0) {
      setMessage(message, "Enter a valid deposit amount.");
      return;
    }

    draft = { asset, amount, notes, wallet };
    selectedAsset.textContent = wallet.label;
    selectedAmount.textContent = formatCurrency(amount);
    selectedNetwork.textContent = wallet.network;
    walletAddress.value = wallet.address;
    stepEntry.classList.add("is-hidden");
    stepCheckout.classList.remove("is-hidden");
  });

  backBtn.addEventListener("click", () => {
    stepCheckout.classList.add("is-hidden");
    stepEntry.classList.remove("is-hidden");
    clearMessage(message);
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(walletAddress.value);
      showToast("Wallet address copied.");
    } catch {
      walletAddress.select();
      document.execCommand("copy");
      showToast("Wallet address copied.");
    }
  });

  confirmBtn.addEventListener("click", async () => {
    if (!draft) return;
    try {
      await submitDepositRequest(user.id, {
        asset: draft.asset,
        amount: draft.amount,
        notes: draft.notes
      });
      showToast("Deposit proof submitted to the admin desk.");
      window.location.reload();
    } catch (error) {
      setMessage(message, error?.message || "We could not submit this deposit right now.");
    }
  });
}

function renderWithdrawalPage(db, user) {
  $("#withdrawalHistory").innerHTML = renderRequestRows(
    db.requests,
    request => request.userId === user.id && request.type === "withdrawal"
  );

  const form = $("#withdrawalRequestForm");
  const message = $("#withdrawalRequestMessage");
  const disable = user.status !== "approved";
  Array.from(form.elements).forEach(field => {
    field.disabled = disable;
  });
  if (disable) {
    setMessage(message, "Withdrawals unlock after your account is approved.", "info");
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessage(message);
    if (disable) return;

    const formData = new FormData(form);
    const amount = Number(formData.get("amount") || 0);
    const notes = String(formData.get("notes") || "").trim();
    if (!amount || amount <= 0) {
      setMessage(message, "Enter a valid withdrawal amount.");
      return;
    }
    if (amount > user.balance) {
      setMessage(message, "The requested withdrawal amount cannot be greater than your available balance.");
      return;
    }
    try {
      await submitWithdrawalRequest(user.id, { amount, notes });
      showToast("Withdrawal request submitted to the admin desk.");
      window.location.reload();
    } catch (error) {
      setMessage(message, error?.message || "We could not submit this withdrawal right now.");
    }
  });
}

function renderPortfolioPage(user) {
  $("#portfolioList").innerHTML = user.portfolio
    .map(
      item => `
        <div class="data-list__item">
          <div>
            <div class="table-row__title">${item.name}</div>
            <div class="table-row__meta">${item.percent}% of total allocation</div>
          </div>
          <div class="data-list__value">${formatCurrency(item.value)}</div>
        </div>
      `
    )
    .join("");
}

function renderActivityPage(db, user) {
  $("#activityTimeline").innerHTML = user.activity
    .map(
      item => `
        <div class="timeline-item">
          <div class="timeline-item__title">${item.title}</div>
          <div class="timeline-item__meta">${item.detail}</div>
          <div class="timeline-item__meta">${formatDate(item.createdAt)}</div>
        </div>
      `
    )
    .join("");

  $("#activityRequests").innerHTML = renderRequestRows(db.requests, request => request.userId === user.id);
}

function renderSettingsPage(user) {
  const form = $("#settingsForm");
  const message = $("#settingsMessage");
  form.elements.name.value = user.name;
  form.elements.email.value = user.email;
  form.elements.plan.value = user.plan;
  form.elements.status.value = user.status;
  form.elements.kyc.value = user.kyc;

  form.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessage(message);
    const name = String(form.elements.name.value || "").trim();
    const email = String(form.elements.email.value || "").trim().toLowerCase();
    const password = String(form.elements.password.value || "");
    const confirmPassword = String(form.elements.confirmPassword.value || "");

    if (!name || !email) {
      setMessage(message, "Name and email are required.");
      return;
    }
    if (password && password.length < 8) {
      setMessage(message, "Use a password with at least 8 characters.");
      return;
    }
    if (password && password !== confirmPassword) {
      setMessage(message, "Password confirmation does not match.");
      return;
    }

    try {
      await updateClientProfile(user.id, { name, email, password });
      setMessage(message, "Profile updated successfully.", "info");
      showToast("Account settings saved.");
    } catch (error) {
      setMessage(message, error?.message || "We could not save your settings right now.");
    }
  });
}

function bindGlobalActions() {
  $("#clientHomeBtn")?.addEventListener("click", () => {
    window.location.href = "index.html";
  });
  $("#clientSignOutBtn")?.addEventListener("click", async () => {
    await signOutFromSupabase();
    window.location.href = "index.html";
  });
}

async function init() {
  await syncSessionFromSupabase();
  const { db, user } = getCurrentContext();
  renderSidebar(user);
  renderHeader(user);
  renderSummary(user);
  bindGlobalActions();

  const page = document.body.dataset.clientPage;
  if (page === "dashboard") renderDashboard(db, user);
  if (page === "deposit") renderDepositPage(db, user);
  if (page === "withdrawal") renderWithdrawalPage(db, user);
  if (page === "portfolio") renderPortfolioPage(user);
  if (page === "activity") renderActivityPage(db, user);
  if (page === "settings") renderSettingsPage(user);
}

void init();
