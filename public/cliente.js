// Conexão com a teia
const socket = io();
const apelido = localStorage.getItem('teia_apelido') || 'Aranha';
const avatar = localStorage.getItem('teia_avatar') || '🕷️';

// Elementos da interface
const elementos = {
    mensagens: document.getElementById('area-mensagens'),
    listaHabitantes: document.getElementById('lista-habitantes'),
    contagemOnline: document.getElementById('contagem-online'),
    miniContagem: document.getElementById('mini-contagem'),
    campoMensagem: document.getElementById('campo-mensagem'),
    botaoEnviar: document.getElementById('botao-enviar'),
    digitandoStatus: document.getElementById('digitando-status'),
    dicasDigitacao: document.getElementById('dicas-digitacao'),
    painelEmojis: document.getElementById('painel-emojis'),
    listaSalas: document.getElementById('lista-salas'),
    salaAtualNome: document.getElementById('sala-atual-nome'),
    modalSenha: document.getElementById('modal-senha'),
    modalCriarSala: document.getElementById('modal-criar-sala'),
    modalConversaPrivada: document.getElementById('modal-conversa-privada'),
    areaConversasPrivadas: document.getElementById('area-conversas-privadas'),
    listaConversas: document.getElementById('lista-conversas'),
    notificacao: document.getElementById('notificacao'),
    notificacaoMensagem: document.getElementById('notificacao-mensagem'),
    somNotificacao: document.getElementById('som-notificacao'),
    botaoAtivarSom: document.getElementById('botao-ativar-som'),
    indicadorSom: document.getElementById('indicador-som'),
    salaSelecionada: null
};

// ========== ESTADO GLOBAL ==========
let digitandoTimeout;
let habitantes = [];
let salas = [];
let salaAtual = 'principal';
let conversasPrivadas = {};
let notificacaoTimeout;
let conversaAtiva = null;  // <--- VARIÁVEL QUE FALTAVA!

// Estado do som de notificação
let somAtivo = false;
let audioContext = null;
let somQueue = [];

// ========== INICIALIZAÇÃO DO SOM ==========

function inicializarAudio() {
    if (somAtivo) return true;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        
        somAtivo = true;
        
        if (elementos.indicadorSom) {
            elementos.indicadorSom.textContent = '🔊';
            elementos.indicadorSom.style.color = '#00FF00';
        }
        
        if (elementos.botaoAtivarSom) {
            elementos.botaoAtivarSom.style.display = 'none';
        }
        
        while (somQueue.length > 0) {
            const tipo = somQueue.shift();
            tocarSom(tipo);
        }
        
        console.log('✅ Áudio inicializado com sucesso');
        return true;
    } catch (e) {
        console.log('❌ Erro ao inicializar áudio:', e);
        return false;
    }
}

function tocarSom(tipo = 'notificacao') {
    if (!somAtivo) {
        somQueue.push(tipo);
        return false;
    }
    
    try {
        if (tipo === 'notificacao') {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.15);
            
            setTimeout(() => {
                if (somAtivo && audioContext) {
                    const oscillator2 = audioContext.createOscillator();
                    const gainNode2 = audioContext.createGain();
                    
                    oscillator2.connect(gainNode2);
                    gainNode2.connect(audioContext.destination);
                    
                    oscillator2.type = 'sine';
                    oscillator2.frequency.value = 600;
                    gainNode2.gain.value = 0.1;
                    
                    oscillator2.start();
                    oscillator2.stop(audioContext.currentTime + 0.1);
                }
            }, 100);
        }
        
        if (tipo === 'erro') {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'sawtooth';
            oscillator.frequency.value = 300;
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        }
        
        if (tipo === 'sucesso') {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 1000;
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
            
            setTimeout(() => {
                if (somAtivo && audioContext) {
                    const oscillator2 = audioContext.createOscillator();
                    const gainNode2 = audioContext.createGain();
                    
                    oscillator2.connect(gainNode2);
                    gainNode2.connect(audioContext.destination);
                    
                    oscillator2.type = 'sine';
                    oscillator2.frequency.value = 1200;
                    gainNode2.gain.value = 0.1;
                    
                    oscillator2.start();
                    oscillator2.stop(audioContext.currentTime + 0.1);
                }
            }, 100);
        }
        
        return true;
    } catch (e) {
        console.log('Erro ao tocar som:', e);
        return false;
    }
}

window.ativarSom = function() {
    return inicializarAudio();
};

// ========== INICIALIZAÇÃO ==========

document.addEventListener('click', function() {
    inicializarAudio();
}, { once: true });

socket.emit('entrar_na_teia', { 
    apelido: apelido,
    avatar: avatar 
});

