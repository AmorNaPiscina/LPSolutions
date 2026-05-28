// ===========================================
// PAINEL ADMIN - JAVASCRIPT
// ===========================================

let usuario = null;
let agendamentos = [];
let filtroAtual = 'todos';
let diaSelecionado = null;

// Verificar login
window.addEventListener('DOMContentLoaded', () => {
  usuario = verificarLogin('admin');
  if (usuario) {
    document.getElementById('nome-usuario').textContent = usuario.nome;
    carregarAgendamentos();
  }
});

// Fazer logout
function fazerLogout() {
  if (confirm('Deseja realmente sair?')) {
    logout('admin');
  }
}

// Carregar agendamentos
async function carregarAgendamentos() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/agendamentos`);
    const data = await response.json();
    agendamentos = data;
    renderizarEstatisticas();
    renderizarCalendario();
  } catch (error) {
    console.error('Erro:', error);
    alert('Erro ao carregar agendamentos');
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
    <div class="stat-card"><h3>${total}</h3><p>Total de Agendamentos</p></div>
  `;
}

// Renderizar calendário
function renderizarCalendario() {
  const hoje = new Date();
  let html = '';

  for (let i = 0; i < 14; i++) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + i);
    
    const counts = contarPorStatus(data);
    const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'short' });
    const diaNumero = data.getDate();
    const dataStr = data.toISOString().split('T')[0];
    const isSelected = diaSelecionado === dataStr;

    html += `
      <div class="calendar-day ${isSelected ? 'selected' : ''}" onclick="selecionarDia('${dataStr}')">
        <div class="calendar-day-number">${diaNumero}</div>
        <div style="font-size: 11px; color: #7f8c8d; margin-bottom: 4px;">${diaSemana}</div>
        ${counts.pendentes > 0 ? `<div class="calendar-badge pendente">${counts.pendentes} pend.</div>` : ''}
        ${counts.aprovados > 0 ? `<div class="calendar-badge aprovado">${counts.aprovados} aprov.</div>` : ''}
      </div>
    `;
  }

  document.getElementById('calendario').innerHTML = html;
}

// Contar agendamentos por status em uma data
function contarPorStatus(data) {
  const dataStr = data.toISOString().split('T')[0];
  const agendsDoDia = agendamentos.filter(ag => ag.data_entrega === dataStr);
  
  return {
    pendentes: agendsDoDia.filter(ag => ag.status === 'Pendente').length,
    aprovados: agendsDoDia.filter(ag => ag.status === 'Aprovado').length
  };
}

// Selecionar dia
function selecionarDia(dataStr) {
  diaSelecionado = dataStr;
  renderizarCalendario();
  renderizarDetalhesDia(dataStr);
}

// Renderizar detalhes do dia
function renderizarDetalhesDia(dataStr) {
  const data = new Date(dataStr + 'T00:00:00');
  const dataFormatada = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  
  let agendsDoDia = agendamentos.filter(ag => ag.data_entrega === dataStr);
  
  if (filtroAtual !== 'todos') {
    agendsDoDia = agendsDoDia.filter(ag => ag.status === filtroAtual);
  }
  
  agendsDoDia.sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio));

  let html = `
    <div class="day-detail">
      <div class="day-detail-header">
        <h2>${dataFormatada}</h2>
        <button class="btn btn-secondary" onclick="fecharDetalhes()">Fechar</button>
      </div>
  `;

  if (agendsDoDia.length === 0) {
    html += `<p style="text-align: center; color: #7f8c8d; padding: 40px;">Nenhum agendamento para este dia.</p>`;
  } else {
    html += '<div class="timeline">';
    agendsDoDia.forEach(ag => {
      html += `
        <div class="timeline-item ${ag.status.toLowerCase()}">
          <div class="timeline-time">${ag.horario_inicio}</div>
          <div class="timeline-content">
            <h3>${ag.nome_empresa}</h3>
            <p><strong>Mercadoria:</strong> ${ag.tipo_mercadoria} (${ag.volume})</p>
            <p><strong>Horário:</strong> ${ag.horario_inicio} às ${ag.horario_fim} (${ag.tempo_estimado}min)</p>
            <p><strong>Contato:</strong> ${ag.nome_contato} - ${ag.telefone}</p>
            ${ag.observacoes ? `<p><strong>Obs:</strong> ${ag.observacoes}</p>` : ''}
            <div style="margin-top: 8px;">
              <span class="badge badge-${ag.status.toLowerCase()}">${ag.status}</span>
            </div>
            ${ag.status === 'Pendente' ? `
              <div class="timeline-actions">
                <button class="btn btn-success" onclick="aprovarAgendamento(${ag.id})">✓ Aprovar</button>
                <button class="btn btn-danger" onclick="recusarAgendamento(${ag.id})">✗ Recusar</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  html += '</div>';
  
  document.getElementById('detalhes-dia').innerHTML = html;
  document.getElementById('detalhes-dia').style.display = 'block';
}

// Fechar detalhes
function fecharDetalhes() {
  diaSelecionado = null;
  document.getElementById('detalhes-dia').style.display = 'none';
  renderizarCalendario();
}

// Filtrar por status
function filtrarStatus(status) {
  filtroAtual = status;
  
  // Atualizar visual dos filtros
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Re-renderizar se houver dia selecionado
  if (diaSelecionado) {
    renderizarDetalhesDia(diaSelecionado);
  }
}

// Aprovar agendamento
async function aprovarAgendamento(id) {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/agendamentos/${id}/aprovar`, {
      method: 'PUT'
    });
    
    if (response.ok) {
      await carregarAgendamentos();
      if (diaSelecionado) {
        renderizarDetalhesDia(diaSelecionado);
      }
    }
  } catch (error) {
    console.error('Erro:', error);
    alert('Erro ao aprovar agendamento');
  }
}

// Recusar agendamento
async function recusarAgendamento(id) {
  if (confirm('Deseja realmente recusar este agendamento?')) {
    try {
      const response = await fetch(`${CONFIG.API_URL}/api/agendamentos/${id}/recusar`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        await carregarAgendamentos();
        if (diaSelecionado) {
          renderizarDetalhesDia(diaSelecionado);
        }
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao recusar agendamento');
    }
  }
}
