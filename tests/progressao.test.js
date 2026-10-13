import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  indexar, faseAtual, proximoTreino, escolherOpcao, planejarTreino, ordemDeExecucao,
  avaliarEscada, avaliarCarga, concluirTreino, volumeSemanal,
} from '../app/js/progressao.js';

const ler = (f) => JSON.parse(readFileSync(new URL(`../app/data/${f}`, import.meta.url)));
const dados = indexar({ exercicios: ler('exercicios.json'), escadas: ler('escadas.json'), treinos: ler('treinos.json') });
const base = () => ({ dataInicio: '2026-10-12', equipamentos: [], escadas: {}, cargas: {}, historico: [] });

test('dados: toda escada e opção aponta para exercícios existentes', () => {
  for (const e of dados.escadas.values()) for (const id of e.niveis) assert.ok(dados.exercicios.has(id), id);
  for (const t of dados.programa.treinos) for (const b of t.blocos) for (const v of b.vagas)
    for (const o of v.opcoes) assert.ok(o.escada ? dados.escadas.has(o.escada) : dados.exercicios.has(o.exercicio), JSON.stringify(o));
});

test('fases: semanas 1–2 = 2 séries; 3–8 = 3 séries', () => {
  const f = dados.programa.fases;
  assert.equal(faseAtual('2026-10-12', '2026-10-12', f).series, 2);
  assert.equal(faseAtual('2026-10-12', '2026-10-25', f).series, 2);
  assert.equal(faseAtual('2026-10-12', '2026-10-26', f).series, 3);
  assert.equal(faseAtual('2026-10-12', '2027-03-01', f).nome, 'Continuidade');
});

test('alternância A-B-A', () => {
  assert.equal(proximoTreino([]), 'A');
  assert.equal(proximoTreino([{ treino: 'A' }]), 'B');
  assert.equal(proximoTreino([{ treino: 'A' }, { treino: 'B' }]), 'A');
});

test('escolhe aparelho se existir, senão calistenia', () => {
  const vaga = dados.programa.treinos[0].blocos[0].vagas[1]; // puxada alta ou barra
  const com = { ...base(), equipamentos: ['estacao_puxada', 'barra_fixa'] };
  assert.deepEqual(escolherOpcao(vaga, com, dados), { tipo: 'carga', exercicioId: 'puxada_alta' });
  const sem = { ...base(), equipamentos: ['barra_fixa'] };
  assert.equal(escolherOpcao(vaga, sem, dados).tipo, 'escada');
  const nada = base();
  assert.equal(escolherOpcao(vaga, nada, dados).faltaEquipamento, true);
});

test('escada: +1 rep por série quando bate a meta', () => {
  const esc = dados.escadas.get('empurrar_horizontal');
  const est = { nivel: 2, alvo: 5 };
  const r = avaliarEscada(est, [{ reps: 5 }, { reps: 6 }, { reps: 5 }], 3, esc, dados, '2026-10-12');
  assert.equal(r.estado.alvo, 6);
  assert.equal(r.evento.tipo, 'meta_maior');
});

test('escada: 3x8 sobe de nível e volta a 5', () => {
  const esc = dados.escadas.get('empurrar_horizontal');
  const r = avaliarEscada({ nivel: 2, alvo: 8 }, [{ reps: 8 }, { reps: 8 }, { reps: 9 }], 3, esc, dados, '2026-10-12');
  assert.equal(r.estado.nivel, 3);
  assert.equal(r.estado.alvo, 5);
});

test('escada: abaixo da meta mantém', () => {
  const esc = dados.escadas.get('empurrar_horizontal');
  const r = avaliarEscada({ nivel: 2, alvo: 7 }, [{ reps: 7 }, { reps: 6 }, { reps: 5 }], 3, esc, dados, '2026-10-12');
  assert.equal(r.estado.alvo, 7);
  assert.equal(r.estado.semProgresso, 1);
});

