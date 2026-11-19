<?php
header("Content-Type: application/json; charset=utf-8");
header("X-Content-Type-Options: nosniff");
header("Cache-Control: no-store");

require_once __DIR__ . "/config.php";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 8388608;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg" => "jpg",
  "image/png" => "png",
  "image/webp" => "webp",
  "image/gif" => "gif",
];

function json_exit($success, $message, $status = 200) {
  http_response_code($status);
  echo json_encode(["success" => $success, "message" => $message]);
  exit;
}

function sanitize_line($value) {
  $value = trim((string) $value);
  $value = str_replace(["\r", "\n"], " ", $value);
  return $value;
}

function client_ip() {
  return $_SERVER["REMOTE_ADDR"] ?? "unknown";
}

function rate_limit_ok() {
  $file = sys_get_temp_dir() . "/xtrude-service-request-rate.json";
  $ip = client_ip();
  $now = time();
  $window = 3600;
  $maxHits = 8;
  $data = [];

  if (is_readable($file)) {
    $data = json_decode(file_get_contents($file), true) ?: [];
  }

  $hits = array_values(array_filter($data[$ip] ?? [], function ($stamp) use ($now, $window) {
    return ($now - (int) $stamp) < $window;
  }));

  if (count($hits) >= $maxHits) {
    return false;
  }

  $hits[] = $now;
  $data[$ip] = $hits;
  file_put_contents($file, json_encode($data), LOCK_EX);
  return true;
}

function collected_images() {
  $images = [];
  if (!isset($_FILES["images"])) {
    return $images;
  }

  $files = $_FILES["images"];
  $count = is_array($files["name"]) ? count($files["name"]) : 1;

  for ($i = 0; $i < $count; $i++) {
    $error = is_array($files["error"]) ? $files["error"][$i] : $files["error"];
    $tmp = is_array($files["tmp_name"]) ? $files["tmp_name"][$i] : $files["tmp_name"];
    $name = is_array($files["name"]) ? $files["name"][$i] : $files["name"];
    $size = is_array($files["size"]) ? $files["size"][$i] : $files["size"];

    if ($error === UPLOAD_ERR_NO_FILE || $tmp === "") {
      continue;
    }
    if ($error !== UPLOAD_ERR_OK || !is_uploaded_file($tmp)) {
      json_exit(false, "One of the images could not be uploaded. Please try again.", 400);
    }
    if ($size > MAX_IMAGE_BYTES) {
      json_exit(false, "Please keep each image under 8 MB.", 400);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($tmp);
    if (!isset(ALLOWED_IMAGE_TYPES[$mime])) {
      json_exit(false, "Please attach JPG, PNG, WEBP, or GIF images only.", 400);
    }

    $safeName = preg_replace("/[^A-Za-z0-9._-]/", "_", basename((string) $name));
    if ($safeName === "" || strpos($safeName, ".") === false) {
      $safeName = "reference." . ALLOWED_IMAGE_TYPES[$mime];
    }

    $images[] = [
      "tmp" => $tmp,
      "name" => $safeName,
      "mime" => $mime,
    ];
  }

  if (count($images) > MAX_IMAGES) {
    json_exit(false, "You can attach up to " . MAX_IMAGES . " images.", 400);
  }

  return $images;
}

function curl_json($url, $payload) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
  ]);
  $body = curl_exec($ch);
  $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $error = curl_error($ch);
  curl_close($ch);
  return [$status, $body, $error];
}

function send_whatsapp_text($config, $chatId, $message) {
  $url = rtrim($config["greenApiUrl"], "/")
    . "/waInstance" . $config["greenApiIdInstance"]
    . "/sendMessage/" . $config["greenApiToken"];
  return curl_json($url, ["chatId" => $chatId, "message" => $message]);
}

function send_whatsapp_image($config, $chatId, $image, $caption = "") {
  $url = rtrim($config["greenApiMediaUrl"], "/")
    . "/waInstance" . $config["greenApiIdInstance"]
    . "/sendFileByUpload/" . $config["greenApiToken"];

  $fields = [
    "chatId" => $chatId,
    "fileName" => $image["name"],
    "file" => new CURLFile($image["tmp"], $image["mime"], $image["name"]),
  ];
  if ($caption !== "") {
    $fields["caption"] = $caption;
  }

  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $fields,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 60,
  ]);
  $body = curl_exec($ch);
  $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $error = curl_error($ch);
  curl_close($ch);
  return [$status, $body, $error];
}

