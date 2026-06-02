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

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ===========================
// DATABASE
// ===========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => console.error('Erro DB:', err));

// ===========================
// HELPER: VALIDAR HORÁRIO BLOQUEADO
// ===========================
function validarHorarioBloqueadoServer(data_entrega, horario_inicio, horario_fim) {
  const data = new Date(data_entrega + 'T00:00:00');
  const diaSemana = data.getDay();

  const bloqueios = [
    { dia: 1, inicio: '10:00', fim: '12:00' },
    { dia: 4, inicio: '10:00', fim: '12:00' }
  ];

  for (const bloqueio of bloqueios) {
    if (diaSemana === bloqueio.dia) {
      const [h1, m1] = horario_inicio.split(':').map(Number);
      const [h2, m2] = horario_fim.split(':').map(Number);
      const [hB1, mB1] = bloqueio.inicio.split(':').map(Number);
      const [hB2, mB2] = bloqueio.fim.split(':').map(Number);

      const inicioMin = h1 * 60 + m1;
      const fimMin = h2 * 60 + m2;
      const bloqueioInicioMin = hB1 * 60 + mB1;
      const bloqueioFimMin = hB2 * 60 + mB2;

      if (!(fimMin <= bloqueioInicioMin || inicioMin >= bloqueioFimMin)) {
        return { bloqueado: true };
      }
    }
  }
  return { bloqueado: false };
}

// ===========================
// FUNÇÃO: LIMPAR AGENDAMENTOS EXPIRADOS
// ===========================
async function limparAgendamentosExpirados() {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataHoje = hoje.toISOString().split('T')[0];

    const result = await pool.query(
      `DELETE FROM agendamentos
       WHERE data_entrega < $1 AND status = 'Pendente'
       RETURNING id`,
      [dataHoje]
    );

    if (result.rowCount > 0) {
      console.log(`🗑️ Deletados ${result.rowCount} agendamentos expirados`);
    }
  } catch (err) {
    console.error('❌ Erro ao limpar:', err);
  }
}

setInterval(limparAgendamentosExpirados, 60 * 60 * 1000);
limparAgendamentosExpirados();

// ===========================
// ROTAS: TESTE
// ===========================
app.get('/', (req, res) => {
  res.json({
    mensagem: '✅ API AgendaMercado online',
    versao: '2.0.0'
  });
});

// ===========================
// ROTAS: AGENDAMENTOS
// ===========================

