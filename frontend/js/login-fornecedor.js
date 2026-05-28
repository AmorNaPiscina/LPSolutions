// ===========================================
// LOGIN FORNECEDOR - JAVASCRIPT
// ===========================================

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/auth/fornecedor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Salvar dados do fornecedor no localStorage
      salvarDados(CONFIG.STORAGE_KEYS.FORNECEDOR, data.fornecedor);
      
      mostrarSucesso(CONFIG.MENSAGENS.SUCESSO_LOGIN);
      
      setTimeout(() => {
        window.location.href = 'area-fornecedor.html';
      }, 1000);
    } else {
      mostrarErro(data.erro || CONFIG.MENSAGENS.ERRO_LOGIN);
    }
  } catch (error) {
    console.error('Erro:', error);
    mostrarErro(CONFIG.MENSAGENS.ERRO_CONEXAO);
  }
});