// ========== RECEBER EVENTOS ==========

socket.on('atualizar_salas', (salasAtualizadas) => {
    salas = salasAtualizadas;
    atualizarListaSalas();
});

socket.on('historico_da_sala', (historico) => {
    limparMensagensPublicas();
    historico.forEach(mensagem => adicionarMensagemPublica(mensagem));
});

socket.on('mensagem_da_teia', (mensagem) => {
    if (!elementos.mensagens) return;
    adicionarMensagemPublica(mensagem);
    
    if (mensagem.tipo === 'habitante' && mensagem.apelido !== apelido) {
        mostrarNotificacao(mensagem.apelido, mensagem.texto);
        tocarSom('notificacao');
    }
});

socket.on('atualizar_habitantes_da_sala', (habitantesDaSala) => {
    habitantes = habitantesDaSala;
    atualizarListaHabitantes();
    atualizarContagens();
});

socket.on('alguem_tecelando', (apelidoDigitando) => {
    elementos.digitandoStatus.textContent = `🕷️ ${apelidoDigitando} está tecendo...`;
});

socket.on('alguem_parou_de_tecer', () => {
    elementos.digitandoStatus.textContent = '';
});

socket.on('sala_trocada', ({ salaId, nome }) => {
    salaAtual = salaId;
    elementos.salaAtualNome.textContent = nome;
    mostrarNotificacao('📍 Sala', `Você entrou em ${nome}`, 2000);
    limparMensagensPublicas();
    tocarSom('sucesso');
});

socket.on('sala_criada', ({ salaId, nome }) => {
    fecharModalCriarSala();
    mostrarNotificacao('✅ Sucesso', `Sala "${nome}" criada!`, 3000);
    tocarSom('sucesso');
});

socket.on('erro_sala', (mensagem) => {
    alert(mensagem);
    tocarSom('erro');
    fecharModalSenha();
});

// ========== CONVERSAS PRIVADAS ==========

socket.on('conversa_privada_solicitada', ({ conversaId, de, avatar }) => {
    if (!conversasPrivadas[conversaId]) {
        conversasPrivadas[conversaId] = {
            id: conversaId,
            com: de,
            avatar: avatar,
            mensagens: [],
            ativa: true
        };
        
        mostrarNotificacao('💬 Nova conversa', `${de} quer conversar em particular`, 5000);
        tocarSom('notificacao');
        atualizarListaConversas();
    }
});

socket.on('conversa_iniciada', ({ conversaId, com, avatar }) => {
    conversasPrivadas[conversaId] = {
        id: conversaId,
        com: com,
        avatar: avatar,
        mensagens: [],
        ativa: true
    };
    
    conversaAtiva = conversaId;
    atualizarListaConversas();
    abrirConversaPrivada(conversaId);
    tocarSom('sucesso');
});

socket.on('historico_conversa_privada', (mensagens) => {
    if (conversaAtiva && conversasPrivadas[conversaAtiva]) {
        conversasPrivadas[conversaAtiva].mensagens = mensagens;
        atualizarAreaConversaPrivada();
    }
});

socket.on('nova_mensagem_privada', (mensagem) => {
    for (let id in conversasPrivadas) {
        const conversa = conversasPrivadas[id];
        
        if ((conversa.com === mensagem.de || conversa.com === apelido) && 
            (mensagem.de === conversa.com || mensagem.de === apelido)) {
            
            conversa.mensagens.push(mensagem);
            
            if (conversaAtiva === id) {
                atualizarAreaConversaPrivada();
            } else {
                mostrarNotificacao('💬 Mensagem privada', 
                    `${mensagem.de}: ${mensagem.texto.substring(0, 30)}${mensagem.texto.length > 30 ? '...' : ''}`, 
                    4000);
                tocarSom('notificacao');
                tremerTela();
            }
            
            atualizarListaConversas();
            break;
        }
    }
});

socket.on('alguem_tecelando_privado', ({ de, conversaId }) => {
    if (conversaAtiva === conversaId) {
        elementos.dicasDigitacao.textContent = `✏️ ${de} está digitando...`;
    }
});

socket.on('alguem_parou_de_tecer_privado', (conversaId) => {
    if (conversaAtiva === conversaId) {
        elementos.dicasDigitacao.textContent = '';
    }
});

socket.on('convite_sala_privada', ({ salaId, nome, de }) => {
    if (confirm(`🔔 ${de} te convidou para entrar na sala "${nome}". Aceitar?`)) {
        socket.emit('trocar_sala', { salaId: salaId });
    }
});

// ========== FUNÇÕES DE NOTIFICAÇÃO ==========

