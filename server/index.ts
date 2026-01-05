import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { processFile } from './parser';
import { categorizeTransactions, analyzeSpending } from './ai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', upload.array('files'), async (req, res) => {
    try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        const allTransactions = [];
        for (const file of files) {
            const transactions = await processFile(file);
            allTransactions.push(...transactions);
        }

        const categorizedTransactions = await categorizeTransactions(allTransactions);
        const insights = await analyzeSpending(categorizedTransactions);

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
