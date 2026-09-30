const STORAGE_KEY = "lidire-mvp-data";

const defaultState = {
  user: {
    name: "",
    email: "conta@lidire.com",
    age: "",
    phone: "",
    address: "",
    photo: ""
  },

  data: {
    compromissos: [],
    tarefas: [],
    compras: [],
    estudos: [],
    studyPlans: [],
    treinos: [],
    hidratacao: [],
    alimentacao: [],
    financas: [],
    alimentos: [],
    objetivos: [],
    familia: [],
    cicloMenstrual: {
      periodos: [],
      sintomas: []
    }
  },

  settings: {
    hydrationGoal: 2000,
    hydrationStart: "08:00",
    hydrationEnd: "21:00",
    hydrationIntervalMinutes: 120,
    calorieGoal: 2000,
    financeLimits: {},
    financeMonthResets: {},
    cycleLength: 28,
    periodLength: 5,
    cycleAiContext: false
  }
};

let state = loadState();
let currentPage = "inicio";
let currentShoppingList = null;
let modal = null;
let authUser = null;
let authMode = "login";
let authBusy = false;
let authChecked = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!saved) {
      return clone(defaultState);
    }

    return {
      ...clone(defaultState),
      ...saved,

      user: {
        ...defaultState.user,
        ...(saved.user || {})
      },

      data: {
        ...defaultState.data,
        ...(saved.data || {})
      },

      settings: {
        ...defaultState.settings,
        ...(saved.settings || {})
      }
    };
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    return clone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}


function authLoadingScreen() {
  return `
    <div class="auth-loading">
      <div class="auth-loading-inner">
        <div class="auth-spinner"></div>
        <strong>Carregando a LiDire…</strong>
      </div>
    </div>
  `;
}

function authScreen() {
  const login = authMode === "login";
  return `
    <div class="auth-screen">
      <div class="auth-glow"></div>
      <section class="auth-card" aria-label="${login ? "Entrar" : "Criar conta"}">
        <div class="auth-brand">
          <img src="/logo-lidire-oficial.png" alt="LiDire">
          <strong>LiDire</strong>
        </div>

        <div class="eyebrow">${login ? "SEJA BEM-VINDO(A)" : "COMECE SUA JORNADA"}</div>
        <h1 class="auth-title">${login ? "Entre na sua conta." : "Crie sua conta."}</h1>
        <p class="auth-subtitle">
          ${login
            ? "Acesse sua rotina, seus planos e tudo o que você organiza com a LiDire."
            : "Tenha sua rotina organizada em um só lugar, com seus dados associados à sua própria conta."}
        </p>

        <div id="auth-message"></div>

        <form id="auth-form" class="auth-form" novalidate>
          ${!login ? `
            <label class="auth-field">
              <span>Nome</span>
              <input name="name" type="text" autocomplete="name" placeholder="Como você quer ser chamado(a)?" required minlength="2">
            </label>
          ` : ""}

          <label class="auth-field">
            <span>E-mail</span>
            <input name="email" type="email" autocomplete="email" placeholder="seu@email.com" required>
          </label>

          <label class="auth-field">
            <span>Senha</span>
            <div class="auth-password">
              <input id="auth-password" name="password" type="password" autocomplete="${login ? "current-password" : "new-password"}" placeholder="Mínimo de 8 caracteres" required minlength="8">
              <button type="button" class="auth-toggle-password" id="auth-toggle-password" data-action="auth-toggle-password" aria-label="Mostrar senha">◉</button>
            </div>
            ${!login ? `<small class="auth-password-hint">A senha deve ter no mínimo 8 caracteres.</small>` : ""}
          </label>

          ${!login ? `
            <label class="auth-field">
              <span>Confirmar senha</span>
              <div class="auth-password">
                <input id="auth-password-confirm" name="passwordConfirm" type="password" autocomplete="new-password" placeholder="Digite a senha novamente" required minlength="8">
                <button type="button" class="auth-toggle-password" id="auth-toggle-password-confirm" data-action="auth-toggle-password-confirm" aria-label="Mostrar confirmação de senha">◉</button>
              </div>
            </label>

            <label class="auth-check">
              <input name="legalAccepted" type="checkbox" required>
              <span>Li e aceito os <a href="#" class="auth-legal" data-action="auth-legal">Termos de Uso</a> e a <a href="#" class="auth-legal" data-action="auth-legal">Política de Privacidade</a>.</span>
            </label>
          ` : ""}

          <button class="primary-button auth-submit" type="submit" ${authBusy ? "disabled" : ""}>
            ${authBusy ? "Aguarde…" : (login ? "Entrar na LiDire" : "Criar minha conta")}
          </button>
        </form>

        ${login ? `<button type="button" class="auth-forgot" data-action="forgot-password">Esqueci minha senha</button>` : ""}

        <p class="auth-switch">
          ${login ? "Ainda não tem uma conta?" : "Já tem uma conta?"}
          <button type="button" data-action="auth-switch">${login ? "Criar conta" : "Entrar"}</button>
        </p>
      </section>
    </div>
  `;
}

function setAuthMessage(message, type = "error") {
  const box = document.getElementById("auth-message");
  if (!box) return;
  box.className = type === "success" ? "auth-success" : "auth-error";
  box.textContent = message;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = {};
  try { data = await response.json(); } catch (_) {}

  if (!response.ok) {
    const error = new Error(data.message || data.error || "Não foi possível concluir a solicitação.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function syncUserToState(user) {
  if (!user) return;
  state.user = {
    ...state.user,
    id: user.id,
    name: user.name || "",
    email: user.email || "",
    age: user.age ?? "",
    phone: user.phone || "",
    address: user.address || "",
    photo: user.profile_photo || state.user.photo || ""
  };
  saveState();
}

async function loadCurrentUser() {
  try {
    const data = await apiRequest("/api/me", { method: "GET" });
    if (data.user) {
      authUser = data.user;
      syncUserToState(data.user);
      return true;
    }
  } catch (error) {
    console.warn("Sessão não carregada:", error);
  }
  authUser = null;
  return false;
}

function renderAuth() {
  const root = document.getElementById("app");
  if (root) root.innerHTML = authScreen();
}

function handleAuthSwitch() {
  authMode = authMode === "login" ? "register" : "login";
  renderAuth();
}

function togglePasswordInput(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
}

function openPasswordRecovery() {
  openModal("Recuperar senha", `
    <p class="muted">Informe o e-mail da sua conta. A LiDire iniciará o fluxo seguro de recuperação.</p>
    ${field("E-mail", "email", "email", "", "required")}
    <div class="content-card" style="margin-top:10px;padding:12px;font-size:12px;">Por segurança, não exibiremos se o e-mail existe. O envio do link de redefinição por e-mail será ativado quando o provedor de e-mail transacional estiver configurado no Worker.</div>
  `, { submit: "Solicitar recuperação" });
  modal.querySelector("#lidire-form").onsubmit = async e => {
    e.preventDefault();
    const email = String(new FormData(e.target).get("email") || "").trim().toLowerCase();
    if (!email) return;
    try {
      await apiRequest("/api/password-reset/request", { method: "POST", body: JSON.stringify({ email }) });
      closeModal();
      setAuthMessage("Se existir uma conta com esse e-mail, as instruções de recuperação serão enviadas.", "success");
    } catch (error) {
      toast(error.message || "Não foi possível iniciar a recuperação.", "error");
    }
  };
}

async function submitAuth(form) {
  if (authBusy) return;
  const formData = new FormData(form);
  const login = authMode === "login";
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("passwordConfirm") || "");

  if (!email || !email.includes("@")) {
    setAuthMessage("Informe um e-mail válido.");
    return;
  }
  if (password.length < 8) {
    setAuthMessage("A senha precisa ter pelo menos 8 caracteres.");
    return;
  }
  if (!login) {
    if (name.length < 2) {
      setAuthMessage("Informe seu nome.");
      return;
    }
    if (password !== confirmation) {
      setAuthMessage("As senhas não coincidem.");
      return;
    }
    if (!formData.get("legalAccepted")) {
      setAuthMessage("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
      return;
    }
  }

  authBusy = true;
  renderAuth();
  setAuthMessage(login ? "Entrando…" : "Criando sua conta…", "success");

  try {
    const data = await apiRequest(login ? "/api/login" : "/api/register", {
      method: "POST",
      body: JSON.stringify(login
        ? { email, password }
        : { name, email, password, legalAccepted: true })
    });

    authUser = data.user;
    syncUserToState(data.user);
    authChecked = true;
    currentPage = "inicio";
    currentShoppingList = null;
    render();
    toast(login ? "Login realizado com sucesso." : "Conta criada com sucesso.");
  } catch (error) {
    authBusy = false;
    renderAuth();
    setAuthMessage(error.message || "Não foi possível concluir o acesso.");
  } finally {
    authBusy = false;
  }
}

async function logoutLiDire() {
  try {
    await apiRequest("/api/logout", { method: "POST", body: "{}" });
  } catch (_) {}
  authUser = null;
  authChecked = true;
  localStorage.removeItem(STORAGE_KEY);
  state = clone(defaultState);
  currentPage = "inicio";
  renderAuth();
  toast("Você saiu da LiDire.");
}

async function initAuth() {
  const root = document.getElementById("app");
  if (!root) return;
  root.innerHTML = authLoadingScreen();
  const logged = await loadCurrentUser();
  authChecked = true;
  if (logged) {
    render();
  } else {
    renderAuth();
  }
}

function normalizeStudiesData() {
  if (!Array.isArray(state.data.estudos)) state.data.estudos = [];
  if (!Array.isArray(state.data.studyPlans)) state.data.studyPlans = [];

  state.data.estudos.forEach(item => {
    if (!Array.isArray(item.history)) item.history = [];
    if (!item.subject) item.subject = item.title || "Matéria";
    if (item.notes == null) item.notes = "";
    if (item.link == null) item.link = "";
  });
}

normalizeStudiesData();

function normalizeCycleData() {
  if (!state.data.cicloMenstrual || typeof state.data.cicloMenstrual !== "object") {
    state.data.cicloMenstrual = { periodos: [], sintomas: [] };
  }
  if (!Array.isArray(state.data.cicloMenstrual.periodos)) state.data.cicloMenstrual.periodos = [];
  if (!Array.isArray(state.data.cicloMenstrual.sintomas)) state.data.cicloMenstrual.sintomas = [];
  state.settings.cycleLength = Math.max(21, Math.min(45, Number(state.settings.cycleLength) || 28));
  state.settings.periodLength = Math.max(1, Math.min(10, Number(state.settings.periodLength) || 5));
  state.settings.cycleAiContext = !!state.settings.cycleAiContext;
}

normalizeCycleData();

function normalizeFoodData() {
  if (!Array.isArray(state.data.alimentos)) state.data.alimentos = [];
  state.data.alimentos.forEach(food => {
    if (!food.unit) food.unit = "g";
    if (food.calories == null) food.calories = 0;
  });
  if (!state.settings.financeMonthResets || typeof state.settings.financeMonthResets !== "object") state.settings.financeMonthResets = {};
}
normalizeFoodData();

if (Array.isArray(state.data.financas)) state.data.financas.forEach(x => { if (!x.currency) x.currency = "BRL"; });
if (Array.isArray(state.data.objetivos)) state.data.objetivos.forEach(x => { if (!x.moneyCurrency) x.moneyCurrency = "BRL"; if (!Array.isArray(x.metas)) x.metas = []; });

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value, currency = "BRL") {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "BRL"
  });
}

function dateBR(value) {
  if (!value) return "";

  const [y, m, d] = String(value).split("-");

  return y && m && d ? `${d}/${m}/${y}` : value;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toTimeString().slice(0, 5);
}

function toast(message, type = "success") {
  document.querySelectorAll(".lidire-toast").forEach((el) => el.remove());

  const el = document.createElement("div");

  el.className = `lidire-toast ${type}`;

  el.innerHTML = `
    <span>${type === "success" ? "✓" : "!"}</span>
    ${esc(message)}
  `;

  document.body.appendChild(el);

  setTimeout(() => el.remove(), 2600);
}

function icon(name) {
  const icons = {
    home: "⌂",
    calendar: "▣",
    check: "✓",
    cart: "🛒",
    book: "▤",
    dumbbell: "♢",
    drop: "◉",
    wallet: "R$",
    target: "◎",
    family: "♧",
    food: "🍽",
    spark: "✦",
    user: "◯",
    plus: "+",
    arrow: "→",
    trash: "⌫",
    edit: "✎",
    clock: "◷",
    search: "⌕",
    back: "‹",
    link: "🔗",
    note: "📝",
    fire: "🔥"
  };

  return icons[name] || "•";
}

/* =========================================================
   ESTILO EXTRA INSERIDO PELO PRÓPRIO JS
   ========================================================= */

function injectLiDireStyles() {
  if (document.getElementById("lidire-extra-styles")) return;

  const style = document.createElement("style");
  style.id = "lidire-extra-styles";

  style.textContent = `
    .task-priority {
      width: 7px;
      min-width: 7px;
      height: 46px;
      border-radius: 8px;
      margin-right: 10px;
    }

    .priority-baixa {
      background: #22c55e;
    }

    .priority-normal {
      background: #3b82f6;
    }

    .priority-média {
      background: #facc15;
    }

    .priority-alta {
      background: #ef4444;
    }

    .task-content {
      display: flex;
      align-items: center;
      width: 100%;
    }

    .finance-chart {
      padding: 20px;
      margin-bottom: 20px;
    }

    .chart-row {
      margin-bottom: 15px;
    }

    .chart-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 13px;
    }

    .chart-bar {
      height: 12px;
      border-radius: 20px;
      background: rgba(255,255,255,.08);
      overflow: hidden;
    }

    .chart-bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg,#8b5cf6,#ec4899);
    }

    .limit-warning {
      font-size: 12px;
      margin-top: 5px;
    }

    .limit-ok {
      color: #22c55e;
    }

    .limit-danger {
      color: #ef4444;
    }

    .notes-box {
      min-height: 150px;
    }

    .exercise-animation {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 130px;
      font-size: 70px;
      animation: lidireExercise 1.4s ease-in-out infinite;
    }

    @keyframes lidireExercise {
      0%,100% {
        transform: translateY(0) rotate(0deg);
      }

      50% {
        transform: translateY(-12px) rotate(4deg);
      }
    }

    .exercise-card {
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 16px;
      padding: 15px;
      margin-bottom: 12px;
    }

    .exercise-grid {
      display: grid;
      grid-template-columns: repeat(2,1fr);
      gap: 10px;
      margin-top: 10px;
    }

    .diet-food-row {
      display: grid;
      grid-template-columns: 1fr 90px 40px;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }

    .calorie-summary {
      padding: 18px;
      border-radius: 18px;
      margin-bottom: 18px;
      background: rgba(139,92,246,.12);
    }

    .calorie-summary strong {
      font-size: 30px;
    }

    .calorie-progress {
      height: 10px;
      border-radius: 20px;
      overflow: hidden;
      background: rgba(255,255,255,.1);
      margin-top: 12px;
    }

    .calorie-progress span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg,#22c55e,#facc15,#ef4444);
    }

    .goal-subtasks {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,.08);
    }

    .goal-subtask {
      display: flex;
      gap: 10px;
      align-items: center;
      margin: 8px 0;
    }

    .period-badge {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 10px;
      background: rgba(139,92,246,.15);
    }

    .photo-preview {
      display: flex;
      justify-content: center;
      margin-bottom: 15px;
    }

    .profile-photo-preview {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid rgba(139,92,246,.5);
    }

    .profile-photo-placeholder {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 36px;
      background: rgba(139,92,246,.18);
    }

    .link-button {
      color: #8b5cf6;
      text-decoration: none;
    }

    .shopping-diet-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 15px 0;
    }

    .muted {
      opacity: .7;
    }

    .danger-button {
      border: 0; border-radius: 12px; padding: 11px 15px; cursor: pointer;
      background: #d6455d; color: #fff; font-weight: 700;
    }
    .confirm-delete-box { text-align:center; padding: 8px 0 4px; }
    .confirm-delete-icon { font-size: 38px; margin-bottom: 8px; }
    .confirm-delete-actions { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:16px; }
    .cycle-summary-card { display:flex; justify-content:space-between; gap:18px; align-items:center; padding:24px; border-radius:20px; background:linear-gradient(135deg,rgba(139,92,246,.18),rgba(236,72,153,.12)); border:1px solid rgba(255,255,255,.08); margin-bottom:18px; }
    .cycle-orbit { width:82px; height:82px; border-radius:50%; display:grid; place-items:center; font-size:46px; background:rgba(255,255,255,.06); }
    .cycle-cross-links { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
    .cycle-cross-links span { padding:9px 12px; border-radius:999px; background:rgba(255,255,255,.05); }
  
    /* AUTENTICAÇÃO — proteção visual para o primeiro carregamento */
    .auth-loading,
    .auth-screen {
      min-height: 100vh;
      min-height: 100dvh;
      width: 100%;
      box-sizing: border-box;
      background: #070C22;
      color: #fff;
      font-family: Inter, Arial, sans-serif;
    }

    .auth-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .auth-loading-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      color: rgba(255,255,255,.86);
    }

    .auth-spinner {
      width: 30px;
      height: 30px;
      border: 3px solid rgba(255,255,255,.18);
      border-top-color: #8b5cf6;
      border-radius: 50%;
      animation: lidire-spin .8s linear infinite;
    }

    @keyframes lidire-spin {
      to { transform: rotate(360deg); }
    }

    .auth-screen {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      overflow: auto;
    }

    .auth-glow {
      position: fixed;
      width: 360px;
      height: 360px;
      border-radius: 50%;
      background: rgba(139,92,246,.16);
      filter: blur(70px);
      pointer-events: none;
    }

    .auth-card {
      position: relative;
      z-index: 1;
      width: min(100%, 440px);
      box-sizing: border-box;
      padding: 28px;
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 24px;
      background: rgba(15,23,52,.94);
      box-shadow: 0 24px 70px rgba(0,0,0,.35);
    }

    .auth-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 28px;
      font-size: 22px;
    }

    .auth-brand img {
      width: 42px;
      height: 42px;
      object-fit: contain;
    }

    .auth-title {
      margin: 8px 0;
      color: #fff;
    }

    .auth-subtitle {
      color: rgba(255,255,255,.68);
      line-height: 1.5;
      margin-bottom: 22px;
    }

    .auth-form {
      display: grid;
      gap: 15px;
    }

    .auth-field {
      display: grid;
      gap: 7px;
    }

    .auth-field > span {
      font-size: 13px;
      color: rgba(255,255,255,.78);
    }

    .auth-field input {
      width: 100%;
      box-sizing: border-box;
      min-height: 46px;
      padding: 12px 14px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 12px;
      background: rgba(255,255,255,.06);
      color: #fff;
      outline: none;
    }

    .auth-field input:focus {
      border-color: rgba(139,92,246,.8);
    }

    .auth-password {
      position: relative;
    }

    .auth-password input {
      padding-right: 48px;
    }

    .auth-toggle-password {
      position: absolute;
      right: 7px;
      top: 50%;
      transform: translateY(-50%);
      border: 0;
      background: transparent;
      color: rgba(255,255,255,.7);
      cursor: pointer;
      padding: 8px;
    }

    .auth-check {
      display: flex;
      gap: 9px;
      align-items: flex-start;
      color: rgba(255,255,255,.72);
      font-size: 12px;
      line-height: 1.4;
    }

    .auth-check a {
      color: #c4b5fd;
    }

    .auth-error,
    .auth-success {
      padding: 11px 12px;
      border-radius: 10px;
      margin-bottom: 14px;
      font-size: 13px;
    }

    .auth-error {
      background: rgba(239,68,68,.12);
      color: #fecaca;
    }

    .auth-success {
      background: rgba(34,197,94,.12);
      color: #bbf7d0;
    }

    .auth-submit {
      width: 100%;
      min-height: 46px;
    }

    .auth-switch {
      margin: 20px 0 0;
      text-align: center;
      color: rgba(255,255,255,.65);
      font-size: 13px;
    }

    .auth-switch button {
      border: 0;
      background: transparent;
      color: #c4b5fd;
      font-weight: 700;
      cursor: pointer;
    }
`;

  style.textContent += `
    .shopping-list-card { position:relative; display:flex; align-items:center; gap:8px; }
    .shopping-list-select { padding:10px 4px; }
    .shopping-list-main { flex:1; }
    .shopping-list-actions { display:flex; gap:4px; }
    .shopping-list-actions button { border:0; background:transparent; cursor:pointer; }
`;
  document.head.appendChild(style);
}

injectLiDireStyles();

/* =========================================================
   MÓDULOS
   ========================================================= */

const modules = [
  ["agenda", "Agenda", "Compromissos e horários", "calendar", "agenda"],
  ["tarefas", "Tarefas", "Tudo o que precisa ser feito", "check", "tarefas"],
  ["compras", "Compras", "Listas para não esquecer", "cart", "compras"],
  ["estudos", "Estudos", "Organize seu aprendizado", "book", "estudos"],
  ["treinos", "Treinos", "Movimente-se e acompanhe", "dumbbell", "treinos"],
  ["hidratacao", "Hidratação", "Cuide da sua rotina", "drop", "hidratacao"],
  ["alimentacao", "Alimentação", "Refeições, dieta e calorias", "food", "alimentacao"],
  ["financas", "Finanças", "Entradas, gastos e limites", "wallet", "financas"],
  ["objetivos", "Objetivos", "Transforme planos em passos", "target", "objetivos"],
  ["familia", "Família", "Compartilhe sua rotina", "family", "familia"],
  ["cicloMenstrual", "Ciclo Menstrual", "Acompanhe seu ciclo e seus sinais", "cycle", "cicloMenstrual"],
  ["suporte", "Suporte", "Ajuda, bugs e contato", "spark", "suporte"]
];

