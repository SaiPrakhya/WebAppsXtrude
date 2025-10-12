<?php
header("Content-Type: application/json");
require_once "config.php";

function sanitize($data) {
  return htmlspecialchars(stripslashes(trim($data)));
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $name = sanitize($_POST["name"] ?? "");
  $email = sanitize($_POST["email"] ?? "");
  $subject = sanitize($_POST["subject"] ?? "");
  $message = sanitize($_POST["message"] ?? "");

  if (empty($name) || empty($email) || empty($subject) || empty($message)) {
    echo json_encode(["success" => false, "message" => "All fields are required."]);
    exit;
  }

  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["success" => false, "message" => "Invalid email address."]);
    exit;
  }

  $subjectMap = [
    "custom-order" => "Custom Order Request",
    "complaint" => "Complaint",
    "job-application" => "Job Application",
    "general" => "General Inquiry"
  ];
  $subjectText = $subjectMap[$subject] ?? "Contact Form Submission";

  $to = ADMIN_EMAIL;
  $emailSubject = "[$subjectText] from $name";
  $emailBody = "You received a new message:\n\n".
               "Name: $name\n".
               "Email: $email\n".
               "Subject: $subjectText\n".
               "Message:\n$message\n";

  $headers = "From: $email\r\n";
  $headers .= "Reply-To: $email\r\n";

  if (mail($to, $emailSubject, $emailBody, $headers)) {
    echo json_encode(["success" => true, "message" => "Message sent successfully."]);
  } else {
    echo json_encode(["success" => false, "message" => "Failed to send message. Please try again later."]);
  }
} else {
  echo json_encode(["success" => false, "message" => "Invalid request method."]);
}