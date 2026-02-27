import { db } from './db.js';
import { getSession } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
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

    // ── Handlers ──
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

        alert('Hackathon created successfully!');
    });
});
