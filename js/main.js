// Interface do app. As regras de treino ficam em progressao.js.
import {
  indexar, hojeISO, proximoTreino, planejarTreino, ordemDeExecucao,
  concluirTreino, volumeSemanal, estadoEscada,
} from './progressao.js';
import { carregar, salvar, exportarBackup, importarBackup, estadoInicial } from './armazenamento.js';

const tela = document.getElementById('tela');
const camadaTreino = document.getElementById('treino');
let dados;
let estado = carregar();
let aba = 'hoje';
let intervaloRelogio = null;
let cronometro = null; // { inicio } para isométricos
let resumoFinal = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nomeEx = (id) => dados.exercicios.get(id)?.nome ?? id;
const guardar = () => salvar(estado);

async function iniciar() {
  const [exercicios, escadas, treinos] = await Promise.all(
    ['exercicios', 'escadas', 'treinos'].map((n) => fetch(`data/${n}.json`).then((r) => r.json())),
  );
  dados = indexar({ exercicios, escadas, treinos });
  document.querySelectorAll('.abas button').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.aba)));
  irPara('hoje');
  if (estado.treinoEmAndamento) abrirTreino();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

function irPara(nova) {
  aba = nova;
  document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === aba));
  ({ hoje: telaHoje, historico: telaHistorico, biblioteca: telaBiblioteca, ajustes: telaAjustes })[aba]();
  window.scrollTo(0, 0);
}

/* ---------- Hoje ---------- */

function descreverMeta(v) {
  const unidade = v.isometrico ? ' s' : '';
  if (v.tipo === 'escada') return `${v.series} × ${v.alvo}${unidade}`;
  const carga = v.carga != null ? ` · ${v.carga} kg` : '';
  return `${v.series} × ${v.faixa.min}–${v.faixa.max}${carga}`;
}

function telaHoje() {
  const hoje = hojeISO();
  const id = proximoTreino(estado.historico);
  const plano = planejarTreino(id, estado, dados, hoje);
  const f = plano.fase;
  const ultimo = estado.historico[estado.historico.length - 1];
  const vol = volumeSemanal(estado.historico, hoje, dados.programa.nomesPadroes);
  const grupos = [...new Set(Object.values(dados.programa.nomesPadroes))];
  const meta = 10; // base-cientifica.md › ≥10 séries semanais por grupo muscular

  tela.innerHTML = `
    <p class="suave">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <h1>${esc(plano.nome)}</h1>
    <p><span class="selo">Semana ${f.semana} · ${esc(f.nome)}</span> <span class="suave">${f.series} séries · pare com ${esc(f.rir)} rep(s) em reserva</span></p>
    ${ultimo ? `<p class="suave">Último treino: ${esc(ultimo.treino)} em ${formatarData(ultimo.data)}</p>` : ''}

    ${plano.blocos.map((b, i) => `
      <div class="bloco-rotulo">${i + 1}. ${b.tipo === 'par' ? 'Par' : 'Trio de core'} · alterne com 90 s de descanso</div>
      <div class="cartao">
        ${b.vagas.map((v) => `
          <div class="linha-ex">
            <div>
              <div class="nome">${esc(nomeEx(v.exercicioId))}</div>
              <div class="suave" style="font-size:14px">${v.tipo === 'escada' ? `Nível ${v.nivel + 1} de ${v.totalNiveis}` : v.carga == null ? 'Defina a carga no 1º treino' : 'Dupla progressão'}</div>
              ${v.faltaEquipamento ? '<div class="aviso">Falta equipamento — marque em Ajustes ou improvise.</div>' : ''}
              ${v.sugestao ? `<div class="aviso">${esc(v.sugestao)}</div>` : ''}
            </div>
            <div class="meta">${descreverMeta(v)}</div>
          </div>`).join('')}
      </div>`).join('')}

    <button class="botao" id="comecar">Começar ${esc(plano.nome)}</button>
    <p class="ajuda">Antes: 5–10 min de aquecimento (ombros com elástico, agachamento com alcance, punhos, dead bug).</p>

    <h2>Séries nesta semana</h2>
    <div class="cartao volume">
      ${grupos.map((g) => {
        const n = vol[g] || 0;
        return `<div class="item"><span>${esc(g)}</span><span class="num suave">${n}/${meta}</span>
          <div class="barra"><span style="width:${Math.min(100, (n / meta) * 100)}%"></span></div></div>`;
      }).join('')}
    </div>
  `;
  document.getElementById('comecar').addEventListener('click', () => comecarTreino(id));
}

