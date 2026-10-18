<?php
// GET api/torcida.php?ids=a,b,c — contagem do torcidômetro: { id: { h, a } }.
require __DIR__ . '/lib.php';
exigir_metodo('GET');
$ids = array_slice(array_filter(explode(',', (string) ($_GET['ids'] ?? '')), 'e_chave'), 0, 80);
$out = [];
foreach ($ids as $id) $out[$id] = ler_votos($id);
responder((object) $out);
