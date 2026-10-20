# JUD 2K26 · Tabela de Jogos

Site com jogos, resultados e torcidômetro do JUD 2K26, com painel `/admin` para a organização cadastrar jogos, lançar placares e manter equipes, locais e modalidades. Feito para hospedagem compartilhada da Hostinger: HTML/CSS/JS no navegador e PHP no servidor, com os dados gravados em arquivos JSON. Não precisa de banco de dados.

## Publicar na Hostinger

**Requisitos:** um plano de *Hospedagem de Sites* (Single, Premium, Business ou Cloud), que roda PHP. O *Construtor de Sites* e o *Horizons* da Hostinger **não servem**, porque não aceitam código próprio.

1. **Defina a senha do admin.** Antes de enviar, abra `api/config.php` num editor de texto e troque `TROQUE-ESTA-SENHA` por uma senha forte (12+ caracteres). Se esquecer, dá para editar depois pelo Gerenciador de Arquivos do hPanel.
2. **Abra o Gerenciador de Arquivos.** hPanel → *Sites* → seu domínio → *Painel* → *Gerenciador de Arquivos* → pasta `public_html`.
3. **Limpe a pasta.** Se houver um `index.php` ou `default.php` de boas-vindas da Hostinger, apague.
4. **Envie o pacote.** Clique em *Upload*, envie `jud2k26-hostinger.zip`, clique com o botão direito no arquivo → *Extract* → extraia em `public_html` (não numa subpasta). Depois apague o .zip.
5. **Confira a estrutura.** Dentro de `public_html` devem aparecer `index.html`, `.htaccess`, `admin/`, `api/`, `assets/`, `data/` e `storage/`. Se ficou tudo dentro de uma subpasta (ex.: `public_html/jud2k26-hostinger/`), mova o conteúdo um nível acima.
6. **Versão do PHP.** hPanel → *Avançado* → *Configuração do PHP* → use 8.1 ou superior (o padrão atual da Hostinger já atende).
7. **SSL.** hPanel → *Segurança* → *SSL* → instale o certificado gratuito. O `.htaccess` redireciona tudo para `https://`.
8. **Teste.** Abra `https://seudominio.com.br` (deve aparecer o pop-up e a tabela) e `https://seudominio.com.br/admin/` (entre com a senha).

Para o site em um subdomínio (ex.: `jogos.seudominio.com.br`), crie o subdomínio no hPanel e use a pasta dele no lugar de `public_html`. O site também funciona dentro de uma subpasta (ex.: `seudominio.com.br/jud/`).

## Como funciona

- `index.html`, `styles.css`, `app.js`: site público. Consulta `api/data.php` a cada 60 s.
- `admin/`: painel da organização, protegido pela senha de `api/config.php`.
- `api/`: endpoints PHP.
  - `data.php` (GET): dados públicos. Enquanto nada foi salvo, devolve `data/seed.json`.
  - `login.php` e `salvar.php` (POST, exigem a senha): o salvamento valida os dados e recusa gravar se outra pessoa salvou no meio do caminho (o admin recarrega e avisa).
  - `torcida.php` (GET) e `votar.php` (POST): torcidômetro. Cada voto soma num arquivo por jogo, com trava de arquivo; votos simultâneos não se perdem.
  - `config.php`: senha e limites. `lib.php`: funções comuns. Os dois são bloqueados para acesso direto.
- `storage/`: onde o site grava dados, votos e contadores de limite. Bloqueada para o navegador pelo `.htaccess`. **Não apague esta pasta durante o evento.**
- `data/seed.json`: grade inicial (sábado 17/10). Depois do primeiro salvamento no admin, os dados passam a ficar em `storage/dados.json`.

## Uso do admin

