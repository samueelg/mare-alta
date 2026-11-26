# Maré Alta: guia para continuar o desenvolvimento

Jogo educativo web (single player, 2D visto de cima) para a disciplina **Qualidade de Software: Normas, Modelos e Melhoria Contínua**. Trabalho em grupo de 3 pessoas, **entrega em 02/12/2026**, com apresentação de 10 a 12 minutos e um relatório de até 2 páginas.

## O que o enunciado exige (e o que dá nota)

- Usar o **MR-MPS-SW** e pelo menos dois de: GPR, REQ, ISO/IEC/IEEE 12207, MR-MPS-RH. O jogo usa **os quatro**.
- Os conceitos precisam estar **nas regras e mecânicas**, não só em nomes ou títulos.
- **Proibido** como mecânica principal: quiz, verdadeiro/falso, jogo de memória.
- Decisões com **consequências visíveis**, objetivo claro, vitória/derrota e partida de **5 a 10 minutos**.
- Notas: conceitos corretos (35), conceitos virando mecânica (25), coerência das consequências (20), funcionamento e apresentação (20). **Visual e quantidade de recursos não contam ponto.**

## Como rodar

O jogo é HTML + JS (módulos ES) com Phaser 3.80.1 salvo em `vendor/`. **Não tem build** e funciona sem internet. Os módulos ES precisam de um servidor HTTP, então abrir o `index.html` direto pelo explorador de arquivos **não funciona**.

```bash
npm start          # sobe em http://localhost:8080 (baixa o http-server na 1ª vez)
# ou, sem Node:
python -m http.server 8080
npm test           # testes das regras (Node 18+), sem dependências
```

- `?semente=123` na URL repete sempre a mesma partida, **inclusive clima e eventos** (útil na apresentação).
- `?debug` expõe `window.mareAlta.game` no console. Exemplos: `mareAlta.game.scene.getScene('Porto').exp`, `mareAlta.game.scene.getScene('Mar').exp.eventosMar`.

## Como se joga (fluxo de uma expedição)

1. **Porto (fase saída), andando com o pescador (WASD, E para interagir, 1/2/3 nas opções, Esc fecha):**
   - **Cliente na praça** (marcador `!`): entrega o pedido vago. Opção de fazer perguntas (−15 s de mar). Com a Ficha de pedido, já vem esclarecido.
   - **Bomba**: segura E para abastecer (R$ 2/un). Painel mostra o tanque, o mínimo para zarpar e, com o Diário de bordo, a **faixa verde da previsão** (já ajustada ao clima do dia). O que sobra no tanque fica para a próxima viagem.
   - **Escritório**: modal HTML para adotar processos. Bloqueia compras que comprometam a reserva da próxima viagem.
   - **Taverna**: vê habilidade e cansaço da tripulação e contrata gente. Os tripulantes ficam em pé ao lado, com barra de cansaço. Quem pede demissão vai embora andando.
   - **Barco** (ponta do píer): checa os requisitos para zarpar e pede a jornada (normal ou hora extra).
2. **Mar** (cena `Mar`): navegar, pescar com o minijogo de tensão, rádio de mudança (expedições 2 e 4), eventos aleatórios. O barco não entra na areia; depois de se afastar da costa, voltar até a linha de boias atraca sozinho (`LINHA_ATRACAR` em `MarScene.js`).
3. **Porto (fase chegada):** o pescador sai do barco carregando a caixa de peixe.
   - **Bancada de triagem** (opcional; automática com o checklist): os peixes reprovados voam para o mercado.
   - **Cliente**: entregar, ver a reação dele e o dinheiro subindo.
   - Em seguida, um modal com o **relatório da entrega** (planejado × realizado).
4. Descanso da tripulação, e o próximo cliente chega andando.

Sobraram só 5 telas HTML: início, rádio (modal), escritório (modal), relatório da entrega (modal) e final.

## Arquitetura

