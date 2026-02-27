import Dashboard from "./dashboard.js";
import { db } from "../core/db.js";
import { showToast } from "../core/utils.js";

class JudgeDashboard extends Dashboard {
  constructor() {
    super();
    this.assignments = []; // hackathons where I'm a judge
  }

  async loadDashboardData() {
    await this.loadAssignments();

    // Populate profile settings
    const nNode = document.getElementById("settingName");
    const eNode = document.getElementById("settingEmail");
    if (nNode) nNode.value = this.user.name || "Unknown";
    if (eNode) eNode.value = this.user.email || "Unknown";
  }

  async loadAssignments() {
    try {
      // Find hackathons where this judge's email appears in the judges array
      const snap = await db.collection("hackathons").get();
      this.assignments = snap.docs
        .filter((doc) => {
          const judges = doc.data().judges || [];
          return judges.some((j) => j.email === this.user.email);
        })
        .map((doc) => ({ id: doc.id, ...doc.data() }));

      const el = document.getElementById("statAssigned");
      if (el) el.textContent = this.assignments.length;

      await this._renderAssignments();
    } catch (e) {
      console.error(e);
    }
  }

  async _renderAssignments() {
    const container = document.getElementById("assignmentsGrid");
    const allContainer = document.getElementById("allAssignmentsGrid");

    if (container) container.innerHTML = "";
    if (allContainer) allContainer.innerHTML = "";

    if (this.assignments.length === 0) {
      if (container)
        container.innerHTML = `<p class="empty-state">No hackathons assigned to you yet.</p>`;
      if (allContainer)
        allContainer.innerHTML = `<p class="empty-state">No hackathons assigned.</p>`;
      return;
    }

    for (const h of this.assignments) {
      // Count teams/submissions for this hackathon
      const teamsSnap = await db
        .collection("teams")
        .where("hackathonId", "==", h.id)
        .get();
      const submissions = teamsSnap.docs.filter(
        (d) => d.data().submission,
      ).length;
      const total = teamsSnap.docs.length;

      const cardHTML = `
            <div class="hackathon-card scale-in">
                <div style="display:flex;justify-content:space-between;margin-bottom:var(--sp-3)">
                    <h3>${h.name || "Untitled"}</h3>
                    <span class="badge badge-violet">Judge</span>
                </div>
                <div class="hackathon-meta">
                    <span>🎯 ${h.domain || "Open"}</span>
                    <span>📍 ${h.location || "Online"}</span>
                    <span>📋 ${submissions}/${total} submitted</span>
                </div>
                <div class="card-actions" style="margin-top:var(--sp-4)">
                    <button class="btn btn-primary btn-sm" onclick="window.openScoring('${h.id}')">
                        Score Submissions
                    </button>
                </div>
            </div>`;

      if (container) container.innerHTML += cardHTML;
      if (allContainer) allContainer.innerHTML += cardHTML;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new JudgeDashboard();
});

// Scoring modal
window.openScoring = async (hackathonId) => {
  try {
    const { db } = await import("../core/db.js");

    const hacDoc = await db.collection("hackathons").doc(hackathonId).get();
    const h = hacDoc.data();
    const params = h.parameters || [];

    const teamsSnap = await db
      .collection("teams")
      .where("hackathonId", "==", hackathonId)
      .get();
    const teams = teamsSnap.docs
      .filter((d) => d.data().submission)
      .map((d) => ({ id: d.id, ...d.data() }));

    if (teams.length === 0) {
      showToast("No submissions yet for this hackathon.", "info");
      return;
    }

    // Build scoring modal
    const overlay = document.createElement("div");
    overlay.id = "scoreModal";
    overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,.7);
            backdrop-filter:blur(8px);z-index:1000;
            display:grid;place-items:center;padding:20px;`;

    const teamOptions = teams
      .map(
        (t) =>
          `<option value="${t.id}">${t.name} – ${t.submission?.title || "No title"}</option>`,
      )
      .join("");

    const paramFields = params
      .map(
        (p) => `
            <div class="form-group">
                <label class="form-label" style="display:flex;justify-content:space-between">
                    <span>${p.name}</span><span style="color:var(--c-text-lo)">max ${p.maxScore}</span>
                </label>
                <input type="number" class="form-input score-field" data-param="${p.name}"
                       min="0" max="${p.maxScore}" placeholder="0">
            </div>`,
      )
      .join("");

    overlay.innerHTML = `
            <div style="background:var(--c-surface);border:1px solid var(--c-border);
                        border-radius:24px;padding:32px;width:100%;max-width:480px;position:relative">
                <button onclick="document.getElementById('scoreModal').remove()"
                        style="position:absolute;top:16px;right:16px;background:none;border:none;
                               color:var(--c-text-lo);cursor:pointer;font-size:1.2rem">✕</button>
                <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:4px">Score Submission</h2>
                <p style="font-size:.875rem;color:var(--c-text-mid);margin-bottom:24px">${h.name}</p>
                <div class="form-group" style="margin-bottom:20px">
                    <label class="form-label">Team</label>
                    <select id="scoreTeamSelect" class="form-input">${teamOptions}</select>
                </div>
                ${paramFields || '<p style="color:var(--c-text-lo);font-size:.875rem">No evaluation parameters set for this hackathon.</p>'}
                <div class="form-group" style="margin-top:8px">
                    <label class="form-label">Feedback (optional)</label>
                    <textarea id="scoreFeedback" class="form-input" rows="3" placeholder="Your comments…"></textarea>
                </div>
                <button id="submitScoreBtn" class="btn btn-primary btn-block" style="margin-top:20px">
                    Submit Score
                </button>
            </div>`;

    document.body.appendChild(overlay);

    document
      .getElementById("submitScoreBtn")
      .addEventListener("click", async () => {
        const teamId = document.getElementById("scoreTeamSelect").value;
        const feedback = document.getElementById("scoreFeedback").value;
        const scores = {};
        let total = 0;

        document.querySelectorAll(".score-field").forEach((input) => {
          const name = input.dataset.param;
          const value = parseFloat(input.value) || 0;
          scores[name] = value;
          total += value;
        });

        const session = JSON.parse(
          sessionStorage.getItem("hackmaster_session") || "{}",
        );

        try {
          await db.collection("scores").add({
            hackathonId,
            teamId,
            judgeUid: session.uid,
            judgeName: session.name,
            scores,
            total,
            feedback,
            scoredAt: new Date().toISOString(),
          });
          showToast("Score submitted! ✅", "success");
          document.getElementById("scoreModal").remove();
        } catch (e) {
          showToast("Error: " + e.message, "error");
        }
      });
  } catch (e) {
    console.error(e);
    showToast("Could not load scoring panel.", "error");
  }
};
