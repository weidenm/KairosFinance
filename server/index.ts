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
        const insights = db.prepare("SELECT * FROM ai_insights ORDER BY created_at DESC").all();
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
        // Find the period before deleting
        const tx = db.prepare('SELECT date FROM transactions WHERE id = ?').get(id) as { date: string } | undefined;
        if (tx) {
            const period = tx.date.includes('-') ? tx.date.substring(0, 7) : `${tx.date.split('/')[2]}-${tx.date.split('/')[1]}`;
            db.prepare('DELETE FROM transactions WHERE id = ?').run(id);

            // Check if month is empty
            const remaining = db.prepare('SELECT count(*) as count FROM transactions WHERE (date LIKE ? OR date LIKE ?)').get(`${period}-%`, `%/${period.split('-')[1]}/${period.split('-')[0]}`) as { count: number };
            if (remaining.count === 0) {
                db.prepare('DELETE FROM ai_insights WHERE period = ?').run(period);
            }
        }
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

        // Find periods affected
        const placeholders = ids.map(() => '?').join(',');
        const periods = db.prepare(`SELECT DISTINCT SUBSTR(date, 1, 7) as period FROM transactions WHERE id IN (${placeholders}) AND date LIKE '____-__%'`).all(...ids) as { period: string }[];

        db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders})`).run(...ids);

        // Cleanup empty months
        for (const { period } of periods) {
            const remaining = db.prepare("SELECT count(*) as count FROM transactions WHERE date LIKE ?").get(`${period}-%`) as { count: number };
            if (remaining.count === 0) {
                db.prepare('DELETE FROM ai_insights WHERE period = ?').run(period);
            }
        }

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

function adjustCreditCardDates(transactions: any[], accountName: string): any[] {
    const creditKeywords = ['fatura', 'cartão', 'cartao', 'credit', 'card'];

    // Always preserve the original date for all transactions
    for (const tx of transactions) {
        tx.original_date = tx.date || null;
    }

    // Group by source_file
    const byFile: Record<string, any[]> = {};
    for (const tx of transactions) {
        const key = tx.source_file || 'unknown';
        if (!byFile[key]) byFile[key] = [];
        byFile[key].push(tx);
    }

    for (const [filename, fileTxs] of Object.entries(byFile)) {
        const isCreditCard = creditKeywords.some(kw =>
            filename.toLowerCase().includes(kw) ||
            accountName.toLowerCase().includes(kw)
        );
        if (!isCreditCard) continue;

        // Determine statement month (most frequent month)
        const monthCounts: Record<string, number> = {};
        for (const tx of fileTxs) {
            if (!tx.date) continue;
            const month = tx.date.substring(0, 7); // "YYYY-MM"
            monthCounts[month] = (monthCounts[month] || 0) + 1;
        }
        const statementMonth = Object.entries(monthCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!statementMonth) continue;

        // Adjust dates earlier than the statement month
        for (const tx of fileTxs) {
            if (!tx.date) continue;
            const txMonth = tx.date.substring(0, 7);
            if (txMonth < statementMonth) {
                tx.date = `${statementMonth}-01`;
            }
        }
    }

    return transactions;
}

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

        // Fetch historical category mappings for context
        const historicalMappings = db.prepare(`
            SELECT description, category, COUNT(*) as count 
            FROM transactions 
            GROUP BY description, category 
            HAVING count > 1
            ORDER BY count DESC 
            LIMIT 100
        `).all();

        const allowedCategories = db.prepare('SELECT name FROM categories').all().map((c: any) => c.name);
        let categorizedTransactions = await categorizeTransactions(allTransactions, allowedCategories, historicalMappings);

        // Adjust dates for credit card installment purchases and preserve original dates
        categorizedTransactions = adjustCreditCardDates(categorizedTransactions, accountName);

        // Check for potential duplicates in the DB
        const confirmedUnique = req.body.confirmedUnique === 'true' || req.body.confirmedUnique === true;
        const potentialDuplicates: any[] = [];

        if (!confirmedUnique) {
            for (const tx of categorizedTransactions) {
                const existing = db.prepare(`
                    SELECT * FROM transactions 
                    WHERE date = ? AND amount = ? AND description = ? AND account_id = ?
                `).get(tx.date, tx.amount, tx.description, account.id);

                if (existing) {
                    potentialDuplicates.push({ ...tx, account_name: accountName });
                }
            }
        }

        if (potentialDuplicates.length > 0 && !confirmedUnique) {
            return res.json({
                potentialDuplicates,
                message: 'Algumas transações parecem ser duplicadas. Deseja continuar?'
            });
        }

        // Save transactions to DB
        const insertTx = db.prepare('INSERT INTO transactions (account_id, date, original_date, description, amount, category, type, source_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const transaction = db.transaction((txs) => {
            for (const tx of txs) {
                insertTx.run(account!.id, tx.date, tx.original_date, tx.description, tx.amount, tx.category, tx.type, tx.source_file);
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
        const insights = db.prepare("SELECT * FROM ai_insights ORDER BY created_at DESC").all();
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
        const allTxs = db.prepare('SELECT * FROM transactions').all() as any[];
        if (!allTxs || allTxs.length === 0) {
            return res.status(400).json({ error: 'Nenhuma transação encontrada para análise.' });
        }

        // Group by month
        const groups: Record<string, any[]> = {};
        allTxs.forEach(tx => {
            const period = tx.date.includes('-') ? tx.date.substring(0, 7) : `${tx.date.split('/')[2]}-${tx.date.split('/')[1]}`;
            if (!groups[period]) groups[period] = [];
            groups[period].push(tx);
        });

        const periods = Object.keys(groups).sort();
        const insertInsight = db.prepare('INSERT INTO ai_insights (period, content, type) VALUES (?, ?, ?)');

        for (let i = 0; i < periods.length; i++) {
            const currentPeriod = periods[i];
            const currentTxs = groups[currentPeriod];

            // Comparative context from previous month
            let comparativeContext = '';
            if (i > 0) {
                const prevPeriod = periods[i - 1];
                const prevTxs = groups[prevPeriod];
                const prevSummary: Record<string, number> = {};
                prevTxs.forEach(t => {
                    if (t.type === 'saida') {
                        prevSummary[t.category] = (prevSummary[t.category] || 0) + Math.abs(t.amount);
                    }
                });
                comparativeContext = `Resumo do mês anterior (${prevPeriod}):\n` +
                    Object.entries(prevSummary).map(([cat, val]) => `- ${cat}: R$ ${val.toFixed(2)}`).join('\n');
            }

            const insights = await analyzeSpending(currentTxs, comparativeContext);

            // Save insights for this SPECIFIC period
            db.prepare('DELETE FROM ai_insights WHERE period = ?').run(currentPeriod);
            const insertMany = db.transaction((consumption: string[], tips: string[]) => {
                consumption.forEach((c: string) => insertInsight.run(currentPeriod, c, 'consumption'));
                tips.forEach((t: string) => insertInsight.run(currentPeriod, t, 'tip'));
            });
            insertMany(insights.consumption, insights.tips);
        }

        const allInsights = db.prepare("SELECT * FROM ai_insights ORDER BY created_at DESC").all();
        res.json(allInsights);
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
