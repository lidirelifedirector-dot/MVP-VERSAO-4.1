const SESSION_COOKIE = "lidire_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 100000;
const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        console.error("LiDire API error:", error);
        return Response.json(
          {
            error: "internal_error",
            message: "Não foi possível concluir a solicitação."
          },
          { status: 500 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleApi(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return Response.json({
      ok: true,
      app: "LiDire MVP 4.1",
      database: !!env.DB
    });
  }

  if (!env.DB) {
    return Response.json(
      { error: "database_unavailable", message: "Banco D1 não configurado." },
      { status: 503 }
    );
  }

  if (url.pathname === "/api/register" && request.method === "POST") {
    return register(request, env);
  }

  if (url.pathname === "/api/login" && request.method === "POST") {
    return login(request, env);
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    return logout(request, env);
  }

  if (url.pathname === "/api/me" && request.method === "GET") {
    const user = await getSessionUser(request, env);
    return Response.json({ user, database: true });
  }

  if (url.pathname === "/api/profile" && request.method === "GET") {
    const user = await getSessionUser(request, env);
    return Response.json({ user, database: true });
  }

  if (url.pathname === "/api/profile" && request.method === "PUT") {
    return updateProfile(request, env);
  }

  if (url.pathname === "/api/password-reset/request" && request.method === "POST") {
    return requestPasswordReset(request, env);
  }

  if (url.pathname === "/api/password-reset/complete" && request.method === "POST") {
    return completePasswordReset(request, env);
  }

  if (url.pathname === "/api/account" && request.method === "DELETE") {
    return deleteAccount(request, env);
  }

  return Response.json(
    {
      error: "not_found",
      message: "Endpoint não implementado.",
      path: url.pathname
    },
    { status: 404 }
  );
}

async function ensureAuthTables(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user
    ON user_sessions(user_id)
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expires
    ON user_sessions(expires_at)
  `).run();
}

async function register(request, env) {
  const body = await readJson(request);
  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (name.length < 2) {
    return Response.json(
      { error: "invalid_name", message: "Informe seu nome." },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return Response.json(
      { error: "invalid_email", message: "Informe um e-mail válido." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return Response.json(
      { error: "weak_password", message: "A senha precisa ter pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  if (!body.legalAccepted) {
    return Response.json(
      { error: "legal_required", message: "O aceite dos documentos legais é necessário para criar a conta." },
      { status: 400 }
    );
  }

  await ensureAuthTables(env.DB);

  const existing = await env.DB
    .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
    .bind(email)
    .first();

  if (existing) {
    return Response.json(
      { error: "email_exists", message: "Já existe uma conta com este e-mail." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    // O D1 atual usa users + profiles com o perfil separado do usuário.
    // Mantemos o cadastro mínimo e seguro aqui; configurações adicionais
    // serão inicializadas quando seus módulos forem conectados.
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(userId, email, passwordHash, name, now, now),

      env.DB.prepare(`
        INSERT INTO profiles (
          user_id, name, email, age, phone, address, profile_photo, currency, created_at, updated_at
        )
        VALUES (?, ?, ?, NULL, NULL, NULL, NULL, 'BRL', ?, ?)
      `).bind(userId, name, email, now, now)
    ]);

    // Se a tabela de aceite jurídico existir, registra o aceite.
    // O cadastro não é bloqueado por tabelas opcionais de módulos ainda não conectados.
    try {
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO legal_acceptances (id, user_id, document_type, document_version, accepted_at)
          VALUES (?, ?, 'terms_of_use', '1.0', ?)
        `).bind(crypto.randomUUID(), userId, now),
        env.DB.prepare(`
          INSERT INTO legal_acceptances (id, user_id, document_type, document_version, accepted_at)
          VALUES (?, ?, 'privacy_policy', '1.0', ?)
        `).bind(crypto.randomUUID(), userId, now)
      ]);
    } catch (legalError) {
      console.warn("Registro de aceite jurídico não disponível nesta versão:", legalError);
    }
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      return Response.json(
        { error: "email_exists", message: "Já existe uma conta com este e-mail." },
        { status: 409 }
      );
    }
    throw error;
  }

  const session = await createSession(env.DB, userId);

  return Response.json(
    {
      ok: true,
      user: await getUserById(env.DB, userId)
    },
    {
      headers: {
        "Set-Cookie": session.cookie
      }
    }
  );
}

