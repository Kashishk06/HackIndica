import { db } from './db.js';
import { getSession } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('hackathonList');
    const refreshBtn = document.getElementById('refreshBtn');
    const addBtn = document.getElementById('addBtn');
    const navCta = document.querySelector('.nav-cta');

    // ── Auth Check ──
    const session = getSession();
    if (session) {
        navCta.innerHTML = `
            <a href="dashboards/${session.role}.html" class="btn btn-primary">
                <i class="fa-solid fa-gauge"></i> Dashboard
            </a>
        `;
    } else {
        navCta.innerHTML = `
            <a href="login.html" class="btn btn-primary">
                <i class="fa-solid fa-sign-in"></i> Get Started
            </a>
        `;
    }

    // ── Render Function ──
    async function renderHackathons() {
        listContainer.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-lo);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';

        const hackathons = await db.getCollection('hackathons');

        if (hackathons.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-lo);">No hackathons found. Create one to get started!</div>';
            return;
        }

        listContainer.innerHTML = hackathons.map(h => `
            <div class="hackathon-item animate__animated animate__fadeInUp">
                <div class="item-info">
                    <h4>${h.name}</h4>
                    <span><i class="fa-solid fa-location-dot"></i> ${h.location} • <i class="fa-solid fa-calendar"></i> ${new Date(h.startDate).toLocaleDateString()}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span class="status-badge">${h.domain.toUpperCase()}</span>
                    <button class="btn btn-delete" data-id="${h.id}" style="padding: 8px; background: transparent; color: var(--text-lo);"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');

        // Attach Delete Listeners
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm('Delete this hackathon?')) {
                    await db.deleteDocument('hackathons', id);
                    renderHackathons();
                }
            });
        });
    }

    // ── Handlers ──
    refreshBtn.addEventListener('click', () => renderHackathons());

    addBtn.addEventListener('click', async () => {
        const name = prompt('Hackathon Name:');
        if (!name) return;

        const domain = prompt('Domain (ai, web3, open):', 'open');
        const location = prompt('Location:', 'Virtual');

        await db.addDocument('hackathons', {
            name,
            domain,
            location,
            startDate: new Date().toISOString(),
            status: 'upcoming'
        });

        renderHackathons();
    });

    // Initial Load
    renderHackathons();
});
