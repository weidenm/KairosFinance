import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock modules that use CJS pdf-parse which fails in Vitest ESM
vi.mock('./parser', () => ({
    processFile: vi.fn().mockResolvedValue([]),
}));
vi.mock('./ai', () => ({
    categorizeTransactions: vi.fn(),
    analyzeSpending: vi.fn(),
}));

import app from './index';

// Mock DB and AI modules if needed, but here we can test the structure
// For a real scenario, we would use a test database

describe('API Endpoints', () => {
    it('GET /api/data should return transactions, insights and categories', async () => {
        const res = await request(app).get('/api/data');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('transactions');
        expect(res.body).toHaveProperty('insights');
        expect(res.body).toHaveProperty('categories');
    });

    it('GET /api/categories should return an array', async () => {
        const res = await request(app).get('/api/categories');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/categories should create a new category', async () => {
        const categoryName = `TestCat_${Date.now()}`;
        const res = await request(app)
            .post('/api/categories')
            .send({ name: categoryName });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe(categoryName);
        expect(res.body).toHaveProperty('id');
    });
});
