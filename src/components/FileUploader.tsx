import React, { useState } from 'react';
import axios from 'axios';
import { Upload, X, FileText, Image as ImageIcon, Table } from 'lucide-react';

interface FileUploaderProps {
    onDataReceived: (data: any) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onDataReceived }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [accountName, setAccountName] = useState('');
    const [existingAccounts, setExistingAccounts] = useState<{ id: number, name: string }[]>([]);
    const [potentialDuplicates, setPotentialDuplicates] = useState<any[]>([]);

    React.useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await axios.get('http://localhost:3001/api/accounts');
                setExistingAccounts(response.data);
            } catch (error) {
                console.error('Erro ao buscar contas:', error);
            }
        };
        fetchAccounts();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const uploadFiles = async (overwrite: boolean = false) => {
        if (files.length === 0) return;
        if (!accountName.trim()) {
            alert('Por favor, selecione ou digite o nome de uma conta bancária.');
            return;
        }

        // Only check for duplicates if we're not already in an overwrite flow
        if (!overwrite) {
            try {
                const checkResponse = await axios.post('http://localhost:3001/api/check-duplicates', {
                    filenames: files.map(f => f.name),
                    accountName
                });

                if (checkResponse.data.duplicates && checkResponse.data.duplicates.length > 0) {
                    const duplicateNames = checkResponse.data.duplicates.join(', ');
                    const confirm = window.confirm(
                        `Os seguintes arquivos já foram importados para esta conta: ${duplicateNames}.\n\n` +
                        `Deseja apagar as transações existentes desses arquivos e importá-las novamente?`
                    );
                    if (!confirm) return;
                    return uploadFiles(true); // Retry with overwrite
                }
            } catch (error) {
                console.error('Erro ao verificar duplicatas:', error);
            }
        }

        setIsUploading(true);

        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        formData.append('accountName', accountName);
        if (overwrite) {
            formData.append('overwrite', 'true');
        }
        if (potentialDuplicates.length > 0) {
            formData.append('confirmedUnique', 'true');
        }

        try {
            const response = await axios.post('http://localhost:3001/api/upload', formData);

            if (response.data.potentialDuplicates && response.data.potentialDuplicates.length > 0 && potentialDuplicates.length === 0) {
                setPotentialDuplicates(response.data.potentialDuplicates);
                return;
            }

            onDataReceived(response.data);
            setFiles([]);
            setAccountName('');
            setPotentialDuplicates([]);
        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Erro ao processar arquivos. Verifique se o servidor está rodando.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="glass-card">
            <div className="mb-6">
                <label className="block text-sm font-medium mb-2 opacity-70">Conta Bancária</label>
                <div className="relative">
                    <input
                        list="accounts-list"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="Selecione ou digite o nome da conta (ex: Nubank)"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-primary transition-colors"
                    />
                    <datalist id="accounts-list">
                        {existingAccounts.map(acc => (
                            <option key={acc.id} value={acc.name} />
                        ))}
                    </datalist>
                </div>
            </div>

            <div
                className="upload-zone"
                onClick={() => document.getElementById('file-input')?.click()}
            >
                <Upload className="mx-auto mb-4" size={48} color="var(--primary)" />
                <h3 className="text-xl font-bold mb-2">Arraste seus comprovantes ou clique aqui</h3>
                <p className="text-muted">Suporta PDF, CSV, XLSX, OFX e Imagens</p>
                <input
                    id="file-input"
                    type="file"
                    multiple
                    hidden
                    onChange={handleFileChange}
                    accept=".pdf,.csv,.xlsx,.ofx,image/*"
                />
            </div>

            {files.length > 0 && (
                <div className="mt-6">
                    <div className="space-y-3">
                        {files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                <div className="flex items-center gap-3">
                                    {file.type.includes('image') ? <ImageIcon size={20} /> : file.type.includes('pdf') ? <FileText size={20} /> : <Table size={20} />}
                                    <span className="text-sm"> {file.name} </span>
                                </div>
                                <button onClick={() => removeFile(idx)} className="text-danger hover:opacity-80">
                                    <X size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => uploadFiles()}
                        disabled={isUploading}
                        className="w-full mt-6 py-3 bg-primary rounded-xl font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
                    >
                        {isUploading ? 'Processando com IA...' : 'Analisar Comprovantes'}
                    </button>
                </div>
            )}

            {potentialDuplicates.length > 0 && (
                <div className="modal-overlay">
                    <div className="modal-content glass-card max-w-lg w-full">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-accent mb-2">Possíveis Duplicatas Detectadas</h3>
                            <p className="text-sm opacity-70">As seguintes transações já existem nesta conta com a mesma data e valor:</p>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2 mb-6">
                            {potentialDuplicates.map((tx, i) => (
                                <div key={i} className="p-3 bg-white/5 rounded-lg text-xs">
                                    <div className="flex justify-between font-bold">
                                        <span>{tx.date}</span>
                                        <span className={tx.type === 'saida' ? 'text-danger' : 'text-success'}>
                                            R$ {Math.abs(tx.amount).toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                    <div className="opacity-70">{tx.description}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => uploadFiles()}
                                className="btn-primary flex-1 py-2 font-bold"
                            >
                                Confirmar e Importar Tudo
                            </button>
                            <button
                                onClick={() => {
                                    setPotentialDuplicates([]);
                                    setFiles([]);
                                    setAccountName('');
                                }}
                                className="btn-secondary flex-1 py-2"
                            >
                                Cancelar Importação
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileUploader;
