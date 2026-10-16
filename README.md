# JUD 2K26 · Tabela de Jogos

Site estático (HTML, CSS e JS, sem build) com jogos, resultados e classificação do JUD 2K26. A estrutura segue a do site do X Intermed Bahia: abas Jogos e Classificação, seletor de dia, filtro por atlética (que fica salvo no aparelho), filtros de naipe, modalidade e local, botão de compartilhar com os filtros na URL, link de replay e "corrigir placar".

## Arquivos

- `data/jogos.js`: **o único arquivo editado durante o evento** (jogos, placares, equipes, locais e pontuação).
- `index.html`, `styles.css`, `app.js`: página, identidade visual e lógica.
- `assets/`: logo e faixa de apoiadores, extraídas da arte oficial. Troque pelas versões vetoriais quando houver.

## Lançar um resultado

No GitHub, abra `data/jogos.js`, clique no lápis (dá para fazer pelo celular), localize o jogo e altere:

```js
status: "encerrado", placar: [3, 1]
```

Status possíveis: `agendado`, `ao_vivo`, `encerrado`, `wo`, `adiado`. Campos opcionais: `parciais` (vôlei), `video` (link do replay) e `obs`. Depois, atualize `atualizadoEm` e faça o commit. A página recarrega os dados sozinha a cada 60 s.

## Classificação

A classificação é calculada automaticamente a partir dos jogos `encerrado`/`wo`, agrupada por modalidade e naipe (e por `grupo`, se informado no jogo). A pontuação fica em `pontuacao` e deve ser ajustada ao regulamento. O desempate é por saldo e, depois, por pró.

## Publicação

Em GitHub Pages: Settings → Pages → Deploy from a branch → escolha a branch e a pasta `/ (root)`. Também funciona em Vercel ou Netlify sem nenhuma configuração.

Para testar localmente: `python3 -m http.server` na pasta e abra `http://localhost:8000`.
