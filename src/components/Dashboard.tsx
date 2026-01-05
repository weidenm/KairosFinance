import React, { useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Download, Edit2, TrendingDown, Lightbulb, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Transaction {
    date: string;
    description: string;
    amount: number;
    category: string;
    type: 'entrada' | 'saida';
}

interface Insights {
    consumption: string[];
    tips: string[];
}

interface DashboardProps {
    transactions: Transaction[];
    insights: Insights;
    onUpdateTransactions: (transactions: Transaction[]) => void;
}

const COLORS = ['#6366f1', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#94a3b8'];

const CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Compras', 'Outros'];

const Dashboard: React.FC<DashboardProps & { onRefreshInsights: () => void }> = ({
    transactions, insights, onUpdateTransactions, onRefreshInsights
}) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsModalOpen(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const categoryTotals = transactions.reduce((acc: any, curr: Transaction) => {
        if (curr.type === 'saida') {
            acc[curr.category] = (acc[curr.category] || 0) + Math.abs(curr.amount);
        }
        return acc;
    }, {});

    const chartData = Object.keys(categoryTotals).map(cat => ({
        name: cat,
        value: categoryTotals[cat]
    })).sort((a, b) => b.value - a.value);

    const totalExpense = transactions
        .filter(t => t.type === 'saida')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalIncome = transactions
        .filter(t => t.type === 'entrada')
        .reduce((sum, t) => sum + t.amount, 0);

    const handleEditSave = (idx: number) => {
        const newTransactions = [...transactions];
        newTransactions[idx].description = editValue;
        newTransactions[idx].category = editCategory;
        onUpdateTransactions(newTransactions);
        setEditingIdx(null);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefreshInsights();
        setIsRefreshing(false);
    };

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(transactions);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transações");
        XLSX.writeFile(wb, "Relatorio_Financeiro.xlsx");
    };

    const exportToPDF = () => {
        const doc = new jsPDF() as any;
        doc.text("Relatório Financeiro - Antigravity", 14, 15);

        const tableColumn = ["Data", "Descrição", "Categoria", "Tipo", "Valor"];
        const tableRows: any[] = [];

        transactions.forEach(t => {
            const data = [
                t.date,
                t.description,
                t.category,
                t.type,
                `R$ ${t.amount.toFixed(2)}`
            ];
            tableRows.push(data);
        });

        doc.autoTable(tableColumn, tableRows, { startY: 20 });
        doc.save("Relatorio_Financeiro.pdf");
    };

    const openDetails = (category: string | null = null) => {
        setSelectedCategory(category);
        setIsModalOpen(true);
    };

    const filteredTransactions = selectedCategory
        ? transactions.filter(t => t.category === selectedCategory)
        : transactions;

    return (
        <div className="dashboard-content">
            <div className="flex-between mb-6">
                <h2 className="text-xl font-bold">Resumo Financeiro</h2>
                <div className="flex gap-2">
                    <button onClick={exportToExcel} className="btn-secondary flex-center gap-2">
                        <Download size={16} /> Excel
                    </button>
                    <button onClick={exportToPDF} className="btn-secondary flex-center gap-2">
                        <Download size={16} /> PDF
                    </button>
                </div>
            </div>

            <div className="stats-grid">
                <div className="glass-card clickable" onClick={() => openDetails()}>
                    <p className="text-muted text-sm mb-1">Total Entradas</p>
                    <h2 className="text-2xl font-bold text-success">R$ {totalIncome.toLocaleString('pt-BR')}</h2>
                </div>
                <div className="glass-card clickable" onClick={() => openDetails()}>
                    <p className="text-muted text-sm mb-1">Total Saídas</p>
                    <h2 className="text-2xl font-bold text-danger">R$ {totalExpense.toLocaleString('pt-BR')}</h2>
                </div>
                <div className="glass-card">
                    <p className="text-muted text-sm mb-1">Saldo Atual</p>
                    <h2 className="text-2xl font-bold" style={{ color: totalIncome - totalExpense >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        R$ {(totalIncome - totalExpense).toLocaleString('pt-BR')}
                    </h2>
                </div>
            </div>

            <div className="chart-section">
                <div className="glass-card h-80">
                    <h3 className="text-lg font-bold mb-4">Gasto por Categoria</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={chartData} onClick={(e) => e && e.activeLabel && openDetails(String(e.activeLabel))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" />
                            <YAxis stroke="var(--text-muted)" />
                            <Tooltip
                                contentStyle={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--text-main)' }}
                            />
                            <Bar
                                dataKey="value"
                                fill="var(--primary)"
                                radius={[4, 4, 0, 0]}
                                className="cursor-pointer"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-card h-80">
                    <h3 className="text-lg font-bold mb-4">Distribuição</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                onClick={(e) => openDetails(e.name)}
                            >
                                {chartData.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="cursor-pointer" />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="flex-between mb-4">
                <h3 className="text-xl font-bold">Insights e Recomendações</h3>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="btn-secondary flex-center gap-2 text-xs py-1"
                >
                    <Lightbulb size={14} className={isRefreshing ? 'animate-pulse' : ''} />
                    {isRefreshing ? 'Analisando...' : 'Refazer Análise IA'}
                </button>
            </div>

            <div className="insights-grid">
                <div className="glass-card">
                    <div className="flex items-center gap-2 mb-4 text-accent">
                        <TrendingDown size={20} />
                        <h3 className="text-lg font-bold">Insights de Consumo</h3>
                    </div>
                    <ul className="space-y-3">
                        {insights.consumption.map((item, i) => (
                            <li key={i} className="text-sm border-l-2 border-accent pl-3 py-1">{item}</li>
                        ))}
                    </ul>
                </div>
                <div className="glass-card">
                    <div className="flex items-center gap-2 mb-4 text-success">
                        <Lightbulb size={20} />
                        <h3 className="text-lg font-bold">Dicas de Organização</h3>
                    </div>
                    <ul className="space-y-3">
                        {insights.tips.map((item, i) => (
                            <li key={i} className="text-sm border-l-2 border-success pl-3 py-1">{item}</li>
                        ))}
                    </ul>
                </div>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content glass-card max-w-2xl w-full">
                        <div className="flex-between mb-6">
                            <h3 className="text-xl font-bold">
                                {selectedCategory ? `Detalhes: ${selectedCategory}` : 'Todas as Transações'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="space-y-3">
                                {filteredTransactions.map((t, idx) => (
                                    <div key={idx} className="transaction-item hover:bg-white/5 rounded-lg border-none px-4">
                                        <div className="flex-1">
                                            {editingIdx === idx ? (
                                                <div className="flex flex-col gap-2 mb-1">
                                                    <input
                                                        autoFocus
                                                        className="bg-white/10 border border-white/20 rounded px-2 py-1 flex-1 text-sm outline-none"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                    />
                                                    <div className="flex gap-2">
                                                        <select
                                                            className="bg-slate-800 border border-white/20 rounded px-2 py-1 text-xs outline-none cursor-pointer"
                                                            value={editCategory}
                                                            onChange={(e) => setEditCategory(e.target.value)}
                                                        >
                                                            {CATEGORIES.map(cat => (
                                                                <option key={cat} value={cat}>{cat}</option>
                                                            ))}
                                                        </select>
                                                        <button onClick={() => handleEditSave(idx)} className="text-success text-xs font-bold">Salvar</button>
                                                        <button onClick={() => setEditingIdx(null)} className="text-muted text-xs">Cancelar</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 group">
                                                    <p className="font-bold">{t.description}</p>
                                                    <button
                                                        onClick={() => {
                                                            setEditingIdx(idx);
                                                            setEditValue(t.description);
                                                            setEditCategory(t.category);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-accent"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-xs text-muted">{t.date} • {t.category}</p>
                                        </div>
                                        <p className={`amount ${t.type === 'saida' ? 'negative' : 'positive'}`}>
                                            {t.type === 'saida' ? '-' : '+'} R$ {Math.abs(t.amount).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
