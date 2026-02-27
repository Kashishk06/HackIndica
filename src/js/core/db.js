/**
 * JSON Backend - localStorage-based database replacing Firebase Firestore.
 * Provides a Firestore-like API:  db.collection(name).add/set/get/where/orderBy/limit etc.
 */

const DB_PREFIX = "hackmaster_";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getCollection(name) {
  try {
    const raw = localStorage.getItem(DB_PREFIX + name);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCollection(name, data) {
  localStorage.setItem(DB_PREFIX + name, JSON.stringify(data));
}

// ── Query builder ────────────────────────────────────────────────────────────
class Query {
  constructor(collectionName, docs) {
    this._name = collectionName;
    this._docs = docs; // array of { id, data }
  }

  where(field, op, value) {
    const filtered = this._docs.filter(({ data }) => {
      const fieldValue = field
        .split(".")
        .reduce((obj, key) => obj?.[key], data);
      switch (op) {
        case "==":
          return fieldValue === value;
        case "!=":
          return fieldValue !== value;
        case "<":
          return fieldValue < value;
        case "<=":
          return fieldValue <= value;
        case ">":
          return fieldValue > value;
        case ">=":
          return fieldValue >= value;
        case "array-contains":
          return Array.isArray(fieldValue) && fieldValue.includes(value);
        default:
          return false;
      }
    });
    return new Query(this._name, filtered);
  }

  orderBy(field, direction = "asc") {
    const sorted = [...this._docs].sort((a, b) => {
      const av = field.split(".").reduce((o, k) => o?.[k], a.data);
      const bv = field.split(".").reduce((o, k) => o?.[k], b.data);
      if (av === undefined && bv === undefined) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      if (av < bv) return direction === "asc" ? -1 : 1;
      if (av > bv) return direction === "asc" ? 1 : -1;
      return 0;
    });
    return new Query(this._name, sorted);
  }

  limit(n) {
    return new Query(this._name, this._docs.slice(0, n));
  }

  async get() {
    return new QuerySnapshot(this._name, this._docs);
  }
}

// ── Snapshot classes ─────────────────────────────────────────────────────────
class QuerySnapshot {
  constructor(collectionName, docs) {
    this._name = collectionName;
    this.docs = docs.map((d) => new DocumentSnapshot(d.id, d.data));
    this.size = this.docs.length;
    this.empty = this.docs.length === 0;
  }

  forEach(cb) {
    this.docs.forEach(cb);
  }
}

class DocumentSnapshot {
  constructor(id, data) {
    this.id = id;
    this._data = data;
    this.exists = data !== null && data !== undefined;
  }
  data() {
    return this._data;
  }
}

// ── Document reference ───────────────────────────────────────────────────────
class DocumentRef {
  constructor(collectionName, id) {
    this._name = collectionName;
    this.id = id;
  }

  async get() {
    const col = getCollection(this._name);
    return new DocumentSnapshot(this.id, col[this.id] ?? null);
  }

  async set(data) {
    const col = getCollection(this._name);
    col[this.id] = { ...data };
    saveCollection(this._name, col);
    return { id: this.id };
  }

  async update(data) {
    const col = getCollection(this._name);
    if (!col[this.id]) throw new Error("Document does not exist");
    col[this.id] = { ...col[this.id], ...data };
    saveCollection(this._name, col);
  }

  async delete() {
    const col = getCollection(this._name);
    delete col[this.id];
    saveCollection(this._name, col);
  }
}

// ── Collection reference ─────────────────────────────────────────────────────
class CollectionRef {
  constructor(name) {
    this._name = name;
  }

  doc(id) {
    const docId = id || generateId();
    return new DocumentRef(this._name, docId);
  }

  async add(data) {
    const id = generateId();
    const col = getCollection(this._name);
    col[id] = { ...data };
    saveCollection(this._name, col);
    return { id };
  }

  where(field, op, value) {
    const col = getCollection(this._name);
    const docs = Object.entries(col).map(([id, data]) => ({ id, data }));
    return new Query(this._name, docs).where(field, op, value);
  }

  orderBy(field, direction = "asc") {
    const col = getCollection(this._name);
    const docs = Object.entries(col).map(([id, data]) => ({ id, data }));
    return new Query(this._name, docs).orderBy(field, direction);
  }

  limit(n) {
    const col = getCollection(this._name);
    const docs = Object.entries(col).map(([id, data]) => ({ id, data }));
    return new Query(this._name, docs).limit(n);
  }

  async get() {
    const col = getCollection(this._name);
    const docs = Object.entries(col).map(([id, data]) => ({ id, data }));
    return new QuerySnapshot(this._name, docs);
  }
}

// ── FieldValue helpers ───────────────────────────────────────────────────────
export const FieldValue = {
  serverTimestamp: () => new Date().toISOString(),
  arrayUnion: (...items) => ({ _type: "arrayUnion", items }),
  arrayRemove: (...items) => ({ _type: "arrayRemove", items }),
  increment: (n) => ({ _type: "increment", n }),
};

// ── Timestamp helper ─────────────────────────────────────────────────────────
export const Timestamp = {
  fromDate: (date) => ({
    _isTimestamp: true,
    iso:
      date instanceof Date ? date.toISOString() : new Date(date).toISOString(),
  }),
  now: () => ({ _isTimestamp: true, iso: new Date().toISOString() }),
  // mimics Firestore Timestamp .toDate()
};

// ── Auto-Seeder (Indian Context Data) ───────────────────────────────────────
(function seedDatabase() {
  const hacKeys = Object.keys(getCollection("hackathons"));
  if (hacKeys.length === 0) {
    console.log("[HackMaster] Seeding 10 Indian Hackathons...");

    const hackathons = [
      {
        id: generateId(),
        name: "Smart India Hackathon 2024",
        domain: "open",
        fees: 0,
        location: "New Delhi, Delhi",
        startDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        organizerName: "MoE Innovate",
        contactDetails: "sih@gov.in",
        guidelines: "Nationwide initiative.",
        parameters: [
          { name: "Innovation", maxScore: 30 },
          { name: "Scalability", maxScore: 30 },
          { name: "Tech Stack", maxScore: 40 },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: "Web3 BLR Summit",
        domain: "web3",
        fees: 500,
        location: "Bangalore, Karnataka",
        startDate: new Date(Date.now() + 86400000 * 12).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 14).toISOString(),
        organizerName: "Polygon Guild",
        contactDetails: "blr@polygon.tech",
        guidelines: "Build dApps on Polygon.",
        parameters: [
          { name: "Smart Contract", maxScore: 40 },
          { name: "UI/UX", maxScore: 30 },
          { name: "Utility", maxScore: 30 },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: "AI-ML Healthcare Hack",
        domain: "ai-ml",
        fees: 0,
        location: "Mumbai, Maharashtra",
        startDate: new Date(Date.now() + 86400000 * 20).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 22).toISOString(),
        organizerName: "Tata MedTech",
        contactDetails: "healthhack@tata.com",
        guidelines: "Solve rural healthcare issues using AI.",
        parameters: [
          { name: "AI Accuracy", maxScore: 50 },
          { name: "Practicality", maxScore: 50 },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: "FinHack Mumbai",
        domain: "open",
        fees: 250,
        location: "BSE Dalal Street, Mumbai",
        startDate: new Date(Date.now() - 86400000 * 10).toISOString(), // Ended
        endDate: new Date(Date.now() - 86400000 * 8).toISOString(),
        organizerName: "FinTech India",
        contactDetails: "finhack@bse.in",
        guidelines: "Next-gen payment solutions.",
        parameters: [
          { name: "Security", maxScore: 40 },
          { name: "Innovation", maxScore: 60 },
        ],
        createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
      },
      {
        id: generateId(),
        name: "IoT Eco-Warriors",
        domain: "iot",
        fees: 100,
        location: "Chennai, Tamil Nadu",
        startDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 32).toISOString(),
        organizerName: "GreenTech IITM",
        contactDetails: "eco@iitm.ac.in",
        guidelines: "Hardware solutions for climate change.",
        parameters: [
          { name: "Hardware Build", maxScore: 40 },
          { name: "Impact", maxScore: 60 },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: "CyberSuraksha 2.0",
        domain: "cybersecurity",
        fees: 0,
        location: "Hyderabad, Telangana",
        startDate: new Date(Date.now() + 86400000 * 45).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 47).toISOString(),
        organizerName: "Cyberabad Police",
        contactDetails: "suraksha@cyberabadpolice.gov.in",
        guidelines: "Capture the Flag and Zero-Day hunting.",
        parameters: [
          { name: "Vulnerabilities Found", maxScore: 50 },
          { name: "Report Quality", maxScore: 50 },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: "Cloud Native Pune",
        domain: "cloud",
        fees: 300,
        location: "Pune, Maharashtra",
        startDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 4).toISOString(),
        organizerName: "Pune Techies",
        contactDetails: "cloud@punetech.com",
        guidelines: "Build scalable microservices.",
        parameters: [
          { name: "Architecture", maxScore: 50 },
          { name: "Deployment", maxScore: 50 },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: "Mobile App Masters",
        domain: "mobile",
        fees: 0,
        location: "Noida, UP",
        startDate: new Date(Date.now() + 86400000 * 60).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 63).toISOString(),
        organizerName: "Paytm Build",
        contactDetails: "hack@paytm.com",
        guidelines: "Super app functionality clones.",
        parameters: [
          { name: "UI/UX", maxScore: 40 },
          { name: "Performance", maxScore: 60 },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        name: "Ahmedabad Auto-Hack",
        domain: "iot",
        fees: 150,
        location: "Ahmedabad, Gujarat",
        startDate: new Date(Date.now() - 86400000 * 2).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 1).toISOString(), // Live!
        organizerName: "Gujarat Auto Makers",
        contactDetails: "auto@gujarat.in",
        guidelines: "Smart vehicle dash systems.",
        parameters: [
          { name: "Integration", maxScore: 50 },
          { name: "Safety", maxScore: 50 },
        ],
        createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
      },
      {
        id: generateId(),
        name: "Kochi Web3 Fiesta",
        domain: "web3",
        fees: 0,
        location: "Kochi, Kerala",
        startDate: new Date(Date.now() + 86400000 * 18).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 20).toISOString(),
        organizerName: "Kerala Blockchain Academy",
        contactDetails: "hello@kba.ai",
        guidelines: "NFTs and DeFi protocols.",
        parameters: [
          { name: "Code Quality", maxScore: 30 },
          { name: "Concept", maxScore: 70 },
        ],
        createdAt: new Date().toISOString(),
      },
    ];

    let col = getCollection("hackathons");
    hackathons.forEach((h) => {
      col[h.id] = { ...h };
    });
    saveCollection("hackathons", col);
  }
  // ── Seed Users ─────────────────────────────────────────────────────────────
  const userKeys = Object.keys(getCollection("users"));
  if (userKeys.length === 0) {
    console.log("[HackMaster] Seeding default test accounts...");

    function localHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash).toString(36);
    }

    const testPassword = localHash("123456");
    const testUsers = {
      superadmin: {
        uid: "user_superadmin",
        name: "Super Admin",
        email: "superadmin@hackmaster.com",
        role: "superadmin",
        passwordHash: testPassword,
        isActive: true,
      },
      organizer: {
        uid: "user_org",
        name: "Dev Organizer",
        email: "org@hackmaster.com",
        role: "organizer",
        passwordHash: testPassword,
        isActive: true,
      },
      participant: {
        uid: "user_part",
        name: "Elite Hacker",
        email: "part@hackmaster.com",
        role: "participant",
        passwordHash: testPassword,
        isActive: true,
      },
      judge: {
        uid: "user_judge",
        name: "Expert Judge",
        email: "judge@hackmaster.com",
        role: "judge",
        passwordHash: testPassword,
        isActive: true,
      },
    };

    saveCollection("users", testUsers);
  }
})();

// ── Main db export ───────────────────────────────────────────────────────────
export const db = {
  collection: (name) => new CollectionRef(name),
};

export { generateId };
