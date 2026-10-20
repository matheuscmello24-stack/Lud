<?php
// Funções comuns da API. Os dados ficam em arquivos JSON na pasta /storage
// (protegida por .htaccess). Enquanto o admin não salva nada, vale data/seed.json.

require __DIR__ . '/config.php';

if (!function_exists('array_is_list')) { // PHP < 8.1
    function array_is_list(array $a): bool { return $a === [] || array_keys($a) === range(0, count($a) - 1); }
}

const STATUS = ['agendado', 'encerrado', 'wo', 'adiado'];
const NAIPES = ['F', 'M', ''];   // '' = sem naipe (ex.: e-sports)
const CORES = ['amarelo', 'rosa'];
define('STORAGE', dirname(__DIR__) . '/storage');
define('SEED', dirname(__DIR__) . '/data/seed.json');
define('DADOS', STORAGE . '/dados.json');

ini_set('display_errors', '0');
header_remove('X-Powered-By');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-LiteSpeed-Cache-Control: no-cache');
header('X-Content-Type-Options: nosniff');

function responder($body, int $status = 200): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function exigir_metodo(string $metodo): void {
    if ($_SERVER['REQUEST_METHOD'] !== $metodo) responder(['erro' => 'Método não permitido.'], 405);
}

function pasta(string $sub = ''): string {
    $dir = STORAGE . ($sub ? "/$sub" : '');
    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
        responder(['erro' => 'O servidor não conseguiu criar a pasta de dados (storage). Verifique as permissões.'], 500);
    }
    return $dir;
}

function corpo_json(): array {
    // Only JSON bodies: a cross-site HTML form cannot send this content type without the browser asking first.
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) responder(['erro' => 'Requisição inválida.'], 415);
    $raw = file_get_contents('php://input', false, null, 0, 600 * 1024);
    $d = json_decode($raw ?: '', true);
    if (!is_array($d)) responder(['erro' => 'Requisição inválida.'], 400);
    return $d;
}

// Saved data, or the seed file with revision 0 when nothing was saved yet.
function ler_dados(): array {
    if (is_file(DADOS)) {
        $d = json_decode((string) file_get_contents(DADOS), true);
        if (is_array($d)) return $d;
    }
    $d = json_decode((string) file_get_contents(SEED), true);
    $d['_rev'] = 0;
    return $d;
}

// Writes atomically: temp file + rename, so a reader never sees half a file.
function gravar_json(string $arquivo, array $dados): void {
    $tmp = $arquivo . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($tmp, json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)) === false || !rename($tmp, $arquivo)) {
        @unlink($tmp);
        responder(['erro' => 'Não foi possível gravar os dados no servidor.'], 500);
    }
}

function senha_enviada(): string {
    foreach (['HTTP_X_ADMIN_SENHA', 'HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION'] as $k) {
        if (!empty($_SERVER[$k])) return preg_replace('/^Bearer\s+/i', '', (string) $_SERVER[$k]);
    }
    return '';
}

function exigir_admin(): void {
    bloqueado('senha-errada', LIMITE_LOGIN_POR_MINUTO);
    if (ADMIN_PASSWORD === '' || ADMIN_PASSWORD === 'TROQUE-ESTA-SENHA') {
        responder(['erro' => 'Defina a senha do admin no arquivo api/config.php antes de usar o painel.'], 500);
    }
    $dada = senha_enviada();
    if ($dada === '' || !hash_equals(hash('sha256', ADMIN_PASSWORD), hash('sha256', $dada))) {
        contar('senha-errada');
        responder(['erro' => 'Senha incorreta ou sessão expirada. Entre novamente.'], 401);
    }
}

