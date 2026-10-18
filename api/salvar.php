<?php
// POST api/salvar.php { rev, dados } — grava o documento inteiro (somente admin).
// Recusa a gravação se outra pessoa salvou depois que este admin carregou os dados.
require __DIR__ . '/lib.php';
exigir_metodo('POST');
exigir_admin();

$p = corpo_json();
$dados = $p['dados'] ?? null;
if (!is_array($dados)) responder(['erro' => 'Dados ausentes.'], 400);
unset($dados['_rev']);
$erro = validar($dados);
if ($erro !== '') responder(['erro' => $erro], 422);

// The whole read-compare-write happens under one exclusive lock.
$lock = fopen(pasta() . '/dados.lock', 'c');
flock($lock, LOCK_EX);
$atual = ler_dados();
$rev_atual = (int) ($atual['_rev'] ?? 1);
if ((int) ($p['rev'] ?? -1) !== $rev_atual) {
    flock($lock, LOCK_UN);
    responder(['erro' => 'Outra pessoa salvou alterações antes de você. Os dados foram recarregados; refaça a última alteração.', 'conflito' => true], 409);
}
$dados['_rev'] = $rev_atual + 1;
$dados['evento']['atualizadoEm'] = gmdate('Y-m-d\TH:i:s\Z');
gravar_json(DADOS, $dados);
flock($lock, LOCK_UN);
responder($dados);
