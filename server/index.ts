import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { processFile } from './parser';
import { categorizeTransactions, analyzeSpending } from './ai';
import db from './db';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/accounts', (req, res) => {
    try {
        const accounts = db.prepare('SELECT * FROM accounts ORDER BY name').all();
        res.json(accounts);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/data', (req, res) => {
    try {
        const transactions = db.prepare(`
            SELECT t.*, a.name as account_name 
            FROM transactions t 
            LEFT JOIN accounts a ON t.account_id = a.id 
            ORDER BY t.date DESC
        `).all();
        const lastCreatedAt = db.prepare('SELECT MAX(created_at) as max_date FROM ai_insights').get() as { max_date: string } | undefined;
        const insights = {
            consumption: lastCreatedAt?.max_date ? db.prepare("SELECT content FROM ai_insights WHERE type = 'consumption' AND created_at = ?").all(lastCreatedAt.max_date).map((i: any) => i.content) : [],
            tips: lastCreatedAt?.max_date ? db.prepare("SELECT content FROM ai_insights WHERE type = 'tip' AND created_at = ?").all(lastCreatedAt.max_date).map((i: any) => i.content) : []
        };
        const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
        res.json({ transactions, insights, categories });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/categories', (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
        res.json(categories);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/categories', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Nome da categoria não fornecido.' });
        const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
        res.json({ id: info.lastInsertRowid, name });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/categories/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Nome da categoria não fornecido.' });
        db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
        res.json({ id, name });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/categories/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/check-duplicates', (req, res) => {
    try {
        const { filenames, accountName } = req.body;
        if (!filenames || !accountName) return res.status(400).json({ error: 'Parâmetros ausentes.' });

        const account = db.prepare('SELECT id FROM accounts WHERE name = ?').get(accountName) as { id: number } | undefined;
        if (!account) return res.json({ duplicates: [] });

        const placeholders = filenames.map(() => '?').join(',');
        const duplicates = db.prepare(`SELECT DISTINCT source_file FROM transactions WHERE account_id = ? AND source_file IN (${placeholders})`)
            .all(account.id, ...filenames) as { source_file: string }[];

        res.json({ duplicates: duplicates.map(d => d.source_file) });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/transactions/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
        res.json({ success: true, id });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/transactions/bulk-delete', (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'Lista de IDs inválida.' });
        }
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders})`).run(...ids);
        res.json({ success: true, count: ids.length });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/transactions/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { description, category } = req.body;
        db.prepare('UPDATE transactions SET description = ?, category = ? WHERE id = ?').run(description, category, id);
        res.json({ id, description, category });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const files = req.files as Express.Multer.File[];
        const { accountName, overwrite } = req.body;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        if (!accountName) {
            return res.status(400).json({ error: 'Nome da conta não fornecido.' });
        }

        // Get or create account
        let account = db.prepare('SELECT id FROM accounts WHERE name = ?').get(accountName) as { id: number } | undefined;
        if (!account) {
            const info = db.prepare('INSERT INTO accounts (name) VALUES (?)').run(accountName);
            account = { id: info.lastInsertRowid as number };
        }

        // If overwrite is requested, delete old records first
        if (overwrite === 'true' || overwrite === true) {
            const filenames = files.map(f => f.originalname);
            const placeholders = filenames.map(() => '?').join(',');
            db.prepare(`DELETE FROM transactions WHERE account_id = ? AND source_file IN (${placeholders})`).run(account.id, ...filenames);
            // Also clean up orphan insights if we want, but usually insights are per upload session.
            // For now, focus on transactions as requested.
        }

        const allTransactions = [];
        for (const file of files) {
            const transactions = await processFile(file);
            // Add filename to raw transactions to guide AI
            const transactionsWithFile = transactions.map(tx => ({ ...tx, source_file: file.originalname }));
            allTransactions.push(...transactionsWithFile);
        }

        const allowedCategories = db.prepare('SELECT name FROM categories').all().map((c: any) => c.name);
        const categorizedTransactions = await categorizeTransactions(allTransactions, allowedCategories);

        // Save transactions to DB
        const insertTx = db.prepare('INSERT INTO transactions (account_id, date, description, amount, category, type, source_file) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const transaction = db.transaction((txs) => {
            for (const tx of txs) {
                insertTx.run(account!.id, tx.date, tx.description, tx.amount, tx.category, tx.type, tx.source_file);
            }
        });
        transaction(categorizedTransactions);

        // Fetch full state to ensure frontend remains in sync and doesn't crash
        const savedTransactions = db.prepare(`
            SELECT t.*, a.name as account_name 
            FROM transactions t 
            LEFT JOIN accounts a ON t.account_id = a.id 
            ORDER BY t.date DESC
        `).all();
        const lastCreatedAt = db.prepare('SELECT MAX(created_at) as max_date FROM ai_insights').get() as { max_date: string } | undefined;
        const insights = {
            consumption: lastCreatedAt?.max_date ? db.prepare("SELECT content FROM ai_insights WHERE type = 'consumption' AND created_at = ?").all(lastCreatedAt.max_date).map((i: any) => i.content) : [],
            tips: lastCreatedAt?.max_date ? db.prepare("SELECT content FROM ai_insights WHERE type = 'tip' AND created_at = ?").all(lastCreatedAt.max_date).map((i: any) => i.content) : []
        };
        const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();

        res.json({
            transactions: savedTransactions,
            insights: insights,
            categories: categories
        });
    } catch (error: any) {
        console.error('Erro no upload:', error);
        res.status(500).json({ error: error.message || 'Erro ao processar arquivos.' });
    }
});

app.post('/api/analyze', async (req, res) => {
    try {
        const transactions = db.prepare('SELECT * FROM transactions').all();
        if (!transactions || transactions.length === 0) {
            return res.status(400).json({ error: 'Nenhuma transação encontrada para análise.' });
        }

        const insights = await analyzeSpending(transactions);

        // Save insights to DB (without deleting old ones to keep history)
        // We use a single transaction to ensure they all get the same created_at
        const insertInsight = db.prepare('INSERT INTO ai_insights (content, type) VALUES (?, ?)');
        const insertMany = db.transaction((consumption: string[], tips: string[]) => {
            consumption.forEach((c: string) => insertInsight.run(c, 'consumption'));
            tips.forEach((t: string) => insertInsight.run(t, 'tip'));
        });

        insertMany(insights.consumption, insights.tips);

        res.json(insights);
    } catch (error: any) {
        console.error('Erro na análise:', error);
        res.status(500).json({ error: error.message || 'Erro ao processar análise.' });
    }
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
    });
}

export default app;