```
index.html, style.css
vendor/phaser.min.js        Phaser 3.80.1 (global Phaser)
src/main.js                 controlador: o fluxo da partida está em jogar(), lido de cima para baixo
src/regras/                 REGRAS PURAS: sem Phaser e sem DOM, testáveis no Node
  config.js                 TODOS os números de balanceamento + espécies + eventos
  pedidos.js                os 4 pedidos (um por expedição), em ordem pedagógica
  processos.js              os 4 processos compráveis + nivelMaturidade()
  estado.js                 estado inicial (caixa, reputação, tanque, tripulação, contadores)
  expedicao.js              ciclo da expedição: pedido, bomba, zarpar, mar, mudança, triagem, entrega, porto, fim
  eventos.js                clima do dia, gaivotas, cardume dourado (sorteio com o rng da partida)
  minijogo.js               lógica da barra de tensão (calibrada por simulação)
  relatorio.js              lições do relatório final (problema -> conceito)
  rng.js                    aleatório com semente (+ sorteio por peso)
src/telas/telas.js          telas HTML sobre o canvas; cada uma devolve Promise com a escolha
src/cena/pixel.js           TODA a pixel art: paleta, personagens, barco, prédios, mar, ícones, molduras
src/cena/ui.js              componentes de interface pixel: diálogo, faixa do objetivo, aviso de tecla, barras
src/cena/comum.js           tamanho do mundo, ZOOM, fontes, câmera, texto flutuante
src/cena/som.js             efeitos sonoros sintetizados (Web Audio), ondas e gaivotas de fundo
src/cena/PortoScene.js      porto jogável (lobby): só desenha, lê teclado e chama regras
src/cena/MarScene.js        mar: só desenha, lê teclado e chama regras
vendor/fontes/              fonte Pixelify Sans (licença OFL, ver LICENSE-pixelify-sans.txt)
tests/regras.test.js        31 testes das regras (node:test)
tests/e2e/jogar.mjs         robô que joga a temporada no Chrome real e tira prints
```

**Regra de ouro da arquitetura:** toda regra de jogo fica em `src/regras/` e tem teste. Cenas e telas só exibem e repassam escolhas. Se for mexer em número, mexa em `config.js`.

## Visual (pixel art) e tela cheia

- **Nenhuma imagem externa:** tudo é desenhado por código em `src/cena/pixel.js`. Os personagens são moldes de texto (`MOLDES`) com troca de cores (`PERSONAGENS`); os ícones e objetos pequenos são grades (`ICONES`); prédios, mar, areia, píer, barco e molduras são procedurais.
- **Uniformidade:** um pixel de arte = `S` = 3 unidades do mundo, e toda cor vem da paleta `COR` (cada material tem tons de sombra e luz). Posições e tamanhos de arte devem ser múltiplos de 3. Pixel art não gira: o barco tem desenho horizontal e vertical, espelhados.
- **Nitidez:** o mundo tem coordenadas 960×540, mas o canvas tem exatamente os pixels físicos do palco (inclusive com escala do Windows em 125%/150%), e a câmera aproxima (`main.js` → `redimensionar`, `comum.js` → `prepararCamera`). O navegador nunca estica a imagem, porque esticar com o modo "pixelado" borrava as letras. Todo texto recebe sozinho resolução igual ao zoom e filtro suave; a pixel art continua com filtro "nearest".
- **Avisos flutuantes** (`flutuar` em `comum.js`): etiqueta de pergaminho com texto escuro e uma marquinha colorida pelo tipo (`CORES.ok`, `ruim`, `alerta`, `ouro`, `neutro`). Não use texto colorido solto por cima do mar, que fica difícil de ler.
- **Neblina** (`MarScene.atualizarNeblina`): um véu pontilhado (`texturaVeuNevoa`, dithering "Bayer" em vez de transparência suave) acompanha o barco e deixa uma bolha de visibilidade do tamanho do alcance do sonar; nuvens de névoa (`nuvensNevoa`) passam por cima. Cardumes, peixes pulando e respingos ficam por baixo do véu, então somem na neblina fechada.
- **Peixes pulando** (`MarScene.pularPeixe`): só enfeite, a cada 3 a 7 s. Metade das vezes o pulo acontece perto de um cardume (com a cor da espécie), o que funciona como pista. Usa `Math.random`, não o rng da partida, para `?semente=N` continuar repetindo o mesmo jogo.
- **Interface:** `ui.js` tem a caixa de diálogo (pergaminho com aba de madeira, opções com teclas desenhadas), a **faixa amarela do objetivo** no topo, a seta que pula sobre o objetivo no mapa, o aviso "E: fazer algo" e as barras. Use esses componentes em vez de criar caixas novas.
- **Telas HTML:** `instalarEstiloPixel()` transforma as mesmas molduras e ícones em CSS (`--moldura`, `.ico-moeda`...). A camada `#tela` é desenhada em 960×540 e escalada junto com o canvas (`--k`).
- **Tela cheia:** o palco ocupa a janela em 16:9. Ao clicar em "Começar temporada" o jogo pede tela cheia ao navegador; **F** alterna.
- **Emojis:** não use (no canvas viram quadradinhos ou destoam do estilo). Use os ícones de `ICONES`; para um ícone novo, acrescente uma grade lá.
- **Fonte:** negrito em texto pequeno fecha a abertura do "c" (vira "o") e deixa o "5" parecido com "S"; em placas, teclas, balões e opções use peso normal. Negrito só em títulos e na faixa do objetivo.

## Som

