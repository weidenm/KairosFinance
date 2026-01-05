import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
});

export async function categorizeTransactions(rawInputs: any[]) {
    if (rawInputs.length === 0) return [];

    const prompt = `
    Você é um assistente financeiro. Abaixo estão extratos brutos de bancos ou faturas (texto ou metadados).
    Extraia todas as transações individuais.
    Para cada transação, identifique: data, descrição, valor (positivo para entrada, negativo para saída), categoria e o arquivo de origem (source_file).
    Categorias permitidas: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Compras, Outros.
    Retorne APENAS um JSON no formato: { "transactions": [ { "date": "YYYY-MM-DD", "description": "...", "amount": 0.00, "category": "...", "type": "entrada/saida", "source_file": "..." } ] }

    Dados Brutos:
    ${JSON.stringify(rawInputs)}
  `;

    const response = await openai.chat.completions.create({
        model: 'sonar-pro',
        messages: [
            { role: 'system', content: 'Be a precise financial parser. Return only JSON.' },
            { role: 'user', content: prompt }
        ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Falha ao categorizar transações via AI.');

    // Remove markdown code blocks if present
    const cleanContent = content.replace(/```json\n?|```/g, '').trim();

    const parsed = JSON.parse(cleanContent);
    return parsed.transactions || parsed;
}

export async function analyzeSpending(categorizedData: any[]) {
    const prompt = `
    Analise os seguintes dados financeiros e forneça insights sobre o consumo e dicas de organização financeira.
    Retorne APENAS um JSON no formato: { 
        "consumption": ["insight 1", "insight 2", ...], 
        "tips": ["dica 1", "dica 2", ...] 
    }
    Seja prático e direto.
    Dados:
    ${JSON.stringify(categorizedData)}
  `;

    const response = await openai.chat.completions.create({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0].message.content;
    if (!content) return { consumption: [], tips: [] };

    try {
        const cleanContent = content.replace(/```json\n?|```/g, '').trim();
        return JSON.parse(cleanContent);
    } catch (e) {
        console.error('Erro ao parsear insights:', e);
        return { consumption: ["Não foi possível gerar insights detalhados."], tips: ["Mantenha um registro regular de seus gastos."] };
    }
}