function green_api_configured($config) {
  return !empty($config["greenApiIdInstance"])
    && !empty($config["greenApiToken"])
    && !empty($config["greenApiUrl"])
    && !empty($config["greenApiMediaUrl"]);
}

function whatsapp_configured($config) {
  return green_api_configured($config) && !empty($config["whatsappTo"]);
}

function normalize_whatsapp_phone($value) {
  $digits = preg_replace("/\D+/", "", (string) $value);
  if (strpos($digits, "00") === 0) {
    $digits = substr($digits, 2);
  }
  if (strlen($digits) === 11 && strpos($digits, "0") === 0) {
    $digits = substr($digits, 1);
  }
  if (strlen($digits) === 10) {
    $digits = "91" . $digits;
  }
  $length = strlen($digits);
  if ($length >= 11 && $length <= 15) {
    return $digits;
  }
  return "";
}

function smtp_configured($config) {
  return !empty($config["smtpHost"])
    && !empty($config["smtpUser"])
    && !empty($config["smtpPassword"])
    && !empty($config["adminEmail"]);
}

function smtp_read($fp) {
  $data = "";
  while (($line = fgets($fp, 515)) !== false) {
    $data .= $line;
    if (isset($line[3]) && $line[3] === " ") {
      break;
    }
  }
  return $data;
}

function smtp_cmd($fp, $cmd) {
  fwrite($fp, $cmd . "\r\n");
  return smtp_read($fp);
}

function send_smtp_email($config, $subject, $message, $replyTo = "") {
  $host = trim((string) ($config["smtpHost"] ?? ""));
  $user = trim((string) ($config["smtpUser"] ?? ""));
  $pass = (string) ($config["smtpPassword"] ?? "");
  $port = (int) ($config["smtpPort"] ?? 587);
  $from = trim((string) ($config["smtpFrom"] ?? $config["adminEmail"] ?? ""));
  $to = trim((string) ($config["adminEmail"] ?? ""));
  if ($host === "" || $user === "" || $pass === "" || $from === "" || $to === "") {
    return false;
  }

  $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";
  $headers = "From: XtrudeInc <$from>\r\n";
  $headers .= "To: <$to>\r\n";
  if ($replyTo !== "" && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
    $headers .= "Reply-To: <$replyTo>\r\n";
  }
  $headers .= "Date: " . gmdate("D, d M Y H:i:s") . " +0000\r\n";
  $headers .= "MIME-Version: 1.0\r\n";
  $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
  $headers .= "Content-Transfer-Encoding: 8bit\r\n";
  $payload = $headers . "Subject: $encodedSubject\r\n\r\n" . $message . "\r\n";

  $remote = ($port === 465 ? "ssl://" : "tcp://") . $host . ":" . $port;
  $fp = @stream_socket_client($remote, $errno, $errstr, 30, STREAM_CLIENT_CONNECT);
  if (!$fp) {
    return false;
  }

  stream_set_timeout($fp, 30);
  smtp_read($fp);
  smtp_cmd($fp, "EHLO xtrudeinc.com");
  if ($port !== 465) {
    $tls = smtp_cmd($fp, "STARTTLS");
    if (strpos($tls, "220") !== 0) {
      fclose($fp);
      return false;
    }
    if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
      fclose($fp);
      return false;
    }
    smtp_cmd($fp, "EHLO xtrudeinc.com");
  }

  smtp_cmd($fp, "AUTH LOGIN");
  smtp_cmd($fp, base64_encode($user));
  $auth = smtp_cmd($fp, base64_encode($pass));
  if (strpos($auth, "235") !== 0) {
    fclose($fp);
    return false;
  }

  smtp_cmd($fp, "MAIL FROM:<$from>");
  smtp_cmd($fp, "RCPT TO:<$to>");
  $data = smtp_cmd($fp, "DATA");
  if (strpos($data, "354") !== 0) {
    fclose($fp);
    return false;
  }

  fwrite($fp, str_replace("\n.", "\n..", $payload) . ".\r\n");
  $ok = smtp_read($fp);
  smtp_cmd($fp, "QUIT");
  fclose($fp);
  return strpos($ok, "250") === 0;
}