/* =========================================================
   SHELL
   ========================================================= */

function appShell(content) {
  const nav = [
    ["inicio", "⌂", "Início"],
    ["agenda", "▣", "Agenda"],
    ["tarefas", "✓", "Tarefas"],
    ["explorar", "✦", "Explorar"],
    ["perfil", "◯", "Perfil"]
  ];

  return `
    <div class="app-bg">

      <header class="topbar">

        <button class="brand" data-page="inicio">
          <img src="/logo-lidire-oficial.png" alt="LiDire">
          <span>LiDire</span>
        </button>

        <div class="topbar-actions">
          <button class="icon-button" data-action="go-back" title="Voltar" aria-label="Voltar">${icon("back")}</button>

          <button class="avatar" data-page="perfil">
            ${
              state.user.photo
                ? `<img src="${esc(state.user.photo)}" alt="Perfil">`
                : esc((state.user.name || "A").charAt(0).toUpperCase())
            }
          </button>


        </div>

      </header>

      <main class="main-content">
        ${content}
      </main>

      <nav class="bottom-nav">
        ${nav.map(([id, ico, label]) => `
          <button
            class="nav-item ${currentPage === id ? "active" : ""}"
            data-page="${id}"
          >
            <span>${ico}</span>
            <small>${label}</small>
          </button>
        `).join("")}
      </nav>

    </div>
  `;
}

function pageHeader(eyebrow, title, subtitle = "", action = "") {
  return `
    <div class="page-header">

      <div>
        <div class="eyebrow">${esc(eyebrow)}</div>
        <h1>${esc(title)}</h1>

        ${
          subtitle
            ? `<p>${esc(subtitle)}</p>`
            : ""
        }
      </div>

      ${action}

    </div>
  `;
}

function statCard(value, label, tone = "") {
  return `
    <div class="stat-card ${tone}">
      <strong>${esc(value)}</strong>
      <span>${esc(label)}</span>
    </div>
  `;
}

function emptyState(title, text, actionLabel, action) {
  return `
    <div class="empty-state">
      <div class="empty-orb">✦</div>

      <h3>${esc(title)}</h3>

      <p>${esc(text)}</p>

      <button
        class="primary-button"
        data-action="${esc(action)}"
      >
        ${icon("plus")} ${esc(actionLabel)}
      </button>
    </div>
  `;
}

/* =========================================================
   INÍCIO
   ========================================================= */

function home() {
  const pending = state.data.tarefas.filter((x) => !x.done).length;

  const commitments = state.data.compromissos.filter(
    (x) => x.date === todayISO()
  ).length;

  const goals = state.data.objetivos.length;

  const firstName =
    (state.user.name || "você").split(" ")[0];

  return appShell(`

    <section class="hero-card">

      <div class="hero-copy">

        <span class="pill">
          <span class="pulse-dot"></span>
          Seu copiloto para a vida
        </span>

        <h1>
          Olá, ${esc(firstName)}.<br>
          <span>Vamos organizar seu dia?</span>
        </h1>

        <p>
          A LiDire reúne sua rotina em um só lugar
          para você saber o que importa agora.
        </p>

        <div class="hero-actions">
          <button class="primary-button" data-page="explorar">${icon("spark")} Explorar recursos</button>
        </div>

      </div>

      <div class="hero-orbit">

        <div class="orbit-center">
          <img
            src="/logo-lidire-oficial.png"
            alt="LiDire"
          >
        </div>

        <span>Agenda</span>
        <span>Tarefas</span>
        <span>Metas</span>
        <span>Você</span>

      </div>

    </section>

    <section class="section">

      <div class="section-title">
        <div>
          <span class="eyebrow">RESUMO</span>
          <h2>Seu dia em números</h2>
        </div>
      </div>

      <div class="daily-summary-card">
        <strong>Bom dia, ${esc(firstName)}!</strong>
        <p>Hoje você tem ${commitments} compromisso${commitments === 1 ? "" : "s"} na agenda, ${pending} tarefa${pending === 1 ? "" : "s"} pendente${pending === 1 ? "" : "s"} e ${goals} objetivo${goals === 1 ? "" : "s"} em andamento. A LiDire está pronta para ajudar você a visualizar detalhes, editar informações, adicionar algo novo ou reorganizar seu dia.</p>
      </div>

      <div class="stats-grid">

        ${statCard(
          commitments,
          "Hoje na agenda",
          "purple"
        )}

        ${statCard(
          pending,
          "Tarefas pendentes",
          "cyan"
        )}

        ${statCard(
          goals,
          "Objetivos ativos",
          "pink"
        )}

      </div>

    </section>

    <section class="section">

      <div class="section-title">

        <div>
          <span class="eyebrow">CENTRAL</span>
          <h2>O que você quer organizar?</h2>
        </div>

        <button
          class="text-button"
          data-page="explorar"
        >
          Ver tudo ${icon("arrow")}
        </button>

      </div>

      <div class="module-grid">
        ${modules.slice(0, 6).map(moduleCard).join("")}
      </div>

    </section>

    <section class="assistant-banner">

      <div class="assistant-symbol">✦</div>

      <div>

        <span class="eyebrow">ASSISTENTE LIDIRE</span>

        <h3>
          Precisa de ajuda para decidir
          o próximo passo?
        </h3>

        <p>
          Converse com sua rotina e encontre
          o que precisa fazer agora.
        </p>

      </div>

      <button
        class="primary-button"
        data-page="assistente"
      >
        Conversar ${icon("arrow")}
      </button>

    </section>

  `);
}

function moduleCard([id, title, desc, ico, page]) {
  const count = countFor(id);

  return `
    <button
      class="module-card"
      data-page="${page}"
    >

      <span class="module-icon">
        ${icon(ico)}
      </span>

      <span class="module-content">

        <strong>${esc(title)}</strong>

        <small>${esc(desc)}</small>

      </span>

      <span class="module-count">
        ${count}
      </span>

      <span class="module-arrow">
        ${icon("arrow")}
      </span>

    </button>
  `;
}

function countFor(id) {
  if (id === "tarefas") {
    return state.data.tarefas.filter(
      (x) => !x.done
    ).length;
  }

  if (id === "agenda") {
    return state.data.compromissos.length;
  }

  if (id === "compras") {
    return state.data.compras.reduce(
      (total, lista) =>
        total +
        (lista.items || []).filter(
          (item) => !item.done
        ).length,
      0
    );
  }

  if (id === "cicloMenstrual") {
    return state.data.cicloMenstrual?.sintomas?.filter(x => x.date === todayISO()).length || 0;
  }

  return state.data[id]?.length || 0;
}

/* =========================================================
   LISTA GENÉRICA
   ========================================================= */

function listPage(config) {
  const items = state.data[config.key] || [];

  return appShell(`

    ${pageHeader(
      config.eyebrow || "ORGANIZAÇÃO",
      config.title,
      config.subtitle,
      `
        <button
          class="primary-button compact"
          data-action="add-${config.key}"
        >
          ${icon("plus")} Adicionar
        </button>
      `
    )}

    ${
      config.stats
        ? `
          <div class="stats-grid mini">
            ${config.stats()}
          </div>
        `
        : ""
    }

    <div class="content-card">

      <div class="card-toolbar">

        <div class="toolbar-title">
          ${items.length}
          ${items.length === 1 ? "item" : "itens"}
        </div>

        <div class="toolbar-filter">
          ${config.filter || ""}
        </div>

      </div>

      ${
        items.length
          ? `
            <div class="item-list">
              ${items.map(config.render).join("")}
            </div>
          `
          : emptyState(
              config.emptyTitle || "Nada por aqui ainda",
              config.emptyText ||
                "Adicione seu primeiro item para começar.",
              "Adicionar",
              `add-${config.key}`
            )
      }

    </div>

  `);
}

/* =========================================================
   AGENDA
   ========================================================= */

function agenda() {
  const items = [...state.data.compromissos].sort(
    (a, b) => {
      const da = `${a.date || ""} ${a.time || ""}`;
      const db = `${b.date || ""} ${b.time || ""}`;
      return da.localeCompare(db);
    }
  );

  return listPage({
    key: "compromissos",

    title: "Agenda",

    subtitle:
      "Seus compromissos organizados em um só lugar.",

    eyebrow: "SUA ROTINA",

    emptyTitle: "Sua agenda está livre",

    emptyText:
      "Cadastre compromissos, consultas, reuniões e outros horários.",

    render: (x) => `
      <div class="list-item">

        <div class="date-badge">
          <strong>
            ${x.date ? x.date.slice(8, 10) : "--"}
          </strong>

          <small>
            ${
              x.date
                ? new Date(
                    `${x.date}T12:00:00`
                  )
                    .toLocaleDateString(
                      "pt-BR",
                      { month: "short" }
                    )
                    .replace(".", "")
                : ""
            }
          </small>
        </div>

        <div class="item-main">

          <strong>${esc(x.title)}</strong>

          <span>
            ${x.time ? `◷ ${esc(x.time)}` : "Sem horário"}

            ${
              x.location
                ? ` · ${esc(x.location)}`
                : ""
            }
          </span>

        </div>

        <div class="item-actions">

          <button
            data-action="edit-compromisso"
            data-id="${x.id}"
          >
            ${icon("edit")}
          </button>

          <button
            data-action="delete-compromisso"
            data-id="${x.id}"
          >
            ${icon("trash")}
          </button>

        </div>

      </div>
    `
  });
}

/* =========================================================
   TAREFAS
   ========================================================= */

const priorityOrder = {
  Alta: 1,
  "Média": 2,
  Normal: 3,
  Baixa: 4
};

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {

    if (a.done !== b.done) {
      return a.done ? 1 : -1;
    }

    const pa =
      priorityOrder[a.priority || "Normal"] || 3;

    const pb =
      priorityOrder[b.priority || "Normal"] || 3;

    if (pa !== pb) {
      return pa - pb;
    }

    const da = `${a.date || "9999-12-31"} ${a.time || "23:59"}`;
    const db = `${b.date || "9999-12-31"} ${b.time || "23:59"}`;

    return da.localeCompare(db);
  });
}

function priorityClass(priority) {
  const map = {
    Baixa: "priority-baixa",
    Normal: "priority-normal",
    "Média": "priority-média",
    Alta: "priority-alta"
  };

  return map[priority || "Normal"];
}

function tarefas() {
  const sorted = sortTasks(state.data.tarefas);

  return appShell(`

    ${pageHeader(
      "FAZER",
      "Tarefas",
      "Tire as coisas da cabeça e coloque em movimento.",
      `
        <button
          class="primary-button compact"
          data-action="add-tarefas"
        >
          ${icon("plus")} Adicionar
        </button>
      `
    )}

    <div class="stats-grid mini">

      ${statCard(
        state.data.tarefas.filter(x => x.done).length,
        "Concluídas",
        "cyan"
      )}

      ${statCard(
        state.data.tarefas.filter(x => !x.done).length,
        "Pendentes",
        "purple"
      )}

      ${statCard(
        state.data.tarefas.length
          ? Math.round(
              state.data.tarefas.filter(x => x.done).length /
              state.data.tarefas.length *
              100
            ) + "%"
          : "0%",
        "Progresso",
        "pink"
      )}

    </div>

    <div class="content-card">

      <div class="card-toolbar">
        <div class="toolbar-title">
          Ordenadas por prioridade, data e horário
        </div>
      </div>

      ${
        sorted.length
          ? `
            <div class="item-list">

              ${sorted.map((x) => `

                <div
                  class="list-item ${x.done ? "completed" : ""}"
                >

                  <div
                    class="task-priority ${priorityClass(
                      x.priority
                    )}"
                  ></div>

                  <button
                    class="check-button ${x.done ? "checked" : ""}"
                    data-action="toggle-tarefa"
                    data-id="${x.id}"
                  >
                    ${x.done ? "✓" : ""}
                  </button>

                  <div class="item-main">

                    <strong>
                      ${esc(x.title)}
                    </strong>

                    <span>

                      ${
                        x.priority
                          ? `Prioridade: ${esc(x.priority)}`
                          : "Prioridade: Normal"
                      }

                      ${
                        x.date
                          ? ` · ${dateBR(x.date)}`
                          : ""
                      }

                      ${
                        x.time
                          ? ` · ◷ ${esc(x.time)}`
                          : ""
                      }

                    </span>

                  </div>

                  <div class="item-actions">

                    <button
                      data-action="edit-tarefa"
                      data-id="${x.id}"
                    >
                      ${icon("edit")}
                    </button>

                    <button
                      data-action="delete-tarefa"
                      data-id="${x.id}"
                    >
                      ${icon("trash")}
                    </button>

                  </div>

                </div>

              `).join("")}

            </div>
          `
          : emptyState(
              "Nenhuma tarefa criada",
              "Crie uma tarefa para começar a organizar seu dia.",
              "Adicionar tarefa",
              "add-tarefas"
            )
      }

    </div>

  `);
}

/* =========================================================
   COMPRAS
   ========================================================= */

function compras() {
  const listas = state.data.compras || [];

  return appShell(`

    ${pageHeader(
      "LISTAS",
      "Compras",
      "Organize suas compras em listas diferentes.",
      `
        <button
          class="primary-button compact"
          data-action="add-compras"
        >
          ${icon("plus")} Nova lista
        </button>
      `
    )}

    <div class="shopping-diet-actions">
      <button class="ghost-button" data-action="merge-shopping-lists">🔗 Juntar listas selecionadas</button>
      <small class="muted">Marque duas ou mais listas usando as caixas de seleção.</small>
    </div>

    <div class="shopping-lists">

      ${
        listas.length
          ? listas.map(lista => {

              const total =
                lista.items?.length || 0;

              const done =
                lista.items?.filter(
                  item => item.done
                ).length || 0;

              return `
                <div class="shopping-list-card">
                  <label class="shopping-list-select" title="Selecionar lista para juntar"><input type="checkbox" class="shopping-merge-check" value="${lista.id}"></label>
                  <button class="shopping-list-main"
                    data-action="open-lista-compras"
                    data-id="${lista.id}"
                  >

                    <div class="shopping-list-icon">
                      🛒
                    </div>

                    <div class="shopping-list-info">

                      <strong>
                        ${esc(lista.name)}
                      </strong>

                      <span>
                        ${total}
                        ${total === 1 ? "item" : "itens"}
                        ·
                        ${done}
                        concluído${done === 1 ? "" : "s"}
                      </span>

                    </div>

                    <span class="module-arrow">
                      ${icon("arrow")}
                    </span>

                  </button>

                  <div class="shopping-list-actions">
                    <button class="ghost-button shopping-list-edit" data-action="edit-lista-compras" data-id="${lista.id}" title="Editar nome">${icon("edit")} Editar nome</button>
                    <button class="danger-button shopping-list-delete" data-action="delete-lista-compras" data-id="${lista.id}" title="Excluir lista">${icon("trash")} Excluir lista</button>
                  </div>

                </div>
              `;
            }).join("")
          : `
            <div class="content-card">

              ${emptyState(
                "Nenhuma lista criada",
                "Crie sua primeira lista de compras para começar.",
                "Criar lista",
                "add-compras"
              )}

            </div>
          `
      }

    </div>

  `);
}

function listaCompras(id) {
  const lista =
    state.data.compras.find(
      x => x.id === id
    );

  if (!lista) {
    currentPage = "compras";
    currentShoppingList = null;
    render();
    return "";
  }

  const items = lista.items || [];

  const done =
    items.filter(x => x.done).length;

  return appShell(`

    <div class="shopping-back">

      <button
        class="text-button"
        data-action="back-compras"
      >
        ${icon("back")} Voltar para listas de compras
      </button>

    </div>

    ${pageHeader(
      "LISTA DE COMPRAS",
      lista.name,
      `${items.length} ${
        items.length === 1 ? "item" : "itens"
      } · ${done} concluído${done === 1 ? "" : "s"}`,
      `
        <button
          class="primary-button compact"
          data-action="add-item-compra"
          data-id="${lista.id}"
        >
          ${icon("plus")} Adicionar item
        </button>
      `
    )}

    <div class="shopping-diet-actions">

      <button
        class="ghost-button"
        data-action="lista-dieta-para-compras"
        data-id="${lista.id}"
      >
        🍽 Importar alimentos da dieta
      </button>

    </div>

    <div class="content-card">

      <div class="card-toolbar">

        <div class="toolbar-title">
          ${done}/${items.length} concluídos
        </div>

      </div>

      ${
        items.length
          ? `
            <div class="item-list">

              ${items.map(item => `

                <div
                  class="list-item ${
                    item.done ? "completed" : ""
                  }"
                >

                  <button
                    class="check-button ${
                      item.done ? "checked" : ""
                    }"
                    data-action="toggle-item-compra"
                    data-list-id="${lista.id}"
                    data-id="${item.id}"
                  >
                    ${item.done ? "✓" : ""}
                  </button>

                  <div class="item-main">

                    <strong>
                      ${esc(item.name)}
                    </strong>

                    <span>

                      ${
                        item.quantity
                          ? esc(item.quantity)
                          : ""
                      }

                      ${
                        item.category
                          ? ` · ${esc(item.category)}`
                          : ""
                      }

                    </span>

                  </div>

                  <div class="item-actions">

                    <button
                      data-action="delete-item-compra"
                      data-list-id="${lista.id}"
                      data-id="${item.id}"
                    >
                      ${icon("trash")}
                    </button>

                  </div>

                </div>

              `).join("")}

            </div>
          `
          : `
            <div class="empty-state">

              <div class="empty-orb">
                🛒
              </div>

              <h3>Lista vazia</h3>

              <p>
                Adicione o primeiro item desta lista.
              </p>

              <button
                class="primary-button"
                data-action="add-item-compra"
                data-id="${lista.id}"
              >
                ${icon("plus")} Adicionar item
              </button>

            </div>
          `
      }

    </div>

  `);
}

/* =========================================================
   ESTUDOS
   ========================================================= */

