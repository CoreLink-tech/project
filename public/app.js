const {
  ADMIN_HOME_URL,
  CLIENT_HOME_URL,
  findUser,
  getDb,
  readSession,
  resetPasswordWithSupabase,
  signInWithSupabase,
  signUpWithSupabase,
  syncSessionFromSupabase
} = window.ZenturoShared;

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

const authModal = $("#authModal");
const authToast = $("#authToast");
const authTabs = $$(".auth-tab");
const authPanels = $$(".auth-panel");
const authTriggers = $$("[data-auth-trigger]");
const authCloseEls = $$("[data-auth-close]");
const signinForm = $("#signinForm");
const signupForm = $("#signupForm");
const signinMessage = $("#signinMessage");
const signupMessage = $("#signupMessage");
const forgotPasswordBtn = $("#forgotPasswordBtn");
const hamburger = $("#hamburger");
const mobileNav = $("#mobileNav");

authTriggers.forEach(trigger => {
  trigger.dataset.defaultLabel = trigger.textContent.trim();
});

function setMessage(target, message, type = "error") {
  target.textContent = message;
  target.dataset.state = type;
}

function clearMessage(target) {
  target.textContent = "";
  target.dataset.state = "";
}

function showToast(message) {
  authToast.textContent = message;
  authToast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => authToast.classList.remove("is-visible"), 3200);
}

function switchAuthTab(mode) {
  authTabs.forEach(tab => {
    const isActive = tab.dataset.authTab === mode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  authPanels.forEach(panel => {
    panel.classList.toggle("is-active", panel.dataset.authPanel === mode);
  });
  clearMessage(signinMessage);
  clearMessage(signupMessage);
}

function openAuthModal(mode = "signin") {
  switchAuthTab(mode);
  authModal.classList.add("is-open");
  authModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-open");
}

function closeAuthModal() {
  authModal.classList.remove("is-open");
  authModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-open");
  clearMessage(signinMessage);
  clearMessage(signupMessage);
}

function routeUser(user) {
  window.location.href = user.role === "admin" ? ADMIN_HOME_URL : CLIENT_HOME_URL;
}

function updateAuthUI() {
  const user = findUser(getDb(), readSession());
  const signinButtons = $$('[data-auth-trigger="signin"]');
  const signupButtons = $$('[data-auth-trigger="signup"]');

  if (user) {
    signinButtons.forEach(button => {
      button.textContent = user.role === "admin" ? "Open Admin" : "Open Workspace";
    });
    signupButtons.forEach(button => {
      button.textContent = user.role === "admin" ? "Open Admin" : "Open Workspace";
    });
    return;
  }

  signinButtons.forEach(button => {
    button.textContent = button.dataset.defaultLabel || "Sign In";
  });
  signupButtons.forEach(button => {
    button.textContent = button.dataset.defaultLabel || "Create Account";
  });
}

window.addEventListener("load", () => {
  setTimeout(() => {
    $("#preloader")?.classList.add("hide");
  }, 800);
});

hamburger?.addEventListener("click", () => mobileNav?.classList.toggle("show"));
mobileNav?.querySelectorAll("a").forEach(anchor => {
  anchor.addEventListener("click", () => mobileNav.classList.remove("show"));
});

authTriggers.forEach(trigger => {
  trigger.addEventListener("click", event => {
    const user = findUser(getDb(), readSession());
    if (user) {
      event.preventDefault();
      routeUser(user);
      return;
    }
    const href = trigger.getAttribute("href");
    if (href && href !== "#") return;
    event.preventDefault();
    openAuthModal(trigger.dataset.authTrigger);
  });
});

authCloseEls.forEach(node => node.addEventListener("click", closeAuthModal));
authTabs.forEach(tab => {
  tab.addEventListener("click", () => switchAuthTab(tab.dataset.authTab));
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && authModal.classList.contains("is-open")) {
    closeAuthModal();
  }
});

signinForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearMessage(signinMessage);

  const formData = new FormData(signinForm);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const remember = Boolean(formData.get("remember"));

  if (!email || !password) {
    setMessage(signinMessage, "Enter your email address and password to continue.");
    return;
  }

  try {
    const { user } = await signInWithSupabase(email, password, remember);
    closeAuthModal();
    signinForm.reset();
    signupForm.reset();
    routeUser(user);
  } catch (error) {
    setMessage(
      signinMessage,
      error?.message || "We could not match that account. Check your credentials or create a new account."
    );
  }
});

signupForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearMessage(signupMessage);

  const formData = new FormData(signupForm);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const plan = String(formData.get("plan") || "Starter");
  const acceptedTerms = Boolean(formData.get("terms"));

  if (!name || !email || !password || !confirmPassword) {
    setMessage(signupMessage, "Complete every required field before creating your account.");
    return;
  }

  if (password.length < 8) {
    setMessage(signupMessage, "Use a password with at least 8 characters.");
    return;
  }

  if (password !== confirmPassword) {
    setMessage(signupMessage, "Your password confirmation does not match.");
    return;
  }

  if (!acceptedTerms) {
    setMessage(signupMessage, "You must agree to the client communication policy.");
    return;
  }

  try {
    const result = await signUpWithSupabase({ name, email, password, plan, remember: true });
    if (result.requiresEmailConfirmation) {
      setMessage(
        signupMessage,
        "Your account was created in Supabase. Check your email to confirm it before signing in.",
        "info"
      );
      signupForm.reset();
      return;
    }
    closeAuthModal();
    routeUser(result.user);
  } catch (error) {
    setMessage(signupMessage, error?.message || "We could not create your account right now.");
  }
});