/* ---------- Treino em andamento ---------- */

function comecarTreino(id) {
  const plano = planejarTreino(id, estado, dados, hojeISO());
  const vagas = plano.blocos.flatMap((b) => b.vagas);
  estado.treinoEmAndamento = {
    treino: id, data: hojeISO(), fase: plano.fase,
    vagas: Object.fromEntries(vagas.map((v) => [v.vagaId, { ...v, feitas: [] }])),
    passos: ordemDeExecucao(plano), passo: 0, descansoAte: null,
  };
  guardar();
  abrirTreino();
}

function abrirTreino() {
  camadaTreino.hidden = false;
  document.body.style.overflow = 'hidden';
  desenharTreino();
}

function fecharTreino() {
  camadaTreino.hidden = true;
  document.body.style.overflow = '';
  clearInterval(intervaloRelogio);
  resumoFinal = null;
  irPara('hoje');
}

function desenharTreino() {
  clearInterval(intervaloRelogio);
  if (resumoFinal) return desenharResumo();
  const t = estado.treinoEmAndamento;
  if (!t) return fecharTreino();
  if (t.passo >= t.passos.length) return finalizar();
  if (t.descansoAte && Date.now() < t.descansoAte) return desenharDescanso();
  desenharSerie();
}

function valoresPadrao(v, serie) {
  const ant = v.feitas[serie - 2];
  const rirPadrao = estado.treinoEmAndamento.fase.series === 2 ? 3 : 2;
  return {
    reps: ant?.reps ?? v.alvo,
    segundos: ant?.segundos ?? v.alvo,
    carga: ant?.carga ?? v.carga ?? '',
    rir: ant?.rir ?? rirPadrao,
  };
}

function desenharSerie() {
  const t = estado.treinoEmAndamento;
  const p = t.passos[t.passo];
  const v = t.vagas[p.vagaId];
  const ex = dados.exercicios.get(v.exercicioId);
  const val = valoresPadrao(v, p.serie);
  const pct = Math.round((t.passo / t.passos.length) * 100);
  const metaTxt = v.tipo === 'escada'
    ? `Meta: <strong>${v.alvo}${v.isometrico ? ' s' : ' reps'}</strong> · sobe de nível em ${v.series}×${v.faixa.max}${v.isometrico ? ' s' : ''}`
    : `Faixa <strong>${v.faixa.min}–${v.faixa.max} reps</strong>${v.carga != null ? ` · ${v.carga} kg` : ''}`;

  camadaTreino.innerHTML = `<div>
    <div class="topo-treino">
      <span class="suave">Treino ${esc(t.treino)} · passo ${t.passo + 1} de ${t.passos.length}</span>
      <button class="botao secundario pequeno" id="sair">Encerrar</button>
    </div>
    <div class="progresso"><span style="width:${pct}%"></span></div>
    <p class="suave">Série ${p.serie} de ${p.total}</p>
    <div class="ex-nome">${esc(ex.nome)}</div>
    <p class="meta-grande">${metaTxt}</p>
    ${ex.dica ? `<details><summary>Como fazer</summary><p style="margin-top:8px">${esc(ex.dica)}</p></details>` : ''}

    ${v.isometrico ? stepper('segundos', 'Segundos sustentados', val.segundos) + `
      <button class="botao secundario" id="crono">${cronometro ? 'Parar cronômetro' : 'Cronometrar'}</button>`
      : stepper('reps', 'Repetições feitas', val.reps)}
    ${v.tipo === 'carga' ? stepper('carga', 'Carga (kg)', val.carga, v.degrau) : ''}

    <div class="campo">
      <label>Repetições em reserva (RIR)</label>
      <div class="chips" id="rir">
        ${[0, 1, 2, 3, 4].map((n) => `<button data-v="${n}" aria-pressed="${n === val.rir}">${n === 4 ? '4+' : n}</button>`).join('')}
      </div>
      <p class="ajuda">Quantas mais você conseguiria fazer com boa técnica. Meta desta fase: ${esc(t.fase.rir)}. 0 = falha.</p>
    </div>

    <button class="botao" id="feito">Concluir série</button>
    ${t.passo > 0 ? '<button class="botao secundario" id="voltar">Desfazer última série</button>' : ''}
  </div>`;

  let rir = val.rir;
  camadaTreino.querySelectorAll('#rir button').forEach((b) => b.addEventListener('click', () => {
    rir = Number(b.dataset.v);
    camadaTreino.querySelectorAll('#rir button').forEach((x) => x.setAttribute('aria-pressed', x === b));
  }));
  ligarSteppers();
  document.getElementById('sair').addEventListener('click', confirmarEncerrar);
  document.getElementById('voltar')?.addEventListener('click', desfazer);
  document.getElementById('crono')?.addEventListener('click', alternarCronometro);
  document.getElementById('feito').addEventListener('click', () => {
    const ler = (n) => { const el = camadaTreino.querySelector(`[name="${n}"]`); return el && el.value !== '' ? Number(el.value) : null; };
    const serie = v.isometrico ? { segundos: ler('segundos'), rir } : { reps: ler('reps'), rir };
    if (v.tipo === 'carga') serie.carga = ler('carga');
    cronometro = null;
    v.feitas.push(serie);
    t.passo += 1;
    const temProximo = t.passo < t.passos.length;
    t.descansoAte = temProximo ? Date.now() + dados.programa.descansoSegundos * 1000 : null;
    guardar();
    desenharTreino();
  });
}

