import { db } from "../core/db.js";
import AuthManager, { getSession } from "../core/auth.js";
import { showToast, formatDate } from "../core/utils.js";

class Dashboard {
  constructor() {
    this.user = null;
    this.userData = null;
    this.init();
  }

  async init() {
    await this.loadUser();
    this.setupEventListeners();
    this.loadDashboardData();
  }

  async loadUser() {
    // Check session from local JSON auth
    const session = getSession();
    if (!session) {
      window.location.href = "../auth/login.html";
      return;
    }

    this.user = session;
    this.userData = session;
    this.updateUI();
  }

  updateUI() {
    if (!this.userData) return;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val ?? "";
    };

    set("userName", this.userData.name);
    set("displayName", this.userData.name);
    set("userEmail", this.userData.email);
    set("userRole", this.userData.role);
    set("userOrganization", this.userData.organization);

    const initialsEl = document.getElementById("userInitials");
    if (initialsEl && this.userData.name) {
      initialsEl.textContent = this.userData.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
  }

  setupEventListeners() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => AuthManager.logout());
    }

    document.querySelectorAll(".sidebar-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        this.navigateToSection(link.dataset.section);
      });
    });

    const menuToggle = document.getElementById("menuToggle");
    if (menuToggle) {
      menuToggle.addEventListener("click", () => {
        document.querySelector(".sidebar")?.classList.toggle("active");
      });
    }
  }

  navigateToSection(sectionId) {
    document
      .querySelectorAll(".dashboard-section")
      .forEach((s) => s.classList.remove("active"));
    document.getElementById(sectionId)?.classList.add("active");
    document.querySelectorAll(".sidebar-link").forEach((link) => {
      link.classList.toggle("active", link.dataset.section === sectionId);
    });
  }

  async loadDashboardData() {
    /* override in subclasses */
  }

  createCard(title, content, className = "") {
    return `
            <div class="dashboard-card glass-card ${className}">
                <h3>${title}</h3>
                <div class="card-content">${content}</div>
            </div>
        `;
  }

  createTable(headers, data) {
    return `
            <table class="data-table">
                <thead>
                    <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
                </thead>
                <tbody>
                    ${data
                      .map(
                        (row) => `
                        <tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
        `;
  }
}

export default Dashboard;