// Fixed one-minute windows per IP, stored in storage/limites.
function arquivo_limite(string $nome): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'desconhecido';
    return pasta('limites') . '/' . $nome . '-' . substr(hash('sha256', $ip), 0, 20) . '.json';
}
// Adds one to this IP's counter for the current minute and returns the new total.
function contar(string $nome): int {
    $janela = intdiv(time(), 60);
    $fp = fopen(arquivo_limite($nome), 'c+');
    if (!$fp) return 0;
    flock($fp, LOCK_EX);
    $d = json_decode(stream_get_contents($fp) ?: '', true) ?: [];
    $n = (($d['j'] ?? 0) === $janela) ? ($d['n'] ?? 0) + 1 : 1;
    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode(['j' => $janela, 'n' => $n]));
    flock($fp, LOCK_UN); fclose($fp);
    return $n;
}
function bloqueado(string $nome, int $max): void {
    $arq = arquivo_limite($nome);
    $d = is_file($arq) ? (json_decode((string) file_get_contents($arq), true) ?: []) : [];
    if (($d['j'] ?? 0) === intdiv(time(), 60) && ($d['n'] ?? 0) >= $max) {
        responder(['erro' => 'Muitas tentativas de senha errada. Aguarde um minuto e tente de novo.'], 429);
    }
}
function limitar(string $nome, int $max): void {
    if (contar($nome) > $max) responder(['erro' => 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.'], 429);
}

function e_chave($s): bool { return is_string($s) && preg_match('/^[A-Za-z0-9_-]{1,24}$/', $s) === 1; }
function texto_ok($s, int $max): bool { return is_string($s) && trim($s) !== '' && mb_strlen($s) <= $max; }
function texto_opc($s, int $max): bool { return $s === null || $s === '' || (is_string($s) && mb_strlen($s) <= $max); }

// Returns an error message, or '' when the document is valid.
function validar(array $d): string {
    $ev = $d['evento'] ?? null;
    if (!is_array($ev) || !texto_opc($ev['aviso'] ?? null, 400) || !texto_opc($ev['popup'] ?? null, 400) || !texto_opc($ev['nome'] ?? null, 80)) {
        return 'Dados do evento inválidos.';
    }
    if (isset($ev['banner'])) {
        $b = $ev['banner'];
        if (!is_array($b) || !is_bool($b['ativo'] ?? null) || !texto_ok($b['texto'] ?? null, 40)
            || !is_string($b['link'] ?? null) || mb_strlen($b['link']) > 300 || !preg_match('#^https://[^\s"<>]+$#i', $b['link'])) {
            return 'Dados do banner inválidos: confira o link (deve começar com https://) e o texto do botão.';
        }
    }
    foreach (['modalidades', 'locais', 'equipes'] as $nome) {
        $col = $d[$nome] ?? null;
        if (!is_array($col) || (array_is_list($col) && count($col) > 0)) return "Lista de $nome inválida.";
        foreach ($col as $k => $v) {
            if (!e_chave((string) $k) || !is_array($v) || !texto_ok($v['nome'] ?? null, 40)) return "Item inválido em $nome: $k.";
            if (!texto_opc($v['destaque'] ?? null, 20) || !texto_opc($v['curto'] ?? null, 12)) return "Item inválido em $nome: $k.";
            if (isset($v['cor']) && !in_array($v['cor'], CORES, true)) return "Cor inválida em $nome: $k.";
            if (isset($v['semNaipe']) && !is_bool($v['semNaipe'])) return "Item inválido em $nome: $k.";
        }
    }
    $jogos = $d['jogos'] ?? null;
    if (!is_array($jogos) || !array_is_list($jogos) || count($jogos) > 2000) return 'Lista de jogos inválida.';
    $ids = [];
    foreach ($jogos as $g) {
        $onde = is_array($g) && isset($g['id']) && is_string($g['id']) ? "jogo {$g['id']}" : 'um jogo';
        if (!is_array($g) || !e_chave($g['id'] ?? null) || isset($ids[$g['id']])) return "Identificador repetido ou inválido em $onde.";
        $ids[$g['id']] = true;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($g['data'] ?? '')) || !preg_match('/^\d{2}:\d{2}$/', (string) ($g['hora'] ?? ''))) return "Data ou horário inválido em $onde.";
        if (!isset($d['locais'][$g['local'] ?? ''])) return "Local inexistente em $onde.";
        if (!isset($d['modalidades'][$g['modalidade'] ?? ''])) return "Modalidade inexistente em $onde.";
        if (!in_array($g['naipe'] ?? '', NAIPES, true)) return "Naipe inválido em $onde.";
        if (isset($g['cor']) && !in_array($g['cor'], CORES, true)) return "Cor inválida em $onde.";
        if (!texto_opc($g['fase'] ?? null, 30)) return "Fase longa demais em $onde.";
        $m = $g['mandante'] ?? ''; $v = $g['visitante'] ?? '';
        if ($m === '' && $v === '') {
            // Teams still unknown (e.g. "Semi 1"): allowed only with a phase name and without a result.
            if (trim((string) ($g['fase'] ?? '')) === '') return "Informe as equipes ou a fase (ex.: Semi 1) em $onde.";
            if ($g['status'] === 'encerrado' || $g['status'] === 'wo') return "Defina as equipes antes de lançar o resultado em $onde.";
        } else {
            if (!isset($d['equipes'][$m]) || !isset($d['equipes'][$v])) return "Equipe inexistente em $onde.";
            if ($m === $v) return "Uma equipe não pode jogar contra si mesma ($onde).";
        }
        if (!in_array($g['status'] ?? '', STATUS, true)) return "Situação inválida em $onde.";
        if (isset($g['placar'])) {
            $p = $g['placar'];
            if (!is_array($p) || count($p) !== 2 || !array_is_list($p)) return "Placar inválido em $onde.";
            foreach ($p as $n) if (!is_int($n) || $n < 0 || $n > 999) return "Placar inválido em $onde.";
        }
        if ($g['status'] === 'encerrado' && !isset($g['placar'])) return "Informe o placar em $onde.";
        if (isset($g['vencedor']) && !in_array($g['vencedor'], ['h', 'a'], true)) return "Vencedor do W.O. inválido em $onde.";
        if ($g['status'] === 'wo' && !isset($g['vencedor']) && !isset($g['placar'])) return "Informe quem compareceu no W.O. em $onde.";
        if (isset($g['parciais'])) {
            if (!is_array($g['parciais']) || count($g['parciais']) > 7) return "Parciais inválidas em $onde.";
            foreach ($g['parciais'] as $p) if (!texto_opc($p, 12)) return "Parciais inválidas em $onde.";
        }
        if (!texto_opc($g['obs'] ?? null, 140)) return "Observação longa demais em $onde.";
    }
    return '';
}

// ---------- torcidômetro: one small file per game, updated under an exclusive lock ----------
function arquivo_votos(string $id): string { return pasta('votos') . "/$id.json"; }

function ler_votos(string $id): array {
    $arq = STORAGE . "/votos/$id.json";
    if (!is_file($arq)) return ['h' => 0, 'a' => 0];
    $d = json_decode((string) file_get_contents($arq), true);
    return ['h' => (int) ($d['h'] ?? 0), 'a' => (int) ($d['a'] ?? 0)];
}

function somar_voto(string $id, string $lado): array {
    $fp = fopen(arquivo_votos($id), 'c+');
    if (!$fp) responder(['erro' => 'Não foi possível registrar o voto.'], 500);
    flock($fp, LOCK_EX);
    $d = json_decode(stream_get_contents($fp) ?: '', true) ?: [];
    $c = ['h' => (int) ($d['h'] ?? 0), 'a' => (int) ($d['a'] ?? 0)];
    $c[$lado]++;
    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($c));
    fflush($fp);
    flock($fp, LOCK_UN); fclose($fp);
    return $c;
}
