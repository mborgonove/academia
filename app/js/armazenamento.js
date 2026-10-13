// Estado salvo só no aparelho (localStorage). Backup/restauração por arquivo JSON.
import { hojeISO } from './progressao.js';

const CHAVE = 'academia.v1';
const VERSAO_ESTADO = 1;

// Equipamento típico de academia de prédio (base-cientifica.md › Academia de prédio).
// O Marcus ajusta na tela Ajustes.
const EQUIPAMENTO_PADRAO = ['barra_fixa', 'banco', 'halteres', 'estacao_supino', 'estacao_puxada', 'estacao_remada', 'flexora', 'polia'];

export function estadoInicial() {
  return {
    versao: VERSAO_ESTADO,
    dataInicio: hojeISO(),
    equipamentos: [...EQUIPAMENTO_PADRAO],
    escadas: {},
    cargas: {},
    historico: [],
    treinoEmAndamento: null,
  };
}

function migrar(estado) {
  // Futuras mudanças de formato entram aqui (nunca apagar histórico).
  return { ...estadoInicial(), ...estado, versao: VERSAO_ESTADO };
}

export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? migrar(JSON.parse(bruto)) : estadoInicial();
  } catch {
    return estadoInicial();
  }
}

export function salvar(estado) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    return true;
  } catch {
    return false;
  }
}

export function exportarBackup(estado) {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `academia-backup-${hojeISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importarBackup(arquivo) {
  const texto = await arquivo.text();
  const dados = JSON.parse(texto);
  if (!dados || !Array.isArray(dados.historico)) throw new Error('Arquivo não parece um backup do app.');
  return migrar(dados);
}