function stepper(nome, rotulo, valor, passo = 1) {
  return `<div class="campo"><label for="f-${nome}">${rotulo}</label>
    <div class="stepper" data-passo="${nome === 'segundos' ? 5 : passo}">
      <button type="button" data-d="-1" aria-label="Diminuir">−</button>
      <input id="f-${nome}" name="${nome}" inputmode="decimal" value="${esc(valor)}">
      <button type="button" data-d="1" aria-label="Aumentar">+</button>
    </div></div>`;
}

function ligarSteppers() {
  camadaTreino.querySelectorAll('.stepper').forEach((s) => {
    const input = s.querySelector('input');
    const passo = Number(s.dataset.passo);
    s.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const atual = Number(input.value) || 0;
      input.value = Math.max(0, Math.round((atual + passo * Number(b.dataset.d)) * 100) / 100);
    }));
  });
}

function alternarCronometro() {
  const input = camadaTreino.querySelector('[name="segundos"]');
  const botao = document.getElementById('crono');
  if (!cronometro) {
    cronometro = { inicio: Date.now() };
    input.value = 0;
    botao.textContent = 'Parar cronômetro';
    intervaloRelogio = setInterval(() => { input.value = Math.floor((Date.now() - cronometro.inicio) / 1000); }, 250);
  } else {
    clearInterval(intervaloRelogio);
    input.value = Math.floor((Date.now() - cronometro.inicio) / 1000);
    cronometro = null;
    botao.textContent = 'Cronometrar';
  }
}

function desenharDescanso() {
  const t = estado.treinoEmAndamento;
  const prox = t.passos[t.passo];
  const v = t.vagas[prox.vagaId];
  camadaTreino.innerHTML = `<div class="descanso">
    <p class="suave">Descanso</p>
    <div class="relogio" id="relogio">--</div>
    <div class="acoes">
      <button class="botao secundario pequeno" id="mais">+15 s</button>
      <button class="botao pequeno" id="pular">Pular</button>
    </div>
    <p class="suave">A seguir</p>
    <p class="ex-nome" style="font-size:22px">${esc(nomeEx(v.exercicioId))}</p>
    <p class="suave">Série ${prox.serie} de ${prox.total} · ${descreverMeta(v)}</p>
  </div>`;
  const relogio = document.getElementById('relogio');
  const tique = () => {
    const resta = Math.ceil((t.descansoAte - Date.now()) / 1000);
    if (resta <= 0) { avisarFimDescanso(); t.descansoAte = null; guardar(); return desenharTreino(); }
    relogio.textContent = `${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, '0')}`;
  };
  tique();
  intervaloRelogio = setInterval(tique, 250);
  document.getElementById('mais').addEventListener('click', () => { t.descansoAte += 15000; guardar(); tique(); });
  document.getElementById('pular').addEventListener('click', () => { t.descansoAte = null; guardar(); desenharTreino(); });
}

