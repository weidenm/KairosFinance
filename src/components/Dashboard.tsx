import React, { useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Download, Edit2, TrendingDown, Lightbulb, X, Calendar, Trash2, Building2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Transaction {
    id?: number;
    date: string;
    description: string;
    amount: number;
    category: string;
    type: 'entrada' | 'saida';
    account_name?: string;
}

interface Insight {
    period: string;
    content: string;
    type: 'consumption' | 'tip';
}

interface DashboardProps {
    transactions: Transaction[];
    insights: Insight[];
    categories: { id: number, name: string }[];
    onUpdateTransactions: (transactions: Transaction[]) => void;
    onUpdateCategories: () => void;
}

const COLORS = ['#6366f1', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#94a3b8'];

const Dashboard: React.FC<DashboardProps & { onRefreshInsights: () => void }> = ({
    transactions, insights, categories, onUpdateTransactions, onUpdateCategories, onRefreshInsights
}) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [selectedType, setSelectedType] = useState<'entrada' | 'saida' | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);

    const EXCLUDED_CATEGORIES = ['Transferência', 'Pagamento de Cartão'];

    // Get unique months from transactions for the filter
    const availableMonths = React.useMemo(() => {
        const months = transactions.map(t => {
            if (t.date.includes('-')) {
                const [year, month] = t.date.split('-');
                return `${year}-${month}`;
            } else {
                const [day, month, year] = t.date.split('/');
                return `${year}-${month}`;
            }
        });
        return Array.from(new Set(months)).filter(m => !m.includes('undefined')).sort().reverse();
    }, [transactions]);

    const [selectedMonth, setSelectedMonth] = useState<string>(
        availableMonths.length > 0 ? availableMonths[0] : ''
    );

    const [selectedBank, setSelectedBank] = useState<string>('');

    // Extract unique banks from transactions
    const availableBanks = React.useMemo(() => {
        const banks = transactions.map(t => t.account_name || 'Desconhecido');
        return Array.from(new Set(banks)).sort();
    }, [transactions]);

    const filteredByMonthAndBankTransactions = React.useMemo(() => {
        let filtered = transactions;

        if (selectedMonth) {
            filtered = filtered.filter(t => {
                if (t.date.includes('-')) {
                    const [year, month] = t.date.split('-');
                    return `${year}-${month}` === selectedMonth;
                } else {
                    const [, month, year] = t.date.split('/');
                    return `${year}-${month}` === selectedMonth;
                }
            });
        }

        if (selectedBank) {
            filtered = filtered.filter(t => (t.account_name || 'Desconhecido') === selectedBank);
        }

        return filtered;
    }, [transactions, selectedMonth, selectedBank]);

    const previousBalance = React.useMemo(() => {
        if (!selectedMonth) return 0;
        return transactions.reduce((acc, t) => {
            let tMonth;
            if (t.date.includes('-')) {
                const [year, month] = t.date.split('-');
                tMonth = `${year}-${month}`;
            } else {
                const [day, month, year] = t.date.split('/');
                tMonth = `${year}-${month}`;
            }

            if (tMonth < selectedMonth) {
                if (EXCLUDED_CATEGORIES.includes(t.category)) return acc;
                return acc + (t.type === 'entrada' ? t.amount : -Math.abs(t.amount));
            }
            return acc;
        }, 0);
    }, [transactions, selectedMonth, EXCLUDED_CATEGORIES]);

    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsModalOpen(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const categoryTotals = filteredByMonthAndBankTransactions.reduce((acc: any, curr: Transaction) => {
        if (curr.type === 'saida') {
            acc[curr.category] = (acc[curr.category] || 0) + Math.abs(curr.amount);
        }
        return acc;
    }, {});

    const chartData = Object.keys(categoryTotals).map(cat => ({
        name: cat,
        value: categoryTotals[cat]
    })).sort((a, b) => b.value - a.value);

    const totalExpense = filteredByMonthAndBankTransactions
        .filter(t => t.type === 'saida' && !EXCLUDED_CATEGORIES.includes(t.category))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalIncome = filteredByMonthAndBankTransactions
        .filter(t => t.type === 'entrada' && !EXCLUDED_CATEGORIES.includes(t.category))
        .reduce((sum, t) => sum + t.amount, 0);

    const monthInsights = React.useMemo(() => {
        if (!selectedMonth) return { consumption: [], tips: [] };
        const filtered = insights.filter(i => i.period === selectedMonth);
        return {
            consumption: filtered.filter(f => f.type === 'consumption').map(f => f.content),
            tips: filtered.filter(f => f.type === 'tip').map(f => f.content)
        };
    }, [insights, selectedMonth]);

    const handleEditSave = async (id: number) => {
        try {
            await fetch(`http://localhost:3001/api/transactions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: editValue, category: editCategory })
            });

            // Update local state via callback to update the dashboard immediately
            const newTransactions = transactions.map(t =>
                t.id === id ? { ...t, description: editValue, category: editCategory } : t
            );
            onUpdateTransactions(newTransactions);
            setEditingId(null);
        } catch (error) {
            console.error('Erro ao salvar transação:', error);
            alert('Erro ao salvar alterações no banco de dados.');
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefreshInsights();
        setIsRefreshing(false);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
        try {
            await fetch(`http://localhost:3001/api/transactions/${id}`, {
                method: 'DELETE'
            });
            onUpdateTransactions(transactions.filter(t => t.id !== id));
        } catch (error) {
            console.error('Erro ao excluir transação:', error);
            alert('Erro ao excluir do banco de dados.');
        }
    };

    const handleBulkDelete = async () => {
        const ids = filteredTransactionsForDetails.map(t => t.id).filter(id => id !== undefined) as number[];
        if (ids.length === 0) return;
        if (!confirm(`Tem certeza que deseja excluir as ${ids.length} transações filtradas?`)) return;

        try {
            await fetch('http://localhost:3001/api/transactions/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            onUpdateTransactions(transactions.filter(t => !ids.includes(t.id as number)));
        } catch (error) {
            console.error('Erro ao excluir transações em lote:', error);
            alert('Erro ao excluir do banco de dados.');
        }
    };

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredByMonthAndBankTransactions);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transações");
        XLSX.writeFile(wb, `Relatorio_Financeiro_${selectedMonth || 'Geral'}_${selectedBank || 'Todos_Bancos'}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF() as any;
        doc.text(`Relatório Financeiro (${selectedMonth || 'Geral'} - ${selectedBank || 'Todos os Bancos'}) - Kairos Finance`, 14, 15);

        const tableColumn = ["Data", "Descrição", "Categoria", "Tipo", "Valor"];
        const tableRows: any[] = [];

        filteredByMonthAndBankTransactions.forEach(t => {
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
        doc.save(`Relatorio_Financeiro_${selectedMonth || 'Geral'}_${selectedBank || 'Todos_Bancos'}.pdf`);
    };

    const openDetails = (category: string | null = null, type: 'entrada' | 'saida' | null = null) => {
        setSelectedCategory(category);
        setSelectedType(type);
        setIsModalOpen(true);
    };

    const filteredTransactionsForDetails = React.useMemo(() => {
        let filtered = filteredByMonthAndBankTransactions;
        if (selectedCategory) {
            filtered = filtered.filter(t => t.category === selectedCategory);
        }
        if (selectedType) {
            filtered = filtered.filter(t => t.type === selectedType);
        }
        return filtered;
    }, [filteredByMonthAndBankTransactions, selectedCategory, selectedType]);

    return (
        <div className="dashboard-content">
            <div className="flex-between mb-6">
                <h2 className="text-xl font-bold">Resumo Financeiro</h2>
                <div className="flex gap-2 items-center">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 mr-2">
                        <Calendar size={16} className="text-primary" />
                        <select
                            className="bg-transparent border-none outline-none text-sm font-medium cursor-pointer"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        >
                            <option value="" className="bg-slate-800">Todos os Meses</option>
                            {availableMonths.map(month => {
                                const [year, m] = month.split('-');
                                const date = new Date(parseInt(year), parseInt(m) - 1);
                                const monthName = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                                return (
                                    <option key={month} value={month} className="bg-slate-800">
                                        {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 mr-2">
                        <Building2 size={16} className="text-secondary" />
                        <select
                            className="bg-transparent border-none outline-none text-sm font-medium cursor-pointer"
                            value={selectedBank}
                            onChange={(e) => setSelectedBank(e.target.value)}
                        >
                            <option value="" className="bg-slate-800">Todos os Bancos</option>
                            {availableBanks.map(bank => (
                                <option key={bank} value={bank} className="bg-slate-800">
                                    {bank}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button onClick={exportToExcel} className="btn-secondary flex-center gap-2">
                        <Download size={16} /> Excel
                    </button>
                    <button onClick={exportToPDF} className="btn-secondary flex-center gap-2">
                        <Download size={16} /> PDF
                    </button>
                    <button onClick={() => setIsCategoryModalOpen(true)} className="btn-secondary flex-center gap-2">
                        <Edit2 size={16} /> Categorias
                    </button>
                </div>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="glass-card">
                    <p className="text-muted text-sm mb-1">Saldo Anterior</p>
                    <h2 className="text-2xl font-bold" style={{ color: previousBalance >= 0 ? 'var(--text-main)' : 'var(--danger)' }}>
                        R$ {previousBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h2>
                </div>
                <div className="glass-card clickable" onClick={() => openDetails(null, 'entrada')}>
                    <p className="text-muted text-sm mb-1">Entradas no Mês</p>
                    <h2 className="text-2xl font-bold text-success">
                        R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h2>
                </div>
                <div className="glass-card clickable" onClick={() => openDetails(null, 'saida')}>
                    <p className="text-muted text-sm mb-1">Saídas no Mês</p>
                    <h2 className="text-2xl font-bold text-danger">
                        R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h2>
                </div>
                <div className="glass-card">
                    <p className="text-muted text-sm mb-1">Saldo Atual</p>
                    <h2 className="text-2xl font-bold" style={{ color: previousBalance + totalIncome - totalExpense >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        R$ {(previousBalance + totalIncome - totalExpense).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                        {(monthInsights.consumption).map((item, i) => (
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
                        {(monthInsights.tips).map((item, i) => (
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
                            <div className="flex gap-2">
                                <button
                                    onClick={handleBulkDelete}
                                    className="btn-danger flex-center gap-2 text-xs py-1.5 px-3"
                                    title="Excluir todas as transações filtradas"
                                >
                                    <Trash2 size={14} /> Excluir Filtrados
                                </button>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="modal-body">
                            <div className="space-y-3">
                                {filteredTransactionsForDetails.map((t) => (
                                    <div key={t.id} className="transaction-item hover:bg-white/5 rounded-lg border-none px-4">
                                        <div className="flex-1">
                                            {editingId === t.id ? (
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
                                                            {categories.map(cat => (
                                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                            ))}
                                                        </select>
                                                        <button onClick={() => t.id && handleEditSave(t.id)} className="text-success text-xs font-bold">Salvar</button>
                                                        <button onClick={() => setEditingId(null)} className="text-muted text-xs">Cancelar</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 group">
                                                    <p className="font-bold">{t.description}</p>
                                                    <button
                                                        onClick={() => {
                                                            if (t.id) {
                                                                setEditingId(t.id);
                                                                setEditValue(t.description);
                                                                setEditCategory(t.category);
                                                            }
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-accent"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => t.id && handleDelete(t.id)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-danger"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={14} />
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

            {isCategoryModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content glass-card max-w-md w-full">
                        <div className="flex-between mb-6">
                            <h3 className="text-xl font-bold">Gerenciar Categorias</h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="flex gap-2 mb-6">
                                <input
                                    className="bg-white/10 border border-white/20 rounded px-3 py-2 flex-1 outline-none text-sm"
                                    placeholder="Nova categoria..."
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                />
                                <button
                                    onClick={async () => {
                                        if (!newCategoryName.trim()) return;
                                        await fetch('http://localhost:3001/api/categories', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ name: newCategoryName })
                                        });
                                        setNewCategoryName('');
                                        onUpdateCategories();
                                    }}
                                    className="bg-primary px-4 py-2 rounded-lg text-sm font-bold"
                                >
                                    Adicionar
                                </button>
                            </div>

                            <div className="space-y-2">
                                {categories.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                        {editingCategoryId === cat.id ? (
                                            <input
                                                autoFocus
                                                className="bg-white/10 border border-white/20 rounded px-2 py-1 flex-1 text-sm outline-none"
                                                value={newCategoryName}
                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                onBlur={async () => {
                                                    await fetch(`http://localhost:3001/api/categories/${cat.id}`, {
                                                        method: 'PUT',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ name: newCategoryName })
                                                    });
                                                    setEditingCategoryId(null);
                                                    setNewCategoryName('');
                                                    onUpdateCategories();
                                                }}
                                            />
                                        ) : (
                                            <span className="text-sm">{cat.name}</span>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingCategoryId(cat.id);
                                                    setNewCategoryName(cat.name);
                                                }}
                                                className="text-muted hover:text-accent"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (confirm('Tem certeza que deseja excluir esta categoria?')) {
                                                        await fetch(`http://localhost:3001/api/categories/${cat.id}`, { method: 'DELETE' });
                                                        onUpdateCategories();
                                                    }
                                                }}
                                                className="text-muted hover:text-danger"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
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
