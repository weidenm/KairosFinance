import { useState, useEffect } from 'react';
import FileUploader from './components/FileUploader';
import Dashboard from './components/Dashboard';
import './styles/dashboard.css';
import { Plus } from 'lucide-react';

function App() {
  const [data, setData] = useState<{ transactions: any[], insights: any, categories: any[] } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/data');
      const result = await response.json();
      if (result.transactions && result.transactions.length >= 0) {
        setData(result);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDataReceived = (newData: any) => {
    setData(newData);
    setShowUpload(false);
    fetchData(); // Refresh to get updated categories if any
  };

  const updateTransactions = (newTransactions: any[]) => {
    if (data) {
      setData({ ...data, transactions: newTransactions });
    }
  };

  const refreshInsights = async () => {
    if (!data) return;
    try {
      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST'
      });
      const newInsights = await response.json();
      setData({ ...data, insights: newInsights });
    } catch (error) {
      console.error('Erro ao atualizar insights:', error);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <p className="text-xl animate-pulse">Carregando seus dados financeiros...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="header glass-card" style={{ marginBottom: '2rem', padding: '1rem 1.5rem' }}>
        <div>
          <h1 className="title" style={{ margin: 0 }}>Kairos Finance</h1>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>Seu assistente financeiro inteligente</p>
        </div>
        <div className="flex gap-4 items-center" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {data && !showUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="btn-secondary flex-center gap-2 py-2"
            >
              <Plus size={18} /> Novo Upload
            </button>
          )}
          <div className="text-right">
            <p className="text-xs text-muted">Status do Sistema</p>
            <p className="text-sm font-bold text-success flex items-center gap-1">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
              Online
            </p>
          </div>
        </div>
      </header>

      {(!data || showUpload) ? (
        <div className="max-w-xl mx-auto mt-12">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black mb-4 tracking-tight">
              {data ? 'Adicionar novos comprovantes' : 'Comece sua análise agora'}
            </h2>
            <p className="text-muted text-lg">Faça upload de seus extratos e deixe que nossa IA organize tudo para você em segundos.</p>
            {data && (
              <button
                onClick={() => setShowUpload(false)}
                className="mt-4 text-primary hover:underline text-sm"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
              >
                Voltar para o Dashboard
              </button>
            )}
          </div>
          <FileUploader onDataReceived={handleDataReceived} />
        </div>
      ) : (
        <Dashboard
          transactions={data.transactions}
          insights={data.insights}
          categories={data.categories || []}
          onUpdateTransactions={updateTransactions}
          onUpdateCategories={fetchData}
          onRefreshInsights={refreshInsights}
        />
      )}
    </div>
  );
}

export default App;
