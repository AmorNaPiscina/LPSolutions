const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// Conexão com PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(cors());
app.use(bodyParser.json());

// ==========================================
// CRIAR TABELAS (ao iniciar)
// ==========================================

async function inicializarBanco() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS fornecedores (
        id SERIAL PRIMARY KEY,
        nome_empresa VARCHAR(255) NOT NULL,
        nome_contato VARCHAR(100) NOT NULL,
        telefone VARCHAR(20),
        email VARCHAR(100),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contas_fornecedores (
        id SERIAL PRIMARY KEY,
        fornecedor_id INTEGER REFERENCES fornecedores(id),
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        fornecedor_id INTEGER REFERENCES fornecedores(id),
        data_entrega DATE NOT NULL,
        horario_inicio TIME NOT NULL,
        horario_fim TIME NOT NULL,
        tipo_mercadoria VARCHAR(100),
        volume VARCHAR(20),
        tempo_estimado INTEGER,
        status VARCHAR(20) DEFAULT 'Pendente',
        observacoes TEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS horarios_bloqueados (
        id SERIAL PRIMARY KEY,
        dia_semana VARCHAR(20),
        horario_inicio TIME,
        horario_fim TIME,
        motivo VARCHAR(100),
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Tabelas criadas/verificadas com sucesso!');
    
    // Inserir dados padrão se estiverem vazios
    const result = await pool.query('SELECT COUNT(*) FROM usuarios');
    if (result.rows[0].count === 0) {
      const senhaHash = bcrypt.hashSync('123456', 10);
      
      await pool.query(
        'INSERT INTO usuarios (nome, email, senha, tipo) VALUES ($1, $2, $3, $4)',
        ['Admin', 'admin@mercado.com', senhaHash, 'admin']
      );
      
      await pool.query(
        'INSERT INTO horarios_bloqueados (dia_semana, horario_inicio, horario_fim, motivo) VALUES ($1, $2, $3, $4)',
        ['Segunda', '10:00', '12:00', 'Descarga Ceasa']
      );
      
      console.log('✅ Dados iniciais inseridos!');
    }
    
  } catch (err) {
    console.error('❌ Erro ao inicializar banco:', err);
  }
}

// ==========================================
// ROTAS
// ==========================================

app.get('/', (req, res) => {
  res.json({ mensagem: '🎉 Servidor rodando!' });
});

// LOGIN FORNECEDOR
app.post('/api/auth/fornecedor/login', async (req, res) => {
  const { email, senha } = req.body;
  
  try {
    const result = await pool.query(`
      SELECT cf.*, f.nome_empresa, f.nome_contato, f.telefone
      FROM contas_fornecedores cf
      JOIN fornecedores f ON cf.fornecedor_id = f.id
      WHERE cf.email = $1 AND cf.ativo = true
    `, [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'Email ou senha inválidos!' });
    }
    
    const user = result.rows[0];
    
    if (!bcrypt.compareSync(senha, user.senha)) {
      return res.status(401).json({ erro: 'Email ou senha inválidos!' });
    }
    
    res.json({
      mensagem: 'Login realizado!',
      fornecedor: {
        id: user.fornecedor_id,
        nome_empresa: user.nome_empresa,
        nome_contato: user.nome_contato,
        telefone: user.telefone,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// CADASTRO FORNECEDOR
app.post('/api/auth/fornecedor/cadastro', async (req, res) => {
  const { nome_empresa, nome_contato, telefone, email, senha } = req.body;
  
  try {
    // Verificar se email existe
    const checkEmail = await pool.query(
      'SELECT * FROM contas_fornecedores WHERE email = $1',
      [email]
    );
    
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ erro: 'Email já cadastrado!' });
    }

    // Criar fornecedor
    const fornResult = await pool.query(
      'INSERT INTO fornecedores (nome_empresa, nome_contato, telefone, email) VALUES ($1, $2, $3, $4) RETURNING id',
      [nome_empresa, nome_contato, telefone, email]
    );

    const fornecedorId = fornResult.rows[0].id;
    const senhaHash = bcrypt.hashSync(senha, 10);

    // Criar conta de login
    await pool.query(
      'INSERT INTO contas_fornecedores (fornecedor_id, email, senha) VALUES ($1, $2, $3)',
      [fornecedorId, email, senhaHash]
    );

    res.json({ mensagem: 'Conta criada!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// LISTAR AGENDAMENTOS
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
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// CRIAR AGENDAMENTO
app.post('/api/agendamentos', async (req, res) => {
  const { fornecedor_id, data_entrega, horario_inicio, horario_fim, tipo_mercadoria, volume, tempo_estimado, observacoes } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO agendamentos (fornecedor_id, data_entrega, horario_inicio, horario_fim, tipo_mercadoria, volume, tempo_estimado, observacoes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id`,
      [fornecedor_id, data_entrega, horario_inicio, horario_fim, tipo_mercadoria, volume, tempo_estimado, observacoes]
    );

    res.json({ mensagem: 'Agendamento criado!', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// AGENDAMENTOS DO FORNECEDOR
app.get('/api/fornecedor/:id/agendamentos', async (req, res) => {
  const { id } = req.params;
  
  try {
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

// APROVAR AGENDAMENTO
app.put('/api/agendamentos/:id/aprovar', async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query(
      'UPDATE agendamentos SET status = $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2',
      ['Aprovado', id]
    );
    
    res.json({ mensagem: 'Agendamento aprovado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// RECUSAR AGENDAMENTO
app.put('/api/agendamentos/:id/recusar', async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query(
      'UPDATE agendamentos SET status = $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2',
      ['Recusado', id]
    );
    
    res.json({ mensagem: 'Agendamento recusado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// BLOQUEIOS
app.get('/api/bloqueios', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM horarios_bloqueados WHERE ativo = true');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ==========================================
// INICIAR
// ==========================================

inicializarBanco();

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  console.log('🚀 ========================================');
  console.log('');
});
