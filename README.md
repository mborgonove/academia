# Academia em Casa

App pessoal de treino — calistenia + academia de prédio — com regras tiradas de `docs/base-cientifica.md` (posicionamento ACSM 2026, meta-análises e a Recommended Routine do r/bodyweightfitness). Roda offline no iPhone como PWA, sem App Store, sem conta paga, sem servidor.

## O que já funciona (v0.1)

- **Hoje:** mostra o próximo treino (A ou B, alternando), a fase (adaptação/base), cada exercício com séries, meta e carga, e o contador de séries semanais por grupo muscular (meta ≥10).
- **Em treino:** uma série por vez, na ordem de pares/trios; registra reps (ou segundos, com cronômetro), carga e RIR; descanso de 90 s com aviso; desfazer; encerrar a qualquer momento.
- **Progressão automática:** escadas de calistenia (3×5 → 3×8 → próximo nível), dupla progressão nos aparelhos, redução de série após falhas seguidas, aviso quando trava.
- **Histórico, Biblioteca** (ajuste de nível das escadas) e **Ajustes** (equipamento do prédio, data de início, backup em JSON).

## 1. Abrir no Claude Code (no Mac)

```bash
cd ~/academia-app        # ou onde a pasta estiver
claude
```

O Claude Code lê `CLAUDE.md` automaticamente e passa a respeitar a base científica. Bons primeiros pedidos:

- "Rode os testes e me explique o que cada um verifica."
- "Na academia do meu prédio tem: … Ajuste `exercicios.json` e os padrões de Ajustes."
- "Implemente o próximo item do backlog do CLAUDE.md."

## 2. Testar no Mac

Precisa do Node.js (https://nodejs.org, versão LTS).

```bash
npm test     # testes da lógica de progressão
npm start    # abre em http://localhost:8000
```

Dica: no Chrome/Safari, use o modo de visualização de celular para ver como fica no iPhone.

## 3. Colocar no iPhone (grátis, via GitHub Pages)

O iPhone só instala como app e funciona offline se a página vier por HTTPS. O GitHub Pages dá isso de graça:

Já está publicado:

- Repositório: https://github.com/mborgonove/academia (público — os seus treinos **não** vão para lá, ficam só no iPhone)
- App: **https://mborgonove.github.io/academia/**

No iPhone, abra o endereço do app no **Safari** → botão Compartilhar → **Adicionar à Tela de Início**.

Como funciona: o código fica na branch `main`; o conteúdo de `app/` é copiado para a branch `gh-pages`, que é a que o GitHub Pages publica.

Para atualizar: peça a mudança ao Claude Code. Ele incrementa `VERSAO` em `app/sw.js`, faz o commit e roda `npm run publicar` (testa, envia a `main` e atualiza a `gh-pages`). O site leva cerca de 1 minuto para atualizar; depois feche e reabra o app no iPhone.

## Seus dados

Ficam só no iPhone (armazenamento do Safari). Use **Ajustes → Baixar backup** de vez em quando e guarde o arquivo no iCloud Drive. Se apagar os dados do Safari, restaure pelo mesmo menu.

## Aviso

Ferramenta pessoal, não substitui orientação médica. Veja a seção "Segurança e aquecimento" em `docs/base-cientifica.md`.
