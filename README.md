# JUD 2K26 · Tabela de Jogos

Site com os jogos e resultados do JUD 2K26 e painel `/admin` para a organização cadastrar jogos, lançar placares e manter equipes, locais e modalidades. Hospedagem, funções e armazenamento no Netlify (plano gratuito), sem banco de dados externo.

## Como funciona

- `index.html`, `styles.css`, `app.js`: site público. Consulta `/api/data` a cada 60 s; enquanto nada foi salvo pelo admin, usa `data/seed.json`.
- `admin/`: painel da organização, protegido por senha.
- `netlify/functions/data.mjs`: `GET /api/data`, leitura pública dos dados.
- `netlify/functions/admin.mjs`: `POST /api/login` e `PUT /api/salvar`, exigem a senha. Valida os dados antes de gravar e recusa a gravação se outra pessoa salvou no meio do caminho (o admin recarrega e avisa).
- `netlify/functions/torcida.mjs` e `votar.mjs`: torcidômetro. `GET /api/torcida?ids=...` devolve a contagem; `POST /api/votar` registra um voto. Cada voto é gravado como um registro próprio, então votos simultâneos nunca se perdem.
- `netlify/lib/shared.mjs`: validação, autenticação e contagem de votos.
- `data/seed.json`: dados iniciais (grade de sábado 17/10). Depois do primeiro salvamento pelo admin, os dados passam a viver no Netlify Blobs e este arquivo deixa de ser usado.

## Publicar no Netlify (uma vez)

1. Em app.netlify.com: **Add new site → Import an existing project → GitHub** e escolha este repositório e a branch.
2. Deixe build command em branco e publish directory como `.` (o `netlify.toml` já define isso).
3. Em **Site configuration → Environment variables**, crie `ADMIN_PASSWORD` com uma senha forte (12+ caracteres). Sem ela, o admin não abre.
4. Faça um novo deploy (**Deploys → Trigger deploy**) para a variável valer.
5. Acesse `https://SEU-SITE.netlify.app/admin/` e entre com a senha.

Para trocar a senha: altere `ADMIN_PASSWORD` e faça novo deploy. Quem estiver logado precisará entrar de novo.

## Uso do admin

- **Resultados**: escolha o dia (e o local, se quiser), digite o placar e toque em *Salvar resultado*. Ao digitar o placar, a situação muda sozinha para *Encerrado*. Para W.O., escolha *W.O.* e informe o placar do regulamento. *Limpar resultado* volta o jogo para *Agendado*.
- **Jogos**: cadastre, edite ou exclua jogos. Depois de adicionar, o formulário mantém data, local, modalidade e naipe e avança 1 hora, para cadastrar a grade em sequência. Excluir pede um segundo toque de confirmação.
- **Cadastros**: equipes (com complemento em itálico, ex.: UNIFACS *SSA*), locais e modalidades (sigla da barra e opção de parciais por sets). Um cadastro em uso por algum jogo não pode ser excluído.
- **Evento**: nome, aviso do rodapé, texto do pop-up de abertura e **Baixar backup** (JSON com tudo). Faça backup ao fim de cada dia.

## Torcidômetro e pop-up

- Abaixo de cada jogo, o público toca no lado do time para o qual torce. A barra mostra a divisão em %. Um voto por pessoa e jogo, controlado no navegador; o servidor limita 120 votos por minuto por conexão. Não impede fraude deliberada (limpar o navegador permite votar de novo): trate como brincadeira, não como pesquisa.
- A votação fecha automaticamente quando o jogo é marcado como Encerrado ou W.O.; a barra fica congelada. Jogo adiado não mostra o torcidômetro.
- O pop-up de aviso aparece uma vez por visita (sessão do navegador) e fecha no botão "Entendi".

O site público reflete uma alteração em até ~30 s (cache de 10 s no Netlify + consulta a cada 60 s nos navegadores abertos; quem recarrega a página vê na hora).

## Testar localmente

```
npm install
ADMIN_PASSWORD=teste npm run dev
```

Site em `http://localhost:8888` e admin em `http://localhost:8888/admin/`. Os dados de teste ficam em `.netlify/blobs-dev` (ignorado pelo git).
