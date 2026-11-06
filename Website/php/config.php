<?php
function service_request_config() {
  $configPath = __DIR__ . "/config.json";
  $localPath = __DIR__ . "/config.local.json";
  $config = [];

  if (is_readable($configPath)) {
    $config = json_decode(file_get_contents($configPath), true) ?: [];
  }
  if (is_readable($localPath)) {
    $local = json_decode(file_get_contents($localPath), true) ?: [];
    $config = array_merge($config, $local);
  }

  return $config;
}
