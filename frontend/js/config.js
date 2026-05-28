// ===========================================
// CONFIGURAÇÕES GERAIS
// ===========================================

const CONFIG = {
  API_URL: 'http://localhost:3000',
  
  // Chaves do localStorage
  STORAGE_KEYS: {
    FORNECEDOR: 'fornecedor_logado',
    ADMIN: 'admin_logado'
  },

  // Mensagens
  MENSAGENS: {
    ERRO_CONEXAO: 'Erro ao conectar com o servidor. Verifique se está rodando.',
    SUCESSO_CADASTRO: 'Conta criada com sucesso! Redirecionando...',
    SUCESSO_LOGIN: 'Login realizado! Redirecionando...',
    ERRO_LOGIN: 'Email ou senha inválidos!',
    SUCESSO_AGENDAMENTO: 'Agendamento criado com sucesso!'
  }
};

// ===========================================
// FUNÇÕES AUXILIARES
// ===========================================

// Salvar dados no localStorage
function salvarDados(chave, dados) {
  localStorage.setItem(chave, JSON.stringify(dados));
}

// Buscar dados do localStorage
function buscarDados(chave) {
  const dados = localStorage.getItem(chave);
  return dados ? JSON.parse(dados) : null;
}

// Limpar dados do localStorage
function limparDados(chave) {
  localStorage.removeItem(chave);
}

// Verificar se está logado
function verificarLogin(tipo) {
  const chave = tipo === 'fornecedor' ? CONFIG.STORAGE_KEYS.FORNECEDOR : CONFIG.STORAGE_KEYS.ADMIN;
  const dados = buscarDados(chave);
  
  if (!dados) {
    const paginaLogin = tipo === 'fornecedor' ? 'login-fornecedor.html' : 'login-admin.html';
    window.location.href = paginaLogin;
    return null;
  }
  
  return dados;
}

// Fazer logout
function logout(tipo) {
  const chave = tipo === 'fornecedor' ? CONFIG.STORAGE_KEYS.FORNECEDOR : CONFIG.STORAGE_KEYS.ADMIN;
  limparDados(chave);
  window.location.href = 'index.html';
}

// Formatar data para exibição
function formatarData(dataString) {
  const data = new Date(dataString + 'T00:00:00');
  return data.toLocaleDateString('pt-BR');
}

// Mostrar mensagem de erro
function mostrarErro(mensagem) {
  const container = document.getElementById('mensagem-container');
  if (container) {
    container.innerHTML = `<div class="error-message">${mensagem}</div>`;
    setTimeout(() => container.innerHTML = '', 5000);
  } else {
    alert(mensagem);
  }
}

// Mostrar mensagem de sucesso
function mostrarSucesso(mensagem) {
  const container = document.getElementById('mensagem-container');
  if (container) {
    container.innerHTML = `<div class="success-message">${mensagem}</div>`;
    setTimeout(() => container.innerHTML = '', 5000);
  } else {
    alert(mensagem);
  }
}
