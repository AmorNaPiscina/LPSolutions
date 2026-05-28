// ===========================================
// LOGIN ADMIN - JAVASCRIPT
// ===========================================

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;
  
  // Validação simples (em produção, usar API de autenticação real)
  let usuario = null;
  
  if (email === 'admin@mercado.com' && senha === '123456') {
    usuario = { nome: 'Admin', tipo: 'admin', email };
  } else if (email === 'joao@mercado.com' && senha === '123456') {
    usuario = { nome: 'João', tipo: 'funcionario', email };
  } else if (email === 'jonatas@mercado.com' && senha === '123456') {
    usuario = { nome: 'Jonatas', tipo: 'funcionario', email };
  }
  
  if (usuario) {
    salvarDados(CONFIG.STORAGE_KEYS.ADMIN, usuario);
    mostrarSucesso(CONFIG.MENSAGENS.SUCESSO_LOGIN);
    
    setTimeout(() => {
      window.location.href = 'painel-admin.html';
    }, 1000);
  } else {
    mostrarErro(CONFIG.MENSAGENS.ERRO_LOGIN);
  }
});
