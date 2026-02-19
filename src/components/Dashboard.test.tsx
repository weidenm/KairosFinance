import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from './Dashboard';

const mockTransactions = [
    { id: 1, date: '2026-01-01', description: 'Salário', amount: 5000, category: 'Salário', type: 'entrada' as const, account_name: 'Bank A' },
    { id: 2, date: '2026-01-02', description: 'Aluguel', amount: 1500, category: 'Moradia', type: 'saida' as const, account_name: 'Bank A' },
    { id: 3, date: '2026-02-01', description: 'Bônus', amount: 1000, category: 'Salário', type: 'entrada' as const, account_name: 'Bank B' },
];

const mockInsights = [
    { period: '2026-02', content: 'Gasto alto em moradia', type: 'consumption' as const },
    { period: '2026-02', content: 'Tente economizar no lazer', type: 'tip' as const },
];

const mockCategories = [
    { id: 1, name: 'Salário' },
    { id: 2, name: 'Moradia' },
];

describe('Dashboard Component', () => {
    const onUpdateTransactions = vi.fn();
    const onUpdateCategories = vi.fn();
    const onRefreshInsights = vi.fn();

    it('renders financial totals correctly for the selected month', () => {
        // By default, it should select the latest month (February 2026 in our mock)
        render(
            <Dashboard
                transactions={mockTransactions}
                insights={mockInsights}
                categories={mockCategories}
                onUpdateTransactions={onUpdateTransactions}
                onUpdateCategories={onUpdateCategories}
                onRefreshInsights={onRefreshInsights}
            />
        );

        // February total income: 1000, total expense: 0, balance: 1000
        // Previous balance (January): 5000 - 1500 = 3500
        // Current balance (Feb): 3500 + 1000 = 4500
        expect(screen.getAllByText(/1\.000/)[0]).toBeInTheDocument();
        expect(screen.getByText(/3\.500/)).toBeInTheDocument(); // Saldo Anterior
        expect(screen.getByText(/4\.500/)).toBeInTheDocument(); // Saldo Atual
    });

    it('updates totals and previous balance when switching months', () => {
        render(
            <Dashboard
                transactions={mockTransactions}
                insights={mockInsights}
                categories={mockCategories}
                onUpdateTransactions={onUpdateTransactions}
                onUpdateCategories={onUpdateCategories}
                onRefreshInsights={onRefreshInsights}
            />
        );

        const select = screen.getAllByRole('combobox')[0]; // First one is the month selector
        fireEvent.change(select, { target: { value: '2026-01' } });

        // January totals: Income 5000, Expense 1500, Balance 3500
        // Previous balance for January: 0
        expect(screen.getByText(/5\.000/)).toBeInTheDocument();
        expect(screen.getByText(/1\.500/)).toBeInTheDocument();
        expect(screen.getByText(/3\.500/)).toBeInTheDocument(); // Saldo Atual
        expect(screen.getAllByText(/0,00/)[0]).toBeInTheDocument(); // Saldo Anterior (zero)
    });

    it('opens details modal when clicking a summary card', () => {
        render(
            <Dashboard
                transactions={mockTransactions}
                insights={mockInsights}
                categories={mockCategories}
                onUpdateTransactions={onUpdateTransactions}
                onUpdateCategories={onUpdateCategories}
                onRefreshInsights={onRefreshInsights}
            />
        );

        const incomeCard = screen.getByText('Entradas no Mês').closest('.glass-card');
        if (incomeCard) fireEvent.click(incomeCard);

        expect(screen.getByText('Todas as Transações')).toBeInTheDocument();
        // February transaction
        expect(screen.getByText('Bônus')).toBeInTheDocument();
    });
});
