// ===========================
// IMPORTS
// ===========================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// ===========================
// CONFIG
// ===========================
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ===========================
// DATABASE CONNECTION
// ===========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Erro na pool:', err);
});

// ===========================
// ROTAS DE TESTE
// ===========================
app.get('/', (req, res) => {
  res.json({ 
    mensagem: '✅ API AgendaMercado online',
    versao: '1.0.0',
    endpoints: {
      agendamentos: '/api/agendamentos',
      fornecedores: '/api/fornecedores',
      login_fornecedor: 'POST /api/auth/fornecedor/login',
      login_admin: 'POST /api/auth/admin/login'
    }
  });
});

// ===========================
// ROTAS: AGENDAMENTOS
// ===========================

// Listar todos os agendamentos (admin)
app.get('/api/agendamentos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        f.nome_empresa,
        f.nome_contato,
        f.telefone
      FROM agendamentos a
      LEFT JOIN fornecedores f ON a.fornecedor_id = f.id
      ORDER BY a.data_entrega DESC, a.horario_inicio DESC
    `);
    
    console.log('📊 Agendamentos retornados:', result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao listar agendamentos:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Listar agendamentos de um fornecedor específico
app.get('/api/fornecedor/:id/agendamentos', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT * FROM agendamentos 
      WHERE fornecedor_id = $1
      ORDER BY data_entrega DESC, horario_inicio DESC
    `, [id]);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Criar agendamento COM VALIDAÇÃO DE HORÁRIOS BLOQUEADOS