forgotPasswordBtn.addEventListener("click", async () => {
  const email = String(signinForm.elements.email.value || "").trim().toLowerCase();
  if (!email) {
    setMessage(signinMessage, "Enter your email address first and we will send the reset link there.");
    return;
  }

  try {
    await resetPasswordWithSupabase(email);
    setMessage(signinMessage, `Password reset instructions have been sent to ${email}.`, "info");
  } catch (error) {
    setMessage(signinMessage, error?.message || "We could not send a reset email right now.");
  }
});

$$(".faq-q").forEach(node => {
  node.addEventListener("click", () => {
    const parent = node.parentElement;
    const isOpen = parent.classList.contains("open");
    $$(".faq-item").forEach(item => item.classList.remove("open"));
    if (!isOpen) parent.classList.add("open");
  });
});

const tickerData = [
  { symbol: "BTC/USD", price: "$68,420.50", change: "+4.82%", up: true },
  { symbol: "ETH/USD", price: "$3,812.30", change: "+2.14%", up: true },
  { symbol: "EUR/USD", price: "1.0872", change: "-0.12%", up: false },
  { symbol: "GBP/USD", price: "1.2654", change: "+0.34%", up: true },
  { symbol: "XRP/USD", price: "$0.5821", change: "+6.70%", up: true },
  { symbol: "S&P 500", price: "5,248.10", change: "+0.89%", up: true },
  { symbol: "NASDAQ", price: "16,741.20", change: "+1.02%", up: true },
  { symbol: "GOLD", price: "$2,341.80", change: "-0.28%", up: false },
  { symbol: "SOL/USD", price: "$148.60", change: "+3.51%", up: true },
  { symbol: "BNB/USD", price: "$592.40", change: "+1.87%", up: true }
];

function buildTicker() {
  const inner = $("#tickerInner");
  if (!inner) return;
  const doubled = [...tickerData, ...tickerData];
  inner.innerHTML = doubled
    .map(
      item => `
        <div class="ticker-item">
          <span class="symbol">${item.symbol}</span>
          <span class="price">${item.price}</span>
          <span class="change ${item.up ? "up" : "down"}">${item.change}</span>
        </div>
      `
    )
    .join("");
}

const coins = [
  { name: "Bitcoin", sym: "BTC", price: 68420, chg: "+4.82%", up: true, color: "#f7931a", bg: "rgba(247,147,26,0.15)" },
  { name: "Ethereum", sym: "ETH", price: 3812, chg: "+2.14%", up: true, color: "#627eea", bg: "rgba(98,126,234,0.15)" },
  { name: "Solana", sym: "SOL", price: 148, chg: "+3.51%", up: true, color: "#9945ff", bg: "rgba(153,69,255,0.15)" },
  { name: "XRP", sym: "XRP", price: 0.58, chg: "+6.70%", up: true, color: "#00aae4", bg: "rgba(0,170,228,0.15)" },
  { name: "EUR/USD", sym: "FX", price: 1.0872, chg: "-0.12%", up: false, color: "#22d3a5", bg: "rgba(34,211,165,0.15)" },
  { name: "Gold", sym: "XAU", price: 2341, chg: "-0.28%", up: false, color: "#f5c842", bg: "rgba(245,200,66,0.15)" }
];

function buildPrices() {
  const container = $("#livePrices");
  if (!container) return;
  container.innerHTML = coins
    .map(
      coin => `
        <div class="coin-row">
          <div class="coin-info">
            <div class="coin-icon" style="background:${coin.bg};color:${coin.color};">${coin.sym.charAt(0)}</div>
            <div>
              <div class="coin-name">${coin.name}</div>
              <div class="coin-sym">${coin.sym}</div>
            </div>
          </div>
          <div>
            <div class="coin-price">$${coin.price.toLocaleString()}</div>
            <div class="coin-chg ${coin.up ? "up" : "dn"}">${coin.chg}</div>
          </div>
        </div>
      `
    )
    .join("");
}

setInterval(() => {
  coins.forEach(coin => {
    const change = (Math.random() - 0.48) * 0.002;
    coin.price = parseFloat((coin.price * (1 + change)).toFixed(coin.price < 10 ? 4 : 0));
    coin.chg = `${change >= 0 ? "+" : ""}${(change * 100).toFixed(2)}%`;
    coin.up = change >= 0;
  });
  buildPrices();
}, 3000);

const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  },
  { threshold: 0.1 }
);

$$(".service-card, .plan-card, .feature-item, .testi-card").forEach(node => {
  node.style.opacity = "0";
  node.style.transform = "translateY(24px)";
  node.style.transition = "opacity 0.5s ease, transform 0.5s ease";
  observer.observe(node);
});

buildTicker();
buildPrices();

void syncSessionFromSupabase()
  .catch(() => null)
  .finally(() => {
    updateAuthUI();
    const sessionUser = findUser(getDb(), readSession());
    if (sessionUser) {
      showToast(`Signed in as ${sessionUser.name}.`);
    }
  });

window.addEventListener("beforeunload", () => {
  clearTimeout(showToast.timer);
});
