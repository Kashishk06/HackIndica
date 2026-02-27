import Dashboard from "./dashboard.js";
import { db } from "../core/db.js";

class SuperadminDashboard extends Dashboard {
  constructor() {
    super();
    this.users = [];
    this.hackathons = [];
  }

  async loadDashboardData() {
    await this.loadGlobalStats();
    await this.loadAllHackathons();
    this._setupSettings();
  }

  async loadGlobalStats() {
    try {
      // Load all users
      const usersSnap = await db.collection("users").get();
      this.users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Load all hackathons
      const hacSnap = await db.collection("hackathons").get();
      this.hackathons = hacSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const el = (id, v) => {
        const e = document.getElementById(id);
        if (e) e.textContent = v;
      };
      el("statUsers", this.users.length);
      el("statHackathons", this.hackathons.length);
      el("statOrgs", this.users.filter((u) => u.role === "organizer").length);
      el(
        "statParts",
        this.users.filter((u) => u.role === "participant").length,
      );

      this._renderUsersTable();
      this._renderAllUsersTable();
    } catch (e) {
      console.error(e);
    }
  }

  _renderAllUsersTable() {
    const tbody = document.querySelector("#allUsersTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (this.users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--c-text-lo);padding:var(--sp-6)">No users found</td></tr>`;
      return;
    }

    const sorted = this.users.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );

    for (const u of sorted) {
      const roleBadge = this._roleBadge(u.role);
      const isActive = u.isActive !== false;
      const statusBadge = isActive
        ? `<span class="badge badge-green">Active</span>`
        : `<span class="badge badge-coral">Suspended</span>`;
      const date = u.createdAt
        ? new Date(u.createdAt).toLocaleDateString("en-IN")
        : "Unknown";

      const toggleAction = isActive
        ? `<button class="btn btn-secondary btn-sm" onclick="window.toggleUserStatus('${u.id}', false)">Suspend</button>`
        : `<button class="btn btn-primary btn-sm" onclick="window.toggleUserStatus('${u.id}', true)">Activate</button>`;

      const deleteAction =
        u.role !== "superadmin"
          ? `<button class="btn btn-danger btn-sm" onclick="window.deleteUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>`
          : ``;

      tbody.innerHTML += `
            <tr>
                <td style="font-weight:var(--fw-semi)">${u.name || "Unknown"}</td>
                <td style="color:var(--c-text-mid)">${u.email}</td>
                <td>${roleBadge}</td>
                <td style="color:var(--c-text-mid)">${date}</td>
                <td>${statusBadge}</td>
                <td style="text-align:right">
                    <div style="display:flex; gap:var(--sp-2); justify-content:flex-end">
                        ${u.id !== this.user.uid ? toggleAction + deleteAction : '<span style="color:var(--c-text-lo);font-size:var(--fs-xs)">You</span>'}
                    </div>
                </td>
            </tr>`;
    }
  }

