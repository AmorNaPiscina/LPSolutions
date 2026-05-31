// ===========================
// CONFIGURAÇÕES GLOBAIS
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
// FUNÇÕES UTILITÁRIAS
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

function formatarData(dataString) {
  const data = new Date(dataString + 'T00:00:00');
  return data.toLocaleDateString('pt-BR');
}

// ===========================
// VALIDAÇÃO DE HORÁRIOS BLOQUEADOS
// ===========================

function validarHorarioBloqueado(data, horaInicio, horaFim) {
  const dataObj = new Date(data + 'T00:00:00');
  const diaSemana = dataObj.getDay(); // 0=domingo, 1=segunda, 2=terça...
  
  // REGRA: Segunda (1) e Quinta (4) das 10:00 às 12:00
  const horasSegundaQuinta = [
    { diaSemana: 1, inicio: '10:00', fim: '12:00', motivo: 'Coleta no Ceasa' },
    { diaSemana: 4, inicio: '10:00', fim: '12:00', motivo: 'Coleta no Ceasa' }
  ];

  for (const bloqueio of horasSegundaQuinta) {
    if (diaSemana === bloqueio.diaSemana) {
      // Converter horas para minutos
      const [h1, m1] = horaInicio.split(':').map(Number);
      const [h2, m2] = horaFim.split(':').map(Number);
      const [hBloqueio1, mBloqueio1] = bloqueio.inicio.split(':').map(Number);
      const [hBloqueio2, mBloqueio2] = bloqueio.fim.split(':').map(Number);
      
      const inicioMin = h1 * 60 + m1;
      const fimMin = h2 * 60 + m2;
      const bloqueioInicioMin = hBloqueio1 * 60 + mBloqueio1;
      const bloqueioFimMin = hBloqueio2 * 60 + mBloqueio2;

      // Verificar se há sobreposição
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

function obterDiaSemana(data) {
  const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const dataObj = new Date(data + 'T00:00:00');
  return dias[dataObj.getDay()];
}

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

function logout(tipo) {
  if (confirm('Deseja realmente sair?')) {
    const chave = tipo === 'fornecedor' ? CONFIG.STORAGE.FORNECEDOR : CONFIG.STORAGE.RECEBEDOR;
    limparDados(chave);
    window.location.href = 'index.html';
  }
}

function toggleDarkMode() {
  const darkMode = !JSON.parse(localStorage.getItem(CONFIG.STORAGE.DARK_MODE) || 'false');
  localStorage.setItem(CONFIG.STORAGE.DARK_MODE, darkMode);
  document.body.classList.toggle('dark-mode');
}

function carregarDarkMode() {
  const darkMode = JSON.parse(localStorage.getItem(CONFIG.STORAGE.DARK_MODE) || 'false');
  if (darkMode) {
    document.body.classList.add('dark-mode');
  }
}

// Carregar dark mode ao iniciar página
window.addEventListener('DOMContentLoaded', carregarDarkMode);

// ===========================
// FUNÇÕES DE MENSAGEM
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