function estudos() {
  normalizeStudiesData();

  const items = state.data.estudos || [];
  const plans = state.data.studyPlans || [];
  const now = new Date();
  const today = todayISO();

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  startOfWeek.setDate(startOfWeek.getDate() + diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const inRange = (date, start, end) => {
    if (!date) return false;
    const d = new Date(`${date}T12:00:00`);
    return d >= start && d <= end;
  };

  const weekPlans = plans.filter(p => p.period === "semanal" && inRange(p.date, startOfWeek, endOfWeek));
  const monthPlans = plans.filter(p => p.period === "mensal" && inRange(p.date, startOfMonth, endOfMonth));

  const plannedWeek = weekPlans.reduce((sum, p) => sum + Number(p.duration || 0), 0);
  const doneWeek = weekPlans.filter(p => p.done).reduce((sum, p) => sum + Number(p.duration || 0), 0);
  const plannedMonth = monthPlans.reduce((sum, p) => sum + Number(p.duration || 0), 0);
  const doneMonth = monthPlans.filter(p => p.done).reduce((sum, p) => sum + Number(p.duration || 0), 0);

  const subjects = [...new Set(items.map(x => String(x.subject || "Matéria").trim()).filter(Boolean))];
  const subjectCards = subjects.map(subject => {
    const sessions = items.filter(x => String(x.subject || "").trim() === subject);
    const totalMinutes = sessions.reduce((sum, x) => sum + Number(x.duration || 0), 0);
    const completedMinutes = sessions.reduce((sum, x) => sum + Number(x.effectiveDuration || (x.done ? x.duration : 0) || 0), 0);
    const fallbackTotal = sessions.length;
    const fallbackDone = sessions.filter(x => x.done).length;
    const pct = totalMinutes > 0
      ? Math.round((completedMinutes / totalMinutes) * 100)
      : (fallbackTotal ? Math.round((fallbackDone / fallbackTotal) * 100) : 0);

    return `
      <div class="study-performance-card">
        <div class="study-performance-top">
          <div>
            <strong>${esc(subject)}</strong>
            <span>${sessions.length} ${sessions.length === 1 ? "sessão" : "sessões"}</span>
          </div>
          <b>${Math.min(100, pct)}%</b>
        </div>
        <div class="progress study-performance-bar">
          <span style="width:${Math.min(100, pct)}%"></span>
        </div>
        <small>${completedMinutes} min concluídos de ${totalMinutes} min registrados</small>
      </div>
    `;
  }).join("");

  const planCard = (plan) => `
    <div class="study-plan-item ${plan.done ? "completed" : ""}">
      <button class="check-button ${plan.done ? "checked" : ""}" data-action="toggle-study-plan" data-id="${plan.id}">${plan.done ? "✓" : ""}</button>
      <div class="item-main">
        <strong>${esc(plan.subject)}</strong>
        <span>${dateBR(plan.date)} · ${Number(plan.duration || 0)} min · ${plan.period === "mensal" ? "Mensal" : "Semanal"}</span>
        ${plan.note ? `<small>${esc(plan.note)}</small>` : ""}
      </div>
      <div class="item-actions">
        <button data-action="edit-study-plan" data-id="${plan.id}">${icon("edit")}</button>
        <button data-action="delete-study-plan" data-id="${plan.id}">${icon("trash")}</button>
      </div>
    </div>
  `;

  return appShell(`
    ${pageHeader(
      "APRENDIZADO",
      "Estudos",
      "Planeje sua semana e seu mês, acompanhe cada assunto e registre seu progresso.",
      `
        <div class="header-actions-group">
          <button class="ghost-button compact" data-action="add-study-plan">${icon("calendar")} Planejar</button>
          <button class="primary-button compact" data-action="add-estudos">${icon("plus")} Adicionar</button>
        </div>
      `
    )}

    <section class="study-planning-grid">
      ${statCard(`${doneWeek}/${plannedWeek} min`, "Planejamento semanal", "cyan")}
      ${statCard(`${doneMonth}/${plannedMonth} min`, "Planejamento mensal", "purple")}
      ${statCard(subjects.length, "Assuntos acompanhados", "pink")}
    </section>

    <section class="content-card study-planning-card">
      <div class="section-title compact-title">
        <div><span class="eyebrow">PLANEJAMENTO</span><h2>Semana e mês</h2></div>
        <button class="text-button" data-action="add-study-plan">+ Novo plano</button>
      </div>
      <div class="study-plan-columns">
        <div>
          <h3>Esta semana</h3>
          ${weekPlans.length ? `<div class="study-plan-list">${weekPlans.map(planCard).join("")}</div>` : `<p class="muted">Nenhum estudo planejado para esta semana.</p>`}
        </div>
        <div>
          <h3>Este mês</h3>
          ${monthPlans.length ? `<div class="study-plan-list">${monthPlans.map(planCard).join("")}</div>` : `<p class="muted">Nenhum estudo planejado para este mês.</p>`}
        </div>
      </div>
    </section>

    <section class="content-card">
      <div class="section-title compact-title">
        <div><span class="eyebrow">RENDIMENTO</span><h2>Por assunto</h2><p>O percentual considera sessões concluídas em relação ao que foi registrado.</p></div>
      </div>
      ${subjectCards ? `<div class="study-performance-grid">${subjectCards}</div>` : `<p class="muted">Registre uma sessão para começar a acompanhar o rendimento de cada assunto.</p>`}
    </section>

    <section class="content-card">
      <div class="card-toolbar">
        <div class="toolbar-title">${items.length} ${items.length === 1 ? "matéria/sessão" : "matérias/sessões"}</div>
      </div>
      ${items.length ? `
        <div class="item-list">
          ${items.map(x => `
            <div class="list-item ${x.done ? "completed" : ""}">
              <button class="check-button ${x.done ? "checked" : ""}" data-action="toggle-estudo" data-id="${x.id}">${x.done ? "✓" : ""}</button>
              <div class="item-main">
                <strong>${esc(x.subject)}</strong>
                <span>${x.topic ? esc(x.topic) : "Sessão de estudo"}${x.date ? ` · ${dateBR(x.date)}` : ""}${x.time ? ` · ${esc(x.time)}` : ""}${x.duration ? ` · ${esc(x.duration)} min planejados` : ""}${x.effectiveDuration ? ` · ${esc(x.effectiveDuration)} min realizados` : ""}</span>
                ${x.notes ? `<small>📝 ${esc(x.notes.slice(0, 120))}</small>` : ""}
                ${x.link ? `<a class="link-button" href="${esc(x.link)}" target="_blank" rel="noopener">🔗 Bibliografia</a>` : ""}
              </div>
              <div class="item-actions">
                <button data-action="edit-estudo" data-id="${x.id}">${icon("edit")}</button>
                <button data-action="delete-estudo" data-id="${x.id}">${icon("trash")}</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : emptyState("Nenhum estudo registrado", "Cadastre uma matéria ou assunto para começar.", "Adicionar estudo", "add-estudos")}
    </section>
  `);
}

/* =========================================================
   TREINOS
   ========================================================= */

function workoutPerformanceChart(items) {
  if (!items.length) return `<p class="muted">Registre treinos para visualizar o rendimento.</p>`;
  const groups = {};
  items.forEach(t => {
    const type = (t.type || "Treino").trim() || "Treino";
    const distance = Number(t.distance || 0);
    const reps = (t.exercises || []).reduce((sum,e)=>sum + Number(e.repsDone || 0),0);
    const value = distance > 0 ? distance : reps;
    const unit = distance > 0 ? "km" : "reps";
    if (!groups[type]) groups[type] = {value:0,unit};
    groups[type].value += value;
  });
  const rows = Object.entries(groups);
  const max = Math.max(1, ...rows.map(([,v])=>v.value));
  return `<div class="performance-chart">${rows.map(([type,v])=>`<div class="chart-row"><div class="chart-label"><span>${esc(type)}</span><strong>${v.value.toLocaleString("pt-BR")} ${v.unit}</strong></div><div class="chart-bar"><span style="width:${Math.round(v.value/max*100)}%"></span></div></div>`).join("")}</div>`;
}

function treinos() {
  const items = state.data.treinos || [];

  return appShell(`

    ${pageHeader(
      "BEM-ESTAR",
      "Treinos",
      "Registre exercícios, cargas, repetições e desempenho.",
      `
        <button
          class="primary-button compact"
          data-action="add-treinos"
        >
          ${icon("plus")} Novo treino
        </button>
      `
    )}

    <div class="content-card">
      <div class="card-toolbar"><div><div class="toolbar-title">Rendimento por tipo de treino</div><small>Ex.: corrida = km concluídos; força = repetições executadas.</small></div></div>
      ${workoutPerformanceChart(items)}
    </div>

    <div class="content-card">

      ${
        items.length
          ? items.map(treino => `

              <div class="exercise-card">

                <div class="goal-top">

                  <div>
                    <strong>
                      ${esc(treino.name)}
                    </strong>

                    <span>
                      ${esc(treino.type || "Treino")}

                      ${
                        treino.duration
                          ? ` · ${esc(treino.duration)} min`
                          : ""
                      }

                      ${
                        treino.distance
                          ? ` · ${esc(treino.distance)} km`
                          : ""
                      }

                      ${
                        treino.pace
                          ? ` · Pace ${esc(treino.pace)}`
                          : ""
                      }
                    </span>
                  </div>

                  <div>
                    <button
                      class="text-button"
                      data-action="add-exercicio"
                      data-id="${treino.id}"
                    >
                      + Exercício
                    </button>
                  </div>

                </div>

                ${
                  treino.exercises?.length
                    ? treino.exercises.map(ex => `

                        <div class="list-item">

                          <div class="module-icon small">
                            ${icon("dumbbell")}
                          </div>

                          <div class="item-main">

                            <strong>
                              ${esc(ex.name)}
                            </strong>

                            <span>

                              Carga:
                              meta ${esc(ex.loadGoal || "—")}
                              /
                              realizada ${esc(ex.loadDone || "—")}

                              ·

                              Repetições:
                              meta ${esc(ex.repsGoal || "—")}
                              /
                              realizadas ${esc(ex.repsDone || "—")}

                            </span>

                          </div>

                          <div class="item-actions">

                            <button
                              data-action="animate-exercicio"
                              data-id="${ex.id}"
                            >
                              ▶
                            </button>

                            <button
                              data-action="edit-exercicio"
                              data-id="${ex.id}"
                              data-treino-id="${treino.id}"
                            >
                              ${icon("edit")}
                            </button>

                            <button
                              data-action="delete-exercicio"
                              data-id="${ex.id}"
                              data-treino-id="${treino.id}"
                            >
                              ${icon("trash")}
                            </button>

                          </div>

                        </div>

                      `).join("")
                    : `
                      <p class="muted">
                        Nenhum exercício cadastrado neste treino.
                      </p>
                    `
                }

                ${
                  treino.observations
                    ? `
                      <p class="muted">
                        ${esc(treino.observations)}
                      </p>
                    `
                    : ""
                }

              </div>

            `).join("")
          : emptyState(
              "Nenhum treino registrado",
              "Crie seu primeiro treino para acompanhar sua evolução.",
              "Novo treino",
              "add-treinos"
            )
      }

    </div>

  `);
}

/* =========================================================
   HIDRATAÇÃO
   ========================================================= */

function formatHydrationInterval(minutes) {
  const value = Number(minutes) || 30;
  if (value < 60) return `${value} min`;

  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (!mins) return `${hours}h`;
  return `${hours}h${String(mins).padStart(2, "0")}`;
}

function hidratacao() {
  const total = state.data.hidratacao
    .filter(x => x.date === todayISO())
    .reduce(
      (sum, x) => sum + Number(x.amount || 0),
      0
    );

  const goal =
    Number(state.settings.hydrationGoal) || 2000;

  const intervalMinutes =
    Number(state.settings.hydrationIntervalMinutes) ||
    (Number(state.settings.hydrationInterval) || 2) * 60;

  const startTime = state.settings.hydrationStart || "08:00";
  const endTime = state.settings.hydrationEnd || "21:00";

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  let periodMinutes =
    (endHour * 60 + endMinute) -
    (startHour * 60 + startMinute);

  if (periodMinutes <= 0) periodMinutes += 24 * 60;

  const consumptionCount = Math.max(1, Math.ceil(periodMinutes / intervalMinutes));
  const periodAmount = Math.round(goal / consumptionCount);

  const pct = Math.min(
    100,
    Math.round((total / goal) * 100)
  );

  return appShell(`

    ${pageHeader(
      "BEM-ESTAR",
      "Hidratação",
      "Acompanhe sua meta diária e a quantidade indicada por período.",
      `
        <button
          class="primary-button compact"
          data-action="add-hidratacao"
        >
          ${icon("plus")} Registrar
        </button>
      `
    )}

    <div class="hydration-card">

      <div class="hydration-top">

        <div>

          <span class="eyebrow">
            HOJE
          </span>

          <h2>
            ${total} ml
          </h2>

          <p>
            de ${goal} ml
          </p>

          <p class="muted">
            ${periodAmount} ml a cada ${formatHydrationInterval(intervalMinutes)}
            <br><span class="muted">${startTime} às ${endTime} · ${consumptionCount} consumos previstos</span>
          </p>

        </div>

        <div class="water-drop">
          ◉
        </div>

      </div>

      <div class="progress">
        <span style="width:${pct}%"></span>
      </div>

      <div class="progress-labels">

        <span>0 ml</span>

        <strong>${pct}%</strong>

        <span>${goal} ml</span>

      </div>

      <div class="quick-water">

        ${[200, 300, 500].map(v => `
          <button
            data-action="quick-water"
            data-value="${v}"
          >
            +${v} ml
          </button>
        `).join("")}

        <button
          class="custom-water-button"
          data-action="add-hidratacao"
        >
          Digitar quantidade
        </button>

      </div>

      <button
        class="ghost-button"
        data-action="config-hidratacao"
      >
        ⚙ Definir meta e período
      </button>

    </div>

    <div class="content-card">

      <div class="card-toolbar">

        <div class="toolbar-title">
          Registros de hoje
        </div>

        <button
          class="text-button"
          data-action="reset-hidratacao"
        >
          Limpar
        </button>

      </div>

      ${
        state.data.hidratacao.filter(
          x => x.date === todayISO()
        ).length
          ? `
            <div class="item-list">

              ${state.data.hidratacao
                .filter(x => x.date === todayISO())
                .map(x => `

                  <div class="list-item">

                    <div class="module-icon small">
                      ◉
                    </div>

                    <div class="item-main">

                      <strong>
                        ${x.amount} ml
                      </strong>

                      <span>
                        ${new Date(
                          x.createdAt
                        ).toLocaleTimeString(
                          "pt-BR",
                          {
                            hour: "2-digit",
                            minute: "2-digit"
                          }
                        )}
                      </span>

                    </div>

                    <div class="item-actions">

                      <button
                        data-action="delete-hidratacao"
                        data-id="${x.id}"
                      >
                        ${icon("trash")}
                      </button>

                    </div>

                  </div>

                `).join("")}

            </div>
          `
          : `<p class="muted">
              Nenhum registro hoje.
            </p>`
      }

    </div>

  `);
}

/* =========================================================
   ALIMENTAÇÃO
   ========================================================= */

function alimentacao() {
  const today = todayISO();

  const meals = state.data.alimentacao
    .filter(x => x.date === today)
    .sort((a, b) =>
      (a.time || "").localeCompare(
        b.time || ""
      )
    );

  const consumed = meals.reduce(
    (sum, meal) =>
      sum +
      (meal.foods || []).reduce(
        (s, food) =>
          s + Number(food.calories || 0),
        0
      ),
    0
  );

  const goal =
    Number(state.settings.calorieGoal) || 2000;

  const remaining =
    Math.max(0, goal - consumed);

  const pct = Math.min(
    100,
    Math.round((consumed / goal) * 100)
  );

  return appShell(`

    ${pageHeader(
      "BEM-ESTAR",
      "Alimentação",
      "Organize refeições, alimentos da dieta e calorias.",
      `
        <button
          class="primary-button compact"
          data-action="add-alimentacao"
        >
          ${icon("plus")} Refeição
        </button>
        <button class="ghost-button compact" data-action="food-catalog">🍎 Cadastro de alimentos</button>
      `
    )}

    <div class="calorie-summary">

      <span class="eyebrow">
        CALORIAS DE HOJE
      </span>

      <strong>
        ${consumed} kcal
      </strong>

      <p>
        Meta: ${goal} kcal · Restam ${remaining} kcal
      </p>

      <div class="calorie-progress">
        <span style="width:${pct}%"></span>
      </div>

      <button
        class="ghost-button"
        data-action="config-calorias"
      >
        ⚙ Definir meta diária
      </button>

    </div>

    <div class="shopping-diet-actions">

      <button
        class="ghost-button"
        data-action="add-dieta"
      >
        🍽 Inserir dieta
      </button>

      <button
        class="ghost-button"
        data-page="receitas"
      >
        🍳 Receitas
      </button>

      <button
        class="ghost-button"
        data-action="dieta-para-compras"
      >
        🛒 Criar compras da dieta
      </button>

    </div>

    <div class="content-card">

      <div class="card-toolbar">

        <div class="toolbar-title">
          Refeições de hoje
        </div>

      </div>

      ${
        meals.length
          ? `
            <div class="item-list">

              ${meals.map(meal => `

                <div class="list-item">

                  <div class="module-icon small">
                    🍽
                  </div>

                  <div class="item-main">

                    <strong>
                      ${esc(meal.name)}
                    </strong>

                    <span>
                      ${esc(meal.time || "--:--")}
                      ·
                      ${
                        (meal.foods || []).reduce(
                          (s, f) =>
                            s +
                            Number(
                              f.calories || 0
                            ),
                          0
                        )
                      } kcal
                    </span>

                    <small>

                      ${(meal.foods || [])
                        .map(
                          f =>
                            `${esc(f.name)} (${Number(
                              f.calories || 0
                            )} kcal)`
                        )
                        .join(", ")}

                    </small>

                  </div>

                  <div class="item-actions">

                    <button
                      data-action="edit-refeicao"
                      data-id="${meal.id}"
                    >
                      ${icon("edit")}
                    </button>

                    <button
                      data-action="delete-refeicao"
                      data-id="${meal.id}"
                    >
                      ${icon("trash")}
                    </button>

                  </div>

                </div>

              `).join("")}

            </div>
          `
          : emptyState(
              "Nenhuma refeição hoje",
              "Registre sua primeira refeição para acompanhar as calorias.",
              "Adicionar refeição",
              "add-alimentacao"
            )
      }

    </div>

  `);
                        }
/* =========================================================
   FINANÇAS
   ========================================================= */

function currentFinanceMonth() {
  return todayISO().slice(0, 7);
}

function activeFinanceRows() {
  const month = currentFinanceMonth();
  const resetAt = state.settings.financeMonthResets?.[month] || "";
  return (state.data.financas || []).filter(x => {
    const date = String(x.date || "");
    if (!date.startsWith(month)) return false;
    return !resetAt || String(x.createdAt || "") >= resetAt;
  });
}

function financeByCategory(rows = activeFinanceRows()) {
  const result = {};
  rows.filter(x => x.type === "expense").forEach(x => {
    const category = x.category?.trim() || "Geral";
    const currency = x.currency || "BRL";
    const key = `${currency}::${category}`;
    if (!result[key]) result[key] = { category, currency, value: 0 };
    result[key].value += Number(x.value || 0);
  });
  return result;
}

function financeChart() {
  const data = financeByCategory();
  const entries = Object.values(data);
  if (!entries.length) return `<p class="muted">Ainda não existem gastos por categoria neste mês.</p>`;
  const max = Math.max(...entries.map(x => x.value));
  return entries.sort((a,b)=>b.value-a.value).map(item => {
    const pct = max ? Math.round((item.value / max) * 100) : 0;
    const limit = item.currency === "BRL" ? Number(state.settings.financeLimits?.[item.category] || 0) : 0;
    const warning = limit > 0 ? `<div class="limit-warning ${item.value > limit ? "limit-danger" : "limit-ok"}">Teto: ${money(limit,"BRL")} · ${item.value > limit ? "Teto ultrapassado" : `Restam ${money(limit-item.value,"BRL")}`}</div>` : "";
    return `<div class="chart-row"><div class="chart-label"><span>${esc(item.category)} · ${item.currency === "USD" ? "US$" : "R$"}</span><strong>${money(item.value,item.currency)}</strong></div><div class="chart-bar"><span style="width:${pct}%"></span></div>${warning}</div>`;
  }).join("");
}

function financas() {
  const rows = activeFinanceRows();
  const incomeBRL = rows.filter(x => x.type === "income" && (x.currency || "BRL") === "BRL").reduce((s,x)=>s+Number(x.value||0),0);
  const incomeUSD = rows.filter(x => x.type === "income" && x.currency === "USD").reduce((s,x)=>s+Number(x.value||0),0);
  const expenseBRL = rows.filter(x => x.type === "expense" && (x.currency || "BRL") === "BRL").reduce((s,x)=>s+Number(x.value||0),0);
  const expenseUSD = rows.filter(x => x.type === "expense" && x.currency === "USD").reduce((s,x)=>s+Number(x.value||0),0);
  const income = `${money(incomeBRL, "BRL")} · ${money(incomeUSD, "USD")}`;
  const expense = `${money(expenseBRL, "BRL")} · ${money(expenseUSD, "USD")}`;
  const balance = `${money(incomeBRL - expenseBRL, "BRL")} · ${money(incomeUSD - expenseUSD, "USD")}`;

  return appShell(`

    ${pageHeader(
      "DINHEIRO",
      "Finanças",
      "Tenha uma visão simples do que entra e sai.",
      `
        <div class="shopping-diet-actions">
          <button class="ghost-button" data-action="finance-monthly-report">📊 Relatório mensal</button>
          <button class="ghost-button" data-action="finance-history">🗂 Histórico</button>
          <button class="ghost-button" data-action="finance-zero-month">↺ Zerar mês</button>
          <button class="primary-button compact" data-action="add-financas">${icon("plus")} Lançamento</button>
        </div>
      `
    )}

    <div class="stats-grid mini">

      ${statCard(
        income,
        "Entradas (R$ · US$)",
        "cyan"
      )}

      ${statCard(
        expense,
        "Saídas (R$ · US$)",
        "pink"
      )}

      ${statCard(
        balance,
        "Saldo (R$ · US$)",
        "purple"
      )}

    </div>

    <div class="content-card finance-chart">

      <div class="card-toolbar">

        <div>
          <div class="toolbar-title">
            Gastos por categoria
          </div>

          <small>
            Visão dos gastos do mês corrente
          </small>
        </div>

        <button
          class="text-button"
          data-action="config-tetos"
        >
          ⚙ Tetos
        </button>

      </div>

      ${financeChart()}

    </div>

    <div class="content-card">

      <div class="card-toolbar">

        <div class="toolbar-title">
          Lançamentos
        </div>

      </div>

      ${
        state.data.financas.length
          ? `
            <div class="item-list">

              ${state.data.financas
                .slice()
                .reverse()
                .map(x => `

                  <div class="list-item">

                    <div
                      class="finance-icon ${
                        x.type
                      }"
                    >
                      ${
                        x.type === "income"
                          ? "↑"
                          : "↓"
                      }
                    </div>

                    <div class="item-main">

                      <strong>
                        ${esc(x.title)}
                      </strong>

                      <span>
                        ${dateBR(
                          x.date || todayISO()
                        )}
                        ·
                        ${
                          x.category
                            ? esc(x.category)
                            : "Geral"
                        }
                      </span>

                    </div>

                    <strong
                      class="finance-value ${
                        x.type
                      }"
                    >
                      ${
                        x.type === "income"
                          ? "+"
                          : "-"
                      }
                      ${money(x.value, x.currency || "BRL")}
                    </strong>

                    <div class="item-actions">
                      <button data-action="edit-financa" data-id="${x.id}" title="Editar lançamento">${icon("edit")}</button>
                      <button data-action="delete-financa" data-id="${x.id}" title="Excluir lançamento">${icon("trash")}</button>
                    </div>

                  </div>

                `).join("")}

            </div>
          `
          : emptyState(
              "Nenhum lançamento",
              "Registre uma entrada ou saída.",
              "Adicionar lançamento",
              "add-financas"
            )
      }

    </div>

  `);
}

/* =========================================================
   OBJETIVOS
   ========================================================= */

function objetivos() {
  const items =
    state.data.objetivos || [];

  return appShell(`

    ${pageHeader(
      "DIREÇÃO",
      "Objetivos",
      "Dê forma aos planos que você quer realizar.",
      `
        <button
          class="primary-button compact"
          data-action="add-objetivos"
        >
          ${icon("plus")} Objetivo
        </button>
      `
    )}

    <div class="content-card">

      ${
        items.length
          ? items.map(x => `

              <div class="goal-item">

                <div class="goal-top">

                  <div>

                    <strong>
                      ${esc(x.title)}
                    </strong>

                    <span>

                      ${
                        x.deadline
                          ? `Até ${dateBR(
                              x.deadline
                            )}`
                          : "Sem prazo"
                      }

                      ${
                        Number(x.moneyGoal || 0) > 0
                          ? ` · Meta financeira ${money(
                              x.moneyGoal,
                              x.moneyCurrency || "BRL"
                            )}`
                          : ""
                      }

                    </span>

                  </div>

                  <b>
                    ${Number(
                      x.progress || 0
                    )}%
                  </b>

                </div>

                <div class="progress">
                  <span
                    style="width:${Math.min(
                      100,
                      Number(x.progress || 0)
                    )}%"
                  ></span>
                </div>

                ${
                  x.observations
                    ? `
                      <p class="muted">
                        ${esc(
                          x.observations
                        )}
                      </p>
                    `
                    : ""
                }

                <div class="goal-subtasks">

                  ${
                    x.metas?.length
                      ? x.metas.map(meta => `

                          <div class="goal-subtask">

                            <button
                              class="check-button ${
                                meta.done
                                  ? "checked"
                                  : ""
                              }"
                              data-action="toggle-meta"
                              data-id="${meta.id}"
                              data-goal-id="${x.id}"
                            >
                              ${
                                meta.done
                                  ? "✓"
                                  : ""
                              }
                            </button>

                            <div class="item-main">

                              <strong>
                                ${esc(
                                  meta.title
                                )}
                              </strong>

                              <span>
                                ${esc(
                                  meta.period
                                )}
                              </span>

                            </div>

                          </div>

                        `).join("")
                      : `
                        <p class="muted">
                          Nenhuma meta interna cadastrada.
                        </p>
                      `
                  }

                </div>

                <div class="goal-actions">

                  <button
                    data-action="add-meta"
                    data-id="${x.id}"
                  >
                    + Meta
                  </button>

                  <button
                    data-action="progress-objetivo"
                    data-id="${x.id}"
                  >
                    Atualizar progresso
                  </button>

                  <button
                    data-action="edit-objetivo"
                    data-id="${x.id}"
                  >
                    Editar
                  </button>

                  <button
                    data-action="delete-objetivo"
                    data-id="${x.id}"
                  >
                    Excluir
                  </button>

                </div>

              </div>

            `).join("")
          : emptyState(
              "Nenhum objetivo",
              "Crie um objetivo e transforme-o em pequenas metas.",
              "Criar objetivo",
              "add-objetivos"
            )
      }

    </div>

  `);
}

/* =========================================================
   FAMÍLIA
   ========================================================= */

function familia() {
  return listPage({
    key: "familia",

    title: "Família",

    subtitle:
      "Uma visão compartilhada para organizar a vida juntos.",

    eyebrow: "COMPARTILHAMENTO",

    emptyTitle:
      "Ainda não há pessoas adicionadas",

    emptyText:
      "Cadastre pessoas para estruturar sua área familiar.",

    render: x => `

      <div class="list-item">

        <div class="avatar">
          ${esc(
            (x.name || "?")
              .charAt(0)
              .toUpperCase()
          )}
        </div>

        <div class="item-main">

          <strong>
            ${esc(x.name)}
          </strong>

          <span>
            ${esc(
              x.relation || "Membro"
            )}

            ${
              x.email
                ? ` · ${esc(x.email)}`
                : ""
            }
          </span>

        </div>

        <div class="item-actions">

          <button
            data-action="edit-familia"
            data-id="${x.id}"
            title="Editar pessoa"
          >
            ${icon("edit")}
          </button>

          <button
            data-action="delete-familia"
            data-id="${x.id}"
            title="Excluir pessoa"
          >
            ${icon("trash")}
          </button>

        </div>

      </div>
    `
  });
}

/* =========================================================
   ASSISTENTE
   ========================================================= */

function assistente() {
  const pending = state.data.tarefas.filter(x => !x.done);
  const today = state.data.compromissos.filter(x => x.date === todayISO());
  return appShell(`
    ${pageHeader("INTELIGÊNCIA", "Assistente LiDire", "Converse por texto ou use sua voz para falar com a LiDire.")}
    <div class="assistant-screen">
      <div class="assistant-avatar">✦</div>
      <h2>Como posso ajudar?</h2>
      <p>Fale pelo microfone ou escreva sua pergunta.</p>
      <div class="assistant-voice-bar">
        <button class="primary-button" data-action="assistant-voice" id="assistant-voice-button">🎙️ Falar com a LiDire</button>
        <button class="ghost-button" data-action="assistant-speak-last">🔊 Ouvir resposta</button>
      </div>
      <div id="assistant-voice-status" class="muted assistant-voice-status">Toque no microfone para começar.</div>
      <form id="assistant-question-form" class="assistant-question-form">
        <input id="assistant-question-input" type="text" placeholder="Ex.: O que tenho para hoje?" autocomplete="off">
        <button class="primary-button" type="submit">Enviar</button>
      </form>
      <div class="suggestions">
        <button data-action="assistant-question" data-question="O que tenho para hoje?">O que tenho para hoje?</button>
        <button data-action="assistant-question" data-question="Quais tarefas estão pendentes?">Quais tarefas estão pendentes?</button>
        <button data-action="assistant-question" data-question="Como está minha rotina?">Como está minha rotina?</button>
      </div>
      <div id="assistant-response" class="assistant-response">
        <strong>Resumo atual</strong>
        <p>Você tem <b>${pending.length}</b> tarefa(s) pendente(s) e <b>${today.length}</b> compromisso(s) hoje.</p>
      </div>
    </div>
  `);
}

let lastAssistantResponse = "";
let voiceRecognition = null;

function getAssistantResponse(question) {
  const q = String(question || "").toLowerCase();
  if (q.includes("hoje")) {
    return `Hoje você tem ${state.data.compromissos.filter(x => x.date === todayISO()).length} compromisso(s) na agenda e ${state.data.tarefas.filter(x => !x.done).length} tarefa(s) pendente(s).`;
  }
  if (q.includes("pendentes") || q.includes("tarefas")) {
    const tasks = state.data.tarefas.filter(x => !x.done).map(x => x.title).join(", ") || "nenhuma tarefa pendente";
    return `Você tem ${state.data.tarefas.filter(x => !x.done).length} tarefa(s) pendente(s): ${tasks}.`;
  }
  return `Sua rotina possui ${state.data.tarefas.filter(x => !x.done).length} tarefa(s) pendente(s), ${state.data.objetivos.length} objetivo(s), ${state.data.compras.reduce((t,l)=>t+(l.items||[]).filter(i=>!i.done).length,0)} item(ns) de compras pendentes e ${state.data.alimentacao.filter(x=>x.date===todayISO()).length} refeição(ões) registradas hoje.`;
}

function answerAssistant(question, speak = false) {
  const response = getAssistantResponse(question);
  lastAssistantResponse = response;
  const box = document.getElementById("assistant-response");
  if (box) box.innerHTML = `<strong>LiDire</strong><p>${esc(response)}</p>`;
  if (speak && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(response));
  }
}

function startAssistantVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    toast("Seu navegador não oferece reconhecimento de voz. Tente usar o Chrome no celular.", "error");
    return;
  }
  if (voiceRecognition) {
    voiceRecognition.stop();
    voiceRecognition = null;
    return;
  }
  voiceRecognition = new Recognition();
  voiceRecognition.lang = "pt-BR";
  voiceRecognition.interimResults = false;
  voiceRecognition.continuous = false;
  const status = document.getElementById("assistant-voice-status");
  const button = document.getElementById("assistant-voice-button");
  if (status) status.textContent = "Ouvindo… fale agora.";
  if (button) button.textContent = "⏹️ Parar de ouvir";
  voiceRecognition.onresult = event => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    const input = document.getElementById("assistant-question-input");
    if (input) input.value = transcript;
    answerAssistant(transcript, true);
    if (status) status.textContent = `Você disse: “${transcript}”`;
  };
  voiceRecognition.onerror = () => {
    if (status) status.textContent = "Não consegui ouvir. Verifique a permissão do microfone e tente novamente.";
  };
  voiceRecognition.onend = () => {
    voiceRecognition = null;
    if (button) button.textContent = "🎙️ Falar com a LiDire";
  };
  voiceRecognition.start();
}

/* =========================================================
   EXPLORAR
   ========================================================= */

function explorar() {
  return appShell(`

    ${pageHeader(
      "LIDIRE",
      "Tudo em um só lugar",
      "Conheça os espaços que ajudam a transformar rotina em clareza."
    )}

    <div class="explore-grid">

      ${modules.map(moduleCard).join("")}

      <button
        class="module-card featured"
        data-page="assistente"
      >

        <span class="module-icon">
          ✦
        </span>

        <span class="module-content">

          <strong>
            Assistente LiDire
          </strong>

          <small>
            Seu copiloto para organizar a rotina.
          </small>

        </span>

        <span class="module-arrow">
          ${icon("arrow")}
        </span>

      </button>

    </div>

  `);
}

/* =========================================================
   CICLO MENSTRUAL
   ========================================================= */

function daysBetween(a, b) {
  if (!a || !b) return null;
  const start = new Date(a + "T12:00:00");
  const end = new Date(b + "T12:00:00");
  return Math.round((end - start) / 86400000);
}

function cycleInfo(date = todayISO()) {
  const periods = [...(state.data.cicloMenstrual?.periodos || [])].filter(x => x.start).sort((a,b) => String(b.start).localeCompare(String(a.start)));
  const last = periods[0];
  if (!last) return { hasData:false, day:null, phase:"Sem registro", next:null, start:null };
  const length = Math.max(21, Math.min(45, Number(state.settings.cycleLength) || 28));
  const diff = daysBetween(last.start, date);
  if (diff == null) return { hasData:false, day:null, phase:"Sem registro", next:null, start:last.start };
  const day = ((diff % length) + length) % length + 1;
  const ovulationDay = Math.max(10, length - 14);
  let phase = "Fase folicular";
  if (day <= Math.max(1, Number(state.settings.periodLength) || 5)) phase = "Menstrual";
  else if (day >= ovulationDay - 4 && day <= ovulationDay + 1) phase = "Ovulatória / fértil";
  else if (day > ovulationDay + 1) phase = "Fase lútea";
  const nextDate = new Date(last.start + "T12:00:00");
  nextDate.setDate(nextDate.getDate() + length);
  return { hasData:true, day, phase, next:nextDate.toISOString().slice(0,10), start:last.start, length };
}

function cycleTrendSummary() {
  const logs = state.data.cicloMenstrual?.sintomas || [];
  const current = cycleInfo();
  if (!current.hasData || !logs.length) return "Registre alguns dias para a LiDire começar a identificar seus próprios padrões.";
  const samePhase = logs.filter(x => x.phase === current.phase);
  if (!samePhase.length) return "Ainda não há registros suficientes nesta fase para identificar um padrão pessoal.";
  const avg = key => samePhase.reduce((sum,x)=>sum + ({Baixa:1,Moderada:2,Intensa:3}[x[key]] || 0),0) / samePhase.filter(x=>x[key]).length;
  const energy = avg("physicalEnergy");
  if (energy) {
    const label = energy < 1.5 ? "baixa" : energy < 2.5 ? "moderada" : "intensa";
    return `Nos seus registros anteriores nesta fase, a energia física apareceu predominantemente ${label}. Isso é um padrão dos seus registros, não uma regra geral.`;
  }
  return "Há registros nesta fase, mas ainda não existe um padrão claro de energia.";
}

function cicloMenstrual() {
  const info = cycleInfo();
  const logs = (state.data.cicloMenstrual?.sintomas || []).filter(x => x.date === todayISO()).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  const recent = (state.data.cicloMenstrual?.periodos || []).slice().sort((a,b)=>String(b.start).localeCompare(String(a.start))).slice(0,4);
  return appShell(`
    ${pageHeader("BEM-ESTAR", "Ciclo Menstrual", "Acompanhe o ciclo e registre como você se sente.", `<button type="button" class="primary-button compact" onclick="event.stopPropagation(); addPeriodoCiclo()">${icon("plus")} Registrar ciclo</button>`)}
    <div class="cycle-summary-card">
      <div><span class="eyebrow">SEU CICLO</span><h2>${info.hasData ? `Dia ${info.day}` : "Ainda sem registro"}</h2><strong>${esc(info.phase)}</strong>${info.next ? `<p>Próxima menstruação estimada: ${dateBR(info.next)}</p>` : `<p>Registre o início da menstruação para calcular as fases.</p>`}</div><div class="cycle-orbit">◌</div>
    </div>
    <div class="stats-grid mini">
      ${statCard(info.hasData ? info.length + " dias" : "—", "Ciclo configurado", "purple")}
      ${statCard(logs.length, "Registros hoje", "pink")}
      ${statCard((state.data.cicloMenstrual?.periodos || []).length, "Ciclos registrados", "cyan")}
    </div>
    <div class="content-card">
      <div class="card-toolbar"><div><div class="toolbar-title">Como estou hoje?</div><small>Para dor, cólicas, acne e energias: Baixa, Moderada ou Intensa.</small></div><button type="button" class="primary-button compact" onclick="event.stopPropagation(); addSintomaCiclo()">${icon("plus")} Registrar</button></div>
      ${logs.length ? `<div class="item-list">${logs.map(x=>`<div class="list-item"><div class="module-icon small">🌷</div><div class="item-main"><strong>${esc(x.mood || "Humor não informado")}</strong><span>Dor: ${esc(x.pain || "—")} · Cólicas: ${esc(x.cramps || "—")} · Acne: ${esc(x.acne || "—")}</span><span>Energia física: ${esc(x.physicalEnergy || "—")} · Energia mental: ${esc(x.mentalEnergy || "—")}</span>${x.notes ? `<small>${esc(x.notes)}</small>` : ""}</div><button data-action="delete-sintoma-ciclo" data-id="${x.id}">${icon("trash")}</button></div>`).join("")}</div>` : `<p class="muted">Nenhum registro de sintomas hoje.</p>`}
    </div>
    <div class="content-card">
      <div class="card-toolbar"><div><div class="toolbar-title">Padrões pessoais</div><small>Baseado somente nos seus registros.</small></div></div>
      <p>${esc(cycleTrendSummary())}</p>
      <div class="cycle-cross-links"><span>🏋️ Treinos: ${state.data.treinos.length}</span><span>🍽 Refeições: ${state.data.alimentacao.filter(x=>x.date===todayISO()).length}</span><span>💧 Água: ${state.data.hidratacao.filter(x=>x.date===todayISO()).reduce((s,x)=>s+Number(x.amount||0),0)} ml</span></div>
    </div>
    <div class="content-card">
      <div class="card-toolbar"><div><div class="toolbar-title">Privacidade e IA</div><small>O ciclo é privado por padrão.</small></div><label class="switch"><input type="checkbox" data-action="toggle-cycle-ai" ${state.settings.cycleAiContext ? "checked" : ""}><span></span></label></div>
      <p class="muted">Permitir que, futuramente, a IA use seus registros do ciclo para cruzar padrões com treino, alimentação e hidratação.</p>
    </div>
    <div class="content-card">
      <div class="card-toolbar"><div class="toolbar-title">Histórico de ciclos</div><button type="button" class="text-button" onclick="event.stopPropagation(); configCicloMenstrual()">⚙ Configurar</button></div>
      ${recent.length ? `<div class="item-list">${recent.map(x=>`<div class="list-item"><div class="module-icon small">🌙</div><div class="item-main"><strong>${dateBR(x.start)}${x.end ? ` → ${dateBR(x.end)}` : ""}</strong><span>Fluxo: ${esc(x.flow || "Não informado")}${x.notes ? ` · ${esc(x.notes)}` : ""}</span></div></div>`).join("")}</div>` : `<p class="muted">Nenhum ciclo registrado ainda.</p>`}
    </div>
  `);
}

function configCicloMenstrual() {
  const last = state.data.cicloMenstrual?.periodos?.[0] || {};
  openModal("Configurar ciclo",
    field("Início da última menstruação", "start", "date", last.start || "") +
    field("Fim da última menstruação", "end", "date", last.end || "") +
    field("Duração média do ciclo (dias)", "cycleLength", "number", state.settings.cycleLength, 'min="21" max="45" required') +
    field("Duração média da menstruação (dias)", "periodLength", "number", state.settings.periodLength, 'min="1" max="10" required') +
    selectField("Intensidade do fluxo", "flow", ["Leve","Moderado","Intenso"], last.flow || "Moderado") +
    textareaField("Observações", "notes", last.notes || ""),
    { submit:"Salvar configuração" }
  );
  modal.querySelector("#lidire-form").onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    state.settings.cycleLength = Number(f.get("cycleLength")) || 28;
    state.settings.periodLength = Number(f.get("periodLength")) || 5;
    if (f.get("start")) {
      const record = { id: last.id || uid("cycle"), start:f.get("start"), end:f.get("end") || "", flow:f.get("flow"), notes:f.get("notes") || "" };
      const index = state.data.cicloMenstrual.periodos.findIndex(x=>x.id===record.id);
      if(index>=0) state.data.cicloMenstrual.periodos[index]=record; else state.data.cicloMenstrual.periodos.push(record);
    }
    saveState(); closeModal(); render(); toast("Configuração do ciclo atualizada.");
  };
}

function addPeriodoCiclo() {
  openModal("Registrar ciclo",
    field("Início da menstruação", "start", "date", todayISO(), "required") +
    field("Fim da menstruação", "end", "date", "") +
    selectField("Intensidade do fluxo", "flow", ["Leve","Moderado","Intenso"], "Moderado") +
    textareaField("Observações", "notes", ""),
    { submit:"Registrar ciclo" }
  );
  modal.querySelector("#lidire-form").onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const start = String(f.get("start") || "");
    const end = String(f.get("end") || "");
    if (!start) { toast("Informe o início da menstruação.", "error"); return; }
    if (end && end < start) { toast("A data de fim não pode ser anterior ao início.", "error"); return; }
    const duration = start && end ? Math.max(1, daysBetween(start, end) + 1) : "";
    const record = {id:uid("cycle"),start,end,flow:String(f.get("flow") || "Moderado"),duration,notes:String(f.get("notes") || ""),createdAt:new Date().toISOString()};
    state.data.cicloMenstrual.periodos = [record, ...(state.data.cicloMenstrual.periodos || [])];
    saveState(); closeModal(); render(); toast("Ciclo registrado com sucesso.");
  };
}

function addSintomaCiclo() {
  openModal("Registrar como você está hoje",
    selectField("Humor", "mood", ["Muito baixo","Baixo","Neutro","Bom","Muito bom"], "Neutro") +
    selectField("Dor", "pain", ["Baixa","Moderada","Intensa"], "Baixa") +
    selectField("Cólicas", "cramps", ["Baixa","Moderada","Intensa"], "Baixa") +
    selectField("Acne", "acne", ["Baixa","Moderada","Intensa"], "Baixa") +
    selectField("Energia física", "physicalEnergy", ["Baixa","Moderada","Intensa"], "Moderada") +
    selectField("Energia mental", "mentalEnergy", ["Baixa","Moderada","Intensa"], "Moderada") +
    textareaField("Observações", "notes", ""),
    { submit:"Registrar" }
  );
  modal.querySelector("#lidire-form").onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const info = cycleInfo();
    const record = {id:uid("symptom"),date:todayISO(),phase:info.phase,mood:String(f.get("mood") || "Neutro"),pain:String(f.get("pain") || "Baixa"),cramps:String(f.get("cramps") || "Baixa"),acne:String(f.get("acne") || "Baixa"),physicalEnergy:String(f.get("physicalEnergy") || "Moderada"),mentalEnergy:String(f.get("mentalEnergy") || "Moderada"),notes:String(f.get("notes") || ""),createdAt:new Date().toISOString()};
    state.data.cicloMenstrual.sintomas = [record, ...(state.data.cicloMenstrual.sintomas || [])];
    saveState(); closeModal(); render(); toast("Registro de sintomas salvo com sucesso.");
  };
}

/* =========================================================
   PERFIL
   ========================================================= */

function perfil() {
  const hasPhoto = !!state.user.photo;

  return appShell(`
    ${pageHeader(
      "MINHA CONTA",
      "Perfil",
      "Personalize sua experiência na LiDire."
    )}

    <div class="profile-card">

      <div class="profile-avatar" data-action="profile-photo" role="button" tabindex="0" title="Alterar foto de perfil">
        ${
          hasPhoto
            ? `<img src="${esc(state.user.photo)}" alt="Foto de perfil">`
            : esc((state.user.name || "A").charAt(0).toUpperCase())
        }
      </div>

      <h2>${esc(state.user.name || "Seu nome")}</h2>

      <p>
        ${esc(state.user.email || "Adicione seu e-mail")}
      </p>
      ${state.user.address ? `<p class="muted">📍 ${esc(state.user.address)}</p>` : ""}

      <button
        class="primary-button"
        data-action="edit-profile"
      >
        ${icon("edit")} Editar perfil
      </button>

    </div>

    <div class="settings-card">

      <button data-page="configuracoes">
        <span>⚙️</span>
        <div>
          <strong>Configurações</strong>
          <small>Preferências, segurança, privacidade e dados</small>
        </div>
        ${icon("arrow")}
      </button>

      <button data-page="termos">
        <span>⚖️</span>
        <div><strong>Termos</strong><small>Termos de Uso da LiDire</small></div>
        ${icon("arrow")}
      </button>

      <button data-page="politicas">
        <span>📄</span>
        <div><strong>Políticas</strong><small>Políticas do aplicativo</small></div>
        ${icon("arrow")}
      </button>

      <button data-page="privacidade">
        <span>🔐</span>
        <div><strong>Privacidade</strong><small>Privacidade e permissões</small></div>
        ${icon("arrow")}
      </button>

      <button data-page="anotacoes">
        <span>📝</span>
        <div><strong>Anotações</strong><small>Notas e informações importantes</small></div>
        ${icon("arrow")}
      </button>

      <button data-action="edit-profile">
        <span>✎</span>

        <div>
          <strong>Dados pessoais</strong>
          <small>Nome, e-mail, idade, telefone e endereço</small>
        </div>

        ${icon("arrow")}
      </button>


      <button data-action="profile-photo">
        <span>📷</span>

        <div>
          <strong>Foto de perfil</strong>

          <small>
            ${hasPhoto
              ? "Alterar ou excluir"
              : "Adicionar uma foto"}
          </small>
        </div>

        ${icon("arrow")}
      </button>


      <button data-action="logout">
        <span>↪</span>
        <div><strong>Sair da conta</strong><small>Encerrar sua sessão neste dispositivo</small></div>
        ${icon("arrow")}
      </button>

      <button data-action="clear-local">
        <span>↺</span>

        <div>
          <strong>Redefinir dados locais</strong>

          <small>
            Apaga os dados salvos neste dispositivo
          </small>
        </div>

        ${icon("arrow")}
      </button>

    </div>
  `);
}

