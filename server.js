const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const servidor = http.createServer(app);
const io = socketIo(servidor);

app.use(express.static(path.join(__dirname, 'public')));

// ========== CONFIGURAÇÃO DAS SALAS ==========
const salasFixas = [
    { id: 'principal', nome: '🕸️ PRINCIPAL', tema: 'geral', descricao: 'Conversa geral', tipo: 'publica' },
    { id: 'fofocas', nome: '🗣️ FOFOCAS', tema: 'fofocas', descricao: 'Fofocas e novidades', tipo: 'publica' },
    { id: 'tecnologia', nome: '💻 TECNOLOGIA', tema: 'tech', descricao: 'Programação, games, ciência', tipo: 'publica' },
    { id: 'cinema', nome: '🎬 CINEMA', tema: 'cinema', descricao: 'Filmes e séries', tipo: 'publica' },
    { id: 'esportes', nome: '⚽ ESPORTES', tema: 'esportes', descricao: 'Futebol, basquete, etc', tipo: 'publica' }
];

// Estrutura de dados
const teia = {
    habitantes: {},        // { socketId: { apelido, cor, sala, ultimaAtividade, avatar } }
    salas: {
        publicas: {},      // { salaId: [socketId, ...] }
        privadas: {}       // { salaId: { nome, criador, senha, participantes: [socketId, ...] } }
    },
    historico: {},         // { salaId: [mensagens...] }
    conversasPrivadas: {}  // { conversaId: { participantes: [apelido1, apelido2], mensagens: [] } }
};

// Inicializar salas públicas
salasFixas.forEach(sala => {
    teia.salas.publicas[sala.id] = [];
    teia.historico[sala.id] = [];
});

// Cores psicodélicas
const coresTeia = [
    '#FF44AA', '#AAFF44', '#44AAFF', '#FFAA44', 
    '#AA44FF', '#FF4444', '#44FFAA', '#FFDD44'
];

// Avatares estilo anos 2000
const avatares = [
    '😎', '🕷️', '🕸️', '👽', '🤖', '👻', '💀', '🎃',
    '😺', '🐶', '🦊', '🐸', '🐲', '🦉', '🐺', '🦝'
];

// ========== FUNÇÕES AUXILIARES ==========

function gerarIdSalaPrivada() {
    return 'priv_' + Math.random().toString(36).substring(2, 10);
}

function enviarParaSala(salaId, evento, dados) {
    // Envia para sala pública
    if (teia.salas.publicas[salaId]) {
        teia.salas.publicas[salaId].forEach(socketId => {
            io.to(socketId).emit(evento, dados);
        });
    }
    // Envia para sala privada
    else if (teia.salas.privadas[salaId]) {
        teia.salas.privadas[salaId].participantes.forEach(socketId => {
            io.to(socketId).emit(evento, dados);
        });
    }
}

function getInfoSalas() {
    const info = [];
    
    // Salas públicas
    salasFixas.forEach(sala => {
        info.push({
            ...sala,
            usuarios: teia.salas.publicas[sala.id]?.length || 0,
            tipo: 'publica'
        });
    });
    
    // Salas privadas
    Object.keys(teia.salas.privadas).forEach(salaId => {
        const sala = teia.salas.privadas[salaId];
        info.push({
            id: salaId,
            nome: sala.nome,
            descricao: `Sala privada criada por ${sala.criador}`,
            tipo: 'privada',
            usuarios: sala.participantes.length,
            criador: sala.criador,
            protegida: !!sala.senha
        });
    });
    
    return info;
}

