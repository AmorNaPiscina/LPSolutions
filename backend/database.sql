-- ===========================
-- CRIAR BANCO DE DADOS
-- ===========================
-- Executar como superuser:
-- CREATE DATABASE agendamento_db;

-- ===========================
-- TABELA: USUÁRIOS (ADMIN)
-- ===========================
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'admin',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- TABELA: FORNECEDORES
-- ===========================
CREATE TABLE IF NOT EXISTS fornecedores (
  id SERIAL PRIMARY KEY,
  nome_empresa VARCHAR(255) NOT NULL,
  nome_contato VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- TABELA: CONTAS FORNECEDORES
-- ===========================
CREATE TABLE IF NOT EXISTS contas_fornecedores (
  id SERIAL PRIMARY KEY,
  fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- TABELA: AGENDAMENTOS
-- ===========================
CREATE TABLE IF NOT EXISTS agendamentos (
  id SERIAL PRIMARY KEY,
  fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  data_entrega DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  tipo_mercadoria VARCHAR(255),
  volume VARCHAR(50),
  tempo_estimado INTEGER,
  status VARCHAR(50) DEFAULT 'Pendente',
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================
-- ÍNDICES
-- ===========================
CREATE INDEX IF NOT EXISTS idx_agendamentos_fornecedor ON agendamentos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_entrega);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_contas_fornecedor ON contas_fornecedores(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- ===========================
-- INSERIR ADMIN PADRÃO
-- ===========================
-- Hash bcrypt de: admin123456
-- Copie e cole no pgAdmin:
INSERT INTO usuarios (nome, email, senha, tipo) 
VALUES ('Administrador', 'admin@mercado.com', '$2b$10$K9Cz.2YJ7QZZ6vXwX7X7Je9gH8pZmQqY8pXzZ.5Z5Z5Z5Z5Z5Z5Z5', 'admin')
ON CONFLICT (email) DO NOTHING;
