# Academia em Casa — instruções para o Claude Code

App pessoal de treino (calistenia + academia de prédio) que roda offline no iPhone como PWA. Dono: Marcus, historiador, não é programador — explique mudanças em português simples.

## Regra de ouro: base científica

`docs/base-cientifica.md` é a fonte de verdade de **todas** as regras de treino (séries, repetições, RIR, progressão, descanso, frequência). Antes de mudar qualquer regra:

1. Localize a seção correspondente em `docs/base-cientifica.md`.
2. Se a mudança não tiver respaldo lá, pergunte ao Marcus ou proponha a fonte (posicionamento ACSM 2026, meta-análises, wiki da Recommended Routine) e atualize o documento junto com o código.
3. Cite a seção em um comentário perto do código (ex.: `// base-cientifica.md › Regras de progressão`).

Não invente números de treino. Não acrescente conselhos médicos.

## Estrutura

```
app/                  ← raiz publicada (é isso que vai para o iPhone)
  index.html          telas e layout
  style.css
  js/progressao.js    lógica pura de progressão (sem DOM) — testada
  js/armazenamento.js estado no localStorage + backup em JSON
  js/main.js          interface
  data/exercicios.json   biblioteca de exercícios
  data/escadas.json      escadas de progressão de calistenia
  data/treinos.json      treinos A e B (blocos em par/trio, opções por equipamento)
  sw.js, manifest.webmanifest, icons/
docs/base-cientifica.md
tests/                testes com node:test
```

## Convenções

- Sem build, sem frameworks: HTML + CSS + JavaScript (módulos ES). Tudo precisa funcionar abrindo `app/` num servidor estático.
- Textos da interface e comentários em português do Brasil.
- Dados do usuário só no aparelho (`localStorage`, chave `academia.v1`). Sem servidor, sem analytics, sem chamadas externas.
- Toda regra nova em `js/progressao.js` ganha teste em `tests/`.
- Ao alterar arquivos em `app/`, incremente `VERSAO` em `app/sw.js` para o iPhone baixar a versão nova.
- Mudança no formato do estado salvo → escreva migração em `armazenamento.js` (nunca apague o histórico do usuário).

## Comandos

- Testes: `npm test`
- Rodar no Mac: `npm start` e abrir http://localhost:8000
- Publicar para o iPhone: `npm run publicar` (testa, envia `main` e atualiza a branch `gh-pages` com o conteúdo de `app/`). Site: https://mborgonove.github.io/academia/

## Próximos passos sugeridos (backlog)

- [ ] Marcus listar os aparelhos reais da academia do prédio e ajustar `data/exercicios.json`
- [ ] Links de vídeo de técnica em cada exercício
- [ ] Gráfico de evolução por padrão no Histórico
- [ ] Tela de aquecimento guiado (seção "Segurança e aquecimento")
- [ ] Fase 3 do programa: sugerir série extra quando a progressão travar