function send_email_copy($config, $subject, $message, $images, $replyTo = "") {
  $to = $config["adminEmail"] ?? "";
  $from = trim((string) ($config["smtpFrom"] ?? $to));
  if ($to === "" || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    return false;
  }

  if (smtp_configured($config) && send_smtp_email($config, $subject, $message, $replyTo)) {
    return true;
  }

  $boundary = "=_xtrude_" . bin2hex(random_bytes(12));
  $headers = "From: XtrudeInc <$from>\r\n";
  if ($replyTo !== "" && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
    $headers .= "Reply-To: <$replyTo>\r\n";
  }
  $headers .= "MIME-Version: 1.0\r\n";
  $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";

  $body = "--$boundary\r\n";
  $body .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
  $body .= $message . "\r\n";

  foreach ($images as $image) {
    $data = chunk_split(base64_encode(file_get_contents($image["tmp"])));
    $body .= "--$boundary\r\n";
    $body .= "Content-Type: " . $image["mime"] . "; name=\"" . $image["name"] . "\"\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n";
    $body .= "Content-Disposition: attachment; filename=\"" . $image["name"] . "\"\r\n\r\n";
    $body .= $data . "\r\n";
  }
  $body .= "--$boundary--\r\n";

  return @mail($to, $subject, $body, $headers);
}

if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") {
  json_exit(false, "Invalid request.", 405);
}

if (!rate_limit_ok()) {
  json_exit(false, "Too many requests. Please try again later.", 429);
}

$config = service_request_config();
$name = sanitize_line($_POST["name"] ?? "");
$email = sanitize_line($_POST["email"] ?? "");
$phone = sanitize_line($_POST["phone"] ?? "");
$service = sanitize_line($_POST["service"] ?? "");
$business = sanitize_line($_POST["business"] ?? "");
$requirement = trim((string) ($_POST["requirement"] ?? ""));

$visitorPhone = normalize_whatsapp_phone($phone);

if ($name === "" || $email === "" || $requirement === "") {
  json_exit(false, "Please fill in your name, email, and requirements.", 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  json_exit(false, "Please enter a valid email address.", 400);
}

if ($visitorPhone === "") {
  json_exit(false, "Please enter a valid WhatsApp number.", 400);
}

if (strlen($name) > 120 || strlen($email) > 160 || strlen($phone) > 40 || strlen($service) > 160 || strlen($business) > 160 || strlen($requirement) > 4000) {
  json_exit(false, "Please shorten your request and try again.", 400);
}

$images = collected_images();
$imageNames = count($images)
  ? implode(", ", array_column($images, "name"))
  : "None";
$businessLabel = $business !== "" ? $business : "None";
$date = (new DateTime("now", new DateTimeZone("Asia/Kolkata")))->format("j F Y");

$emailBody = "A visitor submitted a service enquiry.\n\n"
  . "Name: $name\n"
  . "Email: $email\n"
  . "Phone / WhatsApp: $phone\n"
  . "Service: " . ($service !== "" ? $service : "Not specified") . "\n\n"
  . "Requirements:\n"
  . "$requirement\n\n"
  . "Date: $date";

$whatsappMessage = "New service enquiry from $name.\n"
  . "Service: " . ($service !== "" ? $service : "Not specified") . "\n"
  . "Please check your email for the full details.";
$visitorMessage = "Thank you! We've received your message.\n\n"
  . "Here's what you sent us:\n"
  . $requirement;

$whatsappOk = false;
$visitorOk = false;
$emailOk = send_email_copy(
  $config,
  "New service enquiry from $name",
  $emailBody,
  $images,
  $email
);

if (green_api_configured($config)) {
  if (whatsapp_configured($config)) {
    $whatsappTo = normalize_whatsapp_phone((string) $config["whatsappTo"]);
    if ($whatsappTo !== "") {
      list($status, $body, $error) = send_whatsapp_text($config, $whatsappTo . "@c.us", $whatsappMessage);
      $whatsappOk = $status >= 200 && $status < 300 && $error === "";
    }
  }
  list($visitorStatus, $visitorBody, $visitorError) = send_whatsapp_text(
    $config,
    $visitorPhone . "@c.us",
    $visitorMessage
  );
  $visitorOk = $visitorStatus >= 200 && $visitorStatus < 300 && $visitorError === "";
}

if ($whatsappOk || $emailOk || $visitorOk) {
  json_exit(true, "Request sent. Check your email for the full enquiry.");
}

if (!green_api_configured($config) && !smtp_configured($config)) {
  json_exit(false, "The services form is not connected yet. Please email sai.prakhya@xtrudeinc.com.", 503);
}

json_exit(false, "Could not send your request. Please try again or email sai.prakhya@xtrudeinc.com.", 502);
