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
  const diaSemana = dataObj.getDay();
  
  const horasSegundaQuinta = [
    { diaSemana: 1, inicio: '10:00', fim: '12:00', motivo: 'Coleta no Ceasa' },
    { diaSemana: 4, inicio: '10:00', fim: '12:00', motivo: 'Coleta no Ceasa' }
  ];

  for (const bloqueio of horasSegundaQuinta) {
    if (diaSemana === bloqueio.diaSemana) {
      const [h1, m1] = horaInicio.split(':').map(Number);
      const [h2, m2] = horaFim.split(':').map(Number);
      const [hBloqueio1, mBloqueio1] = bloqueio.inicio.split(':').map(Number);
      const [hBloqueio2, mBloqueio2] = bloqueio.fim.split(':').map(Number);
      
      const inicioMin = h1 * 60 + m1;
      const fimMin = h2 * 60 + m2;
      const bloqueioInicioMin = hBloqueio1 * 60 + mBloqueio1;
      const bloqueioFimMin = hBloqueio2 * 60 + mBloqueio2;

      if (!(fimMin <= bloqueioInicioMin || inicioMin >= bloqueioFimMin)) {
        return {
          bloqueado: true,
          motivo: bloqueio.motivo,
          periodo: `${bloqueio.inicio} - ${bloqueio.fim}`
        };
      }
    }
  }

  return { bloqueado: false };
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