async function login(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!isValidEmail(email) || password.length < 8) {
    return Response.json(
      { error: "invalid_credentials", message: "E-mail ou senha inválidos." },
      { status: 401 }
    );
  }

  await ensureAuthTables(env.DB);

  const user = await env.DB
    .prepare(`
      SELECT id, email, password_hash, name
      FROM users
      WHERE email = ?
      LIMIT 1
    `)
    .bind(email)
    .first();

  if (!user || !user.password_hash) {
    return Response.json(
      { error: "invalid_credentials", message: "E-mail ou senha inválidos." },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    return Response.json(
      { error: "invalid_credentials", message: "E-mail ou senha inválidos." },
      { status: 401 }
    );
  }

  const session = await createSession(env.DB, user.id);

  return Response.json(
    {
      ok: true,
      user: await getUserById(env.DB, user.id)
    },
    {
      headers: {
        "Set-Cookie": session.cookie
      }
    }
  );
}

async function logout(request, env) {
  const token = getCookie(request, SESSION_COOKIE);

  if (token) {
    await ensureAuthTables(env.DB);
    const tokenHash = await sha256(token);
    await env.DB
      .prepare("DELETE FROM user_sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
      }
    }
  );
}


async function ensurePasswordResetTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at)`).run();
}

async function requestPasswordReset(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return Response.json({ ok: true, message: "Se houver uma conta com esse e-mail, as instruções de recuperação serão enviadas." });
  }

  await ensurePasswordResetTable(env.DB);
  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first();

  // Resposta deliberadamente genérica para não revelar se um e-mail possui conta.
  if (!user) {
    return Response.json({ ok: true, message: "Se houver uma conta com esse e-mail, as instruções de recuperação serão enviadas." });
  }

  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = bytesToBase64Url(tokenBytes);
  const tokenHash = await sha256(token);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= CURRENT_TIMESTAMP").bind(user.id).run();
  await env.DB.prepare(`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(id, user.id, tokenHash, expiresAt).run();

  // O token fica somente no servidor até um provedor de e-mail ser conectado.
  // Nunca o devolvemos ao navegador para evitar um fluxo inseguro de recuperação.
  return Response.json({ ok: true, message: "Se houver uma conta com esse e-mail, as instruções de recuperação serão enviadas." });
}