function mostrarNotificacao(titulo, mensagem, duracao = 3000) {
    if (!elementos.notificacao) return;
    
    if (notificacaoTimeout) {
        clearTimeout(notificacaoTimeout);
    }
    
    elementos.notificacaoMensagem.innerHTML = `<strong>${titulo}</strong><br>${mensagem}`;
    elementos.notificacao.classList.add('ativo');
    
    notificacaoTimeout = setTimeout(() => {
        elementos.notificacao.classList.remove('ativo');
    }, duracao);
}

function tremerTela() {
    document.body.classList.add('tremer');
    setTimeout(() => {
        document.body.classList.remove('tremer');
    }, 500);
}

// ========== FUNÇÕES DE INTERFACE ==========

function atualizarListaSalas() {
    if (!elementos.listaSalas) return;
    
    elementos.listaSalas.innerHTML = '';
    
    salas.forEach(sala => {
        const item = document.createElement('div');
        item.className = `sala-item ${sala.id === salaAtual ? 'ativa' : ''} ${sala.tipo}`;
        
        let icone = sala.tipo === 'publica' ? '📡' : '🔒';
        
        item.innerHTML = `
            <span class="sala-info">
                <span class="sala-icone">${icone}</span>
                <span class="sala-nome">${sala.nome}</span>
                ${sala.protegida ? '<span class="sala-cadeado">🔐</span>' : ''}
            </span>
            <span class="sala-contagem">${sala.usuarios}</span>
        `;
        
        item.onclick = () => trocarSala(sala);
        
        if (sala.tipo === 'privada') {
            item.oncontextmenu = (e) => {
                e.preventDefault();
                if (confirm(`Compartilhar convite para sala "${sala.nome}"?`)) {
                    const apelidoConvite = prompt('Convidar qual usuário?');
                    if (apelidoConvite) {
                        socket.emit('convidar_para_sala', { apelido: apelidoConvite, salaId: sala.id });
                    }
                }
            };
        }
        
        elementos.listaSalas.appendChild(item);
    });
}

function trocarSala(sala) {
    if (sala.id === salaAtual) return;
    
    if (sala.protegida) {
        elementos.salaSelecionada = sala;
        elementos.modalSenha.classList.add('ativo');
        document.getElementById('senha-input').focus();
    } else {
        socket.emit('trocar_sala', { salaId: sala.id });
    }
}

function confirmarSenha() {
    const senha = document.getElementById('senha-input').value;
    if (!elementos.salaSelecionada) return;
    
    socket.emit('trocar_sala', {
        salaId: elementos.salaSelecionada.id,
        senha: senha
    });
    
    fecharModalSenha();
}

function fecharModalSenha() {
    elementos.modalSenha.classList.remove('ativo');
    elementos.salaSelecionada = null;
    document.getElementById('senha-input').value = '';
}

function abrirModalCriarSala() {
    elementos.modalCriarSala.classList.add('ativo');
}

function fecharModalCriarSala() {
    elementos.modalCriarSala.classList.remove('ativo');
    document.getElementById('nova-sala-nome').value = '';
    document.getElementById('nova-sala-senha').value = '';
}

function criarSalaPrivada() {
    const nome = document.getElementById('nova-sala-nome').value.trim();
    const senha = document.getElementById('nova-sala-senha').value.trim();
    
    if (!nome) {
        alert('Digite um nome para a sala');
        tocarSom('erro');
        return;
    }
    
    socket.emit('criar_sala_privada', {
        nome: nome,
        senha: senha || null
    });
}

function abrirModalConversaPrivada() {
    elementos.modalConversaPrivada.classList.add('ativo');
}

function fecharModalConversaPrivada() {
    elementos.modalConversaPrivada.classList.remove('ativo');
    document.getElementById('conversa-destino').value = '';
}

function iniciarConversaPrivada() {
    const destino = document.getElementById('conversa-destino').value.trim();
    
    if (!destino) {
        alert('Digite o apelido do usuário');
        tocarSom('erro');
        return;
    }
    
    if (destino === apelido) {
        alert('Não pode conversar consigo mesmo');
        tocarSom('erro');
        return;
    }
    
    socket.emit('iniciar_conversa_privada', { com: destino });
    fecharModalConversaPrivada();
}

function abrirConversaPrivada(conversaId) {
    conversaAtiva = conversaId;
    elementos.areaConversasPrivadas.classList.add('ativo');
    atualizarAreaConversaPrivada();
}

function fecharConversaPrivada() {
    conversaAtiva = null;
    elementos.areaConversasPrivadas.classList.remove('ativo');
}

