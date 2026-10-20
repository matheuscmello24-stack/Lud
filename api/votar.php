<?php
// POST api/votar.php { id, lado: "h" | "a" } — registra um voto no torcidômetro.
// Um voto por pessoa e jogo é controlado no navegador; aqui há limite por IP
// e a votação só vale para jogos existentes que ainda não terminaram.
require __DIR__ . '/lib.php';
exigir_metodo('POST');
limitar('votos', LIMITE_VOTOS_POR_MINUTO);

$p = corpo_json();
$id = $p['id'] ?? null;
$lado = $p['lado'] ?? null;
if (!e_chave($id) || !in_array($lado, ['h', 'a'], true)) responder(['erro' => 'Voto inválido.'], 400);

$jogo = null;
foreach (ler_dados()['jogos'] as $g) if ($g['id'] === $id) { $jogo = $g; break; }
if (!$jogo) responder(['erro' => 'Jogo não encontrado.'], 404);
if (($jogo['mandante'] ?? '') === '') responder(['erro' => 'As equipes deste jogo ainda não foram definidas.'], 409);
if (in_array($jogo['status'], ['encerrado', 'wo'], true)) responder(['erro' => 'A votação deste jogo já foi encerrada.'], 409);

responder(somar_voto($id, $lado));