async function completePasswordReset(request, env) {
  const body = await readJson(request);
  const token = String(body.token || "");
  const password = String(body.password || "");
  if (!token || password.length < 8) {
    return Response.json({ error: "invalid_reset", message: "Token ou senha inválidos." }, { status: 400 });
  }

  await ensurePasswordResetTable(env.DB);
  const tokenHash = await sha256(token);
  const reset = await env.DB.prepare(`
    SELECT id, user_id, expires_at, used_at
    FROM password_reset_tokens
    WHERE token_hash = ? LIMIT 1
  `).bind(tokenHash).first();

  if (!reset || reset.used_at || new Date(reset.expires_at).getTime() <= Date.now()) {
    return Response.json({ error: "invalid_reset", message: "O link de recuperação é inválido ou expirou." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").bind(passwordHash, now, reset.user_id),
    env.DB.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?").bind(now, reset.id),
    env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(reset.user_id)
  ]);

  return Response.json({ ok: true, message: "Senha redefinida com sucesso. Entre novamente na sua conta." });
}

async function updateProfile(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) {
    return Response.json(
      { error: "unauthorized", message: "Sua sessão expirou. Entre novamente." },
      { status: 401 }
    );
  }

  const body = await readJson(request);
  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email || user.email);
  const age = body.age == null || body.age === "" ? null : Number(body.age);
  const phone = String(body.phone || "").trim();
  const address = String(body.address || "").trim();
  const profilePhoto = body.profile_photo == null ? null : String(body.profile_photo || "");

  if (name.length < 2) {
    return Response.json(
      { error: "invalid_name", message: "Informe seu nome." },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return Response.json(
      { error: "invalid_email", message: "Informe um e-mail válido." },
      { status: 400 }
    );
  }

  if (age !== null && (!Number.isFinite(age) || age < 0 || age > 150)) {
    return Response.json(
      { error: "invalid_age", message: "Informe uma idade válida." },
      { status: 400 }
    );
  }

  const existing = await env.DB
    .prepare("SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1")
    .bind(email, user.id)
    .first();

  if (existing) {
    return Response.json(
      { error: "email_exists", message: "Já existe uma conta com este e-mail." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?")
      .bind(name, email, now, user.id),
    env.DB.prepare(`
      UPDATE profiles
      SET name = ?, email = ?, age = ?, phone = ?, address = ?, profile_photo = COALESCE(?, profile_photo), updated_at = ?
      WHERE user_id = ?
    `).bind(name, email, age, phone, address, profilePhoto, now, user.id)
  ]);

  return Response.json({ ok: true, user: await getUserById(env.DB, user.id), database: true });
}


async function deleteAccount(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) {
    return Response.json({ error: "unauthorized", message: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const userId = user.id;
  const tables = await env.DB.prepare(`
    SELECT name, sql FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      AND (sql LIKE '%user_id%' OR sql LIKE '%owner_user_id%')
  `).all();

  const statements = [];

  // Child records that reference family_groups through group_id.
  try {
    const family = await env.DB.prepare(`SELECT id FROM family_groups WHERE owner_user_id = ?`).bind(userId).all();
    for (const row of (family.results || [])) {
      statements.push(env.DB.prepare(`DELETE FROM family_members WHERE group_id = ?`).bind(row.id));
    }
    if ((family.results || []).length) {
      statements.push(env.DB.prepare(`DELETE FROM family_groups WHERE owner_user_id = ?`).bind(userId));
    }
  } catch (_) {}

  for (const table of (tables.results || [])) {
    const name = String(table.name || "");
    if (!name || ["users", "user_sessions"].includes(name) || name === "family_groups" || name === "family_members") continue;
    const sql = String(table.sql || "");
    if (/\buser_id\b/i.test(sql)) {
      statements.push(env.DB.prepare(`DELETE FROM "${name.replaceAll('"','""')}" WHERE user_id = ?`).bind(userId));
    } else if (/\bowner_user_id\b/i.test(sql)) {
      statements.push(env.DB.prepare(`DELETE FROM "${name.replaceAll('"','""')}" WHERE owner_user_id = ?`).bind(userId));
    }
  }

  statements.push(env.DB.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId));
  statements.push(env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(userId));
  statements.push(env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId));

  await env.DB.batch(statements);

  return new Response(JSON.stringify({ ok: true, message: "Conta e dados excluídos." }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    }
  });
}

async function getSessionUser(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;

  await ensureAuthTables(env.DB);

  const tokenHash = await sha256(token);
  const session = await env.DB
    .prepare(`
      SELECT
        s.user_id,
        s.expires_at,
        u.id,
        u.name,
        u.email
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
      LIMIT 1
    `)
    .bind(tokenHash)
    .first();

  if (!session) return null;

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await env.DB
      .prepare("DELETE FROM user_sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
    return null;
  }

  await env.DB
    .prepare("UPDATE user_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?")
    .bind(tokenHash)
    .run();

  return getUserById(env.DB, session.user_id);
}

async function getUserById(db, userId) {
  return db.prepare(`
    SELECT
      u.id,
      u.name,
      u.email,
      p.age,
      p.phone,
      p.address,
      p.profile_photo AS profile_photo
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `).bind(userId).first();
}

async function createSession(db, userId) {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = bytesToBase64Url(tokenBytes);
  const tokenHash = await sha256(token);

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();

  await db.prepare(`
    INSERT INTO user_sessions (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(sessionId, userId, tokenHash, expiresAt).run();

  return {
    token,
    cookie: `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`
  };
}

async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PASSWORD_ITERATIONS,
      hash: "SHA-256"
    },
    key,
    256
  );

  return [
    "pbkdf2",
    PASSWORD_ITERATIONS,
    bytesToBase64Url(salt),
    bytesToBase64Url(new Uint8Array(bits))
  ].join("$");
}

async function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  const salt = base64UrlToBytes(parts[2]);
  const expected = base64UrlToBytes(parts[3]);

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    key,
    expected.length * 8
  );

  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual[i] ^ expected[i];
  }
  return diff === 0;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(value)
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [key, ...parts] = cookie.trim().split("=");
    if (key === name) {
      return parts.join("=");
    }
  }

  return null;
}
