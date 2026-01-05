# Antigravity 🚀

Agente de Análise de Dados Financeiros inteligente que processa extratos bancários e faturas de cartão de crédito em diversos formatos (PDF, CSV, XLSX, Imagem) usando IA para categorizar transações e gerar dashboards de gastos.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado em sua máquina:
- [Node.js](https://nodejs.org/) (Versão 18 ou superior)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)

## ⚙️ Configuração

1. Clone o repositório:
   ```bash
   git clone <url-do-repositorio>
   cd Antigravity
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   Crie um arquivo `.env` na raiz do projeto (se não existir) com a sua chave da API da Perplexity (ou OpenAI, dependendo da implementação):
   ```env
   PERPLEXITY_API_KEY=sua_chave_aqui
   PORT=3001
   ```

## 🚀 Executando o Projeto

Você pode executar o frontend e o backend separadamente ou simultaneamente.

### Executar Tudo (Frontend + Backend)
Este comando inicia ambos os servidores ao mesmo tempo:
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

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React, TypeScript, Vite, Recharts, Lucide-React.
- **Backend:** Node.js, Express, Multer, PDF-parse.
- **IA:** OpenAI / Perplexity API para categorização inteligente.

## 🆘 Solução de Problemas (Windows)

### Erro de Execução de Scripts (PowerShell)
Se você receber o erro: *"O arquivo ... não pode ser carregado porque a execução de scripts foi desabilitada"*, siga estes passos:

1. Abra o **PowerShell** como **Administrador** (procure por PowerShell no menu Iniciar, clique com o botão direito e selecione "Executar como Administrador").
2. Execute o comando abaixo:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. Digite `S` (Sim) e pressione `Enter`.

Após isso, você conseguirá executar os comandos `npm` normalmente. Alternativamente, você pode usar o **Prompt de Comando (CMD)** em vez do PowerShell.
