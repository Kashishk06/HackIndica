/**
 * JSON Database Handler
 * 
 * This module handles data persistence using a combination of:
 * 1. Initial fetch from db.json
 * 2. Persistence in LocalStorage for CRUD operations
 */

const STORAGE_KEY = 'hackathon_v2_db';

class JSONDatabase {
    constructor() {
        this.data = null;
        this.initialized = this.init();
    }

    async init() {
        // Try to load from localStorage first
        const localData = localStorage.getItem(STORAGE_KEY);
        if (localData) {
            this.data = JSON.parse(localData);
            return;
        }

        // Otherwise fetch from db.json
        try {
            const response = await fetch('db.json');
            this.data = await response.json();
            this.save();
        } catch (error) {
            console.error('Failed to initialize database:', error);
            this.data = { hackathons: [], users: [] };
        }
    }

    save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }

    async getCollection(name) {
        await this.initialized;
        return this.data[name] || [];
    }

    async findDocument(collection, key, value) {
        await this.initialized;
        return (this.data[collection] || []).find(d => d[key] === value);
    }

    async addDocument(collection, doc) {
        await this.initialized;
        if (!this.data[collection]) this.data[collection] = [];

        const newDoc = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            createdAt: new Date().toISOString(),
            ...doc
        };

        this.data[collection].push(newDoc);
        this.save();
        return newDoc;
    }

    async updateDocument(collection, id, updates) {
        await this.initialized;
        const index = this.data[collection].findIndex(d => d.id === id);
        if (index !== -1) {
            this.data[collection][index] = { ...this.data[collection][index], ...updates, updatedAt: new Date().toISOString() };
            this.save();
            return this.data[collection][index];
        }
        return null;
    }

    async deleteDocument(collection, id) {
        await this.initialized;
        const index = this.data[collection].findIndex(d => d.id === id);
        if (index !== -1) {
            this.data[collection].splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }
}

export const db = new JSONDatabase();
