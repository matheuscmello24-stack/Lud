<?php
// GET api/data.php — dados públicos do site (jogos, placares, cadastros).
require __DIR__ . '/lib.php';
exigir_metodo('GET');
$d = ler_dados();
$d['_rev'] = $d['_rev'] ?? 1;
responder($d);
