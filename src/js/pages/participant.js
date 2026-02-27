import Dashboard from "./dashboard.js";
import { db } from "../core/db.js";
import { showToast, formatDate } from "../core/utils.js";

class ParticipantDashboard extends Dashboard {
  constructor() {
    super();
    this.hackathons = [];
    this.myTeams = [];
  }

  async loadDashboardData() {
    await this.loadStats();
    await this.loadMyHackathons();
    await this.loadAvailableHackathons();

    // Populate profile settings
    const nNode = document.getElementById("settingName");
    const eNode = document.getElementById("settingEmail");
    if (nNode) nNode.value = this.user.name || "Unknown";
    if (eNode) eNode.value = this.user.email || "Unknown";
  }

  async loadStats() {
    try {
      // My registrations (teams where I am a member)
      const teamsSnap = await db
        .collection("teams")
        .where("memberUids", "array-contains", this.user.uid)
        .get();
      this.myTeams = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const el = (id, v) => {
        const e = document.getElementById(id);
        if (e) e.textContent = v;
      };
      el("statRegistered", this.myTeams.length);
      el("statSubmissions", this.myTeams.filter((t) => t.submission).length);
    } catch (e) {
      console.error(e);
    }
  }

  async loadMyHackathons() {
    const container = document.getElementById("myHackathonsGrid");
    if (!container) return;
    container.innerHTML = "";

    if (this.myTeams.length === 0) {
      container.innerHTML = `<p class="empty-state">You haven't registered for any hackathons yet.</p>`;
      return;
    }

    for (const team of this.myTeams) {
      const hacDoc = await db
        .collection("hackathons")
        .doc(team.hackathonId)
        .get();
      if (!hacDoc.exists) continue;
      const h = hacDoc.data();
      container.innerHTML += this._hackCard(hacDoc.id, h, team);
    }
  }