function atualizarListaConversas() {
    if (!elementos.listaConversas) return;
    
    elementos.listaConversas.innerHTML = '<div class="titulo-conversas">💬 CONVERSAS</div>';
    
    Object.values(conversasPrivadas).forEach(conv => {
        if (!conv.ativa) return;
        
        const item = document.createElement('div');
        item.className = `conversa-item ${conv.id === conversaAtiva ? 'ativa' : ''}`;
        item.innerHTML = `
            <span class="conversa-avatar">${conv.avatar || '💬'}</span>
            <span class="conversa-nome">${conv.com}</span>
            <span class="conversa-msg-count">${conv.mensagens.length}</span>
        `;
        
        item.onclick = () => abrirConversaPrivada(conv.id);
        
        elementos.listaConversas.appendChild(item);
    });
}

// ========== MENSAGENS PRIVADAS ==========

function atualizarAreaConversaPrivada() {
    const area = document.getElementById('conversa-mensagens');
    if (!area || !conversaAtiva || !conversasPrivadas[conversaAtiva]) return;
    
    area.innerHTML = '';
    
    conversasPrivadas[conversaAtiva].mensagens.forEach(msg => {
        const msgDiv = document.createElement('div');
        const ehMinha = msg.de === apelido;
        
        if (ehMinha) {
            msgDiv.className = 'mensagem-privada minha-mensagem';
            msgDiv.innerHTML = `
                <div class="mensagem-bolha minha-bolha">
                    <div class="mensagem-conteudo">
                        <span class="mensagem-texto">${formatarMensagem(msg.texto)}</span>
                        <span class="mensagem-horario">${msg.horario}</span>
                    </div>
                    <span class="mensagem-avatar">${msg.avatar || '💬'}</span>
                </div>
            `;
        } else {
            msgDiv.className = 'mensagem-privada mensagem-recebida';
            msgDiv.innerHTML = `
                <div class="mensagem-bolha recebida-bolha">
                    <span class="mensagem-avatar" style="color: ${msg.cor}">${msg.avatar || '💬'}</span>
                    <div class="mensagem-conteudo">
                        <span class="mensagem-apelido" style="color: ${msg.cor}">${msg.de}</span>
                        <span class="mensagem-texto">${formatarMensagem(msg.texto)}</span>
                        <span class="mensagem-horario">${msg.horario}</span>
                    </div>
                </div>
            `;
        }
        
        area.appendChild(msgDiv);
    });
    
    area.scrollTop = area.scrollHeight;
}

function enviarMensagemPrivada() {
    const campo = document.getElementById('conversa-input');
    const texto = campo.value.trim();
    
    if (texto && conversaAtiva) {
        socket.emit('mensagem_privada', {
            conversaId: conversaAtiva,
            texto: texto
        });
        campo.value = '';
        socket.emit('parou_de_tecer', { tipo: 'privado', destino: conversaAtiva });
    }
}

// ========== MENSAGENS PÚBLICAS ==========

function adicionarMensagemPublica(msg) {
    const msgDiv = document.createElement('div');
    const ehMinha = msg.apelido === apelido;
    
    let classes = 'mensagem';
    if (msg.tipo === 'teia') {
        classes += ' mensagem-teia';
    } else {
        classes += ehMinha ? ' minha-mensagem' : ' mensagem-recebida';
    }
    msgDiv.className = classes;
    
    if (msg.tipo === 'teia') {
        msgDiv.innerHTML = `
            <div class="mensagem-teia-conteudo">
                <span class="horario">[${msg.horario}]</span>
                <span class="texto">${msg.texto}</span>
            </div>
        `;
    } else {
        if (ehMinha) {
            msgDiv.innerHTML = `
                <div class="mensagem-bolha minha-bolha">
                    <div class="mensagem-conteudo">
                        <span class="mensagem-texto">${formatarMensagem(msg.texto)}</span>
                        <span class="mensagem-horario">${msg.horario}</span>
                    </div>
                    <span class="mensagem-avatar">${msg.avatar || '💬'}</span>
                </div>
            `;
        } else {
            msgDiv.innerHTML = `
                <div class="mensagem-bolha recebida-bolha">
                    <span class="mensagem-avatar" style="color: ${msg.cor}">${msg.avatar || '💬'}</span>
                    <div class="mensagem-conteudo">
                        <span class="mensagem-apelido" style="color: ${msg.cor}">${msg.apelido}</span>
                        <span class="mensagem-texto">${formatarMensagem(msg.texto)}</span>
                        <span class="mensagem-horario">${msg.horario}</span>
                    </div>
                </div>
            `;
        }
    }
    
    elementos.mensagens.appendChild(msgDiv);
    elementos.mensagens.scrollTop = elementos.mensagens.scrollHeight;
}

