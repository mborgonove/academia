// Lógica de progressão — funções puras, sem DOM, testadas em tests/.
// Cada regra cita sua origem em docs/base-cientifica.md.

const DIA_MS = 24 * 60 * 60 * 1000;

/** Data local em AAAA-MM-DD. */
export function hojeISO(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function paraData(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function somarDias(iso, dias) {
  return hojeISO(new Date(paraData(iso).getTime() + dias * DIA_MS));
}

/** Índices dos dados para busca rápida. */
export function indexar(dadosBrutos) {
  const exercicios = new Map(dadosBrutos.exercicios.exercicios.map((e) => [e.id, e]));
  const escadas = new Map(dadosBrutos.escadas.escadas.map((e) => [e.id, e]));
  return {
    exercicios,
    escadas,
    equipamentos: dadosBrutos.exercicios.equipamentos,
    faixaIsometrica: dadosBrutos.escadas.faixaIsometrica,
    programa: dadosBrutos.treinos,
  };
}

// base-cientifica.md › Programa iniciante › Fases
// Semanas 1–2: 2 séries, RIR 3. Semanas 3–8 e depois: 3 séries, RIR 1–2.
export function faseAtual(dataInicio, hoje, fases) {
  const dias = Math.max(0, Math.round((paraData(hoje) - paraData(dataInicio)) / DIA_MS));
  const semana = Math.floor(dias / 7) + 1;
  const fase = fases.find((f) => f.ateSemana === null || semana <= f.ateSemana);
  return { ...fase, semana };
}

// base-cientifica.md › Programa iniciante: alternância A-B-A / B-A-B
export function proximoTreino(historico) {
  if (!historico.length) return 'A';
  return historico[historico.length - 1].treino === 'A' ? 'B' : 'A';
}

function temEquipamento(exercicio, disponiveis) {
  return (exercicio.equipamento || []).every((eq) => disponiveis.includes(eq));
}

export function estadoEscada(estado, escada) {
  return estado.escadas[escada.id] || { nivel: escada.nivelInicial ?? 0, alvo: null, semProgresso: 0, falhasSeguidas: 0 };
}

export function estadoCarga(estado, exercicioId) {
  return estado.cargas[exercicioId] || { carga: null, semProgresso: 0, falhasSeguidas: 0 };
}

/** Faixa de repetições (ou segundos) de uma escada no nível atual. */
export function faixaDaEscada(escada, exercicio, dados) {
  return exercicio.isometrico ? dados.faixaIsometrica : escada.faixa;
}

// base-cientifica.md › Academia de prédio: o app usa a primeira opção cujo equipamento existe.
export function escolherOpcao(vaga, estado, dados) {
  const disp = estado.equipamentos;
  for (const op of vaga.opcoes) {
    if (op.exercicio) {
      const ex = dados.exercicios.get(op.exercicio);
      if (ex && temEquipamento(ex, disp)) return { tipo: 'carga', exercicioId: ex.id };
    } else if (op.escada) {
      const esc = dados.escadas.get(op.escada);
      const est = estadoEscada(estado, esc);
      const ex = dados.exercicios.get(esc.niveis[est.nivel]);
      if (temEquipamento(ex, disp)) return { tipo: 'escada', escadaId: esc.id };
    }
  }
  // Nada disponível: devolve a última opção (calistenia) avisando o que falta.
  const ultima = vaga.opcoes[vaga.opcoes.length - 1];
  return ultima.escada
    ? { tipo: 'escada', escadaId: ultima.escada, faltaEquipamento: true }
    : { tipo: 'carga', exercicioId: ultima.exercicio, faltaEquipamento: true };
}

/** O que fazer numa vaga hoje: exercício, nº de séries, meta e carga. */
export function planejarVaga(vaga, estado, dados, fase, hoje) {
  const op = escolherOpcao(vaga, estado, dados);
  // base-cientifica.md › Regras de progressão: RIR 0 em 2 treinos seguidos → 1 série a menos na semana.
  const reduz = (est) => (est.reduzirSerieAte && hoje < est.reduzirSerieAte ? 1 : 0);

  if (op.tipo === 'escada') {
    const escada = dados.escadas.get(op.escadaId);
    const est = estadoEscada(estado, escada);
    const exercicio = dados.exercicios.get(escada.niveis[est.nivel]);
    const faixa = faixaDaEscada(escada, exercicio, dados);
    return {
      vagaId: vaga.id, padrao: vaga.padrao, tipo: 'escada', chave: escada.id,
      exercicioId: exercicio.id, isometrico: !!exercicio.isometrico,
      series: Math.max(1, fase.series - reduz(est)),
      faixa, alvo: est.alvo ?? faixa.min, carga: null,
      nivel: est.nivel, totalNiveis: escada.niveis.length,
      faltaEquipamento: !!op.faltaEquipamento, rir: fase.rir,
      sugestao: est.semProgresso >= 3 ? sugestaoTravou() : null,
    };
  }

  const exercicio = dados.exercicios.get(op.exercicioId);
  const est = estadoCarga(estado, exercicio.id);
  const faixa = dados.programa.faixaCarga;
  return {
    vagaId: vaga.id, padrao: vaga.padrao, tipo: 'carga', chave: exercicio.id,
    exercicioId: exercicio.id, isometrico: false,
    series: Math.max(1, fase.series - reduz(est)),
    faixa, alvo: faixa.min, carga: est.carga, degrau: exercicio.degrau ?? 2,
    faltaEquipamento: !!op.faltaEquipamento, rir: fase.rir,
    sugestao: est.semProgresso >= 3 ? sugestaoTravou() : null,
  };
}

function sugestaoTravou() {
  // base-cientifica.md › Regras de progressão: sem progresso por 3 treinos.
  return 'Sem progresso há 3 treinos: considere a variação mais fácil por 2 semanas ou uma série extra.';
}

export function planejarTreino(treinoId, estado, dados, hoje) {
  const fase = faseAtual(estado.dataInicio, hoje, dados.programa.fases);
  const treino = dados.programa.treinos.find((t) => t.id === treinoId);
  return {
    treino: treinoId, nome: treino.nome, fase,
    blocos: treino.blocos.map((b) => ({
      tipo: b.tipo,
      vagas: b.vagas.map((v) => planejarVaga(v, estado, dados, fase, hoje)),
    })),
  };
}

/** Ordem de execução em pares/trios: série 1 de cada vaga do bloco, depois série 2… */
export function ordemDeExecucao(plano) {
  const passos = [];
  for (const bloco of plano.blocos) {
    const max = Math.max(...bloco.vagas.map((v) => v.series));
    for (let s = 0; s < max; s++) {
      for (const vaga of bloco.vagas) if (s < vaga.series) passos.push({ vagaId: vaga.vagaId, serie: s + 1, total: vaga.series });
    }
  }
  return passos;
}

// Contadores comuns às duas progressões.
function atualizarContadores(est, series, progrediu, hoje) {
  const falhou = series.some((s) => s.rir === 0);
  let falhasSeguidas = falhou ? (est.falhasSeguidas || 0) + 1 : 0;
  let reduzirSerieAte = est.reduzirSerieAte || null;
  if (falhasSeguidas >= 2) {
    reduzirSerieAte = somarDias(hoje, 7);
    falhasSeguidas = 0;
  }
  return {
    falhasSeguidas,
    reduzirSerieAte,
    semProgresso: progrediu ? 0 : (est.semProgresso || 0) + 1,
  };
}

// base-cientifica.md › Calistenia: progressões por movimento
// Começa em 3x(min), +1 rep por série a cada treino até 3x(max); então sobe de nível e volta a 3x(min).
// Isométricos: 10 → 30 s. O incremento de +5 s por treino é escolha do app (a RR não especifica).
export function avaliarEscada(est, seriesFeitas, seriesPlanejadas, escada, dados, hoje) {
  const exercicio = dados.exercicios.get(escada.niveis[est.nivel]);
  const faixa = faixaDaEscada(escada, exercicio, dados);
  const alvo = est.alvo ?? faixa.min;
  const valores = seriesFeitas.map((s) => (exercicio.isometrico ? s.segundos : s.reps) ?? 0);
  const completas = seriesFeitas.length >= seriesPlanejadas;
  const passo = exercicio.isometrico ? 5 : 1;

  let nivel = est.nivel;
  let novoAlvo = alvo;
  let evento;

  if (completas && valores.every((v) => v >= faixa.max)) {
    if (nivel < escada.niveis.length - 1) {
      nivel += 1;
      const prox = dados.exercicios.get(escada.niveis[nivel]);
      novoAlvo = faixaDaEscada(escada, prox, dados).min;
      evento = { tipo: 'subiu_nivel', texto: `Subiu para ${prox.nome}` };
    } else {
      novoAlvo = faixa.max;
      evento = { tipo: 'topo', texto: 'Topo da escada — mantenha ou acrescente uma série' };
    }
  } else if (completas && valores.every((v) => v >= alvo)) {
    novoAlvo = Math.min(faixa.max, alvo + passo);
    evento = { tipo: 'meta_maior', texto: `Próxima meta: ${novoAlvo}${exercicio.isometrico ? ' s' : ' reps'} por série` };
  } else {
    evento = { tipo: 'manter', texto: 'Mantenha a mesma meta' };
  }

  const progrediu = evento.tipo !== 'manter';
  return { estado: { ...est, nivel, alvo: novoAlvo, ...atualizarContadores(est, seriesFeitas, progrediu, hoje) }, evento };
}

// base-cientifica.md › Academia de prédio: dupla progressão
// Todas as séries no topo da faixa com RIR ≥ 1 → soma o menor degrau de peso e volta ao início da faixa.
export function avaliarCarga(est, seriesFeitas, seriesPlanejadas, faixa, degrau, hoje) {
  const cargaUsada = seriesFeitas.find((s) => s.carga != null)?.carga ?? est.carga;
  const completas = seriesFeitas.length >= seriesPlanejadas;
  const noTopo = seriesFeitas.every((s) => (s.reps ?? 0) >= faixa.max);
  const comReserva = seriesFeitas.every((s) => (s.rir ?? 2) >= 1);

  let carga = cargaUsada;
  let evento;
  if (completas && noTopo && comReserva && cargaUsada != null) {
    carga = Math.round((cargaUsada + degrau) * 100) / 100;
    evento = { tipo: 'subiu_carga', texto: `Próximo treino: ${carga} kg` };
  } else {
    evento = { tipo: 'manter', texto: cargaUsada != null ? `Mantenha ${cargaUsada} kg e busque mais reps` : 'Registre a carga usada' };
  }
  // Progresso = subiu carga, ou fez mais reps em alguma série que no treino anterior com a mesma carga.
  const mesmaCarga = est.carga === cargaUsada;
  const progrediu = evento.tipo !== 'manter' || !est.ultimasReps || !mesmaCarga
    || seriesFeitas.some((s, i) => (s.reps ?? 0) > (est.ultimasReps[i] ?? Infinity));
  return {
    estado: { ...est, carga, ultimasReps: seriesFeitas.map((s) => s.reps ?? 0), ...atualizarContadores(est, seriesFeitas, progrediu, hoje) },
    evento,
  };
}

/**
 * Fecha um treino: aplica a progressão de cada vaga e devolve o novo estado + resumo.
 * `registro` = { treino, data, vagas: [{ ...planoDaVaga, feitas: [{reps, segundos, carga, rir}] }] }
 */
export function concluirTreino(estado, registro, dados) {
  const novo = { ...estado, escadas: { ...estado.escadas }, cargas: { ...estado.cargas }, historico: [...estado.historico] };
  const resumo = [];
  for (const v of registro.vagas) {
    if (!v.feitas.length) continue;
    if (v.tipo === 'escada') {
      const escada = dados.escadas.get(v.chave);
      const r = avaliarEscada(estadoEscada(novo, escada), v.feitas, v.series, escada, dados, registro.data);
      novo.escadas[v.chave] = r.estado;
      resumo.push({ vagaId: v.vagaId, exercicioId: v.exercicioId, evento: r.evento });
    } else {
      const r = avaliarCarga(estadoCarga(novo, v.chave), v.feitas, v.series, v.faixa, v.degrau, registro.data);
      novo.cargas[v.chave] = r.estado;
      resumo.push({ vagaId: v.vagaId, exercicioId: v.exercicioId, evento: r.evento });
    }
  }
  novo.historico.push({
    id: `${registro.data}-${registro.treino}-${novo.historico.length + 1}`,
    data: registro.data,
    treino: registro.treino,
    vagas: registro.vagas.map((v) => ({ vagaId: v.vagaId, padrao: v.padrao, exercicioId: v.exercicioId, feitas: v.feitas })),
    resumo,
  });
  return { estado: novo, resumo };
}

function inicioDaSemana(iso) {
  const d = paraData(iso);
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  return hojeISO(new Date(d.getTime() - dow * DIA_MS));
}

// base-cientifica.md › Base científica: ≥10 séries semanais por grupo muscular.
export function volumeSemanal(historico, hoje, nomesPadroes) {
  const inicio = inicioDaSemana(hoje);
  const porGrupo = {};
  for (const sessao of historico) {
    if (sessao.data < inicio || sessao.data > hoje) continue;
    for (const v of sessao.vagas) {
      const grupo = nomesPadroes[v.padrao] || v.padrao;
      porGrupo[grupo] = (porGrupo[grupo] || 0) + v.feitas.length;
    }
  }
  return porGrupo;
}
