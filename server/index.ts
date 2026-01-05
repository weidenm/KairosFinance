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
        const transactions = db.prepare('SELECT * FROM transactions ORDER BY date DESC').all();
        const insights = {
            consumption: db.prepare("SELECT content FROM ai_insights WHERE type = 'consumption'").all().map((i: any) => i.content),
            tips: db.prepare("SELECT content FROM ai_insights WHERE type = 'tip'").all().map((i: any) => i.content)
        };
        res.json({ transactions, insights });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const files = req.files as Express.Multer.File[];
        const { accountName } = req.body;

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

        const allTransactions = [];
        for (const file of files) {
            const transactions = await processFile(file);
            // Add filename to raw transactions to guide AI
            const transactionsWithFile = transactions.map(tx => ({ ...tx, source_file: file.originalname }));
            allTransactions.push(...transactionsWithFile);
        }

        const categorizedTransactions = await categorizeTransactions(allTransactions);

        // Save transactions to DB
        const insertTx = db.prepare('INSERT INTO transactions (account_id, date, description, amount, category, type, source_file) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const transaction = db.transaction((txs) => {
            for (const tx of txs) {
                insertTx.run(account!.id, tx.date, tx.description, tx.amount, tx.category, tx.type, tx.source_file);
            }
        });
        transaction(categorizedTransactions);

        const insights = await analyzeSpending(categorizedTransactions);

        // Save insights to DB (categorized ones)
        const insertInsight = db.prepare('INSERT INTO ai_insights (content, type) VALUES (?, ?)');
        insights.consumption.forEach((c: string) => insertInsight.run(c, 'consumption'));
        insights.tips.forEach((t: string) => insertInsight.run(t, 'tip'));

        res.json({
            transactions: categorizedTransactions,
            insights: insights
        });
    } catch (error: any) {
        console.error('Erro no upload:', error);
        res.status(500).json({ error: error.message || 'Erro ao processar arquivos.' });
    }
});

app.post('/api/analyze', async (req, res) => {
    try {
        const { transactions } = req.body;
        if (!transactions || !Array.isArray(transactions)) {
            return res.status(400).json({ error: 'Transações não fornecidas.' });
        }
        const insights = await analyzeSpending(transactions);
        res.json(insights);
    } catch (error: any) {
        console.error('Erro na análise:', error);
        res.status(500).json({ error: error.message || 'Erro ao processar análise.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