function profilePhotoModal() {
  const hasPhoto = !!state.user.photo;

  openModal(
    hasPhoto ? "Foto de perfil" : "Adicionar foto",
    `
      ${
        hasPhoto
          ? `
            <div class="profile-photo-preview">
              <img
                src="${esc(state.user.photo)}"
                alt="Foto de perfil"
              >
            </div>
          `
          : ""
      }

      <div class="profile-photo-actions">

        <label class="primary-button" style="cursor:pointer;">
          📷 Tirar foto com a câmera
          <input id="profile-camera-input" type="file" accept="image/*" capture="user" style="display:none;">
        </label>

        <label class="ghost-button" style="cursor:pointer;">
          🖼️ ${hasPhoto ? "Escolher outra foto" : "Escolher da galeria"}
          <input id="profile-photo-input" type="file" accept="image/*" style="display:none;">
        </label>

        ${
          hasPhoto
            ? `
              <button
                type="button"
                class="ghost-button"
                data-action="delete-profile-photo"
              >
                🗑 Excluir foto
              </button>
            `
            : ""
        }

      </div>

      <p class="muted">
        Escolha uma imagem do seu dispositivo.
      </p>
    `,
    {
      submit: "Fechar"
    }
  );

  const form = modal.querySelector("#lidire-form");

  /*
   * Não precisamos salvar o formulário.
   * A foto é processada diretamente no input.
   */
  form.onsubmit = (e) => {
    e.preventDefault();
    closeModal();
  };

  const inputs = [
    modal.querySelector("#profile-photo-input"),
    modal.querySelector("#profile-camera-input")
  ].filter(Boolean);

  inputs.forEach(input => {
    input.addEventListener("change", () => {

      const file = input.files?.[0];

      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast("Selecione uma imagem válida.", "error");
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {

        state.user.photo = reader.result;
        saveState();
        apiRequest("/api/profile", { method: "PUT", body: JSON.stringify({name: state.user.name, email: state.user.email, age: state.user.age, phone: state.user.phone, address: state.user.address, profile_photo: reader.result}) })
          .then(response => { if (response.user) syncUserToState(response.user); })
          .catch(error => toast(error.message || "Não foi possível salvar a foto no servidor.", "error"))
          .finally(() => { closeModal(); render(); });
        toast("Foto de perfil atualizada.");
      };

      reader.readAsDataURL(file);
    });
  });
}


function suporte() {
  return appShell(`
    ${pageHeader("AJUDA", "Suporte", "Encontre ajuda, informe bugs ou entre em contato com a equipe LiDire.")}
    <div class="content-card"><div class="settings-card">
      <button data-action="report-bug"><span>🐞</span><div><strong>Informar bug</strong><small>Relate um problema encontrado no aplicativo.</small></div>${icon("arrow")}</button>
      <button data-action="support-email"><span>✉</span><div><strong>Contatar por e-mail</strong><small>Envie uma mensagem para o suporte da LiDire.</small></div>${icon("arrow")}</button>
    </div></div>
    <div class="content-card"><span class="eyebrow">EM BREVE</span><h3>Novas formas de suporte</h3><p class="muted">A estrutura está preparada para FAQ, central de ajuda, acompanhamento de chamados e outros canais futuramente.</p></div>
  `);
}


function hubButton(iconText, title, subtitle, target) {
  return `<button class="settings-card" data-page="${esc(target)}" style="width:100%;text-align:left;display:flex;align-items:center;gap:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:inherit;border-radius:18px;padding:15px;margin-bottom:10px"><span style="font-size:22px">${iconText}</span><span style="flex:1;display:flex;flex-direction:column;gap:3px"><strong>${esc(title)}</strong><small class="muted">${esc(subtitle)}</small></span>${icon("arrow")}</button>`;
}
function receitas(){return appShell(`${pageHeader("ALIMENTAÇÃO","Receitas","Guarde suas receitas favoritas e organize ingredientes, preparo e observações.")}<div class="content-card"><div class="empty-state"><div class="empty-orb">🍳</div><h3>Suas receitas</h3><p>Área preparada para receitas, versões, ingredientes e fotos. O armazenamento será conectado ao D1 na próxima etapa.</p><button class="primary-button" data-action="recipe-coming-soon">+ Nova receita</button></div></div>`);}
function anotacoes(){return appShell(`${pageHeader("ORGANIZAÇÃO","Anotações","Registre ideias, informações importantes e anotações da sua rotina.")}<div class="content-card"><div class="empty-state"><div class="empty-orb">📝</div><h3>Suas anotações</h3><p>Área preparada para anotações, categorias, favoritos e tags. O armazenamento será conectado ao D1 na próxima etapa.</p><button class="primary-button" data-action="note-coming-soon">+ Nova anotação</button></div></div>`);}
function configuracoes(){return appShell(`${pageHeader("APLICATIVO","Configurações","Controle sua conta, preferências, segurança, privacidade e dados.")}<div class="content-card"><div class="settings-card">${hubButton("👤","Conta","Perfil e informações da sua conta","perfil")}${hubButton("🔒","Segurança","PIN, biometria e bloqueio do aplicativo","seguranca")}${hubButton("🌐","Idioma e preferências","Português / English e preferências gerais","preferencias")}${hubButton("🤖","Assistente LiDire","Permissões e preferências da inteligência artificial","assistente")}${hubButton("🔐","Privacidade e permissões","Controle quais dados podem ser utilizados","privacidade")}${hubButton("📦","Dados","Exportação e gerenciamento dos seus dados","dados")}${hubButton("⚖️","Termos e políticas","Consulte os documentos legais da LiDire","termos")}${hubButton("🆘","Suporte","Ajuda, bugs e contato","suporte")}</div></div>`);}
function termos(){return appShell(`${pageHeader("LEGAL","Termos de Uso","Consulte as regras de utilização da LiDire.")}<div class="content-card"><h3>Termos de Uso da LiDire</h3><p class="muted">Versão inicial. O texto jurídico definitivo deverá ser revisado antes da publicação oficial.</p><p>A LiDire é uma ferramenta de organização pessoal destinada a ajudar o usuário a gerenciar rotina, compromissos, tarefas, estudos, alimentação, finanças e outros conteúdos escolhidos pelo próprio usuário.</p><p>O usuário é responsável pelas informações inseridas na conta e deve manter suas credenciais protegidas.</p><p>Algumas funcionalidades poderão depender de integrações externas, permissões ou serviços de terceiros.</p></div>`);}
function politicas(){return appShell(`${pageHeader("LEGAL","Políticas","Consulte as políticas aplicáveis ao uso da LiDire.")}<div class="content-card"><div class="settings-card">${hubButton("🔒","Política de Privacidade","Como os dados pessoais são tratados","privacidade")}${hubButton("🍪","Cookies e armazenamento","Armazenamento local e tecnologias utilizadas","politicaCookies")}${hubButton("🤖","Política de IA","Como recursos de IA poderão utilizar dados autorizados","politicaIA")}</div></div>`);}
function privacidade(){return appShell(`${pageHeader("LEGAL","Privacidade","Entenda e controle o tratamento dos seus dados.")}<div class="content-card"><h3>Política de Privacidade</h3><p class="muted">Versão inicial. O documento definitivo deverá passar por revisão jurídica antes da publicação.</p><p>A LiDire deverá tratar somente os dados necessários para oferecer as funcionalidades escolhidas pelo usuário, respeitando as permissões concedidas.</p><p>Dados sensíveis, como informações de saúde, ciclo menstrual e localização, deverão permanecer privados por padrão e somente ser utilizados por recursos que tenham autorização específica.</p><p>O usuário deverá ter acesso a mecanismos para consultar, exportar e solicitar a exclusão de seus dados, conforme aplicável.</p></div>`);}
function politicaCookies(){return appShell(`${pageHeader("POLÍTICA","Cookies e armazenamento","Como o aplicativo utiliza armazenamento local e dados de sessão.")}<div class="content-card"><p>O MVP utiliza armazenamento local para algumas preferências e dados de transição. A sessão de autenticação é administrada pelo Worker. A arquitetura definitiva será consolidada durante a migração para o D1.</p></div>`);}
function politicaIA(){return appShell(`${pageHeader("POLÍTICA","Política de IA","Regras para recursos inteligentes da LiDire.")}<div class="content-card"><p>Recursos de IA deverão respeitar as permissões do usuário. Ações que alterem ou excluam dados poderão exigir confirmação. Chaves de provedores de IA deverão permanecer no servidor e não no código público do aplicativo.</p></div>`);}
function seguranca(){return appShell(`${pageHeader("SEGURANÇA","Segurança","Proteja o acesso ao aplicativo.")}<div class="content-card"><div class="settings-card">${hubButton("🔢","PIN / senha do aplicativo","Configurar bloqueio de acesso","segurancaPIN")}${hubButton("👆","Biometria","Usar a biometria do aparelho quando disponível","segurancaBiometria")}</div></div>`);}
function segurancaPIN(){return appShell(`${pageHeader("SEGURANÇA","PIN / senha","Configuração do bloqueio do aplicativo.")}<div class="content-card"><p class="muted">A configuração será conectada à tabela de segurança do D1. A senha/PIN nunca deverá ser armazenada em texto puro.</p></div>`);}
function segurancaBiometria(){return appShell(`${pageHeader("SEGURANÇA","Biometria","Use a biometria do próprio sistema operacional.")}<div class="content-card"><p class="muted">A LiDire não deve armazenar dados biométricos. O aplicativo utilizará a API de biometria do dispositivo quando essa função for implementada.</p></div>`);}
function preferencias(){return appShell(`${pageHeader("PREFERÊNCIAS","Idioma e preferências","Personalize a experiência da LiDire.")}<div class="content-card"><div class="settings-card"><button data-action="preference-language"><span>🌐</span><div><strong>Idioma</strong><small>Português (Brasil) / English</small></div>${icon("arrow")}</button><button data-action="preference-theme"><span>🎨</span><div><strong>Aparência</strong><small>Claro, escuro ou sistema</small></div>${icon("arrow")}</button></div></div>`);}
function dados(){return appShell(`${pageHeader("DADOS","Seus dados","Gerencie exportação e exclusão da sua conta.")}<div class="content-card"><div class="settings-card"><button data-action="export-data"><span>📤</span><div><strong>Exportar meus dados</strong><small>Solicitar uma cópia dos dados da conta</small></div>${icon("arrow")}</button><button data-action="delete-account"><span>🗑</span><div><strong>Excluir minha conta</strong><small>Solicitar a exclusão da conta e dos dados</small></div>${icon("arrow")}</button></div></div>`);}
function explorarHub(){const items=[["✓","Tarefas","Organize o que precisa ser feito.","tarefas"],["🛒","Compras","Listas e itens de compras.","compras"],["📚","Estudos","Planejamento e desempenho.","estudos"],["🏋️","Treinos","Exercícios e evolução.","treinos"],["💧","Hidratação","Meta diária de água.","hidratacao"],["🍽️","Alimentação","Dietas e refeições.","alimentacao"],["💰","Finanças","Receitas, despesas e limites.","financas"],["🎯","Objetivos","Metas e progresso.","objetivos"],["👨‍👩‍👧","Família","Compartilhamento da rotina.","familia"],["🌸","Ciclo","Acompanhamento do ciclo.","cicloMenstrual"],["📝","Anotações","Notas e informações importantes.","anotacoes"]];return appShell(`${pageHeader("MÓDULOS","Explorar","Tudo o que a LiDire pode organizar em um só lugar.")}<div class="content-card"><div class="settings-card">${items.map(x=>hubButton(...x)).join("")}</div></div>`);}

const pages = {
  inicio: home,
  agenda,
  tarefas,
  compras,
  estudos,
  treinos,
  hidratacao,
  alimentacao,
  financas,
  objetivos,
  familia,
  cicloMenstrual,
  assistente,
  explorar: explorarHub,
  perfil,
  suporte,
  configuracoes,
  termos,
  politicas,
  privacidade,
  politicaCookies,
  politicaIA,
  seguranca,
  segurancaPIN,
  segurancaBiometria,
  preferencias,
  dados,
  receitas,
  anotacoes
};

function navigateTo(page, replace = false) {
  currentPage = page || "inicio";
  currentShoppingList = null;
  const url = `#${encodeURIComponent(currentPage)}`;
  const stateObj = { page: currentPage, lidire: true };
  if (replace) history.replaceState(stateObj, "", url);
  else history.pushState(stateObj, "", url);
  render();
}

function goBack() {
  if (history.length > 1 && history.state?.lidire !== false) {
    history.back();
  } else {
    navigateTo("inicio");
  }
}