Tudo é sintetizado na hora em `src/cena/som.js` (Web Audio API): **nenhum arquivo de áudio**, funciona offline. O estilo é minimalista: ondas simples e ruído filtrado, em volume baixo.

| Som | Quando toca | Como é feito |
|---|---|---|
| `som.interacao()` | E num lugar, opção de diálogo, botão HTML | dois bipes de onda triangular |
| `som.passo('areia' \| 'madeira')` | a cada passo do pescador (madeira no píer) | chiado curto filtrado / toque grave |
| `som.lancar()` | ao lançar a linha | ruído subindo (linha no ar) + "plop" descendo |
| `som.fisgado()` | peixe pescado (de novo na pesca em dobro) | respingo + três notas subindo |
| `som.dinheiro()` | entrega paga, colecionador, garoupa fisgada | duas notas agudas de onda quadrada |
| `som.respingo(vol)` | peixe caindo de volta na água (mais baixo quando longe ou na neblina) | "plic" curto: ruído filtrado + tom descendo |
| `som.gaivota()` | de tempos em tempos no fundo e no evento das gaivotas | "kiau" descendo, com tremido |
| `ambiente('porto' \| 'mar')` | ao abrir cada cena | ruído grave cujo volume sobe e desce devagar (ondas) |

- O navegador só libera áudio depois de um gesto: o primeiro clique ou tecla chama `iniciarAudio()`.
- **M** liga/desliga o som.
- Para afinar um som, abra com `?debug` e chame no console, por exemplo `mareAlta.som.lancar()`. Volumes e frequências ficam dentro de cada função.
- O robô e2e conta quantas vezes cada som disparou e acusa erro se algum nunca tocou.

## Como os conceitos viram mecânica

| Conceito | Mecânica | Onde está |
|---|---|---|
| **REQ** | O cliente fala o pedido vago. Fazer perguntas custa 15 s de mar e revela espécie e tamanho. Sem isso, o sonar mostra `?` e a triagem só pega peixe machucado. | `receberPedido`, `conversarComCliente`, `PortoScene.falarComCliente` |
| **REQ (controle de mudanças)** | Rádio no meio da viagem (expedições 2 e 4). Aceitar direto faz o já pescado ser cobrado pela regra nova. Analisar dá +20 s e o já pescado vale pela regra antiga. Recusar tira reputação. | `decidirMudanca`, `specParaPeixe`, `telas.mudanca` |
| **GPR** | Abastecer na bomba sem saber quanto vai gastar (no chute) ou com a previsão do Diário de bordo, que **estreita com o histórico**. O clima do dia é um **risco conhecido antes de planejar** (mar agitado = +30% de consumo). Sem combustível, reboque. Relatório planejado × realizado. | `abastecer`, `previsaoCombustivel`, `estimativaCardume`, `PortoScene.atualizarPainelBomba` |
| **ISO 12207** | Requisitos (cliente) → planejamento (bomba/barco) → construção (mar) → **verificação** (bancada de triagem) → **validação** (o cliente aceita ou devolve, na frente do jogador). | `triar`, `entregar`, `PortoScene.usarBancada` |
| **MR-MPS-RH** | Cansaço e habilidade definem a **firmeza da linha** no minijogo (e a barra treme com cansaço). Hora extra rende mais tempo e mais cansaço. Fadiga acima de 85 = demissão (o tripulante vai embora andando). Contratação na taverna. | `limiteTensao`, `descansar`, `contratar`, `PortoScene.falarComTripulacao` |
| **MR-MPS-SW** | No escritório, o jogador **institucionaliza** processos que passam a valer para sempre. Maturidade: Improviso → Em transição → **Nível G** (REQ + GPR) → Nível G + Verificação. | `processos.js`, `comprarProcesso`, `telas.escritorio` |

Cuidado com os conceitos: o rótulo "Nível G = GPR + REQ" segue o **MR-MPS-SW:2021**. Confirme com o material da disciplina antes de citar outros níveis no jogo ou no relatório.

## Eventos aleatórios (sorte, sem mudar o que o jogo ensina)

Todos ficam em `CONFIG.eventos` e são sorteados com o rng da partida.

| Evento | Frequência | Efeito |
|---|---|---|
| Mar calmo | comum (peso 45) | nada |
| Mar agitado | comum (20) | combustível ×1,3 |
| Neblina | comum (18) | sonar só mostra cardumes a menos de 190 px do barco |
| Lua cheia | raro (10) | puxar rende 40% mais; peixe especial com chance dobrada |
| Cardumes fartos | raro (7) | +2 peixes por cardume |
| Gaivotas | 60% das viagens | cardume novo surge no meio da viagem (metade das vezes, da espécie pedida) |
| Cardume dourado | 18% das viagens | garoupas douradas por 20 s; cada uma vale R$ 150 no colecionador |
| Pesca em dobro | 12% por peixe | vem um segundo peixe do mesmo cardume |
| Peixe especial | 3% por peixe | em vez do peixe comum, uma garoupa dourada (troféu, não conta para a meta) |

