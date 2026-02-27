import Dashboard from "../pages/dashboard.js";
import { db, FieldValue, Timestamp } from "../core/db.js";
import { showToast } from "../core/utils.js";

class OrganizerDashboard extends Dashboard {
  constructor() {
    super();
    this.judgesCount = 0;
    this.parametersCount = 1;
  }

  async loadDashboardData() {
    await this.loadStats();
    this.loadRecentHackathons();
    this.setupCreateHackathonForm();
    this.setupJudgesSection();
    this.setupParametersSection();

    // Populate profile settings
    const nNode = document.getElementById("settingName");
    const eNode = document.getElementById("settingEmail");
    if (nNode) nNode.value = this.user.name || "Unknown";
    if (eNode) eNode.value = this.user.email || "Unknown";
  }

  async loadStats() {
    try {
      const hackathonsSnap = await db
        .collection("hackathons")
        .where("organizerId", "==", this.user.uid)
        .get();

      document.getElementById("totalHackathons").textContent =
        hackathonsSnap.size;

      const now = new Date();
      const active = hackathonsSnap.docs.filter((doc) => {
        const d = doc.data();
        if (!d.endDate) return false;
        const end = d.endDate._isTimestamp
          ? new Date(d.endDate.iso)
          : new Date(d.endDate);
        return end > now;
      });
      document.getElementById("activeHackathons").textContent = active.length;

      let totalParticipants = 0;
      for (const doc of hackathonsSnap.docs) {
        const teamsSnap = await db
          .collection("teams")
          .where("hackathonId", "==", doc.id)
          .get();
        teamsSnap.docs.forEach((teamDoc) => {
          totalParticipants += teamDoc.data().members?.length || 0;
        });
      }
      document.getElementById("totalParticipants").textContent =
        totalParticipants;

      let totalJudges = 0;
      const domainCounts = {};

      hackathonsSnap.docs.forEach((doc) => {
        const d = doc.data();
        totalJudges += d.judges?.length || 0;

        // Count domains for chart
        const dom = d.domain || "open";
        domainCounts[dom] = (domainCounts[dom] || 0) + 1;
      });
      document.getElementById("totalJudges").textContent = totalJudges;

      this._renderAnalyticsChart(domainCounts);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  _renderAnalyticsChart(domainCounts) {
    const ctx = document.getElementById("domainChart")?.getContext("2d");
    if (!ctx) return;

    // Destroy previous instance if it exists to allow re-rendering
    if (window.myChartInstance) {
      window.myChartInstance.destroy();
    }

    const labels = Object.keys(domainCounts).map((d) => d.toUpperCase());
    const data = Object.values(domainCounts);

    window.myChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: [
              "#6c63ff",
              "#00f2fe",
              "#f5a623",
              "#ed64a6",
              "#22d3ee",
              "#8b5cf6",
            ],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#a0aec0", padding: 20 },
          },
        },
        cutout: "70%",
      },
    });
  }

  async loadRecentHackathons() {
    try {
      const snap = await db
        .collection("hackathons")
        .where("organizerId", "==", this.user.uid)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();

      const container = document.getElementById("recentHackathonsList");
      const allContainer = document.getElementById("allHackathonsList");

      if (container) container.innerHTML = "";
      if (allContainer) allContainer.innerHTML = "";

      if (snap.empty) {
        if (container)
          container.innerHTML =
            '<p style="color:rgba(255,255,255,0.7);padding:20px">No hackathons yet. Create your first one!</p>';
        if (allContainer)
          allContainer.innerHTML =
            '<p style="color:rgba(255,255,255,0.7);padding:20px">You haven\'t created any hackathons.</p>';
        return;
      }

      const allSnap = await db
        .collection("hackathons")
        .where("organizerId", "==", this.user.uid)
        .orderBy("createdAt", "desc")
        .get();

      if (container) {
        snap.docs.forEach((doc) => {
          container.innerHTML += this.createHackathonCard(doc.id, doc.data());
        });
      }

      if (allContainer) {
        allSnap.docs.forEach((doc) => {
          allContainer.innerHTML += this.createHackathonCard(
            doc.id,
            doc.data(),
          );
        });
      }
    } catch (error) {
      console.error("Error loading recent hackathons:", error);
    }
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

  createHackathonCard(id, data) {
    let startDate = "TBD";
    if (data.startDate) {
      const d = data.startDate._isTimestamp
        ? new Date(data.startDate.iso)
        : new Date(data.startDate);
      startDate = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    return `
            <div class="hackathon-card glass-card scale-in" data-id="${id}">
                <div class="card-header-flex">
                    <div style="flex:1; padding-right:15px">
                        ${this._getDomainBadge(data.domain)}
                        <h3>${data.name || "Untitled"}</h3>
                    </div>
                </div>
                <div class="hackathon-meta">
                    <span><i class="fa-solid fa-map-pin"></i> ${data.location || "Online"}</span>
                    <span><i class="fa-solid fa-indian-rupee-sign"></i> ${data.fees ? data.fees : "Free"}</span>
                    <span style="grid-column: 1 / -1;"><i class="fa-regular fa-calendar"></i> Starts: ${startDate}</span>
                </div>
                <div class="card-actions">
                    <button class="btn btn-secondary btn-sm" onclick="window.viewDetails('${id}')">View</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.editHackathon('${id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteHackathon('${id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
  }

  setupCreateHackathonForm() {
    const form = document.getElementById("createHackathonForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const judges = [];
      for (let i = 0; i < this.judgesCount; i++) {
        const judgeName = document.getElementById(`judgeName_${i}`)?.value;
        const judgeEmail = document.getElementById(`judgeEmail_${i}`)?.value;
        const judgeDesignation = document.getElementById(
          `judgeDesignation_${i}`,
        )?.value;
        const judgeOrg = document.getElementById(`judgeOrg_${i}`)?.value;
        if (judgeName && judgeEmail) {
          judges.push({
            name: judgeName,
            email: judgeEmail,
            designation: judgeDesignation,
            organization: judgeOrg,
          });
        }
      }

      const parameters = [];
      for (let i = 0; i < this.parametersCount; i++) {
        const paramName = document.getElementById(`paramName_${i}`)?.value;
        const paramMax = document.getElementById(`paramMax_${i}`)?.value;
        if (paramName && paramMax) {
          parameters.push({ name: paramName, maxScore: parseInt(paramMax) });
        }
      }

      const startDateVal = document.getElementById("startDate")?.value;
      const endDateVal = document.getElementById("endDate")?.value;

      const hackathonData = {
        name: document.getElementById("hackathonName")?.value,
        domain: document.getElementById("domain")?.value,
        guidelines: document.getElementById("guidelines")?.value,
        fees: parseInt(document.getElementById("fees")?.value || "0"),
        location: document.getElementById("location")?.value,
        problemStatements: document.getElementById("problemStatements")?.value,
        startDate: Timestamp.fromDate(new Date(startDateVal)),
        endDate: Timestamp.fromDate(new Date(endDateVal)),
        organizerName: document.getElementById("organizerName")?.value,
        contactDetails: document.getElementById("contactDetails")?.value,
        pptLink: document.getElementById("pptLink")?.value,
        githubLink: document.getElementById("githubLink")?.value,
        judges,
        parameters,
        organizerId: this.user.uid,
        createdAt: new Date().toISOString(),
        isActive: true,
        status: "upcoming",
      };

      try {
        await db.collection("hackathons").add(hackathonData);
        showToast("Hackathon created successfully!", "success");
        form.reset();
        this.navigateToSection("my-hackathons");
        this.loadRecentHackathons();
        this.loadStats();
      } catch (error) {
        showToast("Error creating hackathon: " + error.message, "error");
      }
    });
  }

  setupJudgesSection() {
    this.addJudgeField();
    document
      .getElementById("addJudgeBtn")
      ?.addEventListener("click", () => this.addJudgeField());
  }

  addJudgeField() {
    const container = document.getElementById("judgesContainer");
    if (!container) return;
    const i = this.judgesCount;
    container.innerHTML += `
            <div class="judge-card glass-card" id="judge_${i}">
                <h4>Judge ${i + 1}</h4>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="judgeName_${i}" class="form-input" required>
                </div>
                <div class="form-group">
                    <label>Designation</label>
                    <input type="text" id="judgeDesignation_${i}" class="form-input">
                </div>
                <div class="form-group">
                    <label>Organization</label>
                    <input type="text" id="judgeOrg_${i}" class="form-input">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="judgeEmail_${i}" class="form-input" required>
                </div>
                <button type="button" class="btn btn-small btn-danger" onclick="window.removeJudge(${i})">Remove</button>
            </div>
        `;
    this.judgesCount++;
  }

  setupParametersSection() {
    document
      .getElementById("addParameterBtn")
      ?.addEventListener("click", () => this.addParameterField());
  }

  addParameterField() {
    const container = document.getElementById("parametersContainer");
    if (!container) return;
    const i = this.parametersCount;
    container.innerHTML += `
            <div class="parameter-item" id="param_${i}">
                <input type="text" id="paramName_${i}" class="form-input" placeholder="Parameter Name" required>
                <input type="number" id="paramMax_${i}" class="form-input" placeholder="Max Score" required min="1" max="100">
                <button type="button" class="btn btn-small btn-danger" onclick="window.removeParameter(${i})">×</button>
            </div>
        `;
    this.parametersCount++;
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  new OrganizerDashboard();
});

// Global helpers
window.removeJudge = (index) =>
  document.getElementById(`judge_${index}`)?.remove();
window.removeParameter = (index) =>
  document.getElementById(`param_${index}`)?.remove();
window.viewDetails = async (id) => {
  try {
    const { db } = await import("../core/db.js");
    const hacDoc = await db.collection("hackathons").doc(id).get();
    if (!hacDoc.exists) return;
    const h = hacDoc.data();

    const teamsSnap = await db
      .collection("teams")
      .where("hackathonId", "==", id)
      .get();
    const teams = teamsSnap.docs.map((d) => d.data());

    const overlay = document.createElement("div");
    overlay.id = "orgViewModal";
    overlay.className = "scale-in";
    overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(7,8,15,.8);
            backdrop-filter:blur(12px);z-index:10000;
            display:flex;justify-content:center;align-items:center;padding:20px;
        `;

    const paramsList = (h.parameters || [])
      .map((p) => `<li><strong>${p.name}:</strong> max ${p.maxScore} pts</li>`)
      .join("");
    const judgesList = (h.judges || [])
      .map((j) => `<li>${j.name} (${j.email})</li>`)
      .join("");

    overlay.innerHTML = `
            <div style="background:var(--c-surface);border:1px solid var(--c-border);
                        border-radius:var(--r-xl);width:100%;max-width:600px;
                        max-height:85vh;overflow-y:auto;position:relative;
                        box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.2);
                        padding:var(--sp-8);">
                <button onclick="document.getElementById('orgViewModal').remove()"
                        style="position:absolute;top:24px;right:24px;background:var(--c-surface-2);border:1px solid var(--c-border);
                               width:36px;height:36px;border-radius:50%;color:var(--c-text-hi);cursor:pointer;
                               display:grid;place-items:center;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <h2 style="font-size:var(--fs-2xl);font-weight:var(--fw-black);color:var(--c-text-hi);margin-bottom:var(--sp-2)">
                    ${h.name}
                </h2>
                <div style="display:flex;gap:10px;margin-bottom:var(--sp-6);">
                    <span class="badge badge-violet">${h.domain || "Open"}</span>
                    <span class="badge badge-green">${teams.length} Teams Registered</span>
                </div>
                
                <h4 style="font-size:var(--fs-sm);color:var(--c-text-mid);text-transform:uppercase;margin-bottom:var(--sp-2)">Guidelines</h4>
                <div style="color:var(--c-text-hi);background:rgba(0,0,0,0.2);padding:var(--sp-4);border-radius:var(--r-md);margin-bottom:var(--sp-6)">
                    ${h.guidelines || "N/A"}
                </div>
                
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-6);">
                    <div>
                        <h4 style="font-size:var(--fs-sm);color:var(--c-text-mid);text-transform:uppercase;margin-bottom:var(--sp-2)">Evaluation Parameters</h4>
                        <ul style="color:var(--c-text-hi);padding-left:16px;">
                            ${paramsList || "<li>None</li>"}
                        </ul>
                    </div>
                    <div>
                        <h4 style="font-size:var(--fs-sm);color:var(--c-text-mid);text-transform:uppercase;margin-bottom:var(--sp-2)">Judges Panel</h4>
                        <ul style="color:var(--c-text-hi);padding-left:16px;">
                            ${judgesList || "<li>No judges added</li>"}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  } catch (e) {
    console.error(e);
  }
};

window.editHackathon = (id) => {
  // In a full implementation, this would populate the create form.
  const { showToast } = require("../core/utils.js");
  showToast("Edit Hackathon functionality arriving in v2.1! 🚧", "info");
};

window.deleteHackathon = async (id) => {
  if (confirm("Are you sure you want to delete this hackathon?")) {
    try {
      const { db } = await import("../core/db.js");
      const { showToast } = await import("../core/utils.js");
      await db.collection("hackathons").doc(id).delete();
      showToast("Hackathon deleted successfully", "success");
      setTimeout(() => location.reload(), 1000);
    } catch {
      alert("Error deleting hackathon");
    }
  }
};
