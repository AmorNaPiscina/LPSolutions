// ===========================
// IMPORTS
// ===========================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

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

// Run once on startup — safe to re-run
pool.query(`ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS motivo_recusa TEXT`)
  .then(() => console.log('✅ Schema OK'))
  .catch(err => console.error('❌ Migration error:', err.message));

// ===========================
// HELPER: VALIDAR HORÁRIO BLOQUEADO
// ===========================
function validarHorarioBloqueadoServer(data_entrega, horario_inicio, horario_fim) {
  const data = new Date(data_entrega + 'T00:00:00');
  const diaSemana = data.getDay(); // 0=Dom, 6=Sab

  // Apenas segunda a sexta
  if (diaSemana === 0 || diaSemana === 6) {
    return { bloqueado: true, motivo: 'Atendimento apenas de segunda a sexta-feira' };
  }

  const [h1, m1] = horario_inicio.split(':').map(Number);
  const [h2, m2] = horario_fim.split(':').map(Number);
  const inicioMin = h1 * 60 + m1;
  const fimMin    = h2 * 60 + m2;

  // Janelas permitidas: 08:00–12:00 ou 14:00–17:00
  const dentroManha = inicioMin >= 8 * 60  && fimMin <= 12 * 60;
  const dentroTarde = inicioMin >= 14 * 60 && fimMin <= 17 * 60;

  if (!dentroManha && !dentroTarde) {
    return { bloqueado: true, motivo: 'Fora do horário de atendimento (08:00–12:00 ou 14:00–17:00)' };
  }

  // Ceasa: seg e qui, 10:00–12:00 bloqueado
  if (diaSemana === 1 || diaSemana === 4) {
    if (!(fimMin <= 10 * 60 || inicioMin >= 12 * 60)) {
      return { bloqueado: true, motivo: 'Bloqueado — Coleta no Ceasa (10:00–12:00)' };
    }
  }

  return { bloqueado: false };
}

// ===========================
// EMAIL
// ===========================
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: parseInt(process.env.SMTP_PORT || '587') === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  console.log('📧 Email configurado:', process.env.SMTP_HOST);
} else {
  console.warn('⚠️  SMTP não configurado — emails desativados');
}

function templateEmail(titulo, linhas) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1e3a8a,#0f766e);padding:24px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:20px;">AgendaMercado</h1>
      </div>
      <div style="padding:28px;">
        <h2 style="color:#1f2937;margin-top:0;font-size:18px;">${titulo}</h2>
        ${linhas.map(l => `<p style="color:#374151;margin:8px 0;font-size:14px;">${l}</p>`).join('')}
      </div>
      <div style="background:#f3f4f6;padding:14px;text-align:center;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">AgendaMercado — Sistema de Agendamento de Entregas</p>
      </div>
    </div>`;
}

async function enviarEmail(para, assunto, html) {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"AgendaMercado" <${process.env.SMTP_USER}>`,
      to: para,
      subject: assunto,
      html
    });
    console.log(`📧 Email enviado → ${para}`);
  } catch (err) {
    console.error('❌ Erro ao enviar email:', err.message);
  }
}

async function emailFornecedor(fornecedor_id, assunto, html) {
  try {
    const r = await pool.query(
      'SELECT email FROM contas_fornecedores WHERE fornecedor_id = $1 AND ativo = true',
      [fornecedor_id]
    );
    if (r.rows.length > 0) enviarEmail(r.rows[0].email, assunto, html);
  } catch (err) {
    console.error('❌ Erro ao buscar email do fornecedor:', err.message);
  }
}

function emailAdmin(assunto, html) {
  const dest = process.env.ADMIN_EMAIL;
  if (dest) enviarEmail(dest, assunto, html);
}

function fmtData(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

// ===========================
// WHATSAPP (TWILIO)
// ===========================
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('📱 WhatsApp (Twilio) configurado');
} else {
  console.warn('⚠️  Twilio não configurado — WhatsApp desativado');
}

function normalizarTelefone(tel) {
  const digits = tel.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  return `+55${digits}`;
}