O clima aparece no porto **antes** de abastecer. Isso conta como identificação de risco (GPR); citem isso no relatório.

## Estado atual (25/11/2026)

**Pronto e verificado:**
- **31/31 testes de regra** passando (`npm test`).
- **Temporada inteira jogada no Chrome real pelo robô** (`tests/e2e/jogar.mjs`), sem erros no console. Caminhos cobertos: entrega sem bancada, triagem na bancada, mudança aceita e analisada, cardume dourado, hora extra, contratação, checklist automático, fim por prazo e tela final.
- Corrigido: **tela escurecida depois da pesca**. O modal do rádio fechava, mas a classe `modal` ficava no `#tela`, e o `display: flex` vencia o atributo `hidden`, deixando o fundo escuro por cima do mar. Agora `esconder()` limpa a classe e o CSS tem `#tela[hidden] { display: none !important }`. O robô checa isso depois de cada pesca e de cada rádio.
- Corrigido: o ESPAÇO pescava o primeiro cardume da lista, não o mais próximo. Cardumes de evento também não nascem mais em cima de outros.
- Corrigido: o porto deixava falir sem aviso. Escritório e taverna bloqueiam compras que comprometam a reserva da próxima viagem, e a bomba guarda o dinheiro dos salários.

**Não verificado por pessoas:** ninguém jogou ainda com as mãos, só o robô. Ele teleporta e não gasta combustível navegando, então o "0 usados" nos relatórios dele não vale como teste.

## Próximos passos (em ordem de prioridade)

1. **Playtest com pessoas e balanceamento** (`config.js`). Pontos a observar:
   - **Reputação pode despencar rápido.** Aceitar a mudança sem análise e pular a triagem custou −40 numa viagem só no teste do robô (teto de −20 por devolução + até −20 por meta perdida). É a consequência planejada, mas com 4 viagens pode virar uma espiral sem volta. Se o grupo achar duro demais, reduzam `rejeicao.limite` ou `metaFalhou.reputacaoMax`.
   - A partida inteira deve caber em 6 a 8 minutos, com o porto incluso. Cronometrem.
   - A vitória deve ser possível com processos e difícil sem.
   - Confiram se o peixe especial (3%) e o cardume dourado (18%) não estão dando dinheiro demais.
2. **Polimento:** animação de pesca (linha saindo do barco), mais variedade de enfeites no porto, talvez um som para linha arrebentada e para o rádio. Ouçam os sons em fones e em caixas de som: volumes sintetizados variam de aparelho para aparelho. A arte já está pronta em pixel art (`src/cena/pixel.js`); creditar a fonte Pixelify Sans (OFL) no relatório.
3. **Hospedar:** GitHub Pages ou itch.io (é só subir a pasta; não precisa de build).
4. **Relatório de 2 páginas e roteiro da apresentação.** A tabela "Como os conceitos viram mecânica" acima é a base. Sugestão de demonstração com `?semente=123`: jogar a expedição 1 sem processos (sofre), adotar processos no escritório e mostrar a expedição seguinte mais previsível (pedido claro, faixa verde na bomba, checklist).

Ideias de complemento que combinam com a proposta (só se sobrar tempo):
- Quadro de avisos no porto com o histórico de viagens (planejado × realizado de todas as expedições). Reforça GPR.
- Cliente que aparece na chegada para reclamar do pós-venda quando houve devolução (ISO 12207, operação/manutenção).

## Teste no navegador (robô)

`tests/e2e/jogar.mjs` abre o Chrome e joga uma temporada. Ele usa `?debug` para teleportar o pescador e o barco e ler a tensão, mas as ações são teclas reais (E, 1/2/3, Esc, ESPAÇO). Salva prints de cada etapa e falha se o overlay escuro ficar preso.

```bash
npm i -D puppeteer-core@23.11.1
npm start                      # em outro terminal
mkdir prints
node tests/e2e/jogar.mjs ./prints   # janela 1600×900 → ZOOM 2, prints nítidos
# variáveis opcionais: URL_JOGO (padrão http://localhost:8080/?semente=123&debug) e CHROME (caminho do chrome.exe)
```

## Convenções

- Código e textos em português; tudo que o jogador lê fica nas telas (`telas.js`), nos diálogos das cenas ou em `pedidos.js`/`processos.js`/`config.js` (eventos).
- Toda regra nova ganha teste em `tests/regras.test.js`.
- Não espalhe números mágicos: use `CONFIG`.
- Sem emojis: use os ícones pixel (ver "Visual").
