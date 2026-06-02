# 📦 AgendaMercado - Sistema de Agendamento de Mercadorias

Sistema profissional para gerenciar agendamentos de entrega de mercadorias.

---

## 🎯 Características

✅ **Autenticação de Fornecedores**  
✅ **Painel Administrativo (Recebedor)**  
✅ **Calendário Visual**  
✅ **Validação de Horários Bloqueados** (Seg/Qui 10:00-12:00)  
✅ **Dark Mode**  
✅ **Responsivo (Mobile/Desktop)**  
✅ **Design Profissional**  

---

## 📋 Requisitos

- **Node.js** v14+
- **PostgreSQL** v12+
- **npm** ou **yarn**

---

## 🚀 Instalação

### 1️⃣ **Backend**

```bash
cd backend
npm install
cp .env.example .env
```

Editar `.env`:
```
DATABASE_URL=postgresql://seu_usuario:sua_senha@localhost:5432/agendamento_db
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### 2️⃣ **Banco de Dados**

Criar banco PostgreSQL:
```bash
createdb agendamento_db
psql agendamento_db < database.sql
```

Ou via pgAdmin:
1. Criar banco `agendamento_db`
2. Abrir SQL Editor
3. Copiar e colar conteúdo de `database.sql`
4. Executar

### 3️⃣ **Iniciar Backend**

```bash
npm start
# Deve aparecer: 🚀 AgendaMercado API Online (Porta: 3000)
```

### 4️⃣ **Frontend**

Abrir em navegador:
```
http://localhost:3000/frontend/index.html
```

Ou usando Live Server (VSCode):
1. Clicar botão direito em `frontend/index.html`
2. Selecionar "Open with Live Server"

---

## 📝 Credenciais Padrão

### **Recebedor (Admin)**
- Email: `admin@mercado.com`
- Senha: `admin123456`

### **Fornecedor**
- Criar via página de cadastro

---

## 🔒 Horários Bloqueados

| Dia | Período | Motivo |
|-----|---------|--------|
| Segunda | 10:00 - 12:00 | Coleta no Ceasa |
| Quinta | 10:00 - 12:00 | Coleta no Ceasa |

---

## 🏗️ Estrutura do Projeto

```
agendamento-mercado/
├── backend/
│   ├── server.js           # Servidor Express
│   ├── package.json        # Dependências
│   ├── .env.example        # Variáveis de ambiente
│   └── database.sql        # Script SQL
├── frontend/
│   ├── index.html          # Página inicial
│   ├── login-fornecedor.html
│   ├── cadastro-fornecedor.html
│   ├── area-fornecedor.html
│   ├── login-recebedor.html
│   ├── painel-recebedor.html
│   ├── css/
│   │   └── styles.css      # Estilos compartilhados
│   └── js/
│       └── config.js       # Configurações globais
└── README.md
```

---

## 🔌 API Endpoints

### **Agendamentos**
```
GET    /api/agendamentos                  # Listar todos
POST   /api/agendamentos                  # Criar novo
PUT    /api/agendamentos/:id/aprovar      # Aprovar
PUT    /api/agendamentos/:id/recusar      # Recusar
DELETE /api/agendamentos/:id              # Cancelar
```

### **Fornecedores**
```
GET    /api/fornecedores                  # Listar
```

### **Autenticação**
```
POST   /api/auth/fornecedor/login         # Login fornecedor
POST   /api/auth/fornecedor/cadastro      # Cadastro fornecedor
POST   /api/auth/admin/login              # Login admin
```

---

## 📱 Funcionalidades

### **Fornecedor**
- ✅ Criar agendamentos
- ✅ Visualizar status dos agendamentos
- ✅ Receber aprovação/recusa
- ✅ Ver horários bloqueados

### **Recebedor (Admin)**
- ✅ Criar agendamentos manualmente
- ✅ Aprovar agendamentos
- ✅ Recusar agendamentos
- ✅ Cancelar agendamentos
- ✅ Ver calendário completo

---

## 🌙 Dark Mode

Ativar/desativar via botão no header (🌙)

---

## 🚀 Deploy

### **Vercel (Frontend)**
1. Criar conta em vercel.com
2. Conectar repositório GitHub
3. Configurar `Build Command`: `npm install`
4. Configurar `Output Directory`: `frontend`

### **Render (Backend)**
1. Criar conta em render.com
2. Criar serviço Node
3. Conectar repositório
4. `Build Command`: `npm install`
5. `Start Command`: `npm start`
6. Adicionar variáveis de ambiente:
   - `DATABASE_URL` (PostgreSQL do Render)
   - `PORT` (10000)
   - `NODE_ENV` (production)

---

## 🐛 Troubleshooting

### **Erro: Database connection refused**
- Verificar se PostgreSQL está rodando
- Verificar DATABASE_URL em `.env`
- Criar banco com `createdb agendamento_db`

### **Erro: CORS não permitido**
- Verificar `CORS_ORIGIN` em `.env`
- Frontend URL deve estar cadastrada

### **Login não funciona**
- Verificar se admin foi inserido no banco
- Usar pgAdmin para verifi car tabela `usuarios`

---

## 📞 Suporte

Para problemas ou dúvidas:
1. Verificar console do navegador (F12)
2. Verificar logs do servidor
3. Usar Postman para testar API

---

## 📄 Licença

MIT

---

**Versão:** 1.0.0  
**Última atualização:** 31/05/2026