function render() {
  const root =
    document.getElementById("app");

  if (!root) return;

  if (!authChecked) {
    root.innerHTML = authLoadingScreen();
    return;
  }

  if (!authUser) {
    renderAuth();
    return;
  }

  if (
    currentPage === "compras" &&
    currentShoppingList
  ) {
    root.innerHTML =
      listaCompras(
        currentShoppingList
      );
  } else {
    root.innerHTML =
      (
        pages[currentPage] ||
        home
      )();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================================================
   MODAIS
   ========================================================= */

function openModal(
  title,
  body,
  options = {}
) {
  closeModal();

  modal =
    document.createElement("div");

  modal.className =
    "modal-backdrop";

  modal.innerHTML = `

    <div
      class="modal"
      role="dialog"
      aria-modal="true"
    >

      <div class="modal-header">

        <div>

          <span class="eyebrow">
            ${esc(
              options.eyebrow ||
              "LIDIRE"
            )}
          </span>

          <h2>
            ${esc(title)}
          </h2>

        </div>

        <button
          class="modal-close"
          data-action="close-modal"
        >
          ×
        </button>

      </div>

      <form
        id="lidire-form"
        class="form-grid"
      >

        ${body}

        <div class="modal-footer">

          <button
            type="button"
            class="ghost-button"
            data-action="close-modal"
          >
            Cancelar
          </button>

          <button
            class="primary-button"
            type="submit"
          >
            ${esc(
              options.submit ||
              "Salvar"
            )}
          </button>

        </div>

      </form>

    </div>
  `;

  document.body.appendChild(modal);

  modal
    .querySelector(
      "input, select, textarea"
    )
    ?.focus();
}

function closeModal() {
  document
    .querySelector(
      ".modal-backdrop"
    )
    ?.remove();

  modal = null;
}

function field(
  label,
  name,
  type = "text",
  value = "",
  extra = ""
) {
  return `
    <label class="form-field">

      <span>
        ${esc(label)}
      </span>

      <input
        name="${esc(name)}"
        type="${type}"
        value="${esc(value)}"
        ${extra}
      >

    </label>
  `;
}

function textareaField(
  label,
  name,
  value = "",
  extra = ""
) {
  return `
    <label class="form-field">

      <span>
        ${esc(label)}
      </span>

      <textarea
        name="${esc(name)}"
        ${extra}
      >${esc(value)}</textarea>

    </label>
  `;
}

function selectField(
  label,
  name,
  options,
  selected = ""
) {
  return `
    <label class="form-field">

      <span>
        ${esc(label)}
      </span>

      <select name="${esc(name)}">

        ${options.map(option => {
          const value = typeof option === "object" ? option.value : option;
          const label = typeof option === "object" ? option.label : option;
          return `
            <option
              value="${esc(value)}"
              ${value === selected ? "selected" : ""}
            >
              ${esc(label)}
            </option>
          `;
        }).join("")}

      </select>

    </label>
  `;
          }

/* =========================================================
   FORMULÁRIOS DE ADIÇÃO
   ========================================================= */

function addForm(key) {

  /* ---------------- AGENDA ---------------- */

  if (key === "compromissos") {

    openModal(
      "Novo compromisso",

      field(
        "Título",
        "title",
        "text",
        "",
        "required"
      ) +

      field(
        "Data",
        "date",
        "date",
        todayISO(),
        "required"
      ) +

      field(
        "Horário",
        "time",
        "time",
        nowTime()
      ) +

      field(
        "Local",
        "location"
      ) +

      field(
        "Endereço",
        "address",
        "text",
        "",
        'placeholder="Digite ou cole o endereço do compromisso"'
      ),

      {
        submit: "Adicionar"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = async e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      state.data.compromissos.push({
        id: uid("c"),
        title: f.get("title"),
        date: f.get("date"),
        time: f.get("time"),
        location: f.get("location"),
        address: f.get("address") || ""
      });

      saveState();
      closeModal();
      render();

      toast(
        "Compromisso adicionado."
      );
    };

    return;
  }

  /* ---------------- TAREFAS ---------------- */

  if (key === "tarefas") {

    openModal(
      "Nova tarefa",

      field(
        "Tarefa",
        "title",
        "text",
        "",
        "required"
      ) +

      selectField(
        "Prioridade",
        "priority",
        [
          "Baixa",
          "Normal",
          "Média",
          "Alta"
        ],
        "Normal"
      ) +

      field(
        "Data",
        "date",
        "date"
      ) +

      field(
        "Horário",
        "time",
        "time"
      ),

      {
        submit: "Adicionar"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = async e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      state.data.tarefas.push({
        id: uid("t"),
        title: f.get("title"),
        priority:
          f.get("priority") ||
          "Normal",
        date: f.get("date"),
        time: f.get("time"),
        done: false
      });

      saveState();
      closeModal();
      render();

      toast(
        "Tarefa adicionada."
      );
    };

    return;
  }

  /* ---------------- COMPRAS ---------------- */

  if (key === "compras") {

    openModal(
      "Nova lista de compras",

      field(
        "Nome da lista",
        "name",
        "text",
        "",
        "required"
      ),

      {
        submit: "Criar lista"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      if (!state.data.compras) {
        state.data.compras = [];
      }

      const lista = {
        id: uid("lista"),
        name:
          String(
            f.get("name") || ""
          ).trim(),
        items: []
      };

      if (!lista.name) {
        toast(
          "Digite o nome da lista.",
          "error"
        );
        return;
      }

      state.data.compras.push(
        lista
      );

      saveState();

      closeModal();

      currentPage = "compras";
      currentShoppingList = null;

      render();

      toast(
        "Lista criada com sucesso."
      );
    };

    return;
  }

  /* ---------------- ESTUDOS ---------------- */

  if (key === "estudos") {

    openModal(
      "Novo estudo",

      field(
        "Matéria",
        "subject",
        "text",
        "",
        "required"
      ) +

      field(
        "Assunto",
        "topic"
      ) +

      field(
        "Data",
        "date",
        "date",
        todayISO(),
        "required"
      ) +

      field(
        "Horário",
        "time",
        "time"
      ) +

      field(
        "Tempo planejado (min)",
        "duration",
        "number",
        "",
        "min=\"0\""
      ) +

      field(
        "Tempo realizado (min)",
        "effectiveDuration",
        "number",
        "",
        "min=\"0\""
      ) +

      textareaField(
        "Bloco de anotações",
        "notes",
        "",
        'class="notes-box" placeholder="Anote de onde parou e informações importantes sobre o assunto."'
      ) +

      field(
        "Link da bibliografia",
        "link",
        "url",
        "",
        'placeholder="https://..."'
      ),

      {
        submit: "Registrar"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      state.data.estudos.push({
        id: uid("e"),
        subject:
          f.get("subject"),
        topic:
          f.get("topic"),
        date:
          f.get("date") || todayISO(),
        time:
          f.get("time") || "",
        duration:
          f.get("duration"),
        effectiveDuration:
          f.get("effectiveDuration") || "",
        notes:
          f.get("notes"),
        link:
          f.get("link"),
        done: false
      });

      saveState();
      closeModal();
      render();

      toast(
        "Estudo registrado."
      );
    };

    return;
  }

  /* ---------------- TREINOS ---------------- */

  if (key === "treinos") {

    openModal(
      "Novo treino",

      field(
        "Nome",
        "name",
        "text",
        "",
        "required"
      ) +

      field(
        "Tipo",
        "type"
      ) +

      field(
        "Duração (min)",
        "duration",
        "number",
        "",
        "min=\"0\""
      ) +

      field(
        "Distância (km)",
        "distance",
        "number",
        "",
        'step="0.01" min="0"'
      ) +

      field(
        "Pace",
        "pace",
        "text",
        "",
        'placeholder="Ex.: 6:30 min/km"'
      ) +

      textareaField(
        "Observações",
        "observations"
      ),

      {
        submit: "Criar treino"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      state.data.treinos.push({
        id: uid("tr"),
        name: f.get("name"),
        type: f.get("type"),
        duration:
          f.get("duration"),
        distance:
          f.get("distance"),
        pace:
          f.get("pace"),
        observations:
          f.get("observations"),
        exercises: []
      });

      saveState();
      closeModal();
      render();

      toast(
        "Treino criado."
      );
    };

    return;
  }

  /* ---------------- HIDRATAÇÃO ---------------- */

  if (key === "hidratacao") {

    openModal(
      "Registrar água",

      field(
        "Quantidade (ml)",
        "amount",
        "number",
        "300",
        "required min=\"1\""
      ),

      {
        submit: "Registrar"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      state.data.hidratacao.push({
        id: uid("h"),
        amount:
          Number(f.get("amount")),
        date:
          todayISO(),
        createdAt:
          new Date().toISOString()
      });

      saveState();
      closeModal();
      render();

      toast(
        "Hidratação registrada."
      );
    };

    return;
  }

  /* ---------------- ALIMENTAÇÃO ---------------- */

  if (key === "alimentacao") {
    addMealForm();
    return;
  }

  /* ---------------- FINANÇAS ---------------- */

  if (key === "financas") {

    openModal(
      "Novo lançamento",

      selectField(
        "Tipo",
        "type",
        [
          { value: "expense", label: "Despesa" },
          { value: "income", label: "Receita" }
        ],
        "expense"
      ) +

      field(
        "Descrição",
        "title",
        "text",
        "",
        "required"
      ) +

      field(
        "Valor",
        "value",
        "number",
        "",
        'step="0.01" min="0" required'
      ) +

      field(
        "Categoria",
        "category"
      ) +

      selectField(
        "Moeda",
        "currency",
        [
          { value: "BRL", label: "Real brasileiro (R$)" },
          { value: "USD", label: "Dólar americano (US$)" }
        ],
        "BRL"
      ) +

      field(
        "Data",
        "date",
        "date",
        todayISO()
      ),

      {
        submit: "Salvar"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      state.data.financas.push({
        id: uid("f"),
        type: f.get("type"),
        title: f.get("title"),
        value:
          Number(f.get("value")),
        category:
          f.get("category") ||
          "Geral",
        currency:
          f.get("currency") || "BRL",
        date:
          f.get("date"),
        createdAt: new Date().toISOString()
      });

      saveState();
      closeModal();
      render();

      toast(
        "Lançamento salvo."
      );
    };

    return;
  }

  /* ---------------- OBJETIVOS ---------------- */

  if (key === "objetivos") {

    openGoalForm();
    return;
  }

  /* ---------------- FAMÍLIA ---------------- */

  if (key === "familia") {

    openModal(
      "Adicionar pessoa",

      field(
        "Nome",
        "name",
        "text",
        "",
        "required"
      ) +

      field(
        "Relação",
        "relation"
      ) +

      field(
        "E-mail",
        "email",
        "email"
      ),

      {
        submit: "Adicionar"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      state.data.familia.push({
        id: uid("m"),
        name:
          f.get("name"),
        relation:
          f.get("relation"),
        email:
          f.get("email")
      });

      saveState();
      closeModal();
      render();

      toast(
        "Pessoa adicionada."
      );
    };
  }
}

/* =========================================================
   REFEIÇÃO
   ========================================================= */

function openFoodCatalog() {
  const foods = state.data.alimentos || [];
  openModal("Cadastro de alimentos", `
    <p class="muted">Cadastre e gerencie seus alimentos. A unidade de medida fica vinculada ao cadastro.</p>
    <div class="content-card">
      <div class="item-list">
        ${foods.length ? foods.map(f => `
          <div class="list-item">
            <div class="item-main">
              <strong>${esc(f.name)}</strong>
              <span>${Number(f.calories || 0)} kcal · ${esc(f.unit || "g")}</span>
            </div>
            <div class="item-actions">
              <button type="button" data-food-edit="${f.id}" title="Editar alimento">${icon("edit")}</button>
              <button type="button" data-food-delete="${f.id}" title="Excluir alimento">${icon("trash")}</button>
            </div>
          </div>
        `).join("") : `<p class="muted">Nenhum alimento cadastrado.</p>`}
      </div>
    </div>
    <div class="form-field"><span>Novo alimento</span><input name="foodName" placeholder="Nome do alimento"></div>
    <label class="form-field"><span>Unidade de medida</span><select name="foodUnit"><option>g</option><option>kg</option><option>ml</option><option>L</option><option>unidade</option><option>porção</option></select></label>
    <label class="form-field"><span>Calorias</span><input name="foodCalories" type="number" min="0" step="1" placeholder="kcal por 100 g/ml ou por unidade"></label>
  `,{submit:"Cadastrar alimento"});

  modal.querySelectorAll("[data-food-delete]").forEach(btn => btn.onclick = () => {
    state.data.alimentos = state.data.alimentos.filter(x => x.id !== btn.dataset.foodDelete);
    saveState(); openFoodCatalog(); toast("Alimento excluído.");
  });

  modal.querySelectorAll("[data-food-edit]").forEach(btn => btn.onclick = () => {
    const food = state.data.alimentos.find(x => x.id === btn.dataset.foodEdit);
    if (!food) return;
    openModal("Editar alimento",
      field("Nome do alimento", "name", "text", food.name || "", "required") +
      selectField("Unidade de medida", "unit", ["g","kg","ml","L","unidade","porção"], food.unit || "g") +
      field("Calorias", "calories", "number", food.calories || 0, 'min="0" step="1" required'),
      { submit: "Salvar alterações" }
    );
    modal.querySelector("#lidire-form").onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      food.name = String(f.get("name") || "").trim();
      food.unit = f.get("unit") || "g";
      food.calories = Number(f.get("calories") || 0);
      if (!food.name) { toast("Informe o nome do alimento.", "error"); return; }
      saveState(); openFoodCatalog(); toast("Alimento atualizado.");
    };
  });

  modal.querySelector("#lidire-form").onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get("foodName") || "").trim();
    if (!name) { toast("Digite o nome do alimento.", "error"); return; }
    state.data.alimentos.push({ id: uid("food"), name, unit: f.get("foodUnit") || "g", calories: Number(f.get("foodCalories") || 0) });
    saveState(); openFoodCatalog(); toast("Alimento cadastrado.");
  };
}

function addMealForm(existing = null) {

  let foods =
    existing?.foods
      ? clone(existing.foods)
      : [];

  function renderFoodFields() {

    const container =
      modal.querySelector(
        "#food-fields"
      );

    if (!container) return;

    container.innerHTML =
      foods.map((food, index) => `

        <div class="diet-food-row">

          <input
            name="food-name-${index}"
            placeholder="Alimento"
            value="${esc(food.name || "")}"
          >

          <input name="food-qty-${index}" type="number" min="0" step="0.01" placeholder="Quantidade" value="${esc(food.quantity||"")}">
          <select name="food-unit-${index}"><option value="g">g</option><option value="ml">ml</option><option value="unidade">unidade</option><option value="porção">porção</option></select>
          <input name="food-cal-${index}" type="number" min="0" placeholder="kcal" value="${Number(food.calories||0)}">
          <select name="food-cal-mode-${index}"><option value="auto">Calcular automaticamente</option><option value="manual" ${food.calorieMode==="manual"?"selected":""}>Inserir manualmente</option></select>
          <button type="button" class="danger-button diet-remove-button" data-remove-food="${index}">Excluir</button>

        </div>

      `).join("");

    container
      .querySelectorAll(
        "[data-remove-food]"
      )
      .forEach(button => {

        button.onclick = () => {

          foods.splice(
            Number(
              button.dataset.removeFood
            ),
            1
          );

          renderFoodFields();
        };
      });
  }

  openModal(
    existing
      ? "Editar refeição"
      : "Nova refeição",

    field(
      "Nome da refeição",
      "name",
      "text",
      existing?.name || "",
      "required"
    ) +

    field(
      "Horário",
      "time",
      "time",
      existing?.time ||
      nowTime(),
      "required"
    ) +

    `
      <div class="form-field">

        <span>
          Alimentos e calorias
        </span>

        <div id="food-fields"></div>

        <button
          type="button"
          class="ghost-button"
          id="add-food-button"
        >
          + Adicionar alimento
        </button>

      </div>
    `,

    {
      submit:
        existing
          ? "Salvar"
          : "Adicionar"
    }
  );

  renderFoodFields();

  modal.querySelector(
    "#add-food-button"
  ).onclick = () => {

    foods.push({ name: "", quantity: "", unit: "g", calories: 0, calorieMode: "manual" });

    renderFoodFields();
  };

  modal.querySelector(
    "#lidire-form"
  ).onsubmit = e => {

    e.preventDefault();

    const f =
      new FormData(e.target);

    foods =
      foods.map((food, index) => ({
        name: f.get(`food-name-${index}`) || "",
        quantity: f.get(`food-qty-${index}`) || "",
        unit: f.get(`food-unit-${index}`) || "g",
        calorieMode: f.get(`food-cal-mode-${index}`) || "manual",
        calories: Number(f.get(`food-cal-${index}`) || 0)
      }))
      .filter(
        food => food.name.trim()
      );

    if (!foods.length) {
      toast(
        "Adicione pelo menos um alimento.",
        "error"
      );
      return;
    }

    const meal = {
      id:
        existing?.id ||
        uid("meal"),
      name:
        f.get("name"),
      time:
        f.get("time"),
      date:
        existing?.date ||
        todayISO(),
      foods
    };

    if (existing) {

      const index =
        state.data.alimentacao
          .findIndex(
            x => x.id === existing.id
          );

      if (index >= 0) {
        state.data.alimentacao[index] =
          meal;
      }

    } else {
      state.data.alimentacao.push(
        meal
      );
    }

    saveState();
    closeModal();
    render();

    toast(
      existing
        ? "Refeição atualizada."
        : "Refeição adicionada."
    );
  };
}

/* =========================================================
   DIETA
   ========================================================= */

function addDietForm() {
  const current = state.settings.diet || { name: "", foods: [] };
  let foods = clone(current.foods || []);

  function estimateCalories(name, quantity, unit) {
    const key = String(name || "").trim().toLowerCase();
    const catalog = (state.data.alimentos || []).find(f => String(f.name||"").trim().toLowerCase() === key);
    if (catalog && Number(catalog.calories) > 0) {
      const q = Number(String(quantity||"").replace(",", "."));
      if (!q) return Number(catalog.calories);
      const base = String(catalog.unit || unit || "g").toLowerCase();
      const u = String(unit || base).toLowerCase();
      if (base === u) {
        if (["g","ml"].includes(u)) return Math.round(Number(catalog.calories) * q / 100);
        return Math.round(Number(catalog.calories) * q);
      }
    }
    const common = {
      "arroz": 130, "arroz cozido": 130, "feijão": 76, "feijao": 76,
      "frango": 165, "peito de frango": 165, "ovo": 155, "banana": 89,
      "maçã": 52, "maca": 52, "batata": 87, "aveia": 389,
      "leite": 61, "pão": 265, "pao": 265
    };
    const kcal100 = common[key];
    const q = Number(String(quantity||"").replace(",", "."));
    if (!kcal100 || !q) return 0;
    return Math.round(kcal100 * q / 100);
  }

  function renderFoods() {
    const container = modal.querySelector("#diet-foods");
    if (!container) return;
    container.innerHTML = foods.map((food,index)=>`
      <div class="diet-food-row diet-food-row-complete">
        <label class="inline-field"><span>Alimento</span><input name="diet-food-${index}" placeholder="Ex.: arroz" value="${esc(food.name||"")}"></label>
        <label class="inline-field"><span>Quantidade</span><input name="diet-qty-${index}" type="number" min="0" step="0.01" placeholder="Qtd." value="${esc(food.quantity||"")}"></label>
        <label class="inline-field"><span>Unidade de medida</span><select name="diet-unit-${index}">${["g","kg","ml","L","unidade","porção"].map(u=>`<option value="${u}" ${String(food.unit||"g")===u?"selected":""}>${u}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Parte/refeição</span><input name="diet-meal-${index}" placeholder="Ex.: Almoço" value="${esc(food.meal||"")}"></label>
        <label class="inline-field"><span>Calorias</span><input name="diet-cal-${index}" type="number" min="0" step="1" placeholder="kcal" value="${Number(food.calories||0)}"></label>
        <label class="inline-field"><span>Cálculo</span><select name="diet-cal-mode-${index}"><option value="auto" ${food.calorieMode!=="manual"?"selected":""}>Calcular automaticamente</option><option value="manual" ${food.calorieMode==="manual"?"selected":""}>Inserir manualmente</option></select></label>
        <button type="button" class="danger-button diet-remove-button" data-remove-diet="${index}">Excluir</button>
      </div>
    `).join("");
    container.querySelectorAll("[data-remove-diet]").forEach(btn=>btn.onclick=()=>{ foods.splice(Number(btn.dataset.removeDiet),1); renderFoods(); });
    const refreshAutoCalories = (idx) => {
      const mode = container.querySelector(`[name="diet-cal-mode-${idx}"]`);
      if (!mode || mode.value !== "auto") return;
      const q = container.querySelector(`[name="diet-qty-${idx}"]`).value;
      const u = container.querySelector(`[name="diet-unit-${idx}"]`).value;
      const n = container.querySelector(`[name="diet-food-${idx}"]`).value;
      const cal = container.querySelector(`[name="diet-cal-${idx}"]`);
      if (cal) cal.value = estimateCalories(n,q,u);
    };
    container.querySelectorAll('select[name^="diet-cal-mode-"]').forEach(sel=>sel.addEventListener("change",()=>refreshAutoCalories(Number(sel.name.split("-").pop()))));
    container.querySelectorAll('input[name^="diet-food-"],input[name^="diet-qty-"] ,select[name^="diet-unit-"]').forEach(input=>{
      const idx = Number(input.name.split("-").pop());
      input.addEventListener("input",()=>refreshAutoCalories(idx));
      input.addEventListener("change",()=>refreshAutoCalories(idx));
    });
    foods.forEach((_,idx)=>refreshAutoCalories(idx));
  }

  openModal("Inserir dieta", field("Nome da dieta","dietName","text",current.name||"")+`<div class="form-field"><span>Alimentos da dieta</span><small class="muted">Você pode adicionar vários alimentos sem apagar os anteriores.</small><div id="diet-foods"></div><button type="button" class="ghost-button" id="add-diet-food">+ Adicionar outro alimento</button></div>`,{submit:"Salvar dieta"});
  renderFoods();
  modal.querySelector("#add-diet-food").onclick=()=>{
    const form = modal.querySelector("#lidire-form");
    if (form) {
      const f = new FormData(form);
      const savedDraft = [];
      foods.forEach((food,index)=>{
        const name = f.get(`diet-food-${index}`) || "";
        const quantity = f.get(`diet-qty-${index}`) || "";
        const unit = f.get(`diet-unit-${index}`) || "g";
        const meal = f.get(`diet-meal-${index}`) || "";
        const mode = f.get(`diet-cal-mode-${index}`) || "auto";
        let calories = Number(f.get(`diet-cal-${index}`) || 0);
        if (mode === "auto") calories = estimateCalories(name, quantity, unit);
        savedDraft.push({name, quantity, unit, meal, calories, calorieMode: mode});
      });
      foods = savedDraft;
    }
    foods.push({name:"",quantity:"",unit:"g",meal:"",calories:0,calorieMode:"auto"});
    renderFoods();
  };
  modal.querySelector("#lidire-form").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);foods=foods.map((food,index)=>{const mode=f.get(`diet-cal-mode-${index}`)||"auto";let cal=Number(f.get(`diet-cal-${index}`)||0);if(mode==="auto")cal=estimateCalories(f.get(`diet-food-${index}`),f.get(`diet-qty-${index}`),f.get(`diet-unit-${index}`));return {name:f.get(`diet-food-${index}`)||"",quantity:f.get(`diet-qty-${index}`)||"",unit:f.get(`diet-unit-${index}`)||"g",meal:f.get(`diet-meal-${index}`)||"",calories:cal,calorieMode:mode};}).filter(food=>food.name.trim());state.settings.diet={name:f.get("dietName")||"",foods};saveState();closeModal();render();toast("Dieta salva.");};
}

/* =========================================================
   DIETA → LISTA DE COMPRAS
   ========================================================= */

function createShoppingListFromDiet() {

  const diet =
    state.settings.diet;

  if (
    !diet ||
    !diet.foods ||
    !diet.foods.length
  ) {
    toast(
      "Cadastre os alimentos da dieta primeiro.",
      "error"
    );
    return;
  }

  const list = {
    id: uid("lista"),
    name:
      diet.name
        ? `Compras - ${diet.name}`
        : "Compras da dieta",
    items:
      diet.foods.map(food => ({
        id: uid("item"),
        name: food.name,
        quantity:
          food.quantity || "",
        category: "Dieta",
        done: false
      }))
  };

  state.data.compras.push(
    list
  );

  saveState();

  currentPage = "compras";
  currentShoppingList = list.id;

  render();

  toast(
    "Lista criada a partir da dieta."
  );
}

/* =========================================================
   TREINO → EXERCÍCIO
   ========================================================= */

function addExerciseForm(treinoId, existing = null) {

  openModal(
    existing
      ? "Editar exercício"
      : "Adicionar exercício",

    field(
      "Exercício",
      "name",
      "text",
      existing?.name || "",
      "required"
    ) +

    field(
      "Carga meta",
      "loadGoal",
      "text",
      existing?.loadGoal || "",
      'placeholder="Ex.: 20 kg"'
    ) +

    field(
      "Carga efetivada",
      "loadDone",
      "text",
      existing?.loadDone || "",
      'placeholder="Ex.: 18 kg"'
    ) +

    field(
      "Repetições meta",
      "repsGoal",
      "number",
      existing?.repsGoal || "",
      "min=\"0\""
    ) +

    field(
      "Repetições efetivadas",
      "repsDone",
      "number",
      existing?.repsDone || "",
      "min=\"0\""
    ),

    {
      submit:
        existing
          ? "Salvar"
          : "Adicionar"
    }
  );

  modal.querySelector(
    "#lidire-form"
  ).onsubmit = e => {

    e.preventDefault();

    const f =
      new FormData(e.target);

    const treino =
      state.data.treinos.find(
        x => x.id === treinoId
      );

    if (!treino) return;

    if (!treino.exercises) {
      treino.exercises = [];
    }

    const exercise = {
      id:
        existing?.id ||
        uid("exercise"),
      name:
        f.get("name"),
      loadGoal:
        f.get("loadGoal"),
      loadDone:
        f.get("loadDone"),
      repsGoal:
        f.get("repsGoal"),
      repsDone:
        f.get("repsDone")
    };

    if (existing) {

      const index =
        treino.exercises.findIndex(
          x => x.id === existing.id
        );

      if (index >= 0) {
        treino.exercises[index] =
          exercise;
      }

    } else {

      treino.exercises.push(
        exercise
      );

    }

    saveState();
    closeModal();
    render();

    toast(
      existing
        ? "Exercício atualizado."
        : "Exercício adicionado."
    );
  };
}

/* =========================================================
   ANIMAÇÃO DE EXERCÍCIO
   ========================================================= */

function animateExercise(id) {

  const allExercises =
    state.data.treinos.flatMap(
      treino =>
        treino.exercises || []
    );

  const exercise =
    allExercises.find(
      x => x.id === id
    );

  if (!exercise) return;

  openModal(
    exercise.name,
    `
      <div class="exercise-animation">
        🏃‍♀️
      </div>

      <p style="text-align:center">
        Movimento demonstrativo
        <br>
        <strong>
          ${esc(exercise.name)}
        </strong>
      </p>
    `,
    {
      submit: "Fechar"
    }
  );

  modal.querySelector(
    ".modal-footer"
  ).innerHTML = `
    <button
      type="button"
      class="primary-button"
      data-action="close-modal"
    >
      Fechar
    </button>
  `;
}

/* =========================================================
   CONFIGURAÇÃO DE HIDRATAÇÃO
   ========================================================= */

function configHidratacao() {

  const goal =
    Number(state.settings.hydrationGoal) || 2000;

  const start =
    state.settings.hydrationStart || "08:00";

  const end =
    state.settings.hydrationEnd || "21:00";

  const intervalMinutes =
    Number(state.settings.hydrationIntervalMinutes) ||
    (Number(state.settings.hydrationInterval) || 2) * 60;

  openModal(
    "Meta de hidratação",

    field(
      "Meta diária (ml)",
      "goal",
      "number",
      goal,
      "min=\"1\" required"
    ) +

    field(
      "Início do período",
      "start",
      "time",
      start,
      "required"
    ) +

    field(
      "Fim do período",
      "end",
      "time",
      end,
      "required"
    ) +

    `<label class="form-field">
      <span>Intervalo de consumo</span>
      <select name="intervalMinutes" required>
        ${Array.from({ length: 24 }, (_, i) => {
          const minutes = (i + 1) * 30;
          const selected = minutes === intervalMinutes ? "selected" : "";
          return `<option value="${minutes}" ${selected}>${formatHydrationInterval(minutes)}</option>`;
        }).join("")}
      </select>
    </label>` +

    `<div class="form-help hydration-calculation" id="hydration-calculation">
      A quantidade por intervalo será calculada automaticamente.
    </div>`,

    {
      submit: "Salvar meta"
    }
  );

  const form = modal.querySelector("#lidire-form");
  const calculation = modal.querySelector("#hydration-calculation");

  function updateHydrationCalculation() {
    const formData = new FormData(form);
    const currentGoal = Number(formData.get("goal")) || 0;
    const currentStart = formData.get("start") || "08:00";
    const currentEnd = formData.get("end") || "21:00";
    const currentIntervalMinutes = Number(formData.get("intervalMinutes")) || 30;

    const [sh, sm] = currentStart.split(":").map(Number);
    const [eh, em] = currentEnd.split(":").map(Number);

    let minutes =
      (eh * 60 + em) -
      (sh * 60 + sm);

    if (minutes <= 0) minutes += 24 * 60;

    const count = Math.max(1, Math.ceil(minutes / currentIntervalMinutes));
    const amount = currentGoal > 0 ? Math.round(currentGoal / count) : 0;

    calculation.innerHTML = `
      <strong>${amount.toLocaleString("pt-BR")} ml por consumo</strong>
      <span>(${count} consumos previstos entre ${esc(currentStart)} e ${esc(currentEnd)})</span>
    `;
  }

  form.querySelectorAll("input, select").forEach(input => {
    input.addEventListener("input", updateHydrationCalculation);
    input.addEventListener("change", updateHydrationCalculation);
  });

  updateHydrationCalculation();

  form.onsubmit = e => {
    e.preventDefault();

    const f = new FormData(e.target);

    state.settings.hydrationGoal = Number(f.get("goal"));
    state.settings.hydrationStart = f.get("start");
    state.settings.hydrationEnd = f.get("end");
    state.settings.hydrationIntervalMinutes = Number(f.get("intervalMinutes"));
    delete state.settings.hydrationInterval;

    saveState();
    closeModal();
    render();

    toast("Meta de hidratação atualizada.");
  };
}

/* =========================================================
   META DE CALORIAS
   ========================================================= */

function configCalorias() {

  openModal(
    "Meta diária de calorias",

    field(
      "Calorias por dia",
      "goal",
      "number",
      state.settings.calorieGoal,
      "min=\"1\" required"
    ),

    {
      submit: "Salvar meta"
    }
  );

  modal.querySelector(
    "#lidire-form"
  ).onsubmit = e => {

    e.preventDefault();

    const f =
      new FormData(e.target);

    state.settings.calorieGoal =
      Number(f.get("goal"));

    saveState();
    closeModal();
    render();

    toast(
      "Meta de calorias atualizada."
    );
  };
}

/* =========================================================
   TETOS DE FINANÇAS
   ========================================================= */

function openFinanceEditModal(item){
  openModal("Editar lançamento",selectField("Tipo","type",[{value:"expense",label:"Despesa"},{value:"income",label:"Receita"}],item.type||"expense")+field("Descrição","title","text",item.title||"","required")+field("Valor","value","number",item.value||"",'step="0.01" min="0" required')+field("Categoria","category","text",item.category||"Geral")+selectField("Moeda","currency",[{value:"BRL",label:"Real brasileiro (R$)"},{value:"USD",label:"Dólar americano (US$)"}],item.currency||"BRL")+field("Data","date","date",item.date||todayISO()),{submit:"Salvar alterações"});
  modal.querySelector("#lidire-form").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);Object.assign(item,{type:f.get("type"),title:f.get("title"),value:Number(f.get("value")),category:f.get("category")||"Geral",currency:f.get("currency")||"BRL",date:f.get("date")||todayISO()});saveState();closeModal();render();toast("Lançamento atualizado.");};
}
function financeMonthlyReport(){
  const month=todayISO().slice(0,7);openModal("Relatório mensal",field("Mês","month","month",month,"required")+'<div id="finance-monthly-preview" class="content-card" style="margin-top:12px"></div>',{submit:"Fechar"});
  const update=()=>{const selected=modal.querySelector('[name="month"]').value||month;const rows=state.data.financas.filter(x=>String(x.date||"").startsWith(selected));const sum=(type,cur)=>rows.filter(x=>x.type===type&&(x.currency||"BRL")===cur).reduce((s,x)=>s+Number(x.value||0),0);const cats={};rows.filter(x=>x.type==="expense").forEach(x=>{const k=`${x.currency||"BRL"}::${x.category||"Geral"}`;cats[k]=(cats[k]||0)+Number(x.value||0);});modal.querySelector("#finance-monthly-preview").innerHTML=`<strong>Receitas</strong><p>${money(sum("income","BRL"),"BRL")} · ${money(sum("income","USD"),"USD")}</p><strong>Despesas</strong><p>${money(sum("expense","BRL"),"BRL")} · ${money(sum("expense","USD"),"USD")}</p><strong>Saldo</strong><p>${money(sum("income","BRL")-sum("expense","BRL"),"BRL")} · ${money(sum("income","USD")-sum("expense","USD"),"USD")}</p><strong>Despesas por categoria</strong>${Object.keys(cats).length?`<ul>${Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{const [cur,cat]=k.split("::");return `<li>${esc(cat)}: ${money(v,cur)}</li>`}).join("")}</ul>`:`<p class="muted">Nenhuma despesa no mês.</p>`}`;};modal.querySelector('[name="month"]').addEventListener("change",update);update();modal.querySelector(".modal-footer .primary-button").onclick=e=>{e.preventDefault();closeModal();};
}
function financeHistory(){
  openModal("Histórico financeiro",field("Data inicial","from","date",todayISO(),"required")+field("Data final","to","date",todayISO(),"required")+'<div id="finance-history-preview" class="content-card" style="margin-top:12px"></div>',{submit:"Fechar"});
  const update=()=>{const f=new FormData(modal.querySelector("#lidire-form"));const from=f.get("from"),to=f.get("to");const rows=state.data.financas.filter(x=>(!from||(x.date||"")>=from)&&(!to||(x.date||"")<=to));modal.querySelector("#finance-history-preview").innerHTML=rows.length?`<div class="item-list">${rows.map(x=>`<div class="list-item"><div class="item-main"><strong>${esc(x.title)}</strong><span>${dateBR(x.date)} · ${esc(x.category||"Geral")}</span></div><strong class="finance-value ${x.type}">${x.type==="income"?"+":"-"} ${money(x.value,x.currency||"BRL")}</strong></div>`).join("")}</div>`:`<p class="muted">Nenhum lançamento encontrado no período.</p>`;};modal.querySelectorAll('[name="from"],[name="to"]').forEach(x=>x.addEventListener("change",update));update();modal.querySelector(".modal-footer .primary-button").onclick=e=>{e.preventDefault();closeModal();};
}
function parseQuantity(value){const m=String(value||"").trim().match(/^(\\d+(?:[.,]\\d+)?)\\s*([a-zA-ZÀ-ÿ]+)?$/);if(!m)return null;return {value:Number(m[1].replace(",",".")),unit:(m[2]||"").toLowerCase()};}
function combineQuantities(a,b){const x=parseQuantity(a),y=parseQuantity(b);if(!x||!y||x.unit!==y.unit)return null;const total=x.value+y.value;const formatted=Number.isInteger(total)?String(total):String(total).replace(".",",");return `${formatted}${x.unit?" "+x.unit:""}`;}
function openMergeShoppingModal(lists){openModal("Juntar listas de compras",field("Nome da nova lista","name","text","Lista de compras combinada","required")+`<label class="form-field"><span>Listas selecionadas</span><div class="muted">${lists.map(x=>`${esc(x.name)} (${(x.items||[]).length} itens)`).join(" · ")}</div></label><label class="form-field"><span><input type="checkbox" name="sumDuplicates" checked> Somar quantidades de itens iguais quando as unidades forem compatíveis</span></label>`,{submit:"Criar nova lista"});modal.querySelector("#lidire-form").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),name=String(f.get("name")||"").trim();if(!name){toast("Digite o nome da nova lista.","error");return;}const sumDup=f.get("sumDuplicates")==="on",items=[];lists.flatMap(x=>x.items||[]).forEach(item=>{const existing=items.find(y=>y.name.toLowerCase()===String(item.name||"").toLowerCase());if(existing&&sumDup){const combined=combineQuantities(existing.quantity,item.quantity);if(combined)existing.quantity=combined;else if(item.quantity&&existing.quantity&&existing.quantity!==item.quantity)existing.quantity=`${existing.quantity} + ${item.quantity}`;}else if(!existing)items.push({id:uid("item"),name:item.name,quantity:item.quantity||"",category:item.category||"",done:false});});const list={id:uid("lista"),name,items};state.data.compras.push(list);saveState();closeModal();currentPage="compras";currentShoppingList=list.id;render();toast("Nova lista criada a partir das listas selecionadas.");};}

function configFinanceLimits() {

  const categories =
    new Set();

  state.data.financas.forEach(x => {
    if (x.category) {
      categories.add(
        x.category
      );
    }
  });

  Object.keys(
    state.settings.financeLimits || {}
  ).forEach(cat =>
    categories.add(cat)
  );

  const list =
    [...categories];

  openModal(
    "Tetos mensais por categoria",

    `
      ${
        list.length
          ? list.map(cat => `
              ${field(
                cat,
                `limit-${encodeURIComponent(cat)}`,
                "number",
                state.settings
                  .financeLimits?.[cat] || 0,
                'min="0" step="0.01"'
              )}
            `).join("")
          : `
            <p class="muted">
              Cadastre primeiro um gasto com uma categoria.
            </p>
          `
      }

      ${field(
        "Nova categoria",
        "newCategory"
      )}

      ${field(
        "Teto da nova categoria",
        "newLimit",
        "number",
        "",
        'min="0" step="0.01"'
      )}
    `,

    {
      submit: "Salvar tetos"
    }
  );

  modal.querySelector(
    "#lidire-form"
  ).onsubmit = e => {

    e.preventDefault();

    const f =
      new FormData(e.target);

    const limits = {
      ...(state.settings.financeLimits || {})
    };

    list.forEach(cat => {

      const value =
        Number(
          f.get(
            `limit-${encodeURIComponent(cat)}`
          ) || 0
        );

      limits[cat] = value;

    });

    const newCategory =
      String(
        f.get("newCategory") || ""
      ).trim();

    const newLimit =
      Number(
        f.get("newLimit") || 0
      );

    if (newCategory) {
      limits[newCategory] =
        newLimit;
    }

    state.settings.financeLimits =
      limits;

    saveState();
    closeModal();
    render();

    toast(
      "Tetos de gastos atualizados."
    );
  };
}

/* =========================================================
   OBJETIVO
   ========================================================= */

function openGoalForm(existing = null) {

  openModal(
    existing
      ? "Editar objetivo"
      : "Novo objetivo",

    field(
      "Objetivo",
      "title",
      "text",
      existing?.title || "",
      "required"
    ) +

    field(
      "Prazo",
      "deadline",
      "date",
      existing?.deadline || ""
    ) +

    field(
      "Progresso (%)",
      "progress",
      "number",
      existing?.progress || 0,
      'min="0" max="100"'
    ) +

    field(
      "Dinheiro necessário",
      "moneyGoal",
      "number",
      existing?.moneyGoal || 0,
      'min="0" step="0.01"'
    ) +

    selectField(
      "Moeda da meta financeira",
      "moneyCurrency",
      [
        { value: "BRL", label: "Real brasileiro (R$)" },
        { value: "USD", label: "Dólar americano (US$)" }
      ],
      existing?.moneyCurrency || "BRL"
    ) +

    textareaField(
      "Observações",
      "observations",
      existing?.observations || ""
    ),

    {
      submit:
        existing
          ? "Salvar"
          : "Criar objetivo"
    }
  );

  modal.querySelector(
    "#lidire-form"
  ).onsubmit = e => {

    e.preventDefault();

    const f =
      new FormData(e.target);

    const goal = {
      id:
        existing?.id ||
        uid("o"),

      title:
        f.get("title"),

      deadline:
        f.get("deadline"),

      progress:
        Number(
          f.get("progress") || 0
        ),

      moneyGoal:
        Number(
          f.get("moneyGoal") || 0
        ),

      moneyCurrency:
        f.get("moneyCurrency") || "BRL",

      observations:
        f.get("observations"),

      metas:
        existing?.metas || []
    };

    updateGoalProgress(goal);

    if (existing) {

      const index =
        state.data.objetivos
          .findIndex(
            x => x.id === existing.id
          );

      if (index >= 0) {
        state.data.objetivos[index] =
          goal;
      }

    } else {

      state.data.objetivos.push(
        goal
      );

    }

    saveState();
    closeModal();
    render();

    toast(
      existing
        ? "Objetivo atualizado."
        : "Objetivo criado."
    );
  };
}

/* =========================================================
   META INTERNA DO OBJETIVO
   ========================================================= */

function calculateGoalProgress(goal) {
  const metas = Array.isArray(goal?.metas) ? goal.metas : [];
  if (!metas.length) return Number(goal?.progress || 0);
  const completed = metas.filter(meta => meta.done).length;
  return Math.round((completed / metas.length) * 100);
}

function updateGoalProgress(goal) {
  if (!goal) return;
  if (Array.isArray(goal.metas) && goal.metas.length) {
    goal.progress = calculateGoalProgress(goal);
  }
}

function addMeta(goalId) {

  openModal(
    "Nova meta do objetivo",

    field(
      "Meta",
      "title",
      "text",
      "",
      "required"
    ) +

    selectField(
      "Periodicidade",
      "period",
      [
        "Diária",
        "Semanal",
        "Mensal"
      ],
      "Diária"
    ),

    {
      submit: "Adicionar meta"
    }
  );

  modal.querySelector(
    "#lidire-form"
  ).onsubmit = e => {

    e.preventDefault();

    const f =
      new FormData(e.target);

    const goal =
      state.data.objetivos.find(
        x => x.id === goalId
      );

    if (!goal) return;

    if (!goal.metas) {
      goal.metas = [];
    }

    goal.metas.push({
      id: uid("meta"),
      title:
        f.get("title"),
      period:
        f.get("period"),
      done: false
    });
    updateGoalProgress(goal);

    saveState();
    closeModal();
    render();

    toast(
      "Meta adicionada ao objetivo."
    );
  };
}

function confirmDeleteGoal(id) {
  const goal = state.data.objetivos.find(x => x.id === id);
  if (!goal) return;
  openModal(
    "Excluir objetivo",
    `<div class="confirm-delete-box"><div class="confirm-delete-icon">⚠</div><p>Tem certeza que deseja excluir <strong>${esc(goal.title)}</strong>?</p><p class="muted">As metas internas e o progresso deste objetivo também serão removidos.</p><div class="confirm-delete-actions"><button type="button" class="ghost-button" data-action="cancel-delete-objetivo">Cancelar</button><button type="button" class="danger-button" data-action="confirm-delete-objetivo" data-id="${goal.id}">Confirmar exclusão</button></div></div>`,
    { submit: "Cancelar" }
  );
  modal.querySelector(".modal-footer").style.display = "none";
}

/* =========================================================
   EDIÇÃO DE COMPROMISSO E TAREFA
   ========================================================= */


function addStudyPlan(existing = null) {
  const x = existing || {
    subject: "",
    period: "semanal",
    date: todayISO(),
    duration: "60",
    note: "",
    done: false
  };

  openModal(
    existing ? "Editar planejamento" : "Novo planejamento",
    `<label class="form-field"><span>Tipo de planejamento</span><select name="period" required><option value="semanal" ${x.period === "semanal" ? "selected" : ""}>Semanal</option><option value="mensal" ${x.period === "mensal" ? "selected" : ""}>Mensal</option></select></label>` +
    field("Matéria / assunto", "subject", "text", x.subject || "", "required") +
    field("Data do estudo", "date", "date", x.date || todayISO(), "required") +
    field("Duração planejada (min)", "duration", "number", x.duration || 60, 'min="1" required') +
    textareaField("Observações", "note", x.note || "", 'placeholder="Ex.: capítulo, exercícios ou conteúdo que será estudado."'),
    { submit: existing ? "Salvar" : "Adicionar" }
  );

  modal.querySelector("#lidire-form").onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const value = {
      period: f.get("period"),
      subject: String(f.get("subject") || "").trim(),
      date: f.get("date"),
      duration: Number(f.get("duration") || 0),
      note: f.get("note") || "",
      done: existing ? !!existing.done : false
    };

    if (!value.subject || !value.date || !value.duration) {
      toast("Preencha matéria, data e duração.", "error");
      return;
    }

    if (existing) Object.assign(existing, value);
    else state.data.studyPlans.push({ id: uid("plan"), ...value });

    saveState();
    closeModal();
    render();
    toast(existing ? "Planejamento atualizado." : "Planejamento adicionado.");
  };
}

function editItem(type, id) {

  const key =
    type === "compromisso"
      ? "compromissos"
      : "tarefas";

  const item =
    state.data[key].find(
      x => x.id === id
    );

  if (!item) return;

  if (type === "compromisso") {

    openModal(
      "Editar compromisso",

      field(
        "Título",
        "title",
        "text",
        item.title,
        "required"
      ) +

      field(
        "Data",
        "date",
        "date",
        item.date,
        "required"
      ) +

      field(
        "Horário",
        "time",
        "time",
        item.time || ""
      ) +

      field(
        "Local",
        "location",
        "text",
        item.location || ""
      ) +

      field(
        "Endereço",
        "address",
        "text",
        item.address || "",
        'placeholder="Digite ou cole o endereço do compromisso"'
      ),

      {
        submit: "Salvar"
      }
    );

  } else {

    openModal(
      "Editar tarefa",

      field(
        "Tarefa",
        "title",
        "text",
        item.title,
        "required"
      ) +

      selectField(
        "Prioridade",
        "priority",
        [
          "Baixa",
          "Normal",
          "Média",
          "Alta"
        ],
        item.priority ||
          "Normal"
      ) +

      field(
        "Data",
        "date",
        "date",
        item.date || ""
      ) +

      field(
        "Horário",
        "time",
        "time",
        item.time || ""
      ),

      {
        submit: "Salvar"
      }
    );
  }

  modal.querySelector(
    "#lidire-form"
  ).onsubmit = e => {

    e.preventDefault();

    const f =
      new FormData(e.target);

    Object.assign(
      item,
      Object.fromEntries(
        f.entries()
      )
    );

    saveState();
    closeModal();
    render();

    toast(
      "Alterações salvas."
    );
  };
}


/* =========================================================
   AÇÕES PRINCIPAIS
   ========================================================= */

function removeItem(
  key,
  id,
  message = "Item removido."
) {

  state.data[key] =
    state.data[key].filter(
      x => x.id !== id
    );

  saveState();
  render();

  toast(message);
}

function handleAction(
  action,
  el
) {

  /* AUTENTICAÇÃO */

  if (action === "auth-switch") {
    handleAuthSwitch();
    return;
  }

  if (action === "auth-toggle-password") {
    togglePasswordInput("auth-password");
    return;
  }

  if (action === "auth-toggle-password-confirm") {
    togglePasswordInput("auth-password-confirm");
    return;
  }

  if (action === "forgot-password") {
    openPasswordRecovery();
    return;
  }

  if (action === "go-back") {
    goBack();
    return;
  }

  if (action === "logout") {
    logoutLiDire();
    return;
  }

  if (action === "assistant-voice") {
    startAssistantVoice();
    return;
  }

  if (action === "assistant-speak-last") {
    if (lastAssistantResponse && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(lastAssistantResponse));
    } else {
      toast("Faça uma pergunta primeiro.", "error");
    }
    return;
  }

  if (action === "auth-legal") {
    alert("Os Termos de Uso e a Política de Privacidade estarão disponíveis nesta etapa do cadastro.");
    return;
  }

  if (action === "recipe-coming-soon") { toast("O cadastro de receitas será conectado ao D1 na próxima etapa."); return; }
  if (action === "note-coming-soon") { toast("As anotações serão conectadas ao D1 na próxima etapa."); return; }
  if (action === "preference-language") { toast("A seleção de idioma será conectada às preferências da conta."); return; }
  if (action === "preference-theme") { toast("A seleção de aparência será conectada às preferências da conta."); return; }
  if (action === "export-data") { toast("A exportação de dados será conectada ao D1 nesta etapa."); return; }
  if (action === "delete-account") {
    if (!confirm("Excluir definitivamente sua conta e os dados associados? Esta ação não pode ser desfeita.")) return;
    apiRequest("/api/account", { method: "DELETE" })
      .then(() => { localStorage.removeItem(STORAGE_KEY); state = clone(defaultState); authUser = null; authChecked = true; authMode = "login"; renderAuth(); toast("Conta excluída."); })
      .catch(error => toast(error.message || "Não foi possível excluir a conta.", "error"));
    return;
  }

  /* QUICK ADD */

  if (action === "quick-add") {

    openModal(
      "Adicionar rápido",

      `
        <p class="muted" style="grid-column:1/-1;margin-top:-4px;">
          Crie rapidamente um registro sem precisar abrir o menu Explorar.
        </p>

        <div class="quick-actions">

          ${[
            ["compromissos", "▣", "Compromisso"],
            ["tarefas", "✓", "Tarefa"],
            ["compras", "🛒", "Lista de compras"],
            ["alimentacao", "🍽", "Refeição"],
            ["hidratacao", "◉", "Água"],
            ["financas", "R$", "Lançamento"],
            ["treinos", "♢", "Treino"],
            ["objetivos", "◎", "Objetivo"]
          ]
            .map(
              x => `
                <button
                  type="button"
                  class="quick-option"
                  data-action="quick-option"
                  data-key="${x[0]}"
                >
                  <span>${x[1]}</span>
                  ${x[2]}
                </button>
              `
            )
            .join("")}

        </div>
      `,

      {
        submit: "Fechar"
      }
    );

    modal.querySelector(
      ".modal-footer"
    ).style.display = "none";

    return;
  }

  if (action === "quick-option") {

    const key =
      el.dataset.key;

    closeModal();
    addForm(key);

    return;
  }

  if (action === "close-modal") {
    closeModal();
    return;
  }

  if (
    action.startsWith("add-") &&
    action !== "add-item-compra" &&
    action !== "add-study-plan" &&
    action !== "add-dieta" &&
    action !== "add-meta" &&
    action !== "add-exercicio"
  ) {

    addForm(
      action.slice(4)
    );

    return;
  }

  /* COMPRAS */

  if (action === "open-lista-compras") {

    currentPage = "compras";

    currentShoppingList =
      el.dataset.id;

    render();

    return;
  }

  if (action === "back-compras") {

    currentPage = "compras";
    currentShoppingList = null;

    render();

    return;
  }

  if (action === "edit-lista-compras") {
    const lista=state.data.compras.find(x=>x.id===el.dataset.id); if(!lista)return;
    openModal("Editar lista de compras",field("Nome da lista","name","text",lista.name||"","required"),{submit:"Salvar nome"});
    modal.querySelector("#lidire-form").onsubmit=e=>{e.preventDefault();const name=String(new FormData(e.target).get("name")||"").trim();if(!name){toast("Digite o nome da lista.","error");return;}lista.name=name;saveState();closeModal();render();toast("Nome da lista atualizado.");};
    return;
  }
  if (action === "merge-shopping-lists") {
    const selected=[...document.querySelectorAll(".shopping-merge-check:checked")].map(x=>x.value);if(selected.length<2){toast("Selecione pelo menos duas listas.","error");return;}openMergeShoppingModal(state.data.compras.filter(x=>selected.includes(x.id)));return;
  }

  if (action === "delete-lista-compras") {

    const id =
      el.dataset.id;

    if (
      !confirm(
        "Excluir esta lista de compras?"
      )
    ) {
      return;
    }

    state.data.compras =
      state.data.compras.filter(
        x => x.id !== id
      );

    saveState();

    render();

    toast(
      "Lista excluída."
    );

    return;
  }

  if (action === "add-item-compra") {

    const listId =
      el.dataset.id;

    const lista =
      state.data.compras.find(
        x => x.id === listId
      );

    if (!lista) return;

    openModal(
      "Adicionar item",

      field(
        "Item",
        "name",
        "text",
        "",
        "required"
      ) +

      field(
        "Quantidade",
        "quantity"
      ) +

      field(
        "Categoria",
        "category"
      ),

      {
        submit: "Adicionar"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      lista.items =
        lista.items || [];

      lista.items.push({
        id: uid("item"),
        name:
          f.get("name"),
        quantity:
          f.get("quantity"),
        category:
          f.get("category"),
        done: false
      });

      saveState();
      closeModal();
      render();

      toast(
        "Item adicionado."
      );
    };

    return;
  }

  if (action === "toggle-item-compra") {

    const lista =
      state.data.compras.find(
        x =>
          x.id ===
          el.dataset.listId
      );

    if (!lista) return;

    const item =
      (lista.items || []).find(
        x =>
          x.id ===
          el.dataset.id
      );

    if (!item) return;

    item.done = !item.done;

    saveState();
    render();

    return;
  }

  if (action === "delete-item-compra") {

    const lista =
      state.data.compras.find(
        x =>
          x.id ===
          el.dataset.listId
      );

    if (!lista) return;

    lista.items =
      (lista.items || []).filter(
        x =>
          x.id !==
          el.dataset.id
      );

    saveState();
    render();

    toast(
      "Item removido."
    );

    return;
  }

  if (action === "lista-dieta-para-compras") {
    const lista = state.data.compras.find(x => x.id === el.dataset.id);
    const diet = state.settings.diet;
    if (!lista || !diet?.foods?.length) { toast("Cadastre a dieta primeiro.", "error"); return; }
    const groups = [...new Set(diet.foods.map(f => f.meal || "Todos"))];
    openModal("Importar alimentos da dieta", `
      <p class="muted">Escolha a parte da dieta que deseja importar para esta lista.</p>
      ${selectField("Parte da dieta", "dietPart", groups.map(g => ({value:g,label:g})), "Todos")}
    `, {submit:"Importar"});
    modal.querySelector("#lidire-form").onsubmit = e => {
      e.preventDefault();
      const part = new FormData(e.target).get("dietPart");
      const foods = diet.foods.filter(f => part === "Todos" || (f.meal || "Todos") === part);
      lista.items = lista.items || [];
      foods.forEach(food => {
        const existing = lista.items.find(item => item.name.toLowerCase() === food.name.toLowerCase());
        if (!existing) lista.items.push({id:uid("item"), name:food.name, quantity:food.quantity || "", category:food.meal || "Dieta", done:false});
      });
      saveState(); closeModal(); render(); toast("Alimentos da dieta importados.");
    };
    return;
  }

  /* TAREFAS */

  if (action === "toggle-tarefa") {

    const item =
      state.data.tarefas.find(
        x =>
          x.id ===
          el.dataset.id
      );

    if (item) {
      item.done = !item.done;
    }

    saveState();
    render();

    return;
  }

  if (action === "edit-tarefa") {

    editItem(
      "tarefa",
      el.dataset.id
    );

    return;
  }

  if (action === "edit-compromisso") {

    editItem(
      "compromisso",
      el.dataset.id
    );

    return;
  }

  /* PLANEJAMENTO DE ESTUDOS */

  if (action === "add-study-plan") {
    addStudyPlan();
    return;
  }

  if (action === "toggle-study-plan") {
    const plan = (state.data.studyPlans || []).find(x => x.id === el.dataset.id);
    if (plan) plan.done = !plan.done;
    saveState();
    render();
    return;
  }

  if (action === "edit-study-plan") {
    const plan = (state.data.studyPlans || []).find(x => x.id === el.dataset.id);
    if (plan) addStudyPlan(plan);
    return;
  }

  if (action === "delete-study-plan") {
    state.data.studyPlans = (state.data.studyPlans || []).filter(x => x.id !== el.dataset.id);
    saveState();
    render();
    toast("Planejamento removido.");
    return;
  }

  /* ESTUDOS */

  if (action === "toggle-estudo") {

    const item =
      state.data.estudos.find(
        x =>
          x.id ===
          el.dataset.id
      );

    if (item) {
      item.done = !item.done;
    }

    saveState();
    render();

    return;
  }

  if (action === "edit-estudo") {

    const item =
      state.data.estudos.find(
        x =>
          x.id ===
          el.dataset.id
      );

    if (!item) return;

    openModal(
      "Editar estudo",

      field(
        "Matéria",
        "subject",
        "text",
        item.subject,
        "required"
      ) +

      field(
        "Assunto",
        "topic",
        "text",
        item.topic || ""
      ) +

      field(
        "Data",
        "date",
        "date",
        item.date || todayISO()
      ) +

      field(
        "Horário",
        "time",
        "time",
        item.time || ""
      ) +

      field(
        "Tempo planejado (min)",
        "duration",
        "number",
        item.duration || "",
        "min=\"0\""
      ) +

      field(
        "Tempo realizado (min)",
        "effectiveDuration",
        "number",
        item.effectiveDuration || "",
        "min=\"0\""
      ) +

      textareaField(
        "Bloco de anotações",
        "notes",
        item.notes || "",
        'class="notes-box" placeholder="Anote de onde parou e informações importantes sobre o assunto."'
      ) +

      field(
        "Link da bibliografia",
        "link",
        "url",
        item.link || ""
      ),

      {
        submit: "Salvar"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      Object.assign(
        item,
        {
          subject:
            f.get("subject"),
          topic:
            f.get("topic"),
          date:
            f.get("date") || todayISO(),
          time:
            f.get("time") || "",
          duration:
            f.get("duration"),
          effectiveDuration:
            f.get("effectiveDuration") || "",
          notes:
            f.get("notes"),
          link:
            f.get("link")
        }
      );

      saveState();
      closeModal();
      render();

      toast(
        "Estudo atualizado."
      );
    };

    return;
  }

  /* TREINOS */

  if (action === "add-exercicio") {

    addExerciseForm(
      el.dataset.id
    );

    return;
  }

  if (action === "animate-exercicio") {

    animateExercise(
      el.dataset.id
    );

    return;
  }

  if (action === "edit-exercicio") {

    const treino =
      state.data.treinos.find(
        x =>
          x.id ===
          el.dataset.treinoId
      );

    const exercise =
      treino?.exercises?.find(
        x =>
          x.id ===
          el.dataset.id
      );

    if (treino && exercise) {
      addExerciseForm(
        treino.id,
        exercise
      );
    }

    return;
  }

  if (action === "delete-exercicio") {

    const treino =
      state.data.treinos.find(
        x =>
          x.id ===
          el.dataset.treinoId
      );

    if (!treino) return;

    treino.exercises =
      (treino.exercises || [])
        .filter(
          x =>
            x.id !==
            el.dataset.id
        );

    saveState();
    render();

    toast(
      "Exercício removido."
    );

    return;
  }

  /* HIDRATAÇÃO */

  if (action === "quick-water") {

    state.data.hidratacao.push({
      id: uid("h"),
      amount:
        Number(
          el.dataset.value
        ),
      date:
        todayISO(),
      createdAt:
        new Date().toISOString()
    });

    saveState();
    render();

    toast(
      `+${el.dataset.value} ml registrados.`
    );

    return;
  }

  if (action === "config-hidratacao") {

    configHidratacao();
    return;
  }

  if (action === "reset-hidratacao") {

    if (
      confirm(
        "Limpar todos os registros de hidratação?"
      )
    ) {

      state.data.hidratacao =
        state.data.hidratacao.filter(
          x =>
            x.date !==
            todayISO()
        );

      saveState();
      render();

      toast(
        "Registros de hoje limpos."
      );
    }

    return;
  }

  /* ALIMENTAÇÃO */

  if (action === "food-catalog") { openFoodCatalog(); return; }

  if (action === "add-alimentacao") {

    addMealForm();
    return;
  }

  if (action === "edit-refeicao") {

    const meal =
      state.data.alimentacao.find(
        x =>
          x.id ===
          el.dataset.id
      );

    if (meal) {
      addMealForm(meal);
    }

    return;
  }

  if (action === "delete-refeicao") {

    removeItem(
      "alimentacao",
      el.dataset.id,
      "Refeição removida."
    );

    return;
  }

  if (action === "config-calorias") {

    configCalorias();
    return;
  }

  if (action === "add-dieta") {

    addDietForm();
    return;
  }

  if (action === "dieta-para-compras") {

    createShoppingListFromDiet();
    return;
  }

  /* FINANÇAS */
  if (action === "edit-financa") { const item=state.data.financas.find(x=>x.id===el.dataset.id); if(!item)return; openFinanceEditModal(item); return; }
  if (action === "finance-monthly-report") { financeMonthlyReport(); return; }
  if (action === "finance-history") { financeHistory(); return; }
  if (action === "report-bug") { openModal("Informar bug",textareaField("Descreva o problema","bug","",'required placeholder="O que aconteceu? Em qual tela?"'),{submit:"Preparar e-mail"}); modal.querySelector("#lidire-form").onsubmit=e=>{e.preventDefault();const msg=new FormData(e.target).get("bug")||"";window.location.href=`mailto:?subject=${encodeURIComponent("Bug LiDire")}&body=${encodeURIComponent("Bug LiDire\n\n"+msg)}`;closeModal();};return; }
  if (action === "support-email") { window.location.href="mailto:?subject=Contato%20com%20a%20LiDire"; return; }

  if (action === "finance-zero-month") {
    const month = currentFinanceMonth();
    if (confirm("Zerar os lançamentos deste mês na visão atual? O histórico continuará armazenado e poderá ser consultado em Histórico.")) {
      if (!state.settings.financeMonthResets) state.settings.financeMonthResets = {};
      state.settings.financeMonthResets[month] = new Date().toISOString();
      saveState(); render(); toast("Mês zerado. O histórico foi preservado.");
    }
    return;
  }

  if (action === "config-tetos") {

    configFinanceLimits();
    return;
  }

  /* OBJETIVOS */

  if (action === "add-meta") {

    addMeta(
      el.dataset.id
    );

    return;
  }

  if (action === "toggle-meta") {

    const goal =
      state.data.objetivos.find(
        x =>
          x.id ===
          el.dataset.goalId
      );

    if (!goal) return;

    const meta =
      (goal.metas || []).find(
        x =>
          x.id ===
          el.dataset.id
      );

    if (!meta) return;

    meta.done =
      !meta.done;
    updateGoalProgress(goal);

    saveState();
    render();

    return;
  }

  if (action === "progress-objetivo") {

    const item =
      state.data.objetivos.find(
        x =>
          x.id ===
          el.dataset.id
      );

    if (!item) return;

    openModal(
      "Atualizar progresso",

      field(
        "Progresso (%)",
        "progress",
        "number",
        item.progress || 0,
        'min="0" max="100" required'
      ),

      {
        submit: "Atualizar"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      item.progress =
        Number(
          f.get("progress")
        );

      saveState();
      closeModal();
      render();

      toast(
        "Progresso atualizado."
      );
    };

    return;
  }

  if (action === "delete-objetivo") {
    confirmDeleteGoal(el.dataset.id);
    return;
  }

  if (action === "confirm-delete-objetivo") {
    const item = state.data.objetivos.find(x => x.id === el.dataset.id);
    if (!item) { closeModal(); return; }
    state.data.objetivos = state.data.objetivos.filter(x => x.id !== item.id);
    saveState();
    closeModal();
    render();
    toast("Objetivo removido.");
    return;
  }

  if (action === "cancel-delete-objetivo") {
    closeModal();
    return;
  }

  if (action === "edit-objetivo") {

    const item =
      state.data.objetivos.find(
        x =>
          x.id ===
          el.dataset.id
      );

    if (item) {
      openGoalForm(item);
    }

    return;
  }

  /* FAMÍLIA */

  if (action === "edit-familia") {
    const person = state.data.familia.find(x => x.id === el.dataset.id);
    if (!person) return;
    openModal(
      "Editar pessoa",
      field("Nome", "name", "text", person.name || "", "required") +
      field("Relação", "relation", "text", person.relation || "") +
      field("E-mail", "email", "email", person.email || ""),
      { submit: "Salvar alterações" }
    );
    modal.querySelector("#lidire-form").onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      person.name = String(f.get("name") || "").trim();
      person.relation = String(f.get("relation") || "").trim();
      person.email = String(f.get("email") || "").trim();
      if (!person.name) { toast("Informe o nome.", "error"); return; }
      saveState(); closeModal(); render(); toast("Pessoa atualizada.");
    };
    return;
  }

  /* CICLO MENSTRUAL */

  if (action === "config-ciclo") {
    configCicloMenstrual();
    return;
  }

  if (action === "add-periodo-ciclo") {
    addPeriodoCiclo();
    return;
  }

  if (action === "add-sintoma-ciclo") {
    addSintomaCiclo();
    return;
  }

  if (action === "delete-sintoma-ciclo") {
    if (!confirm("Excluir este registro do ciclo?")) return;
    state.data.cicloMenstrual.sintomas = state.data.cicloMenstrual.sintomas.filter(x => x.id !== el.dataset.id);
    saveState();
    render();
    toast("Registro removido.");
    return;
  }

  if (action === "toggle-cycle-ai") {
    state.settings.cycleAiContext = !!el.checked;
    saveState();
    toast(el.checked ? "Uso do ciclo pela IA autorizado." : "Uso do ciclo pela IA desativado.");
    return;
  }

  /* ASSISTENTE */

  if (action === "assistant-question") {
    answerAssistant(el.dataset.question || "", false);
    return;
  }

  /* PERFIL */

  if (
    action ===
    "edit-profile"
  ) {

    openModal(
      "Editar perfil",

      field(
        "Nome",
        "name",
        "text",
        state.user.name,
        "required"
      ) +

      field(
        "E-mail",
        "email",
        "email",
        state.user.email || ""
      ) +

      field(
        "Idade",
        "age",
        "number",
        state.user.age || ""
      ) +

      field(
        "Telefone",
        "phone",
        "tel",
        state.user.phone || ""
      ) +

      field(
        "Endereço",
        "address",
        "text",
        state.user.address || ""
      ),

      {
        submit: "Salvar perfil"
      }
    );

    modal.querySelector(
      "#lidire-form"
    ).onsubmit = async e => {

      e.preventDefault();

      const f =
        new FormData(e.target);

      const profileData = Object.fromEntries(f.entries());

      try {
        const response = await apiRequest("/api/profile", {
          method: "PUT",
          body: JSON.stringify(profileData)
        });
        if (response.user) syncUserToState(response.user);
        else {
          state.user = { ...state.user, ...profileData };
          saveState();
        }
        closeModal();
        render();
        toast("Perfil atualizado.");
      } catch (error) {
        state.user = { ...state.user, ...profileData };
        saveState();
        closeModal();
        render();
        toast(error.message || "Perfil atualizado localmente.");
      }
    };

    return;
  }

  if (
    action === "profile-photo" ||
    action === "photo-profile"
  ) {

    profilePhotoModal();
    return;
  }

  if (action === "delete-profile-photo") {
    if (confirm("Excluir sua foto de perfil?")) {
      state.user.photo = "";
      saveState();
      apiRequest("/api/profile", { method: "PUT", body: JSON.stringify({name: state.user.name, email: state.user.email, age: state.user.age, phone: state.user.phone, address: state.user.address, profile_photo: ""}) })
        .then(response => { if (response.user) syncUserToState(response.user); })
        .catch(error => toast(error.message || "Não foi possível remover a foto do servidor.", "error"))
        .finally(() => { closeModal(); render(); });
      toast("Foto de perfil excluída.");
    }
    return;
  }

  /* EXCLUSÕES */

  const deletes = {
    "delete-compromisso": [
      "compromissos",
      "Compromisso removido."
    ],

    "delete-tarefa": [
      "tarefas",
      "Tarefa removida."
    ],

    "delete-estudo": [
      "estudos",
      "Registro removido."
    ],

    "delete-treino": [
      "treinos",
      "Treino removido."
    ],

    "delete-hidratacao": [
      "hidratacao",
      "Registro removido."
    ],

    "delete-financa": [
      "financas",
      "Lançamento removido."
    ],

    "delete-familia": [
      "familia",
      "Pessoa removida."
    ]
  };

  if (deletes[action]) {

    removeItem(
      deletes[action][0],
      el.dataset.id,
      deletes[action][1]
    );

    return;
  }

  /* RESET */

  if (
    action ===
    "clear-local"
  ) {

    if (
      confirm(
        "Isso apagará os dados salvos neste dispositivo. Continuar?"
      )
    ) {

      state =
        clone(defaultState);

      saveState();

      currentPage =
        "inicio";

      currentShoppingList =
        null;

      render();

      toast(
        "Dados locais redefinidos."
      );
    }
  }
}

/* =========================================================
   EVENTOS
   ========================================================= */

document.addEventListener("submit", event => {
  if (event.target && event.target.id === "auth-form") {
    event.preventDefault();
    submitAuth(event.target);
    return;
  }
  if (event.target && event.target.id === "assistant-question-form") {
    event.preventDefault();
    const input = document.getElementById("assistant-question-input");
    answerAssistant(input?.value || "", false);
  }
});

document.addEventListener(
  "click",
  event => {

    const pageEl =
      event.target.closest(
        "[data-page]"
      );

    if (pageEl) {

      event.preventDefault();

      navigateTo(pageEl.dataset.page);

      return;
    }

    const actionEl =
      event.target.closest(
        "[data-action]"
      );

    if (actionEl) {

      event.preventDefault();

      handleAction(
        actionEl.dataset.action,
        actionEl
      );
    }
  }
);

document.addEventListener(
  "click",
  event => {

    if (
      event.target.classList.contains(
        "modal-backdrop"
      )
    ) {
      closeModal();
    }
  }
);

window.addEventListener("popstate", event => {
  const page = event.state?.page || (location.hash ? decodeURIComponent(location.hash.slice(1)) : "inicio");
  currentPage = pages[page] ? page : "inicio";
  currentShoppingList = null;
  render();
});

/* =========================================================
   API PÚBLICA DA LIDIRE
   ========================================================= */

window.LiDire = {

  state: () => state,

  save: saveState,

  go: page => {

    navigateTo(page);
  },

  reset: () => {

    if (
      confirm(
        "Redefinir todos os dados da LiDire?"
      )
    ) {

      state =
        clone(defaultState);

      saveState();

      currentPage =
        "inicio";

      render();
    }
  }

};

/* =========================================================
   PROTEÇÃO CONTRA ERROS DE INICIALIZAÇÃO
   ========================================================= */

window.addEventListener("error", event => {
  console.error("Erro na LiDire:", event.error || event.message);
  const root = document.getElementById("app");
  if (root && !root.innerHTML.trim()) {
    root.innerHTML = `
      <div class="auth-screen">
        <section class="auth-card">
          <div class="auth-brand"><strong>LiDire</strong></div>
          <h1 class="auth-title">Não foi possível carregar a LiDire.</h1>
          <p class="auth-subtitle">Atualize a página. Se o problema continuar, envie esta tela para análise.</p>
          <button class="primary-button" onclick="location.reload()">Atualizar página</button>
        </section>
      </div>`;
  }
});

window.addEventListener("unhandledrejection", event => {
  console.error("Erro assíncrono na LiDire:", event.reason);
});

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */


document.addEventListener(
  "DOMContentLoaded",
  () => {

    injectLiDireStyles();
    if (!history.state?.lidire) history.replaceState({ page: currentPage, lidire: true }, "", "#inicio");
    initAuth();

  }
);
