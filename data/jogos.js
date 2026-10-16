/*
 * BASE DE DADOS DO SITE — é o único arquivo que precisa ser editado durante o evento.
 *
 * Para lançar um resultado, localize o jogo pelo "id" e preencha:
 *   status: "agendado" | "ao_vivo" | "encerrado" | "wo" | "adiado"
 *   placar: [mandante, visitante]          ex.: [3, 1]
 *   parciais: ["25/13", "25/17"]           (opcional, vôlei)
 *   video: "https://..."                   (opcional, link do replay)
 *   obs: "texto curto"                     (opcional)
 *
 * naipe: "F" = feminino (rosa) | "M" = masculino (amarelo)
 * modalidade: chave de "modalidades" abaixo.
 * Ao terminar, atualize "atualizadoEm".
 */
window.JUD_DATA = {
  evento: {
    nome: "JUD 2K26",
    subtitulo: "Tabela de jogos e resultados",
    atualizadoEm: "2026-10-16T21:00:00-03:00",
    aviso:
      "Tabela de acompanhamento. Em caso de divergência, prevalece a súmula oficial da organização.",
    // Link para envio de correção de placar (WhatsApp, formulário etc.). Deixe "" para ocultar.
    linkCorrecao: "",
  },

  // Pontuação usada na aba Classificação (ajuste conforme o regulamento).
  pontuacao: { vitoria: 3, empate: 1, derrota: 0, wo: 0 },

  modalidades: {
    HAND: { nome: "Handebol", curto: "HAND" },
    BASQ: { nome: "Basquete", curto: "BASQ" },
    VOLEI: { nome: "Vôlei", curto: "VÔLEI", sets: true },
    FUT: { nome: "Futebol", curto: "FUT" },
  },

  locais: {
    IFBA1: { nome: "IFBA 1" },
    IFBA2: { nome: "IFBA 2" },
  },

  // Chave = sigla usada nos jogos. "destaque" = parte em itálico fino (como na arte).
  equipes: {
    BAIANA: { nome: "BAIANA" },
    UNIFACS: { nome: "UNIFACS", destaque: "SSA" },
    UCSAL: { nome: "UCSAL" },
    UNIFTC: { nome: "UNIFTC" },
    UFBA: { nome: "UFBA" },
    UNEB: { nome: "UNEB", destaque: "SSA" },
    BARBAROS: { nome: "BÁRBAROS" },
  },

  jogos: [
    // ===== SÁBADO 17/10 · IFBA 1 =====
    { id: "1701-08", data: "2026-10-17", hora: "08:00", local: "IFBA1", modalidade: "BASQ", naipe: "M", mandante: "UNIFACS", visitante: "BAIANA", status: "agendado" },
    { id: "1701-09", data: "2026-10-17", hora: "09:00", local: "IFBA1", modalidade: "BASQ", naipe: "F", mandante: "UCSAL", visitante: "UFBA", status: "agendado" },
    { id: "1701-10", data: "2026-10-17", hora: "10:00", local: "IFBA1", modalidade: "BASQ", naipe: "M", mandante: "UCSAL", visitante: "UFBA", status: "agendado" },
    { id: "1701-11", data: "2026-10-17", hora: "11:00", local: "IFBA1", modalidade: "BASQ", naipe: "F", mandante: "UNIFACS", visitante: "UFBA", status: "agendado" },
    { id: "1701-12", data: "2026-10-17", hora: "12:00", local: "IFBA1", modalidade: "BASQ", naipe: "M", mandante: "UNIFACS", visitante: "UCSAL", status: "agendado" },
    { id: "1701-13", data: "2026-10-17", hora: "13:00", local: "IFBA1", modalidade: "VOLEI", naipe: "M", mandante: "UCSAL", visitante: "UFBA", status: "agendado" },
    { id: "1701-14", data: "2026-10-17", hora: "14:00", local: "IFBA1", modalidade: "VOLEI", naipe: "M", mandante: "BAIANA", visitante: "UNIFACS", status: "agendado" },
    { id: "1701-15", data: "2026-10-17", hora: "15:00", local: "IFBA1", modalidade: "VOLEI", naipe: "F", mandante: "BAIANA", visitante: "UFBA", status: "agendado" },
    { id: "1701-16", data: "2026-10-17", hora: "16:00", local: "IFBA1", modalidade: "VOLEI", naipe: "F", mandante: "UCSAL", visitante: "UNIFACS", status: "agendado" },
    { id: "1701-17", data: "2026-10-17", hora: "17:00", local: "IFBA1", modalidade: "FUT", naipe: "M", mandante: "UNIFACS", visitante: "BARBAROS", status: "agendado" },
    { id: "1701-18", data: "2026-10-17", hora: "18:00", local: "IFBA1", modalidade: "FUT", naipe: "F", mandante: "UNEB", visitante: "UNIFACS", status: "agendado" },
    { id: "1701-19", data: "2026-10-17", hora: "19:00", local: "IFBA1", modalidade: "FUT", naipe: "F", mandante: "BAIANA", visitante: "UCSAL", status: "agendado" },
    { id: "1701-21", data: "2026-10-17", hora: "21:00", local: "IFBA1", modalidade: "FUT", naipe: "F", mandante: "UFBA", visitante: "UCSAL", status: "agendado" },

    // ===== SÁBADO 17/10 · IFBA 2 =====
    { id: "1702-08", data: "2026-10-17", hora: "08:00", local: "IFBA2", modalidade: "HAND", naipe: "F", mandante: "BAIANA", visitante: "UNIFACS", status: "agendado" },
    { id: "1702-09", data: "2026-10-17", hora: "09:00", local: "IFBA2", modalidade: "HAND", naipe: "M", mandante: "UCSAL", visitante: "BAIANA", status: "agendado" },
    { id: "1702-10", data: "2026-10-17", hora: "10:00", local: "IFBA2", modalidade: "HAND", naipe: "F", mandante: "UNIFTC", visitante: "BAIANA", status: "agendado" },
    { id: "1702-11", data: "2026-10-17", hora: "11:00", local: "IFBA2", modalidade: "HAND", naipe: "M", mandante: "UFBA", visitante: "UNEB", status: "agendado" },
    { id: "1702-12", data: "2026-10-17", hora: "12:00", local: "IFBA2", modalidade: "HAND", naipe: "F", mandante: "UCSAL", visitante: "UNIFTC", status: "agendado" },
    { id: "1702-13", data: "2026-10-17", hora: "13:00", local: "IFBA2", modalidade: "HAND", naipe: "M", mandante: "BAIANA", visitante: "UNIFACS", status: "agendado" },
    { id: "1702-14", data: "2026-10-17", hora: "14:00", local: "IFBA2", modalidade: "HAND", naipe: "F", mandante: "UCSAL", visitante: "UNIFACS", status: "agendado" },
    { id: "1702-15", data: "2026-10-17", hora: "15:00", local: "IFBA2", modalidade: "HAND", naipe: "M", mandante: "UCSAL", visitante: "UNIFACS", status: "agendado" },
    { id: "1702-16", data: "2026-10-17", hora: "16:00", local: "IFBA2", modalidade: "FUT", naipe: "F", mandante: "UFBA", visitante: "BAIANA", status: "agendado" },
    { id: "1702-17", data: "2026-10-17", hora: "17:00", local: "IFBA2", modalidade: "FUT", naipe: "M", mandante: "BAIANA", visitante: "UCSAL", status: "agendado" },
    { id: "1702-18", data: "2026-10-17", hora: "18:00", local: "IFBA2", modalidade: "HAND", naipe: "F", mandante: "UCSAL", visitante: "BAIANA", status: "agendado" },
    { id: "1702-19", data: "2026-10-17", hora: "19:00", local: "IFBA2", modalidade: "FUT", naipe: "M", mandante: "BAIANA", visitante: "UFBA", status: "agendado" },
    { id: "1702-20", data: "2026-10-17", hora: "20:00", local: "IFBA2", modalidade: "HAND", naipe: "F", mandante: "UNIFTC", visitante: "UNIFACS", status: "agendado" },
    { id: "1702-21", data: "2026-10-17", hora: "21:00", local: "IFBA2", modalidade: "FUT", naipe: "M", mandante: "UFBA", visitante: "UCSAL", status: "agendado" },
  ],
};
