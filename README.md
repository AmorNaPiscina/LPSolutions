# 🏪 Sistema de Agendamento - Mercado

Sistema completo de agendamento de entregas de mercadorias com login para fornecedores e painel administrativo.

---

## 📁 Estrutura do Projeto

```
projeto-organizado/
├── backend/
│   ├── database.js       # Conexão e configuração do banco
│   └── server.js         # Servidor Node.js + Express
├── frontend/
│   ├── index.html                  # Página inicial
│   ├── login-fornecedor.html       # Login fornecedor
│   ├── cadastro-fornecedor.html    # Cadastro fornecedor
│   ├── area-fornecedor.html        # Dashboard fornecedor
│   ├── login-admin.html            # Login admin
│   ├── painel-admin.html           # Painel admin
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── config.js
│       ├── login-fornecedor.js
│       ├── cadastro.js
│       ├── area-fornecedor.js
│       ├── login-admin.js
│       └── painel-admin.js
└── README.md
```

---

## 🚀 Como Rodar

### 1. Instalar dependências
```bash
npm init -y
npm install express sqlite3 cors body-parser bcrypt
```

### 2. Iniciar servidor
```bash
cd backend
node server.js
```

### 3. Abrir frontend
Abra `frontend/index.html` no navegador

---

## 👤 Credenciais

**Admin:** admin@mercado.com / 123456
**Fornecedor:** Criar conta no sistema

---

## 📋 Funcionalidades

✅ Cadastro e login de fornecedores
✅ Dashboard com estatísticas
✅ Criar/visualizar agendamentos
✅ Painel admin com calendário
✅ Aprovar/recusar agendamentos
✅ Senhas criptografadas

---

Desenvolvido para Extensão III - Faculdade
