// ===========================
// CONFIGURAÇÕES
// ===========================
const CONFIG = {
  API_URL: 'https://lpsolutions-89zx.onrender.com',
  STORAGE: {
    FORNECEDOR: 'fornecedor_logado',
    RECEBEDOR: 'recebedor_logado',
    DARK_MODE: 'darkMode'
  }
};

// ===========================
// STORAGE
// ===========================
function salvarDados(chave, dados) {
  localStorage.setItem(chave, JSON.stringify(dados));
}

function buscarDados(chave) {
  const dados = localStorage.getItem(chave);
  return dados ? JSON.parse(dados) : null;
}

function limparDados(chave) {
  localStorage.removeItem(chave);
}

// ===========================
// FORMATAÇÃO
// ===========================
function formatarData(dataString) {
  const data = new Date(dataString + 'T00:00:00');
  return data.toLocaleDateString('pt-BR');
}

function obterDiaSemana(data) {
  const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const dataObj = new Date(data + 'T00:00:00');
  return dias[dataObj.getDay()];
}

// ===========================
// VALIDAÇÃO DE HORÁRIOS BLOQUEADOS
// ===========================
function validarHorarioBloqueado(data, horaInicio, horaFim) {
  const dataObj = new Date(data + 'T00:00:00');
  const diaSemana = dataObj.getDay(); // 0=Dom, 6=Sab

  // Apenas segunda a sexta
  if (diaSemana === 0 || diaSemana === 6) {
    return { bloqueado: true, motivo: 'Atendimento apenas de segunda a sexta-feira', periodo: '' };
  }

  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFim.split(':').map(Number);
  const inicioMin = h1 * 60 + m1;
  const fimMin    = h2 * 60 + m2;

  // Janelas permitidas: 08:00–12:00 ou 14:00–17:00
  const dentroManha = inicioMin >= 8 * 60  && fimMin <= 12 * 60;
  const dentroTarde = inicioMin >= 14 * 60 && fimMin <= 17 * 60;

  if (!dentroManha && !dentroTarde) {
    return {
      bloqueado: true,
      motivo: 'Fora do horário de atendimento',
      periodo: '08:00–12:00 ou 14:00–17:00'
    };
  }

  // Ceasa: seg e qui, 10:00–12:00 bloqueado
  if (diaSemana === 1 || diaSemana === 4) {
    if (!(fimMin <= 10 * 60 || inicioMin >= 12 * 60)) {
      return { bloqueado: true, motivo: 'Bloqueado — Coleta no Ceasa', periodo: '10:00–12:00' };
    }
  }

  return { bloqueado: false };
}

// Retorna true se a data for fim de semana (para bloquear o campo de data imediatamente)
function ehFimDeSemana(dataStr) {
  if (!dataStr) return false;
  const dia = new Date(dataStr + 'T00:00:00').getDay();
  return dia === 0 || dia === 6;
}

// ===========================
// HTML ESCAPING (XSS prevention)
// ===========================
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===========================
// VERIFICAÇÃO DE LOGIN
// ===========================
function verificarLoginFornecedor() {
  const fornecedor = buscarDados(CONFIG.STORAGE.FORNECEDOR);
  if (!fornecedor) {
    window.location.href = 'login-fornecedor.html';
    return null;
  }
  return fornecedor;
}

function verificarLoginRecebedor() {
  const recebedor = buscarDados(CONFIG.STORAGE.RECEBEDOR);
  if (!recebedor) {
    window.location.href = 'login-recebedor.html';
    return null;
  }
  return recebedor;
}

// ===========================
// LOGOUT
// ===========================
function logout(tipo) {
  if (confirm('Deseja realmente sair?')) {
    const chave = tipo === 'fornecedor' ? CONFIG.STORAGE.FORNECEDOR : CONFIG.STORAGE.RECEBEDOR;
    limparDados(chave);
    window.location.href = 'index.html';
  }
}

// ===========================
// DARK MODE
// ===========================
function toggleDarkMode() {
  const isNowLight = document.body.classList.toggle('light-mode');
  localStorage.setItem(CONFIG.STORAGE.DARK_MODE, isNowLight ? 'false' : 'true');
}

function carregarDarkMode() {
  const stored = localStorage.getItem(CONFIG.STORAGE.DARK_MODE);
  if (stored === 'false') {
    document.body.classList.add('light-mode');
  }
}

window.addEventListener('DOMContentLoaded', carregarDarkMode);

// ===========================
// MENSAGENS
// ===========================
function mostrarMensagem(id, tipo, mensagem) {
  const container = document.getElementById(id);
  if (container) {
    container.innerHTML = `<div class="alert alert-${tipo}">${mensagem}</div>`;
    setTimeout(() => {
      container.innerHTML = '';
    }, 5000);
  }
}

function mostrarSucesso(id, mensagem) {
  mostrarMensagem(id, 'success', '✓ ' + mensagem);
}

function mostrarErro(id, mensagem) {
  mostrarMensagem(id, 'error', mensagem);
}

function mostrarInfo(id, mensagem) {
  mostrarMensagem(id, 'info', mensagem);
}
