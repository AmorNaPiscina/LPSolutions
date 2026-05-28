// ===========================================
// ÁREA DO FORNECEDOR - JAVASCRIPT
// ===========================================

let fornecedor = null;
let agendamentos = [];

// Verificar se está logado
window.addEventListener('DOMContentLoaded', () => {
  fornecedor = verificarLogin('fornecedor');
  if (fornecedor) {
    document.getElementById('nome-fornecedor').textContent = fornecedor.nome_empresa;
    carregarAgendamentos();
    configurarFormulario();
  }
});

// Fazer logout
function fazerLogout() {
  if (confirm('Deseja realmente sair?')) {
    logout('fornecedor');
  }
}

// Carregar agendamentos
async function carregarAgendamentos() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/fornecedor/${fornecedor.id}/agendamentos`);
    const data = await response.json();
    agendamentos = data;
    renderizarAgendamentos();
    renderizarEstatisticas();
  } catch (error) {
    console.error('Erro:', error);
    mostrarErro('Erro ao carregar agendamentos');
  }
}

// Renderizar estatísticas
function renderizarEstatisticas() {
  const pendentes = agendamentos.filter(a => a.status === 'Pendente').length;
  const aprovados = agendamentos.filter(a => a.status === 'Aprovado').length;
  const recusados = agendamentos.filter(a => a.status === 'Recusado').length;
  const total = agendamentos.length;

  document.getElementById('stats-container').innerHTML = `
    <div class="stat-card"><h3>${pendentes}</h3><p>Aguardando Aprovação</p></div>
    <div class="stat-card"><h3>${aprovados}</h3><p>Aprovados</p></div>
    <div class="stat-card"><h3>${recusados}</h3><p>Recusados</p></div>
    <div class="stat-card"><h3>${total}</h3><p>Total</p></div>
  `;
}

// Renderizar lista de agendamentos
function renderizarAgendamentos() {
  const pendentes = agendamentos.filter(a => a.status === 'Pendente');
  const aprovados = agendamentos.filter(a => a.status === 'Aprovado');
  const recusados = agendamentos.filter(a => a.status === 'Recusado');

  let html = '';

  if (pendentes.length > 0) {
    html += `<h3 style="font-size: 18px; margin-bottom: 12px; color: #f39c12;">⏳ Aguardando Aprovação (${pendentes.length})</h3>`;
    pendentes.forEach(ag => {
      html += criarCardAgendamento(ag, 'pendente');
    });
  }

  if (aprovados.length > 0) {
    html += `<h3 style="font-size: 18px; margin-top: 24px; margin-bottom: 12px; color: #27ae60;">✅ Aprovados (${aprovados.length})</h3>`;
    aprovados.forEach(ag => {
      html += criarCardAgendamento(ag, 'aprovado');
    });
  }

  if (recusados.length > 0) {
    html += `<h3 style="font-size: 18px; margin-top: 24px; margin-bottom: 12px; color: #e74c3c;">❌ Recusados (${recusados.length})</h3>`;
    recusados.forEach(ag => {
      html += criarCardAgendamento(ag, 'recusado');
    });
  }

  if (agendamentos.length === 0) {
    html = `<p style="text-align: center; color: #7f8c8d; padding: 40px;">Você ainda não tem agendamentos. Clique em "Novo Agendamento" para começar!</p>`;
  }

  document.getElementById('lista-agendamentos').innerHTML = html;
}

// Criar card de agendamento
function criarCardAgendamento(ag, classe) {
  return `
    <div class="agendamento-card ${classe}">
      <h3>📦 ${ag.tipo_mercadoria} (${ag.volume})</h3>
      <p><strong>Data:</strong> ${formatarData(ag.data_entrega)} às ${ag.horario_inicio}</p>
      <p><strong>Duração:</strong> ${ag.tempo_estimado} minutos</p>
      ${ag.observacoes ? `<p><strong>Obs:</strong> ${ag.observacoes}</p>` : ''}
      <span class="badge badge-${classe}">${ag.status}</span>
    </div>
  `;
}

// Toggle formulário novo agendamento
function toggleNovoAgendamento() {
  const form = document.getElementById('form-novo-agendamento');
  const btn = document.getElementById('btn-texto');
  
  if (form.style.display === 'none') {
    form.style.display = 'block';
    btn.textContent = 'Cancelar';
  } else {
    form.style.display = 'none';
    btn.textContent = '+ Novo Agendamento';
    document.getElementById('form-agendamento').reset();
  }
}

// Configurar formulário
function configurarFormulario() {
  // Data mínima = hoje
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('data_entrega').min = hoje;

  // Calcular horário de término
  const horarioInicio = document.getElementById('horario_inicio');
  const tempoEstimado = document.getElementById('tempo_estimado');
  const horarioFim = document.getElementById('horario_fim');

  function calcularHorarioFim() {
    const inicio = horarioInicio.value;
    const tempo = parseInt(tempoEstimado.value);

    if (inicio && tempo) {
      const [h, m] = inicio.split(':').map(Number);
      const totalMinutos = h * 60 + m + tempo;
      const novaHora = Math.floor(totalMinutos / 60);
      const novoMinuto = totalMinutos % 60;
      horarioFim.value = `${String(novaHora).padStart(2, '0')}:${String(novoMinuto).padStart(2, '0')}`;
    }
  }

  horarioInicio.addEventListener('change', calcularHorarioFim);
  tempoEstimado.addEventListener('input', calcularHorarioFim);

  // Submit form
  document.getElementById('form-agendamento').addEventListener('submit', criarAgendamento);
}

// Criar agendamento
async function criarAgendamento(e) {
  e.preventDefault();

  const dados = {
    fornecedor_id: fornecedor.id,
    data_entrega: document.getElementById('data_entrega').value,
    horario_inicio: document.getElementById('horario_inicio').value,
    horario_fim: document.getElementById('horario_fim').value,
    tipo_mercadoria: document.getElementById('tipo_mercadoria').value,
    volume: document.getElementById('volume').value,
    tempo_estimado: parseInt(document.getElementById('tempo_estimado').value),
    observacoes: document.getElementById('observacoes').value
  };

  try {
    const response = await fetch(`${CONFIG.API_URL}/api/agendamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    if (response.ok) {
      mostrarSucesso(CONFIG.MENSAGENS.SUCESSO_AGENDAMENTO);
      document.getElementById('form-agendamento').reset();
      toggleNovoAgendamento();
      carregarAgendamentos();
    } else {
      const data = await response.json();
      mostrarErro(data.erro || 'Erro ao criar agendamento');
    }
  } catch (error) {
    console.error('Erro:', error);
    mostrarErro(CONFIG.MENSAGENS.ERRO_CONEXAO);
  }
}
