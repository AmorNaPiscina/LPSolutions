// server.js - SERVIDOR COMPLETO COM TODAS AS ROTAS

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { db, inicializarBanco } = require('./database');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Inicializar banco
inicializarBanco();

// ==========================================
// ROTA DE TESTE
// ==========================================
app.get('/', (req, res) => {
  res.json({ 
    mensagem: '🎉 Servidor rodando!',
    status: 'OK'
  });
});

// ==========================================
// ROTAS DE AUTENTICAÇÃO FORNECEDOR
// ==========================================

// LOGIN FORNECEDOR
app.post('/api/auth/fornecedor/login', (req, res) => {
  const { email, senha } = req.body;
  const bcrypt = require('bcrypt');
  
  db.get(`
    SELECT cf.*, f.nome_empresa, f.nome_contato, f.telefone
    FROM contas_fornecedores cf
    JOIN fornecedores f ON cf.fornecedor_id = f.id
    WHERE cf.email = ? AND cf.ativo = 1
  `, [email], (err, row) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    
    if (!row) {
      return res.status(401).json({ erro: 'Email ou senha inválidos!' });
    }
    
    if (!bcrypt.compareSync(senha, row.senha)) {
      return res.status(401).json({ erro: 'Email ou senha inválidos!' });
    }
    
    res.json({
      mensagem: 'Login realizado!',
      fornecedor: {
        id: row.fornecedor_id,
        nome_empresa: row.nome_empresa,
        nome_contato: row.nome_contato,
        telefone: row.telefone,
        email: row.email
      }
    });
  });
});

// CADASTRO FORNECEDOR
app.post('/api/auth/fornecedor/cadastro', (req, res) => {
  const { nome_empresa, nome_contato, telefone, email, senha } = req.body;
  const bcrypt = require('bcrypt');
  
  // Verificar se email já existe
  db.get('SELECT * FROM contas_fornecedores WHERE email = ?', [email], (err, row) => {
    if (row) {
      return res.status(400).json({ erro: 'Email já cadastrado!' });
    }

    // Criar fornecedor
    db.run(`
      INSERT INTO fornecedores (nome_empresa, nome_contato, telefone, email)
      VALUES (?, ?, ?, ?)
    `, [nome_empresa, nome_contato, telefone, email], function(errForn) {
      if (errForn) {
        return res.status(500).json({ erro: errForn.message });
      }

      const fornecedorId = this.lastID;
      const senhaHash = bcrypt.hashSync(senha, 10);
      
      // Criar conta de login
      db.run(`
        INSERT INTO contas_fornecedores (fornecedor_id, email, senha)
        VALUES (?, ?, ?)
      `, [fornecedorId, email, senhaHash], (errConta) => {
        if (errConta) {
          return res.status(500).json({ erro: errConta.message });
        }

        res.json({ 
          mensagem: 'Conta criada!',
          fornecedor_id: fornecedorId
        });
      });
    });
  });
});

// ==========================================
// ROTAS DE AGENDAMENTOS
// ==========================================

// LISTAR TODOS AGENDAMENTOS
app.get('/api/agendamentos', (req, res) => {
  db.all(`
    SELECT 
      a.*,
      f.nome_empresa,
      f.nome_contato,
      f.telefone
    FROM agendamentos a
    LEFT JOIN fornecedores f ON a.fornecedor_id = f.id
    ORDER BY a.data_entrega DESC, a.horario_inicio DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ erro: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// LISTAR AGENDAMENTOS DO FORNECEDOR
app.get('/api/fornecedor/:id/agendamentos', (req, res) => {
  const { id } = req.params;
  
  db.all(`
    SELECT 
      a.*,
      f.nome_empresa
    FROM agendamentos a
    JOIN fornecedores f ON a.fornecedor_id = f.id
    WHERE a.fornecedor_id = ?
    ORDER BY a.data_entrega DESC, a.horario_inicio DESC
  `, [id], (err, rows) => {
    if (err) {
      res.status(500).json({ erro: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// CRIAR AGENDAMENTO
app.post('/api/agendamentos', (req, res) => {
  const { fornecedor_id, data_entrega, horario_inicio, horario_fim, tipo_mercadoria, volume, tempo_estimado, observacoes } = req.body;
  
  db.run(`
    INSERT INTO agendamentos (fornecedor_id, data_entrega, horario_inicio, horario_fim, tipo_mercadoria, volume, tempo_estimado, observacoes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [fornecedor_id, data_entrega, horario_inicio, horario_fim, tipo_mercadoria, volume, tempo_estimado, observacoes], function(err) {
    if (err) {
      res.status(500).json({ erro: err.message });
    } else {
      res.json({ 
        mensagem: 'Agendamento criado!',
        id: this.lastID 
      });
    }
  });
});

// APROVAR AGENDAMENTO
app.put('/api/agendamentos/:id/aprovar', (req, res) => {
  const { id } = req.params;
  
  db.run(`
    UPDATE agendamentos 
    SET status = 'Aprovado', atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [id], function(err) {
    if (err) {
      res.status(500).json({ erro: err.message });
    } else {
      res.json({ mensagem: 'Agendamento aprovado!' });
    }
  });
});

// RECUSAR AGENDAMENTO
app.put('/api/agendamentos/:id/recusar', (req, res) => {
  const { id } = req.params;
  
  db.run(`
    UPDATE agendamentos 
    SET status = 'Recusado', atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [id], function(err) {
    if (err) {
      res.status(500).json({ erro: err.message });
    } else {
      res.json({ mensagem: 'Agendamento recusado!' });
    }
  });
});

// ==========================================
// ROTAS FORNECEDORES
// ==========================================

app.get('/api/fornecedores', (req, res) => {
  db.all('SELECT * FROM fornecedores ORDER BY nome_empresa', (err, rows) => {
    if (err) {
      res.status(500).json({ erro: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// ==========================================
// ROTAS BLOQUEIOS
// ==========================================

app.get('/api/bloqueios', (req, res) => {
  db.all('SELECT * FROM horarios_bloqueados WHERE ativo = 1', (err, rows) => {
    if (err) {
      res.status(500).json({ erro: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`✅  Servidor rodando em http://localhost:${PORT}`);
  console.log('🚀 ========================================');
  console.log('');
  console.log('📋 Rotas disponíveis:');
  console.log(`   GET  http://localhost:${PORT}/`);
  console.log(`   GET  http://localhost:${PORT}/api/agendamentos`);
  console.log(`   POST http://localhost:${PORT}/api/agendamentos`);
  console.log(`   POST http://localhost:${PORT}/api/auth/fornecedor/login`);
  console.log(`   POST http://localhost:${PORT}/api/auth/fornecedor/cadastro`);
  console.log(`   GET  http://localhost:${PORT}/api/fornecedor/:id/agendamentos`);
  console.log(`   PUT  http://localhost:${PORT}/api/agendamentos/:id/aprovar`);
  console.log(`   PUT  http://localhost:${PORT}/api/agendamentos/:id/recusar`);
  console.log('');
});