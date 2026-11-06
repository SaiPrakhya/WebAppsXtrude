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

function whatsapp_configured($config) {
  return !empty($config["greenApiIdInstance"])
    && !empty($config["greenApiToken"])
    && !empty($config["greenApiUrl"])
    && !empty($config["greenApiMediaUrl"])
    && !empty($config["whatsappTo"]);
}

function send_email_copy($config, $subject, $message, $images) {
  $to = $config["adminEmail"] ?? "";
  if ($to === "" || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    return false;
  }

  $boundary = "=_xtrude_" . bin2hex(random_bytes(12));
  $headers = "From: XtrudeInc Services <noreply@xtrudeinc.com>\r\n";
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
$business = sanitize_line($_POST["business"] ?? "");
$requirement = trim((string) ($_POST["requirement"] ?? ""));

if ($name === "" || $requirement === "") {
  json_exit(false, "Please fill in your name and requirements.", 400);
}

if (strlen($name) > 120 || strlen($business) > 160 || strlen($requirement) > 4000) {
  json_exit(false, "Please shorten your request and try again.", 400);
}

$images = collected_images();
$imageNames = count($images)
  ? implode(", ", array_column($images, "name"))
  : "None";
$businessLabel = $business !== "" ? $business : "None";
$date = (new DateTime("now", new DateTimeZone("Asia/Kolkata")))->format("j F Y");

$message = "Name: $name\n"
  . "Business name: $businessLabel\n"
  . "Requirement: $requirement\n"
  . "Images: $imageNames\n"
  . "Date: $date";

$whatsappOk = false;
$emailOk = send_email_copy($config, "XtrudeInc services application from $name", $message, $images);

if (whatsapp_configured($config)) {
  $phone = preg_replace("/\D+/", "", (string) $config["whatsappTo"]);
  $chatId = $phone . "@c.us";
  list($status, $body, $error) = send_whatsapp_text($config, $chatId, $message);
  $whatsappOk = $status >= 200 && $status < 300 && $error === "";

  if ($whatsappOk) {
    foreach ($images as $image) {
      list($imgStatus, $imgBody, $imgError) = send_whatsapp_image($config, $chatId, $image);
      if ($imgStatus < 200 || $imgStatus >= 300 || $imgError !== "") {
        $whatsappOk = false;
        break;
      }
    }
  }
}

if ($whatsappOk) {
  json_exit(true, "Request sent.");
}

if ($emailOk) {
  json_exit(true, "Request sent.");
}

if (!whatsapp_configured($config)) {
  json_exit(false, "The services form is not connected yet. Please email sai.prakhya@xtrudeinc.com.", 503);
}

json_exit(false, "Could not send your request. Please try again or email sai.prakhya@xtrudeinc.com.", 502);
