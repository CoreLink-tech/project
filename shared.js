(function () {
  const APP_DB_KEY = "zenturocapital-db-v2";
  const APP_SESSION_KEY = "zenturocapital-session-v2";
  const CLIENT_HOME_URL = "dashboard.html";
  const ADMIN_HOME_URL = "admin.html";

  const CRYPTO_WALLETS = {
    BTC: { label: "Bitcoin (BTC)", network: "Bitcoin", address: "bc1qzenturocapitalbtc6m9k3c4v2u7p8r9x0w5n4s" },
    ETH: { label: "Ethereum (ETH)", network: "ERC20", address: "0x4F31b9D9B2a8fC29C8d9Af0a62B55fC23d5E7A10" },
    USDT: { label: "Tether (USDT - TRC20)", network: "TRC20", address: "TR7n9F3hV6x8mQa2Kz1sLp4wEf5yHu8pRn" },
    BNB: { label: "BNB Smart Chain (BNB)", network: "BEP20", address: "0x8D3E4b2C1A97f5E6d4c3B2a1098F7e6D5c4B3a21" }
  };

  const makeId = prefix => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  const formatCurrency = value =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
  const formatDate = value =>
    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const createActivity = (title, detail) => ({
    id: makeId("activity"),
    title,
    detail,
    createdAt: new Date().toISOString()
  });

  function createPortfolio(plan, balance) {
    const allocations = {
      Starter: [["Copy trading core", 42], ["FX momentum", 33], ["Cash reserve", 25]],
      Silver: [["Copy trading core", 38], ["Multi-asset rotation", 34], ["Structured reserve", 28]],
      Gold: [["Macro allocation", 36], ["Index and ETF blend", 40], ["Liquidity reserve", 24]],
      Platinum: [["Discretionary macro", 34], ["Private mandate sleeve", 41], ["Opportunistic cash", 25]]
    };

    return (allocations[plan] || allocations.Starter).map(([name, percent]) => ({
      id: makeId("portfolio"),
      name,
      percent,
      value: Math.round((balance || 0) * (percent / 100))
    }));
  }

  function normalizeRequestStatus(status) {
    if (status === "open") return "pending";
    if (status === "processed") return "approved";
    return status || "pending";
  }

  function normalizeRequest(request) {
    const asset = request.asset || (request.type === "deposit" ? "BTC" : "");
    const wallet = CRYPTO_WALLETS[asset];
    return {
      ...request,
      id: request.id || makeId("request"),
      type: request.type === "withdraw" ? "withdrawal" : request.type,
      amount: Number(request.amount || 0),
      notes: request.notes || "",
      asset,
      assetLabel: request.assetLabel || (wallet ? wallet.label : ""),
      walletAddress: request.walletAddress || (wallet ? wallet.address : ""),
      status: normalizeRequestStatus(request.status),
      paymentConfirmedAt: request.paymentConfirmedAt || request.createdAt || null,
      processedAt: request.processedAt || null,
      decisionNote: request.decisionNote || ""
    };
  }

  function normalizeUser(user) {
    const balance = Number(user.balance || 0);
    return {
      ...user,
      balance,
      performance: Number(user.performance || 0),
      kyc: user.kyc || "Pending",
      advisor: user.advisor || "Relationship Desk",
      portfolio:
        Array.isArray(user.portfolio) && user.portfolio.length
          ? user.portfolio
          : createPortfolio(user.plan || "Starter", balance),
      activity: Array.isArray(user.activity) ? user.activity : []
    };
  }

  function seedDatabase() {
    const existing = localStorage.getItem(APP_DB_KEY);
    if (existing) return JSON.parse(existing);

    const balance = 2458000;
    const admin = {
      id: makeId("user"),
      role: "admin",
      status: "approved",
      name: "Platform Admin",
      email: "admin@zenturocapital.com",
      password: "Admin123!",
      plan: "Administrator",
      kyc: "Verified",
      advisor: "Operations",
      balance: 0,
      performance: 0,
      createdAt: new Date().toISOString(),
      portfolio: [],
      activity: [createActivity("Admin workspace ready", "Seed administrator account created for platform operations.")]
    };
    const client = {
      id: makeId("user"),
      role: "client",
      status: "approved",
      name: "Ava Carter",
      email: "ava@zenturocapital.com",
      password: "Client123!",
      plan: "Gold",
      kyc: "Verified",
      advisor: "London relationship desk",
      balance,
      performance: 8.4,
      createdAt: new Date().toISOString(),
      portfolio: createPortfolio("Gold", balance),
      activity: [
        createActivity("Allocation confirmed", "Your Gold mandate has been allocated across macro, ETF, and reserve sleeves."),
        createActivity("Client reporting enabled", "Weekly reporting has been enabled for this account.")
      ]
    };

    const db = {
      users: [admin, client],
      requests: [],
      announcement: {
        headline: "Quarterly allocation window is active",
        message: "Approved clients can submit deposit proofs and withdrawal requests directly from the workspace while the operations desk reviews each item.",
        updatedAt: new Date().toISOString()
      }
    };

    localStorage.setItem(APP_DB_KEY, JSON.stringify(db));
    return db;
  }

  function getDb() {
    const raw = JSON.parse(localStorage.getItem(APP_DB_KEY) || JSON.stringify(seedDatabase()));
    const db = {
      ...raw,
      users: (raw.users || []).map(normalizeUser),
      requests: (raw.requests || []).map(normalizeRequest),
      announcement: raw.announcement || {
        headline: "No active announcement",
        message: "The admin desk has not published an update yet.",
        updatedAt: new Date().toISOString()
      }
    };
    saveDb(db);
    return db;
  }

  function saveDb(db) {
    localStorage.setItem(APP_DB_KEY, JSON.stringify(db));
  }

  function saveSession(session, remember) {
    const payload = JSON.stringify(session);
    if (remember) {
      localStorage.setItem(APP_SESSION_KEY, payload);
      sessionStorage.removeItem(APP_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(APP_SESSION_KEY, payload);
    localStorage.removeItem(APP_SESSION_KEY);
  }

  function readSession() {
    return JSON.parse(sessionStorage.getItem(APP_SESSION_KEY) || localStorage.getItem(APP_SESSION_KEY) || "null");
  }

  function clearSession() {
    sessionStorage.removeItem(APP_SESSION_KEY);
    localStorage.removeItem(APP_SESSION_KEY);
  }

  function findUser(db, session) {
    return db.users.find(user => user.id === (session && session.userId)) || null;
  }

  function updateUserStatus(userId, status) {
    const db = getDb();
    const user = db.users.find(item => item.id === userId);
    if (!user) return null;
    user.status = status;
    user.activity.unshift(
      createActivity(
        status === "approved" ? "Account approved" : "Account status changed",
        status === "approved"
          ? "An administrator approved this registration and unlocked account access."
          : "An administrator updated the account status."
      )
    );
    saveDb(db);
    return { db, user };
  }

  function submitDepositRequest(userId, payload) {
    const db = getDb();
    const user = db.users.find(item => item.id === userId);
    const wallet = CRYPTO_WALLETS[payload.asset];
    if (!user || !wallet) return null;
    const request = {
      id: makeId("request"),
      userId,
      type: "deposit",
      amount: Number(payload.amount || 0),
      notes: payload.notes || "",
      asset: payload.asset,
      assetLabel: wallet.label,
      walletAddress: wallet.address,
      status: "pending",
      createdAt: new Date().toISOString(),
      paymentConfirmedAt: new Date().toISOString(),
      processedAt: null,
      decisionNote: ""
    };
    db.requests.unshift(request);
    user.activity.unshift(createActivity("Deposit submitted", `${formatCurrency(request.amount)} deposit proof was sent to the admin desk for approval.`));
    saveDb(db);
    return { db, user, request };
  }

  function submitWithdrawalRequest(userId, payload) {
    const db = getDb();
    const user = db.users.find(item => item.id === userId);
    if (!user) return null;
    const request = {
      id: makeId("request"),
      userId,
      type: "withdrawal",
      amount: Number(payload.amount || 0),
      notes: payload.notes || "",
      asset: "",
      assetLabel: "",
      walletAddress: "",
      status: "pending",
      createdAt: new Date().toISOString(),
      paymentConfirmedAt: null,
      processedAt: null,
      decisionNote: ""
    };
    db.requests.unshift(request);
    user.activity.unshift(createActivity("Withdrawal submitted", `${formatCurrency(request.amount)} withdrawal request was sent to the admin desk for approval.`));
    saveDb(db);
    return { db, user, request };
  }

  function declineClientRequest(requestId, decisionNote) {
    const db = getDb();
    const request = db.requests.find(item => item.id === requestId);
    const user = db.users.find(item => item.id === (request && request.userId));
    if (!request || !user || request.status !== "pending") return null;
    request.status = "declined";
    request.processedAt = new Date().toISOString();
    request.decisionNote = decisionNote || "Declined by the admin desk.";
    user.activity.unshift(
      createActivity(
        `${request.type === "deposit" ? "Deposit" : "Withdrawal"} declined`,
        `${formatCurrency(request.amount)} ${request.type} request was declined by the admin desk.`
      )
    );
    saveDb(db);
    return { db, user, request };
  }

  function approveClientRequest(requestId) {
    const db = getDb();
    const request = db.requests.find(item => item.id === requestId);
    const user = db.users.find(item => item.id === (request && request.userId));
    if (!request || !user || request.status !== "pending") return null;

    if (request.type === "deposit") {
      user.balance += request.amount;
      user.activity.unshift(createActivity("Deposit approved", `${formatCurrency(request.amount)} was approved and added to your account balance.`));
    } else {
      if (request.amount > user.balance) {
        return declineClientRequest(requestId, "Declined automatically because the withdrawal amount exceeded the available balance.");
      }
      user.balance -= request.amount;
      user.activity.unshift(createActivity("Withdrawal approved", `${formatCurrency(request.amount)} was approved for withdrawal by the admin desk.`));
    }

    user.portfolio = createPortfolio(user.plan, user.balance);
    request.status = "approved";
    request.processedAt = new Date().toISOString();
    request.decisionNote = request.type === "deposit" ? "Payment confirmed and credited to the client account." : "Withdrawal approved by the admin desk.";
    saveDb(db);
    return { db, user, request };
  }

  function updateClientSettings(clientId, payload) {
    const db = getDb();
    const user = db.users.find(item => item.id === clientId);
    if (!user) return null;
    user.name = payload.name || user.name;
    user.plan = payload.plan;
    user.status = payload.status;
    user.balance = Number(payload.balance || 0);
    user.performance = Number(payload.performance || 0);
    user.kyc = payload.kyc;
    user.portfolio = createPortfolio(user.plan, user.balance);
    if (payload.note) {
      user.activity.unshift(createActivity("Admin note added", payload.note));
    }
    saveDb(db);
    return { db, user };
  }

  function updateClientProfile(userId, payload) {
    const db = getDb();
    const user = db.users.find(item => item.id === userId);
    if (!user) return null;
    user.name = payload.name || user.name;
    user.email = payload.email || user.email;
    if (payload.password) user.password = payload.password;
    user.activity.unshift(createActivity("Profile updated", "Client account details were updated from the settings page."));
    saveDb(db);
    return { db, user };
  }

  function publishAnnouncement(headline, message) {
    const db = getDb();
    db.announcement = { headline, message, updatedAt: new Date().toISOString() };
    saveDb(db);
    return db;
  }

  seedDatabase();

  window.ZenturoShared = {
    APP_DB_KEY,
    APP_SESSION_KEY,
    CLIENT_HOME_URL,
    ADMIN_HOME_URL,
    CRYPTO_WALLETS,
    makeId,
    formatCurrency,
    formatDate,
    createActivity,
    createPortfolio,
    getDb,
    saveDb,
    saveSession,
    readSession,
    clearSession,
    findUser,
    updateUserStatus,
    submitDepositRequest,
    submitWithdrawalRequest,
    approveClientRequest,
    declineClientRequest,
    updateClientSettings,
    updateClientProfile,
    publishAnnouncement
  };
})();
