(function () {
  const APP_DB_KEY = "zenturocapital-db-v3";
  const APP_SESSION_KEY = "zenturocapital-session-v3";
  const CLIENT_HOME_URL = "dashboard.html";
  const ADMIN_HOME_URL = "admin.html";
  const ADMIN_EMAILS = ["ashedavid2007@gmail.com", "admin@zenturo2025.com"];

  const CRYPTO_WALLETS = {
    BTC: { label: "Bitcoin (BTC)", network: "Bitcoin", address: "bc1qzg9wlxy90vryv5atymx5uk4whhjdk7v4fm52tr" },
    ETH: { label: "Ethereum (ETH)", network: "ERC20", address: "0xD38E17BBba235472aB1A9BF4245829E82514de21" },
    XRP: { label: "XRP", network: "XRP Ledger", address: "rLboF4ELqyeBPwrpuLxpzUwr61iRh2s8Nn" }
  };

  const EMPTY_ANNOUNCEMENT = {
    headline: "No active announcement",
    message: "The admin desk has not published an update yet.",
    updatedAt: new Date().toISOString()
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
  const getSupabaseClient = () =>
    window.SupabaseConfig?.client ||
    window.SupabaseConfig?.supabase ||
    window.supabaseClient ||
    null;
  const isAdminEmail = email => ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());

  let dbCache = null;

  function getDisplayNameFromAuth(authUser, fallbackEmail) {
    const metadata = authUser?.user_metadata || {};
    const fallback = String(fallbackEmail || authUser?.email || "Client User")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .trim();
    return String(metadata.full_name || metadata.name || fallback || "Client User")
      .replace(/\s+/g, " ")
      .trim();
  }

  function createPortfolio(plan, balance) {
    const allocations = {
      Starter: [["Copy trading core", 42], ["FX momentum", 33], ["Cash reserve", 25]],
      Silver: [["Copy trading core", 38], ["Multi-asset rotation", 34], ["Structured reserve", 28]],
      Gold: [["Macro allocation", 36], ["Index and ETF blend", 40], ["Liquidity reserve", 24]],
      Platinum: [["Discretionary macro", 34], ["Private mandate sleeve", 41], ["Opportunistic cash", 25]],
      Administrator: []
    };

    return (allocations[plan] || allocations.Starter).map(([name, percent]) => ({
      id: makeId("portfolio"),
      name,
      percent,
      value: Math.round((balance || 0) * (percent / 100))
    }));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getEmptyDb() {
    return {
      users: [],
      requests: [],
      announcement: { ...EMPTY_ANNOUNCEMENT }
    };
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

  function normalizeDb(raw) {
    const source = raw || getEmptyDb();
    return {
      users: (source.users || []).map(normalizeUser),
      requests: (source.requests || []).map(normalizeRequest),
      announcement: source.announcement || { ...EMPTY_ANNOUNCEMENT }
    };
  }

  function saveDb(db) {
    dbCache = normalizeDb(db);
    localStorage.setItem(APP_DB_KEY, JSON.stringify(dbCache));
    return dbCache;
  }

  function getDb() {
    if (dbCache) return clone(dbCache);
    const cached = localStorage.getItem(APP_DB_KEY);
    dbCache = cached ? normalizeDb(JSON.parse(cached)) : normalizeDb(getEmptyDb());
    return clone(dbCache);
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

  function mapProfileRow(profile, portfolioRows, activityRows) {
    const balance = Number(profile.balance || 0);
    const portfolio = portfolioRows.length
      ? portfolioRows.map(item => ({
          id: item.id,
          name: item.name,
          percent: Number(item.percent || 0),
          value: Number(item.value || 0)
        }))
      : createPortfolio(profile.plan || "Starter", balance);

    return normalizeUser({
      id: profile.id,
      role: profile.role,
      status: profile.status,
      name: profile.full_name,
      email: profile.email,
      plan: profile.plan,
      kyc: profile.kyc,
      advisor: profile.advisor,
      balance,
      performance: Number(profile.performance || 0),
      createdAt: profile.created_at || new Date().toISOString(),
      portfolio,
      activity: activityRows.map(item => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
        createdAt: item.created_at
      }))
    });
  }

  function buildPortfolioRows(userId, plan, balance) {
    return createPortfolio(plan, balance).map(item => ({
      user_id: userId,
      name: item.name,
      percent: item.percent,
      value: item.value
    }));
  }

  async function replacePortfolioAllocations(userId, plan, balance) {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase client is not available on this page.");

    const { error: deleteError } = await client.from("portfolio_allocations").delete().eq("user_id", userId);
    if (deleteError) throw deleteError;

    const rows = buildPortfolioRows(userId, plan, balance);
    if (!rows.length) return;

    const { error: insertError } = await client.from("portfolio_allocations").insert(rows);
    if (insertError) throw insertError;
  }

  async function appendActivity(userId, title, detail) {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase client is not available on this page.");

    const { error } = await client.from("user_activity").insert({
      user_id: userId,
      title,
      detail
    });
    if (error) throw error;
  }

  async function loadDbFromSupabase(activeAuthUser) {
    const client = getSupabaseClient();
    if (!client) return getDb();

    const authUser = activeAuthUser || (await client.auth.getUser()).data.user;
    if (!authUser) {
      saveDb(getEmptyDb());
      return getDb();
    }

    const { data: currentProfile, error: currentProfileError } = await client
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (currentProfileError) throw currentProfileError;

    const isAdmin = currentProfile.role === "admin";
    const profileQuery = client.from("profiles").select("*").order("created_at", { ascending: false });
    const requestQuery = client.from("funding_requests").select("*").order("created_at", { ascending: false });
    const announcementQuery = client
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    const portfolioQuery = client.from("portfolio_allocations").select("*").order("created_at", { ascending: true });
    const activityQuery = client.from("user_activity").select("*").order("created_at", { ascending: false });

    const [
      { data: profileRows, error: profilesError },
      { data: requestRows, error: requestsError },
      { data: announcementRows, error: announcementsError },
      { data: portfolioRows, error: portfolioError },
      { data: activityRows, error: activityError }
    ] = await Promise.all([
      isAdmin ? profileQuery : profileQuery.eq("id", authUser.id),
      isAdmin ? requestQuery : requestQuery.eq("user_id", authUser.id),
      announcementQuery,
      isAdmin ? portfolioQuery : portfolioQuery.eq("user_id", authUser.id),
      isAdmin ? activityQuery : activityQuery.eq("user_id", authUser.id)
    ]);

    if (profilesError) throw profilesError;
    if (requestsError) throw requestsError;
    if (announcementsError) throw announcementsError;
    if (portfolioError) throw portfolioError;
    if (activityError) throw activityError;

    const users = (profileRows || []).map(profile =>
      mapProfileRow(
        profile,
        (portfolioRows || []).filter(item => item.user_id === profile.id),
        (activityRows || []).filter(item => item.user_id === profile.id)
      )
    );

    const requests = (requestRows || []).map(item =>
      normalizeRequest({
        id: item.id,
        userId: item.user_id,
        type: item.type,
        amount: item.amount,
        notes: item.notes,
        asset: item.asset,
        assetLabel: item.asset_label,
        walletAddress: item.wallet_address,
        status: item.status,
        paymentConfirmedAt: item.payment_confirmed_at,
        processedAt: item.processed_at,
        decisionNote: item.decision_note,
        createdAt: item.created_at
      })
    );

    const latestAnnouncement = announcementRows?.[0];
    return saveDb({
      users,
      requests,
      announcement: latestAnnouncement
        ? {
            headline: latestAnnouncement.headline,
            message: latestAnnouncement.message,
            updatedAt: latestAnnouncement.updated_at
          }
        : { ...EMPTY_ANNOUNCEMENT }
    });
  }

  async function signInWithSupabase(email, password, remember = false) {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase client is not available on this page.");

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const db = await loadDbFromSupabase(data.user);
    const user = findUser(db, { userId: data.user.id });
    if (!user) throw new Error("Your profile was not found after sign in.");

    await appendActivity(user.id, "Session started", "User signed in through Supabase authentication.");
    const refreshedDb = await loadDbFromSupabase(data.user);
    saveSession({ userId: user.id }, remember);
    return { authUser: data.user, user: findUser(refreshedDb, { userId: data.user.id }) || user };
  }

  async function signUpWithSupabase({ name, email, password, plan, remember = true }) {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase client is not available on this page.");

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          plan
        }
      }
    });
    if (error) throw error;

    let authUser = data.user;
    let session = data.session;

    if (!session && authUser?.email) {
      const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) {
        throw new Error("Signup succeeded, but immediate sign-in is blocked. Disable email confirmation in Supabase Auth settings to allow direct login.");
      }
      authUser = signInData.user;
      session = signInData.session;
    }

    if (!session || !authUser) {
      throw new Error("Signup completed, but no active session was created.");
    }

    const db = await loadDbFromSupabase(authUser);
    const user = findUser(db, { userId: authUser.id });
    if (!user) throw new Error("Your profile was not created correctly.");

    saveSession({ userId: user.id }, remember);
    return { authUser, user };
  }

  async function syncSessionFromSupabase(remember = true) {
    const client = getSupabaseClient();
    if (!client) return findUser(getDb(), readSession());

    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.user) {
      clearSession();
      saveDb(getEmptyDb());
      return null;
    }

    const db = await loadDbFromSupabase(data.session.user);
    const user = findUser(db, { userId: data.session.user.id });
    if (!user) return null;
    saveSession({ userId: user.id }, remember);
    return user;
  }

  async function signOutFromSupabase() {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    clearSession();
    saveDb(getEmptyDb());
  }

  async function resetPasswordWithSupabase(email) {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase client is not available on this page.");

    const redirectTo = `${window.location.origin}${window.location.pathname.includes("/public/") ? "/public/login.html" : "/login.html"}`;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async function updateUserStatus(userId, status) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("profiles")
      .update({ status })
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw error;

    await appendActivity(
      userId,
      status === "approved" ? "Account approved" : "Account status changed",
      status === "approved"
        ? "An administrator approved this registration and unlocked account access."
        : "An administrator updated the account status."
    );

    const db = await loadDbFromSupabase();
    const user = findUser(db, { userId: data.id });
    return { db, user };
  }

  async function submitDepositRequest(userId, payload) {
    const client = getSupabaseClient();
    const wallet = CRYPTO_WALLETS[payload.asset];
    if (!wallet) throw new Error("Select a cryptocurrency for this deposit.");

    const { data, error } = await client
      .from("funding_requests")
      .insert({
        user_id: userId,
        type: "deposit",
        amount: Number(payload.amount || 0),
        notes: payload.notes || "",
        asset: payload.asset,
        asset_label: wallet.label,
        wallet_address: wallet.address,
        status: "pending",
        payment_confirmed_at: new Date().toISOString(),
        decision_note: ""
      })
      .select("*")
      .single();
    if (error) throw error;

    await appendActivity(userId, "Deposit submitted", `${formatCurrency(data.amount)} deposit proof was sent to the admin desk for approval.`);
    const db = await loadDbFromSupabase();
    const user = findUser(db, { userId });
    const request = db.requests.find(item => item.id === data.id) || null;
    return { db, user, request };
  }

  async function submitWithdrawalRequest(userId, payload) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("funding_requests")
      .insert({
        user_id: userId,
        type: "withdrawal",
        amount: Number(payload.amount || 0),
        notes: payload.notes || "",
        asset: "",
        asset_label: "",
        wallet_address: "",
        status: "pending",
        decision_note: ""
      })
      .select("*")
      .single();
    if (error) throw error;

    await appendActivity(userId, "Withdrawal submitted", `${formatCurrency(data.amount)} withdrawal request was sent to the admin desk for approval.`);
    const db = await loadDbFromSupabase();
    const user = findUser(db, { userId });
    const request = db.requests.find(item => item.id === data.id) || null;
    return { db, user, request };
  }

  async function declineClientRequest(requestId, decisionNote) {
    const client = getSupabaseClient();
    const existingDb = getDb();
    const cachedRequest = existingDb.requests.find(item => item.id === requestId);
    if (!cachedRequest) throw new Error("Request not found.");

    const { data, error } = await client
      .from("funding_requests")
      .update({
        status: "declined",
        processed_at: new Date().toISOString(),
        decision_note: decisionNote || "Declined by the admin desk."
      })
      .eq("id", requestId)
      .select("*")
      .single();
    if (error) throw error;

    await appendActivity(
      data.user_id,
      `${data.type === "deposit" ? "Deposit" : "Withdrawal"} declined`,
      `${formatCurrency(data.amount)} ${data.type} request was declined by the admin desk.`
    );

    const db = await loadDbFromSupabase();
    const user = findUser(db, { userId: data.user_id });
    const request = db.requests.find(item => item.id === data.id) || null;
    return { db, user, request };
  }

  async function approveClientRequest(requestId) {
    const client = getSupabaseClient();
    const db = getDb();
    const request = db.requests.find(item => item.id === requestId);
    const user = db.users.find(item => item.id === (request && request.userId));
    if (!request || !user || request.status !== "pending") throw new Error("Request is no longer available.");

    let nextBalance = Number(user.balance || 0);
    let activityTitle = "Deposit approved";
    let activityDetail = `${formatCurrency(request.amount)} was approved and added to your account balance.`;

    if (request.type === "deposit") {
      nextBalance += request.amount;
    } else {
      if (request.amount > nextBalance) {
        return declineClientRequest(requestId, "Declined automatically because the withdrawal amount exceeded the available balance.");
      }
      nextBalance -= request.amount;
      activityTitle = "Withdrawal approved";
      activityDetail = `${formatCurrency(request.amount)} was approved for withdrawal by the admin desk.`;
    }

    const { error: profileError } = await client
      .from("profiles")
      .update({ balance: nextBalance })
      .eq("id", user.id);
    if (profileError) throw profileError;

    const { data: updatedRequest, error: requestError } = await client
      .from("funding_requests")
      .update({
        status: "approved",
        processed_at: new Date().toISOString(),
        decision_note:
          request.type === "deposit"
            ? "Payment confirmed and credited to the client account."
            : "Withdrawal approved by the admin desk."
      })
      .eq("id", requestId)
      .select("*")
      .single();
    if (requestError) throw requestError;

    await replacePortfolioAllocations(user.id, user.plan, nextBalance);
    await appendActivity(user.id, activityTitle, activityDetail);

    const refreshedDb = await loadDbFromSupabase();
    return {
      db: refreshedDb,
      user: findUser(refreshedDb, { userId: user.id }),
      request: refreshedDb.requests.find(item => item.id === updatedRequest.id) || null
    };
  }

  async function updateClientSettings(clientId, payload) {
    const client = getSupabaseClient();
    const updates = {
      full_name: payload.name,
      plan: payload.plan,
      status: payload.status,
      balance: Number(payload.balance || 0),
      performance: Number(payload.performance || 0),
      kyc: payload.kyc
    };

    const { data, error } = await client
      .from("profiles")
      .update(updates)
      .eq("id", clientId)
      .select("*")
      .single();
    if (error) throw error;

    await replacePortfolioAllocations(clientId, updates.plan, updates.balance);
    if (payload.note) {
      await appendActivity(clientId, "Admin note added", payload.note);
    }

    const db = await loadDbFromSupabase();
    return { db, user: findUser(db, { userId: data.id }) };
  }

  async function updateClientProfile(userId, payload) {
    const client = getSupabaseClient();
    const authUpdates = {
      data: {
        full_name: payload.name
      }
    };
    if (payload.email) authUpdates.email = payload.email;
    if (payload.password) authUpdates.password = payload.password;

    const { error: authError } = await client.auth.updateUser(authUpdates);
    if (authError) throw authError;

    const { data, error } = await client
      .from("profiles")
      .update({
        full_name: payload.name,
        email: payload.email
      })
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw error;

    await appendActivity(userId, "Profile updated", "Client account details were updated from the settings page.");
    const db = await loadDbFromSupabase();
    return { db, user: findUser(db, { userId: data.id }) };
  }

  async function publishAnnouncement(headline, message) {
    const client = getSupabaseClient();
    const { error: deactivateError } = await client
      .from("announcements")
      .update({ is_active: false })
      .eq("is_active", true);
    if (deactivateError) throw deactivateError;

    const session = readSession();
    const { error: insertError } = await client.from("announcements").insert({
      headline,
      message,
      is_active: true,
      updated_by: session?.userId || null
    });
    if (insertError) throw insertError;

    return loadDbFromSupabase();
  }

  saveDb(getEmptyDb());

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
    signInWithSupabase,
    signUpWithSupabase,
    syncSessionFromSupabase,
    signOutFromSupabase,
    resetPasswordWithSupabase,
    findUser,
    loadDbFromSupabase,
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