function moverUsuarioParaSala(socketId, novaSalaId, apelido, cor, avatar) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return false;

    const habitante = teia.habitantes[socketId];
    if (!habitante) return false;

    // Sair da sala anterior
    const salaAnterior = habitante.sala;
    if (salaAnterior) {
        // Remover da sala anterior
        if (teia.salas.publicas[salaAnterior]) {
            teia.salas.publicas[salaAnterior] = teia.salas.publicas[salaAnterior].filter(id => id !== socketId);
        } else if (teia.salas.privadas[salaAnterior]) {
            teia.salas.privadas[salaAnterior].participantes = 
                teia.salas.privadas[salaAnterior].participantes.filter(id => id !== socketId);
        }

        // Avisar na sala anterior
        enviarParaSala(salaAnterior, 'mensagem_da_teia', {
            tipo: 'teia',
            texto: `🕸️ ${apelido} saiu da sala`,
            horario: new Date().toLocaleTimeString()
        });

        // Atualizar lista de habitantes da sala anterior
        const habitantesAnteriores = getHabitantesDaSala(salaAnterior);
        enviarParaSala(salaAnterior, 'atualizar_habitantes_da_sala', habitantesAnteriores);
    }

    // Entrar na nova sala
    if (teia.salas.publicas[novaSalaId]) {
        teia.salas.publicas[novaSalaId].push(socketId);
    } else if (teia.salas.privadas[novaSalaId]) {
        teia.salas.privadas[novaSalaId].participantes.push(socketId);
    }

    // Atualizar sala do habitante
    teia.habitantes[socketId].sala = novaSalaId;
    socket.join(novaSalaId);

    // Avisar na nova sala
    enviarParaSala(novaSalaId, 'mensagem_da_teia', {
        tipo: 'teia',
        texto: `🕷️ ${apelido} entrou na sala`,
        horario: new Date().toLocaleTimeString()
    });

    // Enviar histórico da nova sala
    if (teia.historico[novaSalaId]) {
        socket.emit('historico_da_sala', teia.historico[novaSalaId]);
    }

    // Atualizar lista de habitantes da nova sala
    const novosHabitantes = getHabitantesDaSala(novaSalaId);
    enviarParaSala(novaSalaId, 'atualizar_habitantes_da_sala', novosHabitantes);

    return true;
}

function getHabitantesDaSala(salaId) {
    const habitantes = [];
    
    if (teia.salas.publicas[salaId]) {
        teia.salas.publicas[salaId].forEach(id => {
            if (teia.habitantes[id]) habitantes.push(teia.habitantes[id]);
        });
    } else if (teia.salas.privadas[salaId]) {
        teia.salas.privadas[salaId].participantes.forEach(id => {
            if (teia.habitantes[id]) habitantes.push(teia.habitantes[id]);
        });
    }
    
    return habitantes;
}

// ========== EVENTOS DO SOCKET ==========