test('escada: não sobe com séries incompletas', () => {
  const esc = dados.escadas.get('empurrar_horizontal');
  const r = avaliarEscada({ nivel: 2, alvo: 8 }, [{ reps: 8 }, { reps: 8 }], 3, esc, dados, '2026-10-12');
  assert.equal(r.estado.nivel, 2);
});

test('isométrico: 3x30 s sobe de nível; usa segundos', () => {
  const esc = dados.escadas.get('empurrar_vertical'); // nível 0 = sustentação
  const r = avaliarEscada({ nivel: 0, alvo: 30 }, [{ segundos: 30 }, { segundos: 31 }, { segundos: 30 }], 3, esc, dados, '2026-10-12');
  assert.equal(r.estado.nivel, 1);
  assert.equal(r.estado.alvo, 5); // negativa é dinâmica → 5 reps
});

test('carga: topo da faixa com RIR ≥1 soma o degrau', () => {
  const r = avaliarCarga({ carga: 20 }, [{ reps: 12, carga: 20, rir: 1 }, { reps: 12, carga: 20, rir: 1 }, { reps: 12, carga: 20, rir: 2 }], 3, { min: 8, max: 12 }, 2, '2026-10-12');
  assert.equal(r.estado.carga, 22);
});

test('carga: no topo mas em falha (RIR 0) não sobe', () => {
  const r = avaliarCarga({ carga: 20 }, [{ reps: 12, carga: 20, rir: 1 }, { reps: 12, carga: 20, rir: 0 }, { reps: 12, carga: 20, rir: 1 }], 3, { min: 8, max: 12 }, 2, '2026-10-12');
  assert.equal(r.estado.carga, 20);
});

test('falha em 2 treinos seguidos reduz 1 série por 7 dias', () => {
  const s = [{ reps: 8, carga: 20, rir: 0 }];
  let est = { carga: 20 };
  est = avaliarCarga(est, s, 3, { min: 8, max: 12 }, 2, '2026-10-12').estado;
  assert.equal(est.reduzirSerieAte ?? null, null);
  est = avaliarCarga(est, s, 3, { min: 8, max: 12 }, 2, '2026-10-14').estado;
  assert.equal(est.reduzirSerieAte, '2026-10-21');
  const estado = { ...base(), equipamentos: ['halteres', 'banco'], cargas: { supino_halteres: est }, dataInicio: '2026-09-01' };
  const plano = planejarTreino('A', estado, dados, '2026-10-16');
  const supino = plano.blocos[1].vagas[0];
  assert.equal(supino.exercicioId, 'supino_halteres');
  assert.equal(supino.series, 2);
});

test('ordem de execução intercala pares', () => {
  const plano = planejarTreino('A', { ...base(), dataInicio: '2026-01-01' }, dados, '2026-10-12');
  const passos = ordemDeExecucao(plano);
  assert.deepEqual(passos.slice(0, 3).map((p) => p.vagaId), ['A1a', 'A1b', 'A1a']);
  assert.equal(passos.length, 3 * 2 + 3 * 2 + 3 * 3);
});

test('concluir treino grava histórico e conta volume semanal', () => {
  const estado = { ...base(), equipamentos: ['halteres', 'banco'] };
  const plano = planejarTreino('A', estado, dados, '2026-10-12');
  const vagas = plano.blocos.flatMap((b) => b.vagas).map((v) => ({
    ...v, feitas: Array.from({ length: v.series }, () => (v.isometrico ? { segundos: 20, rir: 2 } : { reps: v.alvo, carga: 10, rir: 2 })),
  }));
  const { estado: novo, resumo } = concluirTreino(estado, { treino: 'A', data: '2026-10-12', vagas }, dados);
  assert.equal(novo.historico.length, 1);
  assert.equal(resumo.length, 7);
  const vol = volumeSemanal(novo.historico, '2026-10-14', dados.programa.nomesPadroes);
  assert.equal(vol['Pernas (joelho)'], 2);
  assert.equal(vol['Core'], 6);
});