async function enviarWhatsApp(telefone, mensagem) {
  if (!twilioClient) return;
  try {
    const from = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM || '+14155238886'}`;
    const to   = `whatsapp:${normalizarTelefone(telefone)}`;
    await twilioClient.messages.create({ from, to, body: mensagem });
    console.log(`📱 WhatsApp enviado → ${to}`);
  } catch (err) {
    console.error('❌ Erro ao enviar WhatsApp:', err.message);
  }
}

async function whatsAppFornecedor(fornecedor_id, mensagem) {
  try {
    const r = await pool.query('SELECT telefone FROM fornecedores WHERE id = $1', [fornecedor_id]);
    if (r.rows.length > 0 && r.rows[0].telefone) {
      enviarWhatsApp(r.rows[0].telefone, mensagem);
    }
  } catch (err) {
    console.error('❌ Erro ao buscar telefone:', err.message);
  }
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

    const ag = result.rows[0];
    console.log('✅ Agendamento criado:', ag.id);
    res.status(201).json(ag);

    // Notificações (fire-and-forget)
    const nomeEmpresa = (await pool.query('SELECT nome_empresa FROM fornecedores WHERE id=$1', [fornecedor_id])).rows[0]?.nome_empresa || 'Fornecedor';
    if (ag.status === 'Pendente') {
      // Fornecedor criou → avisa admin
      emailAdmin(
        `[AgendaMercado] Novo agendamento pendente — ${nomeEmpresa}`,
        templateEmail('Novo agendamento pendente', [
          `<strong>${nomeEmpresa}</strong> solicitou um agendamento.`,
          `📅 <strong>Data:</strong> ${fmtData(data_entrega)}`,
          `🕐 <strong>Horário:</strong> ${horario_inicio} — ${horario_fim}`,
          `📦 <strong>Mercadoria:</strong> ${tipo_mercadoria} (${volume})`,
          `Acesse o painel para aprovar ou recusar.`
        ])
      );
    } else {
      // Admin criou direto como Aprovado → avisa fornecedor
      emailFornecedor(fornecedor_id,
        `[AgendaMercado] Agendamento confirmado — ${fmtData(data_entrega)}`,
        templateEmail('Seu agendamento foi confirmado ✅', [
          `Um agendamento foi criado para <strong>${nomeEmpresa}</strong>.`,
          `📅 <strong>Data:</strong> ${fmtData(data_entrega)}`,
          `🕐 <strong>Horário:</strong> ${horario_inicio} — ${horario_fim}`,
          `📦 <strong>Mercadoria:</strong> ${tipo_mercadoria} (${volume})`
        ])
      );
    }
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

    const ag = result.rows[0];
    console.log('✅ Aprovado:', ag.id);
    res.json(ag);

    emailFornecedor(ag.fornecedor_id,
      `[AgendaMercado] Agendamento aprovado ✅ — ${fmtData(ag.data_entrega)}`,
      templateEmail('Seu agendamento foi aprovado! ✅', [
        `Boas notícias! Seu agendamento foi <strong>aprovado</strong>.`,
        `📅 <strong>Data:</strong> ${fmtData(ag.data_entrega)}`,
        `🕐 <strong>Horário:</strong> ${ag.horario_inicio} — ${ag.horario_fim}`,
        `📦 <strong>Mercadoria:</strong> ${ag.tipo_mercadoria} (${ag.volume})`
      ])
    );
    whatsAppFornecedor(ag.fornecedor_id,
      `✅ *AgendaMercado*\n\nSeu agendamento para *${fmtData(ag.data_entrega)}* às *${ag.horario_inicio}* foi confirmado!`
    );
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Recusar
app.put('/api/agendamentos/:id/recusar', async (req, res) => {
  try {
    const { motivo } = req.body;

    const result = await pool.query(
      `UPDATE agendamentos
       SET status = 'Recusado', motivo_recusa = $2, atualizado_em = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, motivo || null]
    );

    if (result.rowCount === 0) return res.status(404).json({ erro: 'Não encontrado' });

    const ag = result.rows[0];
    console.log('✅ Recusado:', ag.id);
    res.json(ag);

    emailFornecedor(ag.fornecedor_id,
      `[AgendaMercado] Agendamento recusado ❌ — ${fmtData(ag.data_entrega)}`,
      templateEmail('Agendamento recusado ❌', [
        `Infelizmente seu agendamento foi <strong>recusado</strong>.`,
        `📅 <strong>Data solicitada:</strong> ${fmtData(ag.data_entrega)}`,
        `🕐 <strong>Horário:</strong> ${ag.horario_inicio} — ${ag.horario_fim}`,
        `📦 <strong>Mercadoria:</strong> ${ag.tipo_mercadoria} (${ag.volume})`,
        motivo ? `💬 <strong>Motivo:</strong> ${motivo}` : `Você pode propor um novo horário acessando o sistema.`
      ])
    );
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

    const ag = result.rows[0];
    console.log('✅ Reagendado:', ag.id);
    res.json(ag);

    const nomeEmpresa2 = (await pool.query('SELECT nome_empresa FROM fornecedores WHERE id=$1', [ag.fornecedor_id])).rows[0]?.nome_empresa || 'Fornecedor';
    emailAdmin(
      `[AgendaMercado] Agendamento reagendado — ${nomeEmpresa2}`,
      templateEmail('Agendamento reagendado ⚡', [
        `<strong>${nomeEmpresa2}</strong> propôs um novo horário.`,
        `📅 <strong>Nova data:</strong> ${fmtData(ag.data_entrega)}`,
        `🕐 <strong>Horário:</strong> ${ag.horario_inicio} — ${ag.horario_fim}`,
        `📦 <strong>Mercadoria:</strong> ${ag.tipo_mercadoria} (${ag.volume})`,
        `Acesse o painel para aprovar ou recusar.`
      ])
    );
    emailFornecedor(ag.fornecedor_id,
      `[AgendaMercado] Reagendamento enviado — ${fmtData(ag.data_entrega)}`,
      templateEmail('Reagendamento enviado ⚡', [
        `Seu pedido de reagendamento foi enviado com sucesso.`,
        `📅 <strong>Nova data:</strong> ${fmtData(ag.data_entrega)}`,
        `🕐 <strong>Horário:</strong> ${ag.horario_inicio} — ${ag.horario_fim}`,
        `📦 <strong>Mercadoria:</strong> ${ag.tipo_mercadoria} (${ag.volume})`,
        `Aguardando aprovação do recebedor.`
      ])
    );
    whatsAppFornecedor(ag.fornecedor_id,
      `⚡ *AgendaMercado*\n\nSeu agendamento foi reagendado para *${fmtData(ag.data_entrega)}* às *${ag.horario_inicio}*. Aguardando confirmação.`
    );
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Cancelar
app.delete('/api/agendamentos/:id', async (req, res) => {
  try {
    const agBefore = await pool.query(
      `SELECT a.*, f.nome_empresa FROM agendamentos a
       JOIN fornecedores f ON f.id = a.fornecedor_id
       WHERE a.id = $1`,
      [req.params.id]
    );

    const result = await pool.query('DELETE FROM agendamentos WHERE id = $1', [req.params.id]);

    if (result.rowCount === 0) return res.status(404).json({ erro: 'Não encontrado' });

    console.log('✅ Cancelado:', req.params.id);
    res.json({ mensagem: 'Cancelado' });

    if (agBefore.rows.length > 0) {
      const ag = agBefore.rows[0];
      emailFornecedor(ag.fornecedor_id,
        `[AgendaMercado] Agendamento cancelado — ${fmtData(ag.data_entrega)}`,
        templateEmail('Agendamento cancelado', [
          `Seu agendamento foi <strong>cancelado</strong>.`,
          `📅 <strong>Data:</strong> ${fmtData(ag.data_entrega)}`,
          `🕐 <strong>Horário:</strong> ${ag.horario_inicio} — ${ag.horario_fim}`,
          `📦 <strong>Mercadoria:</strong> ${ag.tipo_mercadoria} (${ag.volume})`,
          `Entre em contato ou crie um novo agendamento pelo sistema.`
        ])
      );
    }
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
    res.json({ mensagem: 'OK', fornecedor: { ...resultFornecedor.rows[0], email: conta.email } });
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

// Alterar senha fornecedor
app.put('/api/auth/fornecedor/alterar-senha', async (req, res) => {
  try {
    const { fornecedor_id, senha_atual, nova_senha } = req.body;

    if (!fornecedor_id || !senha_atual || !nova_senha) {
      return res.status(400).json({ erro: 'Campos obrigatórios' });
    }
    if (nova_senha.length < 8) {
      return res.status(400).json({ erro: 'Nova senha deve ter no mínimo 8 caracteres' });
    }

    const result = await pool.query(
      'SELECT * FROM contas_fornecedores WHERE fornecedor_id = $1 AND ativo = true',
      [fornecedor_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Conta não encontrada' });

    const conta = result.rows[0];
    const senhaValida = await bcrypt.compare(senha_atual, conta.senha);
    if (!senhaValida) return res.status(401).json({ erro: 'Senha atual incorreta' });

    const novaHash = await bcrypt.hash(nova_senha, 10);
    await pool.query(
      'UPDATE contas_fornecedores SET senha = $1 WHERE id = $2',
      [novaHash, conta.id]
    );

    console.log('✅ Senha alterada - fornecedor:', fornecedor_id);
    res.json({ mensagem: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error('❌ Erro ao alterar senha fornecedor:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Alterar senha admin
app.put('/api/auth/admin/alterar-senha', async (req, res) => {
  try {
    const { email, senha_atual, nova_senha } = req.body;

    if (!email || !senha_atual || !nova_senha) {
      return res.status(400).json({ erro: 'Campos obrigatórios' });
    }
    if (nova_senha.length < 8) {
      return res.status(400).json({ erro: 'Nova senha deve ter no mínimo 8 caracteres' });
    }

    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND tipo = $2',
      [email, 'admin']
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Conta não encontrada' });

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha_atual, usuario.senha);
    if (!senhaValida) return res.status(401).json({ erro: 'Senha atual incorreta' });

    const novaHash = await bcrypt.hash(nova_senha, 10);
    await pool.query(
      'UPDATE usuarios SET senha = $1 WHERE id = $2',
      [novaHash, usuario.id]
    );

    console.log('✅ Senha alterada - admin:', email);
    res.json({ mensagem: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error('❌ Erro ao alterar senha admin:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Atualizar perfil fornecedor
app.put('/api/auth/fornecedor/perfil', async (req, res) => {
  try {
    const { fornecedor_id, nome_empresa, nome_contato, telefone, email } = req.body;

    if (!fornecedor_id || !nome_empresa || !nome_contato || !email) {
      return res.status(400).json({ erro: 'Campos obrigatórios' });
    }

    const emailCheck = await pool.query(
      'SELECT id FROM contas_fornecedores WHERE email = $1 AND fornecedor_id != $2',
      [email, fornecedor_id]
    );
    if (emailCheck.rows.length > 0) return res.status(400).json({ erro: 'Este email já está em uso' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const r = await client.query(
        'UPDATE fornecedores SET nome_empresa=$1, nome_contato=$2, telefone=$3 WHERE id=$4 RETURNING *',
        [nome_empresa, nome_contato, telefone, fornecedor_id]
      );
      if (r.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ erro: 'Não encontrado' }); }

      await client.query(
        'UPDATE contas_fornecedores SET email=$1 WHERE fornecedor_id=$2',
        [email, fornecedor_id]
      );

      await client.query('COMMIT');
      console.log('✅ Perfil atualizado - fornecedor:', fornecedor_id);
      res.json({ mensagem: 'Perfil atualizado', fornecedor: { ...r.rows[0], email } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Erro ao atualizar perfil fornecedor:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Atualizar perfil admin
app.put('/api/auth/admin/perfil', async (req, res) => {
  try {
    const { id, nome, email } = req.body;

    if (!id || !nome || !email) return res.status(400).json({ erro: 'Campos obrigatórios' });

    const emailCheck = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1 AND id != $2',
      [email, id]
    );
    if (emailCheck.rows.length > 0) return res.status(400).json({ erro: 'Este email já está em uso' });

    const result = await pool.query(
      'UPDATE usuarios SET nome=$1, email=$2 WHERE id=$3 RETURNING id, nome, email',
      [nome, email, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });

    console.log('✅ Perfil atualizado - admin:', id);
    res.json({ mensagem: 'Perfil atualizado', admin: result.rows[0] });
  } catch (err) {
    console.error('❌ Erro ao atualizar perfil admin:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ===========================
// ROTAS: RELATÓRIOS
// ===========================
app.get('/api/relatorios', async (req, res) => {
  try {
    const [statusRes, diaRes, mesRes, horaRes] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) AS total FROM agendamentos GROUP BY status`),
      pool.query(`SELECT EXTRACT(DOW FROM data_entrega)::int AS dia, COUNT(*) AS total FROM agendamentos GROUP BY dia ORDER BY dia`),
      pool.query(`
        SELECT TO_CHAR(data_entrega, 'YYYY-MM') AS mes, COUNT(*) AS total
        FROM agendamentos
        WHERE data_entrega >= NOW() - INTERVAL '6 months'
        GROUP BY mes ORDER BY mes
      `),
      pool.query(`SELECT EXTRACT(HOUR FROM horario_inicio)::int AS hora, COUNT(*) AS total FROM agendamentos GROUP BY hora ORDER BY hora`)
    ]);

    const porStatus = {};
    statusRes.rows.forEach(r => { porStatus[r.status] = parseInt(r.total); });

    const porDia = new Array(7).fill(0);
    diaRes.rows.forEach(r => { porDia[r.dia] = parseInt(r.total); });

    res.json({
      por_status: porStatus,
      por_dia:    porDia,
      por_mes:    mesRes.rows.map(r => ({ mes: r.mes, total: parseInt(r.total) })),
      por_hora:   horaRes.rows.map(r => ({ hora: r.hora, total: parseInt(r.total) }))
    });
  } catch (err) {
    console.error('❌ Erro relatórios:', err);
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
