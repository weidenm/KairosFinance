import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import * as xlsx from 'xlsx';

export async function processFile(file: Express.Multer.File): Promise<any[]> {
    const { mimetype, buffer, originalname } = file;

    if (mimetype === 'application/pdf') {
        return processPDF(buffer);
    } else if (mimetype === 'text/csv' || originalname.endsWith('.csv')) {
        return processCSV(buffer);
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || originalname.endsWith('.xlsx')) {
        return processExcel(buffer);
    } else if (mimetype.startsWith('image/')) {
        return processImage(buffer);
    } else {
        throw new Error(`Formato de arquivo não suportado: ${mimetype}`);
    }
}

async function processPDF(buffer: Buffer): Promise<any[]> {
    const data = await pdfParse(buffer);
    // Simplificado para envio direto ao GPT para extração estruturada
    return [{ rawText: data.text, source: 'pdf' }];
}

async function processCSV(buffer: Buffer): Promise<any[]> {
    const content = buffer.toString('utf-8');
    // Simplificado: enviar conteúdo CSV para o GPT
    return [{ rawText: content, source: 'csv' }];
}

async function processExcel(buffer: Buffer): Promise<any[]> {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet);
    return json.map((item: any) => ({ ...item, source: 'xlsx' }));
}

async function processImage(buffer: Buffer): Promise<any[]> {
    // OpenAI Vision lidará com isso no ai.ts se necessário, 
    // aqui apenas marcamos como imagem para o processamento subsequente
    const base64 = buffer.toString('base64');
    return [{ imageBase64: base64, source: 'image' }];
}
