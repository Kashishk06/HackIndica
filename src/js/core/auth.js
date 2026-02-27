/**
 * auth.js  – JSON/localStorage backend (replaces Firebase Auth)
 *
 * Session is stored in sessionStorage under key "HackIndica_session":
 *   { uid, email, role, name, organization, phone }
 *
 * Passwords are stored as plain strings in localStorage (for demo purposes).
 * In production you would hash them server-side.
 */

import { db, generateId, FieldValue } from "./db.js";
import { showToast, validateEmail, validatePhone } from "./utils.js";

const SESSION_KEY = "HackIndica_session";
const OTP_KEY = "HackIndica_otp";

// ── Simple "hash" (NOT secure – demo only) ────────────────────────────────────
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ── OTP helpers ───────────────────────────────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function saveOTP(email, otp) {
  const expires = Date.now() + 10 * 60 * 1000; // 10 min
  sessionStorage.setItem(OTP_KEY, JSON.stringify({ email, otp, expires }));
}

function getStoredOTP() {
  try {
    const raw = sessionStorage.getItem(OTP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearOTP() {
  sessionStorage.removeItem(OTP_KEY);
}

// ── Session helpers ───────────────────────────────────────────────────────────
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(userData) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ── AuthManager class ─────────────────────────────────────────────────────────
class AuthManager {
  constructor() {
    this.currentUser = getSession();
    this._listeners = [];

    // Dispatch to any registered listeners
    setTimeout(() => {
      this._listeners.forEach((fn) => fn(this.currentUser));
    }, 0);
  }

  // Emulate onAuthStateChanged
  onAuthStateChanged(callback) {
    this._listeners.push(callback);
    callback(this.currentUser);
  }

  // ── Send OTP (simulated – shows in toasts & console) ─────────────────────
  async sendOTP(email) {
    try {
      if (!validateEmail(email)) throw new Error("Invalid email format");

      // Check user exists (for login flow)
      const query = await db
        .collection("users")
        .where("email", "==", email)
        .get();
      if (query.empty && window.location.pathname.includes("login")) {
        throw new Error("No account found with this email");
      }

      const otp = generateOTP();
      saveOTP(email, otp);

      // In a real app you'd call a server endpoint to send the email.
      // For demo, show the OTP in a toast and console.
      console.log(`[DEV] OTP for ${email}: ${otp}`);
      showToast(`OTP sent! (Demo: ${otp})`, "success");
      return true;
    } catch (error) {
      showToast(error.message, "error");
      return false;
    }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  async verifyOTP(email, otp) {
    try {
      const stored = getStoredOTP();
      if (!stored) throw new Error("No OTP found. Please request a new one.");
      if (Date.now() > stored.expires) {
        clearOTP();
        throw new Error("OTP expired. Please request a new one.");
      }
      if (stored.email !== email || stored.otp !== otp) {
        throw new Error("Invalid OTP");
      }

      clearOTP();

      // Get user data
      const query = await db
        .collection("users")
        .where("email", "==", email)
        .get();
      if (query.empty) throw new Error("User not found");

      const doc = query.docs[0];
      const userData = { uid: doc.id, ...doc.data() };
      setSession(userData);
      this.currentUser = userData;
      this._listeners.forEach((fn) => fn(userData));

      showToast("Login successful!", "success");
      return userData;
    } catch (error) {
      showToast(error.message, "error");
      return null;
    }
  }

  // ── Email + Password login ────────────────────────────────────────────────
  async login(email, password) {
    try {
      if (!validateEmail(email)) throw new Error("Invalid email format");
      if (!password) throw new Error("Password is required");

      const query = await db
        .collection("users")
        .where("email", "==", email)
        .get();
      if (query.empty) throw new Error("No account found with this email");

      const doc = query.docs[0];
      const user = doc.data();

      if (user.passwordHash !== simpleHash(password)) {
        throw new Error("Incorrect password");
      }

      const userData = { uid: doc.id, ...user };
      setSession(userData);
      this.currentUser = userData;
      this._listeners.forEach((fn) => fn(userData));

      showToast("Login successful!", "success");
      return userData;
    } catch (error) {
      showToast(error.message, "error");
      return null;
    }
  }

  // ── Register ──────────────────────────────────────────────────────────────
  async register(userData) {
    try {
      if (!validateEmail(userData.email))
        throw new Error("Invalid email format");
      if (!validatePhone(userData.phone))
        throw new Error("Invalid phone number");
      if (!userData.password || userData.password.length < 6)
        throw new Error("Password must be at least 6 characters");

      // Duplicate check
      const existing = await db
        .collection("users")
        .where("email", "==", userData.email)
        .get();
      if (!existing.empty) {
        const existingRole = existing.docs[0].data().role;
        if (existingRole !== userData.role) {
          throw new Error(`Email already registered as ${existingRole}`);
        }
        throw new Error("Email already registered");
      }

      const uid = generateId();
      const userDataFull = {
        uid,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        organization: userData.organization || "",
        phone: userData.phone,
      };

      await db
        .collection("users")
        .doc(uid)
        .set({
          ...userDataFull,
          passwordHash: simpleHash(userData.password),
          createdAt: new Date().toISOString(),
          isActive: true,
        });

      setSession(userDataFull);
      this.currentUser = userDataFull;
      this._listeners.forEach((fn) => fn(userDataFull));

      showToast("Registration successful! Welcome.", "success");
      return userDataFull;
    } catch (error) {
      showToast(error.message, "error");
      return null;
    }
  }

  // ── Get user role ─────────────────────────────────────────────────────────
  async getUserRole(userId) {
    try {
      const doc = await db.collection("users").doc(userId).get();
      return doc.exists ? doc.data().role : null;
    } catch (error) {
      console.error("Error getting user role:", error);
      return null;
    }
  }

  // ── Redirect based on role ────────────────────────────────────────────────
  redirectToDashboard(role) {
    const map = {
      organizer: "../dashboard/organizer-dashboard.html",
      participant: "../dashboard/participant-dashboard.html",
      judge: "../dashboard/judge-dashboard.html",
      superadmin: "../dashboard/superadmin-dashboard.html",
    };
    window.location.href = map[role] || "../../../index.html";
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  logout() {
    clearSession();
    this.currentUser = null;
    this._listeners.forEach((fn) => fn(null));
    showToast("Logged out successfully", "success");
    // Standard relative route map back out to root index
    if (window.location.pathname.includes("dashboard")) {
      window.location.href = "../../../index.html";
    } else {
      window.location.href = "../../index.html";
    }
  }
}

const authManager = new AuthManager();
export default authManager;
