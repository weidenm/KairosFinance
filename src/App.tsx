import { useState } from 'react';
import FileUploader from './components/FileUploader';
import Dashboard from './components/Dashboard';
import './styles/dashboard.css';

function App() {
  const [data, setData] = useState<{ transactions: any[], insights: any } | null>(null);

  const updateTransactions = (newTransactions: any[]) => {
    if (data) {
      setData({ ...data, transactions: newTransactions });
    }
  };

  const refreshInsights = async () => {
    if (!data) return;
    try {
      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: data.transactions })
      });
      const newInsights = await response.json();
      setData({ ...data, insights: newInsights });
    } catch (error) {
      console.error('Erro ao atualizar insights:', error);
    }
  };

  return (
    <div className="dashboard-container">
      <header className="header">
        <div>
          <h1 className="title">Antigravity Finance</h1>
          <p className="text-muted">Seu assistente financeiro inteligente</p>
        </div>
      </header>

      {!data ? (
        <div className="max-w-xl mx-auto mt-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Comece sua análise agora</h2>
            <p className="text-muted">Faça upload de seus extratos e deixe que nossa IA organize tudo para você em segundos.</p>
          </div>
          <FileUploader onDataReceived={setData} />
        </div>
      ) : (
        <>
          <Dashboard
            transactions={data.transactions}
            insights={data.insights}
            onUpdateTransactions={updateTransactions}
            onRefreshInsights={refreshInsights}
          />
          <button
            onClick={() => setData(null)}
            className="mt-8 px-6 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
          >
            Limpar e Novo Upload
          </button>
        </>
      )}
    </div>
  );
}

export default App;
