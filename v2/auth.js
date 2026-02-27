import { db } from './db.js';

const SESSION_KEY = 'hackmaster_session';

export function localHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

export async function register(userData) {
    const { email, password, name, role } = userData;

    // Check if user already exists
    const existing = await db.findDocument('users', 'email', email);
    if (existing) throw new Error('Email already registered');

    const newUser = {
        uid: Date.now().toString(36),
        name,
        email,
        role,
        passwordHash: localHash(password),
        createdAt: new Date().toISOString()
    };

    await db.addDocument('users', newUser);

    // Auto-login
    return await login(email, password);
}

export async function login(email, password) {
    const user = await db.findDocument('users', 'email', email);
    if (!user) throw new Error('User not found');

    const hash = localHash(password);
    if (user.passwordHash !== hash) throw new Error('Invalid password');

    // Create session
    const session = {
        uid: user.uid,
        name: user.name,
        role: user.role,
        email: user.email,
        timestamp: Date.now()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
}

export function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = '../login.html';
}

export function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
}

export function requireAuth(allowedRoles = []) {
    const session = getSession();
    if (!session) {
        window.location.href = '../login.html';
        return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
        window.location.href = '../dashboards/unauthorized.html';
        return null;
    }

    return session;
}