- **Resultados**: escolha o dia (e o local, se quiser), digite o placar e toque em *Salvar resultado*. Ao digitar o placar, a situação muda sozinha para *Encerrado*. Para W.O., escolha *W.O.* na Situação e marque quem compareceu: o site mostra **W** ao lado de quem compareceu e **O** ao lado de quem faltou, sem placar. *Limpar resultado* volta o jogo para *Agendado*.
- **Jogos**: cadastre, edite ou exclua jogos. Depois de adicionar, o formulário mantém data, local, modalidade e naipe e avança 1 hora. Excluir pede um segundo toque de confirmação.
- **Novo dia**: toque em *+ Novo dia* (ao lado dos dias). O admin sugere o dia seguinte ao último cadastrado; ajuste a data se precisar e cadastre os jogos. Também basta escolher qualquer data no campo *Data* do formulário.
- **Importar grade de um dia**: na aba Jogos, abra *Importar grade*, escolha data e local e cole uma linha por jogo, no formato `08:00 BAIANA x UNIFACS HAND F` (horário, equipe, x, equipe, sigla da modalidade, naipe F ou M). Toque em *Conferir*: o admin mostra cada jogo entendido e aponta erros (equipe ou modalidade não cadastrada etc.). Sem erros, *Importar* grava todos de uma vez. Faça uma importação por local.
- **Cadastros**: equipes (com complemento em itálico, ex.: UNIFACS *SSA*), locais e modalidades (sigla da barra e opção de parciais por sets). Um cadastro em uso por algum jogo não pode ser excluído.
- **Novo local**: na aba Jogos, toque em *+ Novo local* abaixo do campo Local (no formulário ou na importação de grade), digite o nome e toque em *Criar*; o local já fica selecionado. Também dá para cadastrar e renomear em Cadastros → Locais. No site público, o filtro de locais mostra só os locais com jogos no dia escolhido.
- **Evento**: nome, aviso do rodapé, texto do pop-up de abertura e **Baixar backup** (JSON com tudo). Faça backup ao fim de cada dia.

Para trocar a senha, edite `api/config.php` no Gerenciador de Arquivos. Quem estiver logado precisará entrar de novo.

## Banner da festa

- Telas grandes (a partir de 1340 px de largura): banner vertical fixo na margem direita (`assets/banner-festa-lateral.webp`, 480×960).
- Celular e tablet: banner horizontal entre os filtros e os jogos (`assets/banner-festa-horizontal.webp`, 1080×540).
- Botão roxo pulsante abaixo da imagem; imagem e botão levam ao link de compra.
- Em **Admin → Evento → Banner da festa**: ligar/desligar, trocar o link e o texto do botão. Para trocar as imagens, substitua os dois arquivos acima no Gerenciador de Arquivos, mantendo os nomes.

## Torcidômetro e pop-up

- Abaixo de cada jogo, o público toca no lado do time para o qual torce e a barra mostra a divisão em %. Um voto por pessoa e jogo, controlado no navegador; o servidor limita 120 votos por minuto por IP (ajustável em `api/config.php`). Não impede fraude deliberada (limpar o navegador permite votar de novo): trate como brincadeira, não como pesquisa.
- A votação fecha quando o jogo é marcado como Encerrado ou W.O. Jogo adiado não mostra o torcidômetro.
- O pop-up de aviso aparece uma vez por visita e fecha no botão "Entendi".

## Backup e restauração

- O botão *Baixar backup* do admin gera um JSON com jogos, placares e cadastros (não inclui votos).
- Para restaurar: no Gerenciador de Arquivos, envie o backup para `storage/` com o nome `dados.json`, substituindo o atual.
- Para zerar o torcidômetro de um jogo: apague `storage/votos/<id-do-jogo>.json`. Para zerar todos: apague a pasta `storage/votos`.

## Testar no computador

Com PHP 8.1+ instalado, na pasta do projeto: `php -S localhost:8000` e abra `http://localhost:8000` e `http://localhost:8000/admin/`. O servidor embutido do PHP ignora o `.htaccess`; as proteções de pasta só valem na Hostinger.

## Segurança

- Nenhum recurso externo: fontes (Anton, Archivo, Poppins) servidas de `assets/fonts`, sem Google Fonts. Isso permite a Content Security Policy restrita do `.htaccess`.
- `.htaccess` envia: Content-Security-Policy, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy e HSTS (só em HTTPS); força HTTPS; bloqueia listagem de pastas, arquivos ocultos e `.md/.txt/.log/.bak/.zip/.sql/.ini/.sh`.
- `storage/` e `api/config.php`/`api/lib.php` bloqueados para o navegador.
- A API só aceita corpo JSON (bloqueia envio por formulários de outros sites), limita senhas erradas por IP, não exibe erros do PHP nem a versão do servidor.
- Todo dado inserido em HTML passa por escape; links externos com `rel="noopener"`; link do banner só aceita `https://`.
- Este README **não** vai no pacote de publicação.