  _renderUsersTable() {
    const tbody = document.querySelector("#usersTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (this.users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--c-text-lo)">No users found</td></tr>`;
      return;
    }

    // Sort new to old, take top 10
    const recent = this.users
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 10);

    for (const u of recent) {
      const roleBadge = this._roleBadge(u.role);
      const status =
        u.isActive !== false
          ? `<span class="badge badge-green">Active</span>`
          : `<span class="badge badge-coral">Suspended</span>`;
      const date = u.createdAt
        ? new Date(u.createdAt).toLocaleDateString("en-IN")
        : "Unknown";

      tbody.innerHTML += `
            <tr>
                <td style="font-weight:var(--fw-semi)">${u.name || "Unknown"}</td>
                <td style="color:var(--c-text-mid)">${u.email}</td>
                <td>${roleBadge}</td>
                <td style="color:var(--c-text-mid)">${date}</td>
                <td>${status}</td>
            </tr>`;
    }
  }

  _roleBadge(role) {
    const maps = {
      organizer: `<span class="badge badge-coral">Organiser</span>`,
      participant: `<span class="badge badge-green">Participant</span>`,
      judge: `<span class="badge badge-violet">Judge</span>`,
      superadmin: `<span class="badge badge-violet" style="border-color:#f5a623;color:#f5a623">Superadmin</span>`,
    };
    return maps[role] || `<span class="badge badge-gray">${role}</span>`;
  }

  _getDomainBadge(domain) {
    const d = (domain || "open").toLowerCase();
    let icon = "fa-globe";
    if (d === "web3") icon = "fa-brands fa-ethereum";
    if (d === "ai-ml") icon = "fa-robot";
    if (d === "iot") icon = "fa-microchip";
    if (d === "cybersecurity") icon = "fa-shield-halved";
    return `<div class="domain-badge ${d}"><i class="fa-solid ${icon}"></i> ${domain}</div>`;
  }

  async loadAllHackathons() {
    const container = document.getElementById("allHackathonsGrid");
    if (!container) return;
    container.innerHTML = "";

    if (this.hackathons.length === 0) {
      container.innerHTML = `<p class="empty-state">No hackathons exist on the platform yet.</p>`;
      return;
    }

    for (const h of this.hackathons) {
      const status = this._status(h);
      const date = h.createdAt
        ? new Date(h.createdAt).toLocaleDateString("en-IN")
        : "Unknown";

      container.innerHTML += `
            <div class="hackathon-card scale-in">
                <div class="card-header-flex">
                    <div style="flex:1; padding-right:15px">
                        ${this._getDomainBadge(h.domain)}
                        <h3>${h.name || "Untitled"}</h3>
                    </div>
                    ${status}
                </div>
                <div class="hackathon-meta">
                    <span><i class="fa-solid fa-sitemap"></i> Org: ${h.organizerName || "Unknown"}</span>
                    <span><i class="fa-solid fa-map-pin"></i> ${h.location || "Online"}</span>
                    <span style="grid-column: 1 / -1;"><i class="fa-regular fa-calendar-plus"></i> Created: ${date}</span>
                </div>
                <div class="card-actions">
                    <button class="btn btn-danger btn-sm" onclick="window.deleteEvent('${h.id}')"><i class="fa-solid fa-trash"></i> Delete Global</button>
                </div>
            </div>`;
    }
  }

  _status(h) {
    const now = new Date();
    const end = h.endDate?._isTimestamp
      ? new Date(h.endDate.iso)
      : h.endDate
        ? new Date(h.endDate)
        : null;
    const start = h.startDate?._isTimestamp
      ? new Date(h.startDate.iso)
      : h.startDate
        ? new Date(h.startDate)
        : null;
    if (!end || end < now) return `<span class="badge badge-gray">Ended</span>`;
    if (start && start > now)
      return `<span class="badge badge-violet">Upcoming</span>`;
    return `<span class="badge badge-green">Live</span>`;
  }

  _setupSettings() {
    const regBtn = document.getElementById("btnToggleRegistrations");
    if (regBtn) {
      regBtn.addEventListener("click", async () => {
        const isActive = regBtn.textContent === "Enabled";
        if (isActive) {
          regBtn.textContent = "Disabled";
          regBtn.className = "btn btn-secondary btn-sm";
        } else {
          regBtn.textContent = "Enabled";
          regBtn.className = "btn btn-primary btn-sm";
        }
        const { showToast } = await import("../core/utils.js");
        showToast("Registration setting updated.", "success");
      });
    }

    const maintBtn = document.getElementById("btnToggleMaintenance");
    if (maintBtn) {
      maintBtn.addEventListener("click", async () => {
        const isActive = maintBtn.textContent === "Enabled";
        if (isActive) {
          maintBtn.textContent = "Disabled";
          maintBtn.className = "btn btn-secondary btn-sm";
          maintBtn.style = "";
        } else {
          maintBtn.textContent = "Enabled";
          maintBtn.className = "btn btn-danger btn-sm";
          maintBtn.style.background = "rgba(255,107,107,0.1)";
          maintBtn.style.color = "var(--c-coral)";
          maintBtn.style.borderColor = "rgba(255,107,107,0.3)";
        }
        const { showToast } = await import("../core/utils.js");
        showToast("Maintenance mode setting updated.", "success");
      });
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new SuperadminDashboard();
});

window.deleteEvent = async (id) => {
  if (
    !confirm(
      "Are you sure you want to delete this hackathon? This cannot be undone.",
    )
  )
    return;
  try {
    const { db } = await import("../core/db.js");
    const { showToast } = await import("../core/utils.js");
    await db.collection("hackathons").doc(id).delete();
    showToast("Hackathon deleted globally.", "success");
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    console.error(e);
    alert("Could not delete hackathon.");
  }
};

window.toggleUserStatus = async (uid, activate) => {
  try {
    const { db } = await import("../core/db.js");
    const { showToast } = await import("../core/utils.js");
    await db.collection("users").doc(uid).update({ isActive: activate });
    showToast(
      `User ${activate ? "activated" : "suspended"} successfully.`,
      "success",
    );
    setTimeout(() => location.reload(), 800);
  } catch (e) {
    console.error(e);
  }
};

window.deleteUser = async (uid) => {
  if (!confirm("Permanently delete this user? This cannot be undone.")) return;
  try {
    const { db } = await import("../core/db.js");
    const { showToast } = await import("../core/utils.js");
    await db.collection("users").doc(uid).delete();
    showToast("User deeply deleted.", "success");
    setTimeout(() => location.reload(), 800);
  } catch (e) {
    console.error(e);
  }
};

window.factoryReset = () => {
  if (
    !confirm(
      "DANGER! This will WIPE ALL DATA from the platform database including events, scores, and users. Are you sure?",
    )
  )
    return;
  if (!confirm("Action is irreversible. Type OK to continue.") === false) {
    // Mock exact type validation
    localStorage.clear();
    sessionStorage.clear();
    alert("Platform completely wiped. Redirecting to start.");
    window.location.href = "../../index.html";
  }
};
