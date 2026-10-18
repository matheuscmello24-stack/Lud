<?php
// POST api/login.php — confere a senha do admin.
require __DIR__ . '/lib.php';
exigir_metodo('POST');
exigir_admin();
responder(['ok' => true]);
