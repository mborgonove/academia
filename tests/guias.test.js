import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const app = (f) => new URL(`../app/${f}`, import.meta.url);
const ler = (f) => JSON.parse(readFileSync(app(`data/${f}`)));
const exercicios = ler('exercicios.json').exercicios;
const { guias } = ler('guias.json');
const sw = readFileSync(app('sw.js'), 'utf8');

test('guias: todo exercício tem explicação, músculos, passo a passo e vídeo', () => {
  for (const ex of exercicios) {
    const g = guias[ex.id];
    assert.ok(g, `sem guia: ${ex.id}`);
    assert.ok(g.explicacao && g.musculos, ex.id);
    assert.ok(Array.isArray(g.passos) && g.passos.length >= 2, ex.id);
    assert.match(g.video?.id ?? '', /^[\w-]{11}$/, ex.id);
  }
  for (const id of Object.keys(guias)) assert.ok(exercicios.some((e) => e.id === id), `guia sem exercício: ${id}`);
});

test('guias: toda foto citada existe e fica guardada para uso offline', () => {
  for (const [id, g] of Object.entries(guias)) {
    if (!g.fotos) continue;
    assert.ok(g.fotos.quadros.length >= 1, id);
    for (const q of g.fotos.quadros) {
      const arq = `${g.fotos.pasta}-${q}.jpg`;
      assert.ok(existsSync(app(arq)), `${id}: falta ${arq}`);
      assert.ok(sw.includes(`'${arq}'`), `${id}: ${arq} fora da lista do sw.js`);
    }
  }
});

test('fotos: toda imagem da pasta é usada e está no sw.js (nada sobrando)', () => {
  const usadas = new Set(Object.values(guias).flatMap((g) => (g.fotos ? g.fotos.quadros.map((q) => `${g.fotos.pasta}-${q}.jpg`) : [])));
  for (const f of readdirSync(app('img/ex'))) {
    assert.ok(usadas.has(`img/ex/${f}`), `foto sem uso: ${f}`);
    assert.ok(sw.includes(`'img/ex/${f}'`), `foto fora do sw.js: ${f}`);
  }
});