app.post('/api/agendamentos', async (req, res) => {
  try {
    const { fornecedor_id, data_entrega, horario_inicio, horario_fim, 
            tipo_mercadoria, volume, tempo_estimado, observacoes } = req.body;

    // VALIDAÇÃO: Segunda (1) e Quinta (4) das 10:00 às 12:00
    const data = new Date(data_entrega + 'T00:00:00');
    const diaSemana = data.getDay();

    const horariosBlockeados = [
      { dia: 1, inicio: '10:00', fim: '12:00' }, // Segunda
      { dia: 4, inicio: '10:00', fim: '12:00' }  // Quinta
    ];

    for (const bloqueio of horariosBlockeados) {
      if (diaSemana === bloqueio.dia) {
        // Converter para minutos
        const [h1, m1] = horario_inicio.split(':').map(Number);
        const [h2, m2] = horario_fim.split(':').map(Number);
        const [hBloqueio1, mBloqueio1] = bloqueio.inicio.split(':').map(Number);
        const [hBloqueio2, mBloqueio2] = bloqueio.fim.split(':').map(Number);
        
        const inicioMin = h1 * 60 + m1;
        const fimMin = h2 * 60 + m2;
        const bloqueioInicioMin = hBloqueio1 * 60 + mBloqueio1;
        const bloqueioFimMin = hBloqueio2 * 60 + mBloqueio2;

        // Verificar sobreposição
        if (!(fimMin <= bloqueioInicioMin || inicioMin >= bloqueioFimMin)) {
          return res.status(400).json({ 
            erro: 'Horário bloqueado - Coleta no Ceasa (10:00-12:00)',
            horarioBloqueado: true 
          });
        }
      }
    }

    // Inserir agendamento se passou na validação
    const result = await pool.query(
      `INSERT INTO agendamentos 
       (fornecedor_id, data_entrega, horario_inicio, horario_fim, 
        tipo_mercadoria, volume, tempo_estimado, observacoes, status, criado_em, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pendente', NOW(), NOW())
       RETURNING *`,
      [fornecedor_id, data_entrega, horario_inicio, horario_fim,
       tipo_mercadoria, volume, tempo_estimado, observacoes]
    );

    console.log('✅ Agendamento criado:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao criar agendamento:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Aprovar agendamento
app.put('/api/agendamentos/:id/aprovar', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE agendamentos 
       SET status = 'Aprovado', atualizado_em = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Agendamento não encontrado' });
    }

    console.log('✅ Agendamento aprovado:', id);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Recusar agendamento
app.put('/api/agendamentos/:id/recusar', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE agendamentos 
       SET status = 'Recusado', atualizado_em = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Agendamento não encontrado' });
    }

    console.log('✅ Agendamento recusado:', id);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Cancelar/Deletar agendamento
app.delete('/api/agendamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM agendamentos WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Agendamento não encontrado' });
    }

    console.log('✅ Agendamento cancelado:', id);
    res.json({ mensagem: 'Agendamento cancelado' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===========================
// ROTAS: FORNECEDORES
// ===========================

// Listar todos os fornecedores
app.get('/api/fornecedores', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fornecedores ORDER BY nome_empresa');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===========================
// ROTAS: AUTENTICAÇÃO FORNECEDOR
// ===========================

// Login fornecedor
app.post('/api/auth/fornecedor/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    // Buscar conta do fornecedor
    const resultConta = await pool.query(
      'SELECT * FROM contas_fornecedores WHERE email = $1 AND ativo = true',
      [email]
    );

    if (resultConta.rows.length === 0) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const conta = resultConta.rows[0];

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, conta.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    // Buscar dados do fornecedor
    const resultFornecedor = await pool.query(
      'SELECT id, nome_empresa, nome_contato, telefone, email FROM fornecedores WHERE id = $1',
      [conta.fornecedor_id]
    );

    const fornecedor = resultFornecedor.rows[0];

    console.log('✅ Login fornecedor:', email);
    res.json({ 
      mensagem: 'Login bem-sucedido',
      fornecedor 
    });
  } catch (err) {
    console.error('❌ Erro no login fornecedor:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Cadastro fornecedor
app.post('/api/auth/fornecedor/cadastro', async (req, res) => {
  try {
    const { nome_empresa, nome_contato, telefone, email, senha } = req.body;

    if (!nome_empresa || !nome_contato || !telefone || !email || !senha) {
      return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
    }

    if (senha.length < 8) {
      return res.status(400).json({ erro: 'Senha deve ter no mínimo 8 caracteres' });
    }

    // Verificar se email já existe
    const checkEmail = await pool.query(
      'SELECT id FROM contas_fornecedores WHERE email = $1',
      [email]
    );

    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Iniciar transação
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Inserir fornecedor
      const resultFornecedor = await client.query(
        `INSERT INTO fornecedores (nome_empresa, nome_contato, telefone, criado_em)
         VALUES ($1, $2, $3, NOW())
         RETURNING id`,
        [nome_empresa, nome_contato, telefone]
      );

      const fornecedorId = resultFornecedor.rows[0].id;

      // Inserir conta
      await client.query(
        `INSERT INTO contas_fornecedores (fornecedor_id, email, senha, ativo, criado_em)
         VALUES ($1, $2, $3, true, NOW())`,
        [fornecedorId, email, senhaHash]
      );

      await client.query('COMMIT');

      console.log('✅ Fornecedor cadastrado:', email);
      res.status(201).json({ mensagem: 'Cadastro realizado com sucesso' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Erro no cadastro fornecedor:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ===========================
// ROTAS: AUTENTICAÇÃO ADMIN
// ===========================

// Login admin/recebedor
app.post('/api/auth/admin/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    // Buscar admin na tabela usuarios
    const result = await pool.query(
      'SELECT id, nome, email FROM usuarios WHERE email = $1 AND tipo = $2',
      [email, 'admin']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const usuario = result.rows[0];

    // Verificar senha
    const resultSenha = await pool.query(
      'SELECT senha FROM usuarios WHERE id = $1',
      [usuario.id]
    );

    const senhaValida = await bcrypt.compare(senha, resultSenha.rows[0].senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    console.log('✅ Login admin:', email);
    res.json({ 
      mensagem: 'Login bem-sucedido',
      admin: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  } catch (err) {
    console.error('❌ Erro no login admin:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ===========================
// INICIALIZAR SERVIDOR
// ===========================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════╗
║  🚀 AgendaMercado API Online   ║
║     Porta: ${PORT}              ║
╚════════════════════════════════╝
  `);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Erro não tratado:', err);
});

module.exports = app;
