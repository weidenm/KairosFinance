# Kairos Finance 🚀
Seu assistente financeiro inteligente com persistência local e IA.

Agente de análise de dados financeiros que processa extratos bancários e faturas (PDF, CSV, XLSX, Imagens) usando IA para categorizar transações, gerar insights e gerenciar suas finanças de forma privada e eficiente.

---

## ✨ Funcionalidades Premium

### 📁 Inteligência e Processamento
- **Análise Multi-formato**: Processamento automático de PDFs, CSVs e fotos de comprovantes.
- **Categorização Adaptável**: IA inteligente que aprende e usa suas categorias personalizadas.
- **Rastreabilidade**: Todas as transações registram o arquivo de origem para sua segurança.
- **Insights Contextuais**: Sugestões de economia e análise de consumo geradas por IA.

### 💾 Persistência e Privacidade
- **Local-First (SQLite)**: Seus dados permanecem na sua máquina em um banco de dados ACID compatível.
- **Auto-loading**: A aplicação inicia instantaneamente carregando seus dados salvos.
- **Gestão de Contas**: Suporte para múltiplas contas bancárias (Ex: Nubank, Itaú, Santander).
- **CRUD de Categorias**: Controle total sobre a lista de categorias disponíveis.

### 🎨 Experiência do Usuário (UI/UX)
- **Glassmorphism Design**: Interface moderna com transparências, desfoque de fundo e sombras suaves.
- **Dashboard Interativo**: Gráficos dinâmicos (Barra e Pizza) com filtros por categoria.
- **Edição em Tempo Real**: Altere descrições e categorias de transações diretamente no painel.
- **Exportação**: Relatórios profissionais em Excel e PDF com um clique.

---

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)

## ⚙️ Configuração

1.  **Clone o repositório:**
    ```bash
    git clone <url-do-repositorio>
    cd KairosFinance
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Variáveis de Ambiente:**
    Crie um arquivo `.env` na raiz:
    ```env
    PERPLEXITY_API_KEY=sua_chave_aqui
    PORT=3001
    ```

## 🚀 Executando o Projeto

Execute ambos os servidores (Frontend e Backend) simultaneamente:
```bash
npm run dev:all
```

### Executar apenas o Frontend (Vite)
```bash
npm run dev
```
O frontend estará disponível em `http://localhost:5173`.

### Executar apenas o Backend (Servidor Node.js)
```bash
npm run server
```
O backend estará rodando em `http://localhost:3001`.

## 🧪 Testes

### Executando Testes
Atualmente, o projeto está em fase inicial de estruturação de testes. Para rodar o linter e verificar erros de código:
```bash
npm run lint
```

### Sugestões de Teste Manual
1. Inicie o projeto com `npm run dev:all`.
2. Acesse `http://localhost:5173`.
3. Faça o upload de um arquivo de extrato (PDF ou imagem).
4. Verifique se as transações são extraídas e categorizadas corretamente no dashboard.

## 🛠️ Tecnologias

- **Frontend:** React 18, TypeScript, Recharts, Lucide-React, CSS Glassmorphism.
- **Backend:** Node.js, Express, `better-sqlite3`, Multer, PDF-parse.
- **IA:** Perplexity AI / OpenAI para reconhecimento de transações e análise financeira.

---

## 🆘 Solução de Problemas (Windows)

Se a execução de scripts estiver desabilitada no PowerShell, execute no terminal como Administrador:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

Desenvolvido para transformar sua organização financeira com o poder da IA. 💎