function avisarFimDescanso() {
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach((d) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.15);
    });
  } catch {}
}

function desfazer() {
  const t = estado.treinoEmAndamento;
  t.passo -= 1;
  t.vagas[t.passos[t.passo].vagaId].feitas.pop();
  t.descansoAte = null;
  guardar();
  desenharTreino();
}

function confirmarEncerrar() {
  const t = estado.treinoEmAndamento;
  const feitas = Object.values(t.vagas).some((v) => v.feitas.length);
  if (!feitas) {
    if (confirm('Descartar este treino?')) { estado.treinoEmAndamento = null; guardar(); fecharTreino(); }
    return;
  }
  if (confirm('Encerrar e salvar o que foi feito? Exercícios incompletos não sobem de nível.')) finalizar();
}

function finalizar() {
  const t = estado.treinoEmAndamento;
  const registro = { treino: t.treino, data: t.data, vagas: Object.values(t.vagas) };
  const { estado: novo, resumo } = concluirTreino(estado, registro, dados);
  estado = { ...novo, treinoEmAndamento: null };
  guardar();
  resumoFinal = resumo;
  desenharResumo();
}

const ICONES = { subiu_nivel: '▲', subiu_carga: '▲', meta_maior: '↗', topo: '★', manter: '•' };

function desenharResumo() {
  camadaTreino.innerHTML = `<div>
    <h1>Treino salvo</h1>
    <p class="suave">O que muda no próximo treino:</p>
    <div class="cartao">
      ${resumoFinal.map((r) => `<div class="linha-ex evento"><span class="icone">${ICONES[r.evento.tipo] || '•'}</span>
        <div><div class="nome">${esc(nomeEx(r.exercicioId))}</div><div class="suave">${esc(r.evento.texto)}</div></div></div>`).join('')}
    </div>
    <button class="botao" id="ok">Concluir</button>
  </div>`;
  document.getElementById('ok').addEventListener('click', fecharTreino);
}

/* ---------- Histórico ---------- */

