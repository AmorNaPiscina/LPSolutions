// database.js
// Responsável por conectar e inicializar o banco de dados

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho do arquivo do banco
const dbPath = path.resolve(__dirname, 'mercado.db');

// Criar conexão com o banco
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erro ao conectar com o banco:', err.message);
  } else {
    console.log('✅ Conectado ao banco de dados SQLite');
  }
});

// Função para inicializar o banco (criar tabelas)
function inicializarBanco() {
  db.serialize(() => {
    // Tabela de usuários (equipe interna)
    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) DEFAULT 'funcionario',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de fornecedores
    db.run(`
      CREATE TABLE IF NOT EXISTS fornecedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_empresa VARCHAR(150) NOT NULL,
        nome_contato VARCHAR(100) NOT NULL,
        telefone VARCHAR(20) NOT NULL,
        email VARCHAR(100),
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // NOVA TABELA: Contas de fornecedores (login)
    db.run(`
      CREATE TABLE IF NOT EXISTS contas_fornecedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fornecedor_id INTEGER NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        ativo BOOLEAN DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id)
      )
    `);

    // Tabela de agendamentos
    db.run(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fornecedor_id INTEGER NOT NULL,
        data_entrega DATE NOT NULL,
        horario_inicio TIME NOT NULL,
        horario_fim TIME NOT NULL,
        tipo_mercadoria VARCHAR(100) NOT NULL,
        volume VARCHAR(20) NOT NULL,
        tempo_estimado INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'Pendente',
        observacoes TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id)
      )
    `);

    // Tabela de horários bloqueados
    db.run(`
      CREATE TABLE IF NOT EXISTS horarios_bloqueados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dia_semana INTEGER NOT NULL,
        horario_inicio TIME NOT NULL,
        horario_fim TIME NOT NULL,
        motivo VARCHAR(100) NOT NULL,
        ativo BOOLEAN DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tabelas criadas/verificadas com sucesso!');

    // Inserir dados iniciais (só se não existirem)
    inserirDadosIniciais();
  });
}

// Inserir dados de teste
function inserirDadosIniciais() {
  const bcrypt = require('bcrypt');
  
  // Verificar se já existem usuários
  db.get('SELECT COUNT(*) as total FROM usuarios', (err, row) => {
    if (row && row.total === 0) {
      const senhaHash = bcrypt.hashSync('123456', 10);

      db.run(`INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)`,
        ['Admin', 'admin@mercado.com', senhaHash, 'admin']);
      db.run(`INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)`,
        ['João', 'joao@mercado.com', senhaHash, 'funcionario']);
      db.run(`INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)`,
        ['Jonatas', 'jonatas@mercado.com', senhaHash, 'funcionario']);

      console.log('✅ Usuários iniciais criados! (senha padrão: 123456)');
    }
  });

  // Verificar se já existem bloqueios
  db.get('SELECT COUNT(*) as total FROM horarios_bloqueados', (err, row) => {
    if (row && row.total === 0) {
      db.run(`INSERT INTO horarios_bloqueados (dia_semana, horario_inicio, horario_fim, motivo) VALUES (?, ?, ?, ?)`,
        [1, '10:00', '12:00', 'Descarga Ceasa']); // Segunda
      db.run(`INSERT INTO horarios_bloqueados (dia_semana, horario_inicio, horario_fim, motivo) VALUES (?, ?, ?, ?)`,
        [4, '10:00', '12:00', 'Descarga Ceasa']); // Quinta

      console.log('✅ Bloqueios de horário criados!');
    }
  });

  // Verificar se já existem fornecedores
  db.get('SELECT COUNT(*) as total FROM fornecedores', (err, row) => {
    if (row && row.total === 0) {
      db.run(`INSERT INTO fornecedores (nome_empresa, nome_contato, telefone, email) VALUES (?, ?, ?, ?)`,
        ['Distribuidora ABC', 'Carlos Silva', '(44) 99999-1111', 'carlos@abc.com']);
      db.run(`INSERT INTO fornecedores (nome_empresa, nome_contato, telefone, email) VALUES (?, ?, ?, ?)`,
        ['Atacadão XYZ', 'Maria Santos', '(44) 99999-2222', 'maria@xyz.com']);

      console.log('✅ Fornecedores de teste criados!');
    }
  });
}

module.exports = { db, inicializarBanco };
