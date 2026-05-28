// ===========================================
// CADASTRO FORNECEDOR - JAVASCRIPT
// ===========================================

document.getElementById('form-cadastro').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nome_empresa = document.getElementById('nome_empresa').value;
  const nome_contato = document.getElementById('nome_contato').value;
  const telefone = document.getElementById('telefone').value;
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;
  const confirmar_senha = document.getElementById('confirmar_senha').value;
  
  // Validar senhas
  if (senha !== confirmar_senha) {
    mostrarErro('As senhas não coincidem!');
    return;
  }
  
  if (senha.length < 6) {
    mostrarErro('A senha deve ter no mínimo 6 caracteres!');
    return;
  }
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/auth/fornecedor/cadastro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome_empresa,
        nome_contato,
        telefone,
        email,
        senha
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      mostrarSucesso(CONFIG.MENSAGENS.SUCESSO_CADASTRO);
      
      setTimeout(() => {
        window.location.href = 'login-fornecedor.html';
      }, 2000);
    } else {
      mostrarErro(data.erro || 'Erro ao criar conta');
    }
  } catch (error) {
    console.error('Erro:', error);
    mostrarErro(CONFIG.MENSAGENS.ERRO_CONEXAO);
  }
});