io.on('connection', (socket) => {
    console.log(`🕷️ Nova aranha conectada: ${socket.id}`);

    // Quando alguém entra na teia
    socket.on('entrar_na_teia', ({ apelido, avatar }) => {
        const cor = coresTeia[Math.floor(Math.random() * coresTeia.length)];
        const avatarEscolhido = avatar || avatares[Math.floor(Math.random() * avatares.length)];
        
        // Registrar habitante
        teia.habitantes[socket.id] = {
            apelido: apelido || 'Aranha',
            cor: cor,
            avatar: avatarEscolhido,
            sala: 'principal',
            ultimaAtividade: Date.now()
        };

        // Entrar na sala principal
        teia.salas.publicas['principal'].push(socket.id);
        socket.join('principal');

        // Enviar lista de salas
        io.emit('atualizar_salas', getInfoSalas());

        // Anunciar entrada
        enviarParaSala('principal', 'mensagem_da_teia', {
            tipo: 'teia',
            texto: `🕷️ ${apelido} entrou na teia`,
            horario: new Date().toLocaleTimeString()
        });

        // Enviar histórico da sala principal
        socket.emit('historico_da_sala', teia.historico['principal'] || []);

        // Atualizar lista de habitantes
        enviarParaSala('principal', 'atualizar_habitantes_da_sala', 
            getHabitantesDaSala('principal'));
    });

    // Trocar de sala
    socket.on('trocar_sala', ({ salaId, senha }) => {
        const habitante = teia.habitantes[socket.id];
        if (!habitante) return;

        // Verificar se sala existe
        if (teia.salas.privadas[salaId] && teia.salas.privadas[salaId].senha) {
            if (senha !== teia.salas.privadas[salaId].senha) {
                socket.emit('erro_sala', '🔒 Senha incorreta!');
                return;
            }
        }

        moverUsuarioParaSala(socket.id, salaId, habitante.apelido, habitante.cor, habitante.avatar);
        io.emit('atualizar_salas', getInfoSalas());
        
        const nomeSala = teia.salas.privadas[salaId]?.nome || 
                        salasFixas.find(s => s.id === salaId)?.nome || 
                        'Sala';
        
        socket.emit('sala_trocada', {
            salaId: salaId,
            nome: nomeSala
        });
    });

    // Criar sala privada
    socket.on('criar_sala_privada', ({ nome, senha }) => {
        const habitante = teia.habitantes[socket.id];
        if (!habitante) return;

        const salaId = gerarIdSalaPrivada();
        
        teia.salas.privadas[salaId] = {
            nome: nome || 'Sala Privada',
            criador: habitante.apelido,
            senha: senha || null,
            participantes: [socket.id],
            criadaEm: new Date().toISOString()
        };

        teia.historico[salaId] = [];

        // Mover criador para nova sala
        moverUsuarioParaSala(socket.id, salaId, habitante.apelido, habitante.cor, habitante.avatar);

        // Atualizar lista de salas
        io.emit('atualizar_salas', getInfoSalas());

        socket.emit('sala_criada', {
            salaId: salaId,
            nome: nome
        });
    });

    // Iniciar conversa privada com outro usuário
    socket.on('iniciar_conversa_privada', ({ com }) => {
        const remetente = teia.habitantes[socket.id];
        if (!remetente) return;

        const destinatarioId = Object.keys(teia.habitantes).find(
            id => teia.habitantes[id].apelido === com
        );

        if (!destinatarioId) {
            socket.emit('erro_conversa', 'Usuário não encontrado');
            return;
        }

        const destinatario = teia.habitantes[destinatarioId];
        
        const participantes = [remetente.apelido, destinatario.apelido].sort();
        const conversaId = `priv_${participantes.join('_')}`;

        if (!teia.conversasPrivadas[conversaId]) {
            teia.conversasPrivadas[conversaId] = {
                participantes: participantes,
                mensagens: []
            };
        }

        socket.join(conversaId);
        io.sockets.sockets.get(destinatarioId)?.join(conversaId);

        socket.emit('historico_conversa_privada', teia.conversasPrivadas[conversaId].mensagens);

        socket.emit('conversa_iniciada', {
            conversaId: conversaId,
            com: destinatario.apelido,
            avatar: destinatario.avatar
        });

        io.to(destinatarioId).emit('conversa_privada_solicitada', {
            conversaId: conversaId,
            de: remetente.apelido,
            avatar: remetente.avatar
        });
    });

    // Enviar mensagem privada
    socket.on('mensagem_privada', ({ conversaId, texto }) => {
        const remetente = teia.habitantes[socket.id];
        if (!remetente || !texto.trim()) return;

        const conversa = teia.conversasPrivadas[conversaId];
        if (!conversa) return;

        const mensagem = {
            de: remetente.apelido,
            cor: remetente.cor,
            avatar: remetente.avatar,
            texto: texto,
            horario: new Date().toLocaleTimeString(),
            tipo: 'privada'
        };

        conversa.mensagens.push(mensagem);
        if (conversa.mensagens.length > 50) conversa.mensagens.shift();

        io.to(conversaId).emit('nova_mensagem_privada', mensagem);
    });

    // Enviar mensagem na sala
    socket.on('falar_na_teia', (texto) => {
        const habitante = teia.habitantes[socket.id];
        if (!habitante || !texto.trim()) return;

        habitante.ultimaAtividade = Date.now();

        const mensagem = {
            tipo: 'habitante',
            apelido: habitante.apelido,
            cor: habitante.cor,
            avatar: habitante.avatar,
            texto: texto,
            horario: new Date().toLocaleTimeString(),
            de: habitante.apelido
        };

        if (!teia.historico[habitante.sala]) {
            teia.historico[habitante.sala] = [];
        }
        
        teia.historico[habitante.sala].push(mensagem);
        if (teia.historico[habitante.sala].length > 30) {
            teia.historico[habitante.sala].shift();
        }

        enviarParaSala(habitante.sala, 'mensagem_da_teia', mensagem);
    });

    // Indicador de digitação
    socket.on('tecelao_digitando', ({ tipo, destino }) => {
        const habitante = teia.habitantes[socket.id];
        if (!habitante) return;

        if (tipo === 'sala') {
            socket.to(habitante.sala).emit('alguem_tecelando', habitante.apelido);
        } else if (tipo === 'privado' && destino) {
            io.to(destino).emit('alguem_tecelando_privado', {
                de: habitante.apelido,
                conversaId: destino
            });
        }
    });

    socket.on('parou_de_tecer', ({ tipo, destino }) => {
        const habitante = teia.habitantes[socket.id];
        if (!habitante) return;

        if (tipo === 'sala') {
            socket.to(habitante.sala).emit('alguem_parou_de_tecer');
        } else if (tipo === 'privado' && destino) {
            io.to(destino).emit('alguem_parou_de_tecer_privado', destino);
        }
    });

    // Convidar para sala privada
    socket.on('convidar_para_sala', ({ apelido, salaId }) => {
        const habitante = teia.habitantes[socket.id];
        if (!habitante) return;

        const convidadoId = Object.keys(teia.habitantes).find(
            id => teia.habitantes[id].apelido === apelido
        );

        if (convidadoId) {
            const sala = teia.salas.privadas[salaId];
            io.to(convidadoId).emit('convite_sala_privada', {
                salaId: salaId,
                nome: sala?.nome || 'Sala Privada',
                de: habitante.apelido
            });
        }
    });

    // Quando desconecta
    socket.on('disconnect', () => {
        const habitante = teia.habitantes[socket.id];
        if (habitante) {
            const salaId = habitante.sala;
            
            if (teia.salas.publicas[salaId]) {
                teia.salas.publicas[salaId] = teia.salas.publicas[salaId].filter(id => id !== socket.id);
            } else if (teia.salas.privadas[salaId]) {
                teia.salas.privadas[salaId].participantes = 
                    teia.salas.privadas[salaId].participantes.filter(id => id !== socket.id);
            }

            if (teia.salas.privadas[salaId] && teia.salas.privadas[salaId].participantes.length === 0) {
                setTimeout(() => {
                    if (teia.salas.privadas[salaId]?.participantes.length === 0) {
                        delete teia.salas.privadas[salaId];
                        delete teia.historico[salaId];
                        io.emit('atualizar_salas', getInfoSalas());
                    }
                }, 5 * 60 * 1000);
            }

            enviarParaSala(salaId, 'mensagem_da_teia', {
                tipo: 'teia',
                texto: `🕸️ ${habitante.apelido} saiu da teia`,
                horario: new Date().toLocaleTimeString()
            });

            const habitantesSala = getHabitantesDaSala(salaId);
            enviarParaSala(salaId, 'atualizar_habitantes_da_sala', habitantesSala);

            delete teia.habitantes[socket.id];
            io.emit('atualizar_salas', getInfoSalas());
        }
    });
});

// ========== INICIAR SERVIDOR ==========
const PORTA = 3000;
servidor.listen(PORTA, () => {
    console.log(`
    ╔══════════════════════════════════╗
    ║    🕸️  TEIA CHAT - FINAL    🕸️   ║
    ║    http://localhost:${PORTA}        ║
    ╚══════════════════════════════════╝
    `);
});