function formatarData(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function telaHistorico() {
  const sessoes = [...estado.historico].reverse();
  tela.innerHTML = `<h1>Histórico</h1>
    ${sessoes.length ? '' : '<p class="suave">Nenhum treino ainda. O primeiro aparece aqui.</p>'}
    ${sessoes.map((s) => `<details class="cartao">
      <summary><strong>Treino ${esc(s.treino)}</strong> · ${formatarData(s.data)} <span class="suave">· ${s.vagas.reduce((n, v) => n + v.feitas.length, 0)} séries</span></summary>
      ${s.vagas.filter((v) => v.feitas.length).map((v) => `<div class="linha-ex"><span>${esc(nomeEx(v.exercicioId))}</span>
        <span class="meta">${v.feitas.map((f) => (f.segundos != null ? `${f.segundos}s` : `${f.reps ?? '–'}${f.carga != null ? `×${f.carga}kg` : ''}`)).join(' · ')}</span></div>`).join('')}
    </details>`).join('')}`;
}

/* ---------- Biblioteca ---------- */

function telaBiblioteca() {
  tela.innerHTML = `<h1>Biblioteca</h1>
    <p class="suave">Escadas de calistenia: ajuste o nível se o sugerido estiver fácil ou difícil demais. Escolha o nível em que você faz 3×5 com boa técnica.</p>
    ${[...dados.escadas.values()].map((e) => {
      const est = estadoEscada(estado, e);
      return `<div class="cartao"><strong>${esc(e.nome)}</strong>
        <ol class="niveis">${e.niveis.map((id, i) => `<li class="${i === est.nivel ? 'atual' : ''}">${esc(nomeEx(id))}</li>`).join('')}</ol>
        <div class="linha-acoes">
          <button class="botao secundario pequeno" data-escada="${e.id}" data-d="-1" ${est.nivel === 0 ? 'disabled' : ''}>Nível mais fácil</button>
          <button class="botao secundario pequeno" data-escada="${e.id}" data-d="1" ${est.nivel === e.niveis.length - 1 ? 'disabled' : ''}>Mais difícil</button>
        </div></div>`;
    }).join('')}
    <h2>Exercícios com carga</h2>
    <div class="cartao">${[...dados.exercicios.values()].filter((x) => x.modalidade !== 'calistenia').map((x) => `
      <div class="linha-ex"><span>${esc(x.nome)}</span><span class="meta">${estado.cargas[x.id]?.carga != null ? `${estado.cargas[x.id].carga} kg` : '—'}</span></div>`).join('')}
    </div>`;
  tela.querySelectorAll('[data-escada]').forEach((b) => b.addEventListener('click', () => {
    const e = dados.escadas.get(b.dataset.escada);
    const est = estadoEscada(estado, e);
    const nivel = Math.min(e.niveis.length - 1, Math.max(0, est.nivel + Number(b.dataset.d)));
    estado.escadas[e.id] = { ...est, nivel, alvo: null, semProgresso: 0 };
    guardar();
    telaBiblioteca();
  }));
}

/* ---------- Ajustes ---------- */

function telaAjustes() {
  tela.innerHTML = `<h1>Ajustes</h1>
    <h2>Equipamento da academia do prédio</h2>
    <div class="cartao">${dados.equipamentos.map((eq) => `
      <label class="check"><input type="checkbox" value="${eq.id}" ${estado.equipamentos.includes(eq.id) ? 'checked' : ''}> ${esc(eq.nome)}</label>`).join('')}
    </div>
    <p class="ajuda">Sem o aparelho, o app troca automaticamente pela opção de halteres ou de calistenia.</p>

    <h2>Início do programa</h2>
    <div class="cartao"><input type="date" id="inicio" value="${esc(estado.dataInicio)}">
      <p class="ajuda">Define a fase: semanas 1–2 adaptação (2 séries), depois 3 séries.</p></div>

    <h2>Seus dados</h2>
    <p class="ajuda">Tudo fica só neste aparelho. Faça backup de vez em quando.</p>
    <button class="botao secundario" id="exportar">Baixar backup (.json)</button>
    <label class="botao secundario" style="text-align:center">Restaurar backup<input type="file" id="importar" accept="application/json" hidden></label>
    <button class="botao secundario" id="zerar" style="color:var(--alerta)">Apagar tudo</button>
    <p class="ajuda">Regras baseadas no posicionamento ACSM 2026 e na Recommended Routine (r/bodyweightfitness). Não substitui orientação médica.</p>`;

  tela.querySelectorAll('.check input').forEach((c) => c.addEventListener('change', () => {
    estado.equipamentos = [...tela.querySelectorAll('.check input:checked')].map((x) => x.value);
    guardar();
  }));
  document.getElementById('inicio').addEventListener('change', (e) => { if (e.target.value) { estado.dataInicio = e.target.value; guardar(); } });
  document.getElementById('exportar').addEventListener('click', () => exportarBackup(estado));
  document.getElementById('importar').addEventListener('change', async (e) => {
    const arq = e.target.files[0];
    if (!arq) return;
    try { estado = await importarBackup(arq); guardar(); alert('Backup restaurado.'); telaAjustes(); }
    catch (err) { alert(err.message); }
  });
  document.getElementById('zerar').addEventListener('click', () => {
    if (confirm('Apagar todo o histórico e ajustes deste aparelho? Isso não pode ser desfeito.')) {
      estado = estadoInicial(); guardar(); irPara('hoje');
    }
  });
}

iniciar().catch((e) => { tela.innerHTML = `<p>Não foi possível carregar o app: ${esc(e.message)}</p>`; });