  async loadAvailableHackathons() {
    const container = document.getElementById("browseGrid");
    if (!container) return;
    container.innerHTML = "";

    const snap = await db
      .collection("hackathons")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();
    if (snap.empty) {
      container.innerHTML = `<p class="empty-state">No hackathons available right now.</p>`;
      return;
    }

    snap.docs.forEach((doc) => {
      container.innerHTML += this._browseCard(doc.id, doc.data());
    });
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

  _hackCard(id, h, team) {
    const status = this._status(h);
    return `
        <div class="hackathon-card scale-in">
            <div class="card-header-flex">
                <div style="flex:1; padding-right:15px">
                    ${this._getDomainBadge(h.domain)}
                    <h3>${h.name || "Untitled"}</h3>
                </div>
                ${status}
            </div>
            <div class="hackathon-meta">
                <span><i class="fa-solid fa-map-pin"></i> ${h.location || "Online"}</span>
                <span><i class="fa-regular fa-calendar"></i> ${this._date(h.startDate)}</span>
                <span style="grid-column: 1 / -1;"><i class="fa-solid fa-users"></i> Team: ${team.name || "Solo"}</span>
            </div>
            <div class="card-actions">
                ${
                  !team.submission
                    ? `<button class="btn btn-primary btn-sm" onclick="window.submitProject('${id}','${team.id}')">Submit</button>`
                    : `<span class="badge badge-green" style="flex:1;justify-content:center"><i class="fa-solid fa-check"></i> Submitted</span>`
                }
                <button class="btn btn-secondary btn-sm" onclick="window.viewHackathon('${id}')">Details</button>
            </div>
        </div>`;
  }

  _browseCard(id, h) {
    const alreadyIn = this.myTeams.some((t) => t.hackathonId === id);
    return `
        <div class="hackathon-card scale-in">
            <div class="card-header-flex">
                <div style="flex:1; padding-right:15px">
                    ${this._getDomainBadge(h.domain)}
                    <h3>${h.name || "Untitled"}</h3>
                </div>
                ${this._status(h)}
            </div>
            <div class="hackathon-meta">
                <span><i class="fa-solid fa-map-pin"></i> ${h.location || "Online"}</span>
                <span><i class="fa-solid fa-indian-rupee-sign"></i> ${h.fees ? h.fees : "Free"}</span>
                <span style="grid-column: 1 / -1;"><i class="fa-regular fa-calendar"></i> Starts:  ${this._date(h.startDate)}</span>
            </div>
            <div class="card-actions">
                ${
                  alreadyIn
                    ? `<span class="badge badge-violet" style="flex:1;justify-content:center"><i class="fa-solid fa-check-double"></i> Registered</span>`
                    : `<button class="btn btn-primary btn-sm" onclick="window.registerForHackathon('${id}')">Register Now</button>`
                }
            </div>
        </div>`;
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

  _date(ts) {
    if (!ts) return "TBD";
    const d = ts._isTimestamp ? new Date(ts.iso) : new Date(ts);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ParticipantDashboard();
});

// Global handlers
window.registerForHackathon = async (hackathonId) => {
  const session = (await import("../core/auth.js")).getSession();
  if (!session) return;
  try {
    const { db } = await import("../core/db.js");
    // Check already registered
    const existing = await db
      .collection("teams")
      .where("hackathonId", "==", hackathonId)
      .where("memberUids", "array-contains", session.uid)
      .get();
    if (!existing.empty) {
      showToast("Already registered!", "info");
      return;
    }

    // Create solo team
    await db.collection("teams").add({
      hackathonId,
      name: session.name + "'s Team",
      memberUids: [session.uid],
      members: [{ uid: session.uid, name: session.name, email: session.email }],
      submission: null,
      createdAt: new Date().toISOString(),
    });
    showToast("Registered successfully! 🎉", "success");
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    showToast("Error registering: " + e.message, "error");
  }
};

window.submitProject = async (hackathonId, teamId) => {
  const title = prompt("Project title:");
  const url = prompt("GitHub / demo URL:");
  if (!title) return;
  try {
    const { db } = await import("../core/db.js");
    await db
      .collection("teams")
      .doc(teamId)
      .update({
        submission: { title, url, submittedAt: new Date().toISOString() },
      });
    showToast("Project submitted! 🚀", "success");
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    showToast("Error submitting: " + e.message, "error");
  }
};

window.viewHackathon = async (id) => {
  try {
    const { db } = await import("../core/db.js");
    const hacDoc = await db.collection("hackathons").doc(id).get();
    if (!hacDoc.exists) {
      showToast("Hackathon not found!", "error");
      return;
    }

    const h = hacDoc.data();
    const start = h.startDate?._isTimestamp
      ? new Date(h.startDate.iso)
      : h.startDate
        ? new Date(h.startDate)
        : null;
    const end = h.endDate?._isTimestamp
      ? new Date(h.endDate.iso)
      : h.endDate
        ? new Date(h.endDate)
        : null;

    const fmt = (d) =>
      d
        ? d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "TBD";

    const overlay = document.createElement("div");
    overlay.id = "hackathonModal";
    overlay.className = "scale-in";
    overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(7,8,15,.8);
            backdrop-filter:blur(12px);z-index:9999;
            display:flex;justify-content:center;align-items:center;padding:20px;
        `;

    overlay.innerHTML = `
            <div style="background:var(--c-surface);border:1px solid var(--c-border);
                        border-radius:var(--r-xl);width:100%;max-width:700px;
                        max-height:90vh;overflow-y:auto;position:relative;
                        box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.2);">
                
                <div style="padding:var(--sp-8);border-bottom:1px solid var(--c-border);position:relative;overflow:hidden">
                    <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--c-violet),var(--c-cyan))"></div>
                    <button onclick="document.getElementById('hackathonModal').remove()"
                            style="position:absolute;top:24px;right:24px;background:var(--c-surface-2);border:1px solid var(--c-border);
                                   width:36px;height:36px;border-radius:50%;color:var(--c-text-hi);cursor:pointer;
                                   display:grid;place-items:center;transition:background 0.2s">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    
                    <div style="display:inline-block;padding:6px 12px;background:rgba(108,99,255,0.1);color:var(--c-violet);
                                border-radius:var(--r-full);font-size:var(--fs-xs);font-weight:var(--fw-bold);
                                text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--sp-4)">
                        ${h.domain || "Open Domain"}
                    </div>
                    
                    <h2 style="font-size:var(--fs-2xl);font-weight:var(--fw-black);color:var(--c-text-hi);line-height:1.1;margin-bottom:var(--sp-2)">
                        ${h.name}
                    </h2>
                    <p style="color:var(--c-text-mid);font-size:var(--fs-base)"><i class="fa-solid fa-sitemap" style="color:var(--c-violet)"></i> Organized by <strong>${h.organizerName || "Unknown"}</strong></p>
                </div>
                
                <div style="padding:var(--sp-8);display:grid;gap:var(--sp-8)">
                    
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--sp-4)">
                        <div style="background:var(--c-surface-2);padding:var(--sp-4);border-radius:var(--r-md);border:1px solid var(--c-border)">
                            <div style="font-size:var(--fs-xs);color:var(--c-text-lo);text-transform:uppercase;margin-bottom:var(--sp-1)">Location</div>
                            <div style="font-weight:var(--fw-bold);color:var(--c-text-hi)">${h.location || "Online"}</div>
                        </div>
                        <div style="background:var(--c-surface-2);padding:var(--sp-4);border-radius:var(--r-md);border:1px solid var(--c-border)">
                            <div style="font-size:var(--fs-xs);color:var(--c-text-lo);text-transform:uppercase;margin-bottom:var(--sp-1)">Timeline</div>
                            <div style="font-weight:var(--fw-bold);color:var(--c-text-hi)">${fmt(start)} - ${fmt(end)}</div>
                        </div>
                        <div style="background:var(--c-surface-2);padding:var(--sp-4);border-radius:var(--r-md);border:1px solid var(--c-border)">
                            <div style="font-size:var(--fs-xs);color:var(--c-text-lo);text-transform:uppercase;margin-bottom:var(--sp-1)">Entry Fee</div>
                            <div style="font-weight:var(--fw-bold);color:var(--c-green)">${h.fees ? "₹" + h.fees : "Free & Open"}</div>
                        </div>
                    </div>

                    <div>
                        <h4 style="font-size:var(--fs-sm);color:var(--c-text-mid);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--sp-3)">About & Guidelines</h4>
                        <div style="color:var(--c-text-hi);line-height:1.6;font-size:var(--fs-sm);background:rgba(0,0,0,0.2);padding:var(--sp-5);border-radius:var(--r-lg);border-left:2px solid var(--c-violet)">
                            ${h.guidelines ? h.guidelines.replace(/\n/g, "<br>") : "No guidelines provided."}
                        </div>
                    </div>
                    
                    ${
                      h.problemStatements
                        ? `
                    <div>
                        <h4 style="font-size:var(--fs-sm);color:var(--c-text-mid);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--sp-3)">Problem Statements</h4>
                        <div style="color:var(--c-text-hi);line-height:1.6;font-size:var(--fs-sm);background:rgba(0,0,0,0.2);padding:var(--sp-5);border-radius:var(--r-lg);border-left:2px solid var(--c-cyan)">
                            ${h.problemStatements.replace(/\n/g, "<br>")}
                        </div>
                    </div>
                    `
                        : ""
                    }

                    <div style="display:flex;gap:var(--sp-4)">
                        <button class="btn btn-primary" style="flex:1" onclick="document.getElementById('hackathonModal').remove(); window.registerForHackathon('${id}')">
                            <i class="fa-solid fa-bolt"></i> Register for Event
                        </button>
                    </div>
                </div>
            </div>
        `;

    document.body.appendChild(overlay);

    // Click outside to close
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  } catch (e) {
    showToast("Error loading details.", "error");
    console.error(e);
  }
};