function limparMensagensPublicas() {
    elementos.mensagens.innerHTML = `
        <div class="bem-vindo-teia">
            <div class="icone-bem-vindo">🕷️</div>
            <div class="texto-bem-vindo">
                bem-vindo à sala. seja educado, seja curioso.
            </div>
        </div>
    `;
}

function atualizarListaHabitantes() {
    if (!elementos.listaHabitantes) return;
    
    elementos.listaHabitantes.innerHTML = '';
    
    habitantes.sort((a, b) => a.apelido.localeCompare(b.apelido));
    
    habitantes.forEach(habitante => {
        const item = document.createElement('div');
        item.className = 'habitante-item';
        item.style.color = habitante.cor;
        item.innerHTML = `
            <span class="habitante-avatar">${habitante.avatar || '🕷️'}</span>
            <span class="habitante-nome">${habitante.apelido}</span>
        `;
        
        item.onclick = () => {
            if (habitante.apelido !== apelido) {
                iniciarPrivado(habitante.apelido);
            }
        };
        
        elementos.listaHabitantes.appendChild(item);
    });
}

function iniciarPrivado(apelidoDestino) {
    socket.emit('iniciar_conversa_privada', { com: apelidoDestino });
}

function atualizarContagens() {
    const count = habitantes.length;
    if (elementos.contagemOnline) {
        elementos.contagemOnline.innerHTML = `<span class="numero-online">${count}</span> online`;
    }
    if (elementos.miniContagem) {
        elementos.miniContagem.textContent = count;
    }
}

function formatarMensagem(texto) {
    return texto
        .replace(/:\)/g, '😊')
        .replace(/:D/g, '😃')
        .replace(/:\(/g, '😞')
        .replace(/;-\)/g, '😉')
        .replace(/<3/g, '❤️')
        .replace(/:P/g, '😛')
        .replace(/:O/g, '😮')
        .replace(/xD/g, '😆')
        .replace(/:'\(/g, '😢')
        .replace(/:@/g, '😠');
}

// ========== AÇÕES DO USUÁRIO ==========

window.enviarMensagem = () => {
    const texto = elementos.campoMensagem.value.trim();
    
    if (texto) {
        socket.emit('falar_na_teia', texto);
        elementos.campoMensagem.value = '';
        socket.emit('parou_de_tecer', { tipo: 'sala' });
    }
};

window.limparCampo = () => {
    elementos.campoMensagem.value = '';
    elementos.campoMensagem.focus();
};

window.toggleEmojis = () => {
    elementos.painelEmojis.classList.toggle('ativo');
};

window.inserirEmoji = (emoji) => {
    elementos.campoMensagem.value += emoji + ' ';
    elementos.campoMensagem.focus();
};

window.sairDaTeia = () => {
    if (confirm('🕸️ Desconectar da teia?')) {
        localStorage.removeItem('teia_apelido');
        localStorage.removeItem('teia_avatar');
        window.location.href = 'index.html';
    }
};

// ========== EVENTOS DE TECLADO ==========

elementos.campoMensagem.addEventListener('input', () => {
    socket.emit('tecelao_digitando', { tipo: 'sala' });
    
    clearTimeout(digitandoTimeout);
    digitandoTimeout = setTimeout(() => {
        socket.emit('parou_de_tecer', { tipo: 'sala' });
    }, 1000);
});

elementos.campoMensagem.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensagem();
    }
});

const conversaInput = document.getElementById('conversa-input');
if (conversaInput) {
    conversaInput.addEventListener('input', () => {
        if (conversaAtiva) {
            socket.emit('tecelao_digitando', { 
                tipo: 'privado', 
                destino: conversaAtiva 
            });
            
            clearTimeout(digitandoTimeout);
            digitandoTimeout = setTimeout(() => {
                socket.emit('parou_de_tecer', { 
                    tipo: 'privado', 
                    destino: conversaAtiva 
                });
            }, 1000);
        }
    });
    
    conversaInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviarMensagemPrivada();
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        limparMensagensPublicas();
    }
    
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        toggleEmojis();
    }
    
    if (e.key === 'Escape') {
        fecharModalSenha();
        fecharModalCriarSala();
        fecharModalConversaPrivada();
        fecharConversaPrivada();
        if (elementos.painelEmojis) {
            elementos.painelEmojis.classList.remove('ativo');
        }
    }
});

document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
        inicializarAudio();
    }, { once: true });
});

console.log(`🕷️ Conectado à teia como ${apelido}`);