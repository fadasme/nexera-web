<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Metodo no permitido.']);
    exit;
}

function clean_value($value) {
    $value = trim((string) $value);
    $value = str_replace(["\r", "\n"], ' ', $value);
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

$nombre = clean_value($_POST['nombre'] ?? '');
$empresa = clean_value($_POST['empresa'] ?? '');
$correo = filter_var(trim((string) ($_POST['correo'] ?? '')), FILTER_VALIDATE_EMAIL);
$telefono = clean_value($_POST['telefono'] ?? '');
$tamano = clean_value($_POST['tamano'] ?? '');
$servicio = clean_value($_POST['servicio'] ?? '');
$mensaje = trim((string) ($_POST['mensaje'] ?? ''));

if ($nombre === '' || $empresa === '' || !$correo || $servicio === '' || $mensaje === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'Completa los campos obligatorios.']);
    exit;
}

if (strlen($mensaje) > 3000) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'message' => 'El mensaje es demasiado largo.']);
    exit;
}

$destino = 'contacto@nexera.cl';
$asunto = 'Nuevo contacto desde Nexera';
$mensajeSeguro = htmlspecialchars($mensaje, ENT_QUOTES, 'UTF-8');

$body = "Nuevo mensaje desde el sitio web de Nexera:\n\n";
$body .= "Nombre: {$nombre}\n";
$body .= "Empresa: {$empresa}\n";
$body .= "Correo: {$correo}\n";
$body .= "Telefono: {$telefono}\n\n";
$body .= "Tamano aproximado: {$tamano}\n";
$body .= "Servicio de interes: {$servicio}\n\n";
$body .= "Mensaje:\n{$mensajeSeguro}\n";

$headers = [
    'From: Nexera Web <contacto@nexera.cl>',
    'Reply-To: ' . $correo,
    'Content-Type: text/plain; charset=UTF-8',
    'X-Mailer: PHP/' . phpversion(),
];

$sent = mail($destino, $asunto, $body, implode("\r\n", $headers));

if (!$sent) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'No fue posible enviar el correo.']);
    exit;
}

echo json_encode(['ok' => true, 'message' => 'Mensaje enviado correctamente.']);