// Listar - SÓ AGENDAMENTOS FUTUROS
app.get('/api/agendamentos', async (req, res) => {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataHoje = hoje.toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT
        a.*,
        f.nome_empresa,
        f.nome_contato,
        f.telefone
      FROM agendamentos a
      LEFT JOIN fornecedores f ON a.fornecedor_id = f.id
      WHERE a.data_entrega >= $1
      ORDER BY a.data_entrega ASC, a.horario_inicio ASC
    `, [dataHoje]);

    console.log('📊 Agendamentos:', result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Listar por fornecedor - SÓ FUTUROS
app.get('/api/fornecedor/:id/agendamentos', async (req, res) => {
  try {
    const { id } = req.params;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataHoje = hoje.toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT * FROM agendamentos
      WHERE fornecedor_id = $1 AND data_entrega >= $2
      ORDER BY data_entrega ASC, horario_inicio ASC
    `, [id, dataHoje]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Criar com validação de bloqueio
app.post('/api/agendamentos', async (req, res) => {
  try {
    const { fornecedor_id, data_entrega, horario_inicio, horario_fim,
            tipo_mercadoria, volume, tempo_estimado, observacoes, status } = req.body;

    console.log('📝 Criando agendamento:', { fornecedor_id, data_entrega, horario_inicio });

    const check = validarHorarioBloqueadoServer(data_entrega, horario_inicio, horario_fim);
    if (check.bloqueado) {
      return res.status(400).json({
        erro: 'Horário bloqueado - Coleta no Ceasa (10:00-12:00)',
        horarioBloqueado: true
      });
    }

    const result = await pool.query(
      `INSERT INTO agendamentos
       (fornecedor_id, data_entrega, horario_inicio, horario_fim,
        tipo_mercadoria, volume, tempo_estimado, observacoes, status, criado_em, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [fornecedor_id, data_entrega, horario_inicio, horario_fim,
       tipo_mercadoria, volume, tempo_estimado, observacoes, status || 'Pendente']
    );

    console.log('✅ Agendamento criado:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao criar:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Aprovar
app.put('/api/agendamentos/:id/aprovar', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE agendamentos
       SET status = 'Aprovado', atualizado_em = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ erro: 'Não encontrado' });

    console.log('✅ Aprovado:', req.params.id);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Recusar
app.put('/api/agendamentos/:id/recusar', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE agendamentos
       SET status = 'Recusado', atualizado_em = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ erro: 'Não encontrado' });

    console.log('✅ Recusado:', req.params.id);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Reagendar (recebedor ou fornecedor propõe nova data/hora → volta para Pendente)
app.put('/api/agendamentos/:id/reagendar', async (req, res) => {
  try {
    const { data_entrega, horario_inicio, horario_fim, tempo_estimado } = req.body;

    if (!data_entrega || !horario_inicio || !horario_fim) {
      return res.status(400).json({ erro: 'Data e horários são obrigatórios' });
    }

    const check = validarHorarioBloqueadoServer(data_entrega, horario_inicio, horario_fim);
    if (check.bloqueado) {
      return res.status(400).json({
        erro: 'Horário bloqueado - Coleta no Ceasa (10:00-12:00)',
        horarioBloqueado: true
      });
    }

    const result = await pool.query(
      `UPDATE agendamentos
       SET data_entrega = $1, horario_inicio = $2, horario_fim = $3,
           tempo_estimado = COALESCE($4, tempo_estimado),
           status = 'Pendente', atualizado_em = NOW()
       WHERE id = $5
       RETURNING *`,
      [data_entrega, horario_inicio, horario_fim, tempo_estimado || null, req.params.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ erro: 'Não encontrado' });

    console.log('✅ Reagendado:', req.params.id);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Cancelar
app.delete('/api/agendamentos/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM agendamentos WHERE id = $1', [req.params.id]);

    if (result.rowCount === 0) return res.status(404).json({ erro: 'Não encontrado' });

    console.log('✅ Cancelado:', req.params.id);
    res.json({ mensagem: 'Cancelado' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===========================
// ROTAS: FORNECEDORES
// ===========================

app.get('/api/fornecedores', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fornecedores ORDER BY nome_empresa');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===========================
// ROTAS: AUTENTICAÇÃO
// ===========================

// Login fornecedor
app.post('/api/auth/fornecedor/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });

    const resultConta = await pool.query(
      'SELECT * FROM contas_fornecedores WHERE email = $1 AND ativo = true',
      [email]
    );

    if (resultConta.rows.length === 0) return res.status(401).json({ erro: 'Email ou senha incorretos' });

    const conta = resultConta.rows[0];
    const senhaValida = await bcrypt.compare(senha, conta.senha);

    if (!senhaValida) return res.status(401).json({ erro: 'Email ou senha incorretos' });

    const resultFornecedor = await pool.query(
      'SELECT id, nome_empresa, nome_contato, telefone FROM fornecedores WHERE id = $1',
      [conta.fornecedor_id]
    );

    console.log('✅ Login fornecedor:', email);
    res.json({ mensagem: 'OK', fornecedor: resultFornecedor.rows[0] });
  } catch (err) {
    console.error('❌ Erro login fornecedor:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Cadastro fornecedor
app.post('/api/auth/fornecedor/cadastro', async (req, res) => {
  try {
    const { nome_empresa, nome_contato, telefone, email, senha } = req.body;

    if (!nome_empresa || !nome_contato || !telefone || !email || !senha) {
      return res.status(400).json({ erro: 'Campos obrigatórios' });
    }

    if (senha.length < 8) {
      return res.status(400).json({ erro: 'Mínimo 8 caracteres' });
    }

    const checkEmail = await pool.query('SELECT id FROM contas_fornecedores WHERE email = $1', [email]);
    if (checkEmail.rows.length > 0) return res.status(400).json({ erro: 'Email já existe' });

    const senhaHash = await bcrypt.hash(senha, 10);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const resultFornecedor = await client.query(
        'INSERT INTO fornecedores (nome_empresa, nome_contato, telefone, criado_em) VALUES ($1, $2, $3, NOW()) RETURNING id',
        [nome_empresa, nome_contato, telefone]
      );

      await client.query(
        'INSERT INTO contas_fornecedores (fornecedor_id, email, senha, ativo, criado_em) VALUES ($1, $2, $3, true, NOW())',
        [resultFornecedor.rows[0].id, email, senhaHash]
      );

      await client.query('COMMIT');
      console.log('✅ Fornecedor cadastrado:', email);
      res.status(201).json({ mensagem: 'Cadastro ok' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Erro cadastro:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Login admin
app.post('/api/auth/admin/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });

    const result = await pool.query(
      'SELECT id, nome, email FROM usuarios WHERE email = $1 AND tipo = $2',
      [email, 'admin']
    );

    if (result.rows.length === 0) return res.status(401).json({ erro: 'Credenciais inválidas' });

    const usuario = result.rows[0];
    const resultSenha = await pool.query('SELECT senha FROM usuarios WHERE id = $1', [usuario.id]);

    const senhaValida = await bcrypt.compare(senha, resultSenha.rows[0].senha);
    if (!senhaValida) return res.status(401).json({ erro: 'Credenciais inválidas' });

    console.log('✅ Login admin:', email);
    res.json({ mensagem: 'OK', admin: usuario });
  } catch (err) {
    console.error('❌ Erro login admin:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ===========================
// INICIAR
// ===========================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════╗
║  🚀 AgendaMercado API Online   ║
║     Porta: ${PORT}              ║
╚════════════════════════════════╝
  `);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Erro:', err);
});

module.exports = app;
