// ===========================================
// SISTEMA DE AGENDAMENTO - JAVASCRIPT
// ===========================================

const { useState, useEffect } = React;
const API_URL = 'https://lpsolutions-89zx.onrender.com';

// ===========================================
// COMPONENTE PRINCIPAL
// ===========================================

function App() {
  const [telaAtual, setTelaAtual] = useState('fornecedor');
  const [logadoAdmin, setLogadoAdmin] = useState(false);
  const [usuarioAdmin, setUsuarioAdmin] = useState(null);
  const [logadoFornecedor, setLogadoFornecedor] = useState(false);
  const [fornecedorLogado, setFornecedorLogado] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [bloqueios, setBloqueios] = useState([]);

  // Carregar bloqueios ao iniciar
  useEffect(() => {
    carregarBloqueios();
  }, []);

  // Carregar agendamentos do admin
  useEffect(() => {
    if (logadoAdmin) {
      carregarTodosAgendamentos();
    }
  }, [logadoAdmin]);

  // Carregar agendamentos do fornecedor
  useEffect(() => {
    if (logadoFornecedor && fornecedorLogado) {
      carregarMeusAgendamentos();
    }
  }, [logadoFornecedor]);

  async function carregarTodosAgendamentos() {
    try {
      const res = await fetch(`${API_URL}/api/agendamentos`);
      const data = await res.json();
      setAgendamentos(data);
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
    }
  }

  async function carregarMeusAgendamentos() {
    if (!fornecedorLogado || !fornecedorLogado.id) {
      console.error('Fornecedor não está logado corretamente');
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/fornecedor/${fornecedorLogado.id}/agendamentos`);
      const data = await res.json();
      setAgendamentos(data);
    } catch (err) {
      console.error('Erro ao carregar meus agendamentos:', err);
    }
  }

  async function carregarBloqueios() {
    try {
      const res = await fetch(`${API_URL}/api/bloqueios`);
      const data = await res.json();
      setBloqueios(data);
    } catch (err) {
      console.error('Erro ao carregar bloqueios:', err);
    }
  }

  async function aprovarAgendamento(id) {
    try {
      const res = await fetch(`${API_URL}/api/agendamentos/${id}/aprovar`, { method: 'PUT' });
      if (res.ok) carregarTodosAgendamentos();
    } catch (err) {
      alert('Erro ao aprovar: ' + err.message);
    }
  }

  async function recusarAgendamento(id) {
    try {
      const res = await fetch(`${API_URL}/api/agendamentos/${id}/recusar`, { method: 'PUT' });
      if (res.ok) carregarTodosAgendamentos();
    } catch (err) {
      alert('Erro ao recusar: ' + err.message);
    }
  }

  function fazerLoginAdmin(email, senha) {
    if (email === 'admin@mercado.com' && senha === '123456') {
      setLogadoAdmin(true);
      setUsuarioAdmin({ nome: 'Admin', tipo: 'admin' });
      setTelaAtual('admin');
    } else if (email === 'joao@mercado.com' && senha === '123456') {
      setLogadoAdmin(true);
      setUsuarioAdmin({ nome: 'João', tipo: 'funcionario' });
      setTelaAtual('admin');
    } else if (email === 'jonatas@mercado.com' && senha === '123456') {
      setLogadoAdmin(true);
      setUsuarioAdmin({ nome: 'Jonatas', tipo: 'funcionario' });
      setTelaAtual('admin');
    } else {
      alert('Email ou senha inválidos!');
    }
  }

  async function fazerLoginFornecedor(email, senha) {
    try {
      const res = await fetch(`${API_URL}/api/auth/fornecedor/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        console.log('Login bem-sucedido:', data);
        setFornecedorLogado(data.fornecedor);
        setLogadoFornecedor(true);
        setTelaAtual('fornecedor');
      } else {
        throw new Error(data.erro || 'Erro ao fazer login');
      }
    } catch (err) {
      throw err;
    }
  }

  function logoutFornecedor() {
    setLogadoFornecedor(false);
    setFornecedorLogado(null);
    setAgendamentos([]);
  }

  function logoutAdmin() {
    setLogadoAdmin(false);
    setUsuarioAdmin(null);
    setTelaAtual('fornecedor');
  }

  if (telaAtual === 'admin' && !logadoAdmin) {
    return <TelaLoginAdmin onLogin={fazerLoginAdmin} onVoltar={() => setTelaAtual('fornecedor')} />;
  }

  const totalPendentes = agendamentos.filter(a => a.status === 'Pendente').length;
  const totalAprovados = agendamentos.filter(a => a.status === 'Aprovado').length;
  const totalRecusados = agendamentos.filter(a => a.status === 'Recusado').length;

  return (
    <div className="container">
      <div className="header">
        <h1>🏪 Sistema de Agendamento - Mercado</h1>
        {logadoAdmin && (
          <div>
            <span style={{marginRight: '16px', color: '#7f8c8d'}}>Olá, {usuarioAdmin.nome}!</span>
            <button className="btn btn-danger" onClick={logoutAdmin}>Sair</button>
          </div>
        )}
        {logadoFornecedor && fornecedorLogado && (
          <div>
            <span style={{marginRight: '16px', color: '#7f8c8d'}}>Olá, {fornecedorLogado.nome_empresa}!</span>
            <button className="btn btn-danger" onClick={logoutFornecedor}>Sair</button>
          </div>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${telaAtual === 'fornecedor' ? 'active' : ''}`} onClick={() => setTelaAtual('fornecedor')}>
          📦 Área do Fornecedor
        </button>
        <button className={`tab ${telaAtual === 'admin' ? 'active' : ''}`} onClick={() => setTelaAtual('admin')}>
          🔐 Painel Administrativo
        </button>
      </div>

      {telaAtual === 'fornecedor' && (
        logadoFornecedor && fornecedorLogado ? (
          <AreaFornecedorLogado 
            fornecedor={fornecedorLogado}
            agendamentos={agendamentos}
            bloqueios={bloqueios}
            onReload={carregarMeusAgendamentos}
          />
        ) : (
          <TelaLoginFornecedor onLogin={fazerLoginFornecedor} />
        )
      )}

      {telaAtual === 'admin' && logadoAdmin && (
        <PainelAdminPorDia 
          agendamentos={agendamentos}
          aprovarAgendamento={aprovarAgendamento}
          recusarAgendamento={recusarAgendamento}
          totalPendentes={totalPendentes}
          totalAprovados={totalAprovados}
          totalRecusados={totalRecusados}
        />
      )}
    </div>
  );
}

// ===========================================
// TELA LOGIN ADMIN
// ===========================================

function TelaLoginAdmin({ onLogin, onVoltar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onLogin(email, senha);
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>🔐 Login Administrativo</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@mercado.com" required />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="******" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%', marginBottom: '12px'}}>Entrar</button>
          <button type="button" className="btn" onClick={onVoltar} style={{width: '100%', background: '#ecf0f1'}}>Voltar</button>
        </form>
        <div className="alert-info" style={{marginTop: '20px', fontSize: '13px'}}>
          <strong>Credenciais de teste:</strong><br/>admin@mercado.com / 123456
        </div>
      </div>
    </div>
  );
}

// ===========================================
// TELA LOGIN FORNECEDOR
// ===========================================

function TelaLoginFornecedor({ onLogin }) {
  const [modoTela, setModoTela] = useState('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [dadosCadastro, setDadosCadastro] = useState({
    nome_empresa: '',
    nome_contato: '',
    telefone: '',
    email: '',
    senha: '',
    confirmarSenha: ''
  });

  async function handleLogin(e) {
    e.preventDefault();
    setErro('');
    try {
      await onLogin(email, senha);
    } catch (err) {
      setErro(err.message);
    }
  }

  async function handleCadastro(e) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (dadosCadastro.senha !== dadosCadastro.confirmarSenha) {
      setErro('As senhas não coincidem!');
      return;
    }

    if (dadosCadastro.senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres!');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/fornecedor/cadastro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_empresa: dadosCadastro.nome_empresa,
          nome_contato: dadosCadastro.nome_contato,
          telefone: dadosCadastro.telefone,
          email: dadosCadastro.email,
          senha: dadosCadastro.senha
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSucesso('Conta criada com sucesso! Faça login para continuar.');
        setDadosCadastro({ nome_empresa: '', nome_contato: '', telefone: '', email: '', senha: '', confirmarSenha: '' });
        setTimeout(() => {
          setModoTela('login');
          setSucesso('');
        }, 2000);
      } else {
        setErro(data.erro || 'Erro ao criar conta');
      }
    } catch (err) {
      setErro(err.message);
    }
  }

  if (modoTela === 'cadastro') {
    return (
      <div className="login-container">
        <div className="login-card" style={{maxWidth: '500px'}}>
          <h2>📝 Criar Conta</h2>
          
          {erro && <div className="error-message">{erro}</div>}
          {sucesso && <div className="success-message">{sucesso}</div>}

          <form onSubmit={handleCadastro}>
            <div className="form-group">
              <label>Nome da Empresa *</label>
              <input type="text" value={dadosCadastro.nome_empresa} onChange={(e) => setDadosCadastro({...dadosCadastro, nome_empresa: e.target.value})} required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Nome do Contato *</label>
                <input type="text" value={dadosCadastro.nome_contato} onChange={(e) => setDadosCadastro({...dadosCadastro, nome_contato: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Telefone *</label>
                <input type="tel" value={dadosCadastro.telefone} onChange={(e) => setDadosCadastro({...dadosCadastro, telefone: e.target.value})} placeholder="(44) 99999-9999" required />
              </div>
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input type="email" value={dadosCadastro.email} onChange={(e) => setDadosCadastro({...dadosCadastro, email: e.target.value})} required />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Senha * (mínimo 6 caracteres)</label>
                <input type="password" value={dadosCadastro.senha} onChange={(e) => setDadosCadastro({...dadosCadastro, senha: e.target.value})} minLength="6" required />
              </div>
              <div className="form-group">
                <label>Confirmar Senha *</label>
                <input type="password" value={dadosCadastro.confirmarSenha} onChange={(e) => setDadosCadastro({...dadosCadastro, confirmarSenha: e.target.value})} required />
              </div>
            </div>

            <button type="submit" className="btn btn-success" style={{width: '100%', marginBottom: '12px'}}>Criar Conta</button>
            <button type="button" className="link-button" onClick={() => setModoTela('login')} style={{width: '100%'}}>Já tenho conta - Fazer Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>🔐 Login Fornecedor</h2>
        
        {erro && <div className="error-message">{erro}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="******" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%', marginBottom: '12px'}}>Entrar</button>
          <button type="button" className="link-button" onClick={() => setModoTela('cadastro')} style={{width: '100%'}}>Não tenho conta - Criar Conta</button>
        </form>
      </div>
    </div>
  );
}

// Continua no próximo arquivo...
