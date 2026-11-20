#!/usr/bin/env python3
"""Local preview server that emails service enquiries and pings WhatsApp."""

from __future__ import annotations

import json
import mimetypes
import os
import re
import smtplib
import ssl
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from html import escape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

ROOT = Path(__file__).resolve().parent
PHP_DIR = ROOT / "php"
CONFIG_PATH = PHP_DIR / "config.json"
LOCAL_CONFIG_PATH = PHP_DIR / "config.local.json"
MAX_IMAGES = 5
MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
RATE_FILE = Path(tempfile.gettempdir()) / "xtrude-service-request-rate.json"
CTX = ssl.create_default_context()
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
VISITOR_WHATSAPP = (
    "Your message has been sent!\n"
    "\n"
    "Thank you for contacting XtrudeInc, we will reach out to you once we are available."
)
ENV_KEYS = {
    "SMTP_HOST": "smtpHost",
    "SMTP_PORT": "smtpPort",
    "SMTP_USER": "smtpUser",
    "SMTP_PASSWORD": "smtpPassword",
    "SMTP_FROM": "smtpFrom",
    "GREEN_API_ID_INSTANCE": "greenApiIdInstance",
    "GREEN_API_TOKEN": "greenApiToken",
}


def load_config() -> dict:
    config = {}
    if CONFIG_PATH.is_file():
        config.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
    if LOCAL_CONFIG_PATH.is_file():
        config.update(json.loads(LOCAL_CONFIG_PATH.read_text(encoding="utf-8")))
    for env_key, config_key in ENV_KEYS.items():
        value = os.environ.get(env_key, "").strip()
        if value:
            config[config_key] = value
    return config


def green_api_configured(config: dict) -> bool:
    return all(
        str(config.get(key, "")).strip()
        for key in (
            "greenApiIdInstance",
            "greenApiToken",
            "greenApiUrl",
            "greenApiMediaUrl",
        )
    )


def whatsapp_configured(config: dict) -> bool:
    return green_api_configured(config) and bool(str(config.get("whatsappTo", "")).strip())


def normalize_whatsapp_phone(value: str) -> str:
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 10:
        digits = "91" + digits
    if 11 <= len(digits) <= 15:
        return digits
    return ""


def smtp_configured(config: dict) -> bool:
    return all(
        str(config.get(key, "")).strip()
        for key in ("smtpHost", "smtpUser", "smtpPassword", "adminEmail")
    )


def rate_limit_ok(ip: str) -> bool:
    now = time.time()
    data = {}
    if RATE_FILE.is_file():
        try:
            data = json.loads(RATE_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
    hits = [stamp for stamp in data.get(ip, []) if now - float(stamp) < 3600]
    if len(hits) >= 8:
        return False
    hits.append(now)
    data[ip] = hits
    RATE_FILE.write_text(json.dumps(data), encoding="utf-8")
    return True


def parse_multipart(handler: SimpleHTTPRequestHandler) -> tuple[dict[str, str], list[dict]]:
    content_type = handler.headers.get("Content-Type", "")
    length = int(handler.headers.get("Content-Length", "0") or 0)
    raw = handler.rfile.read(length) if length else b""

    if "multipart/form-data" not in content_type:
        charset = "utf-8"
        fields = parse_qs(raw.decode(charset), keep_blank_values=True)
        return {key: values[0] if values else "" for key, values in fields.items()}, []

    boundary_key = "boundary="
    if boundary_key not in content_type:
        return {}, []
    boundary = content_type.split(boundary_key, 1)[1].strip().strip('"').encode("utf-8")
    parts = raw.split(b"--" + boundary)
    fields: dict[str, str] = {}
    images: list[dict] = []

    for part in parts:
        if not part or part in (b"--\r\n", b"--", b"--\n"):
            continue
        if part.startswith(b"--"):
            continue
        header_blob, _, body = part.partition(b"\r\n\r\n")
        if body.endswith(b"\r\n"):
            body = body[:-2]
        headers = header_blob.decode("utf-8", errors="replace")
        disposition = ""
        part_type = "application/octet-stream"
        for line in headers.split("\r\n"):
            lower = line.lower()
            if lower.startswith("content-disposition:"):
                disposition = line
            if lower.startswith("content-type:"):
                part_type = line.split(":", 1)[1].strip()

        name = ""
        filename = ""
        for item in disposition.split(";"):
            item = item.strip()
            if item.startswith("name="):
                name = item.split("=", 1)[1].strip().strip('"')
            if item.startswith("filename="):
                filename = item.split("=", 1)[1].strip().strip('"')

        if filename:
            if not body:
                continue
            images.append(
                {
                    "name": filename,
                    "mime": part_type,
                    "data": body,
                }
            )
        elif name:
            fields[name] = body.decode("utf-8", errors="replace")

    return fields, images


def json_post(url: str, payload: dict) -> tuple[int, str]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, context=CTX, timeout=30) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", errors="replace")


def send_file(url: str, chat_id: str, image: dict, caption: str = "") -> tuple[int, str]:
    boundary = "----xtrudeServiceBoundary"
    filename = image["name"] or "reference.jpg"
    mime = image["mime"] or "application/octet-stream"
    chunks = [
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"chatId\"\r\n\r\n{chat_id}\r\n".encode(),
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"fileName\"\r\n\r\n{filename}\r\n".encode(),
        (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {mime}\r\n\r\n"
        ).encode()
        + image["data"]
        + b"\r\n",
    ]
    if caption:
        chunks.insert(
            1,
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"caption\"\r\n\r\n{caption}\r\n".encode(),
        )
    chunks.append(f"--{boundary}--\r\n".encode())
    body = b"".join(chunks)
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, context=CTX, timeout=60) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8", errors="replace")


def send_whatsapp_to(
    config: dict,
    phone: str,
    message: str,
    images: list[dict] | None = None,
) -> bool:
    chat_id = f"{phone}@c.us"
    text_url = (
        f"{config['greenApiUrl'].rstrip('/')}/waInstance{config['greenApiIdInstance']}"
        f"/sendMessage/{config['greenApiToken']}"
    )
    status, _ = json_post(text_url, {"chatId": chat_id, "message": message})
    if status < 200 or status >= 300:
        return False

    if not images:
        return True

    file_url = (
        f"{config['greenApiMediaUrl'].rstrip('/')}/waInstance{config['greenApiIdInstance']}"
        f"/sendFileByUpload/{config['greenApiToken']}"
    )
    for image in images:
        status, _ = send_file(file_url, chat_id, image)
        if status < 200 or status >= 300:
            return False
    return True


def send_whatsapp(config: dict, message: str, images: list[dict] | None = None) -> bool:
    phone = normalize_whatsapp_phone(str(config.get("whatsappTo", "")))
    if not phone:
        return False
    return send_whatsapp_to(config, phone, message, images)


def send_email(
    config: dict,
    subject: str,
    body: str,
    reply_to: str = "",
    images: list[dict] | None = None,
    html_body: str = "",
) -> bool:
    to_addr = str(config.get("adminEmail", "")).strip()
    from_addr = str(config.get("smtpFrom") or to_addr).strip()
    host = str(config.get("smtpHost", "")).strip()
    user = str(config.get("smtpUser", "")).strip()
    password = str(config.get("smtpPassword", "")).strip()
    port = int(config.get("smtpPort") or 587)

    if not (to_addr and from_addr and host and user and password):
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"XtrudeInc <{from_addr}>"
    message["To"] = to_addr
    if reply_to and EMAIL_RE.match(reply_to):
        message["Reply-To"] = reply_to
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    for image in images or []:
        mime = image.get("mime") or "application/octet-stream"
        maintype, _, subtype = mime.partition("/")
        message.add_attachment(
            image["data"],
            maintype=maintype or "application",
            subtype=subtype or "octet-stream",
            filename=image.get("name") or "reference",
        )

    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=30, context=CTX) as smtp:
            smtp.login(user, password)
            smtp.send_message(message)
        return True

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.ehlo()
        smtp.starttls(context=CTX)
        smtp.ehlo()
        smtp.login(user, password)
        smtp.send_message(message)
    return True


def combine_services(service: str, service_other: str) -> str:
    other = service_other.strip()
    labels: list[str] = []
    for part in service.split(","):
        choice = part.strip()
        if not choice:
            continue
        if choice.lower() == "other":
            labels.append(other or "Other")
        elif choice not in labels:
            labels.append(choice)
    if other and other not in labels and "Other" not in [part.strip() for part in service.split(",")]:
        labels.append(other)
    return ", ".join(labels)


def project_enquiry_subject(service: str, organization: str) -> str:
    company = organization or "Not specified"
    services = [part.strip() for part in service.split(",") if part.strip()]
    kind = services[0] if len(services) == 1 else "New Project Enquiry"
    return f"{kind} | XtrudeInc | {company}"


def specified(value: str, empty: str = "Not specified") -> str:
    return value.strip() or empty


def project_enquiry_plain(
    name: str,
    email: str,
    phone: str,
    organization: str,
    website: str,
    linkedin: str,
    socials: str,
    service: str,
    description: str,
    timeline: str,
    file_names: str,
) -> str:
    company = specified(organization)
    when = specified(timeline, "To be discussed.")
    return (
        "New Project Enquiry\n"
        "Website Submission\n"
        "\n"
        "Contact information\n"
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Contact Number: {specified(phone)}\n"
        f"Organisation or Company Name: {company}\n"
        f"Website Link: {specified(website)}\n"
        f"LinkedIn: {specified(linkedin)}\n"
        f"Other socials: {specified(socials)}\n"
        "\n"
        "Project information:\n"
        f"Service requested: {specified(service)}\n"
        f"Project description: {description}\n"
        f"Expected timeline: {when}\n"
        "\n"
        "Additional information\n"
        f"Reference files: {file_names}\n"
        "Reply directly to the sender to initiate discussions."
    )


def project_enquiry_html(
    name: str,
    email: str,
    phone: str,
    organization: str,
    website: str,
    linkedin: str,
    socials: str,
    service: str,
    description: str,
    timeline: str,
    file_names: str,
) -> str:
    desc = escape(description).replace("\n", "<br>")
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#111111;">'
        '<p style="margin:0;"><strong>New Project Enquiry</strong></p>'
        '<p style="margin:0;"><strong>Website Submission</strong></p>'
        '<p style="margin:16px 0 0 0;"><strong>Contact information</strong></p>'
        f'<p style="margin:0;">Name: {escape(name)}</p>'
        f'<p style="margin:0;">Email: {escape(email)}</p>'
        f'<p style="margin:0;">Contact Number: {escape(specified(phone))}</p>'
        f'<p style="margin:0;">Organisation or Company Name: {escape(specified(organization))}</p>'
        f'<p style="margin:0;">Website Link: {escape(specified(website))}</p>'
        f'<p style="margin:0;">LinkedIn: {escape(specified(linkedin))}</p>'
        f'<p style="margin:0;">Other socials: {escape(specified(socials))}</p>'
        '<p style="margin:16px 0 0 0;"><strong>Project information:</strong></p>'
        f'<p style="margin:0;">Service requested: {escape(specified(service))}</p>'
        f'<p style="margin:0;"><strong>Project description:</strong> {desc}</p>'
        f'<p style="margin:0;"><strong>Expected timeline:</strong> {escape(specified(timeline, "To be discussed."))}</p>'
        '<p style="margin:16px 0 0 0;"><strong>Additional information</strong></p>'
        f'<p style="margin:0;">Reference files: {escape(file_names)}</p>'
        '<p style="margin:0;">Reply directly to the sender to initiate discussions.</p>'
        "</div>"
    )


def prepare_images(images: list[dict]) -> tuple[list[dict] | None, str]:
    if len(images) > MAX_IMAGES:
        return None, "You can attach up to 5 images."
    cleaned = []
    for image in images:
        mime = image["mime"]
        guessed, _ = mimetypes.guess_type(image["name"])
        if mime not in ALLOWED_TYPES:
            mime = guessed or ""
        if mime not in ALLOWED_TYPES:
            return None, "Please attach JPG, PNG, WEBP, or GIF images only."
        if len(image["data"]) > MAX_IMAGE_BYTES:
            return None, "Please keep each image under 8 MB."
        safe = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in os.path.basename(image["name"]))
        if "." not in safe:
            safe = f"reference.{ALLOWED_TYPES[mime]}"
        image["name"] = safe
        image["mime"] = mime
        cleaned.append(image)
    return cleaned, ""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.startswith("/php/"):
            self.send_error(403, "Forbidden")
            return
        super().do_GET()

    def do_POST(self):
        try:
            self.handle_service_request()
        except Exception:
            import traceback
            traceback.print_exc()
            try:
                self.json_response(
                    500,
                    False,
                    "Could not send your request. Please try again or email sai.prakhya@xtrudeinc.com.",
                )
            except Exception:
                traceback.print_exc()

    def handle_collaboration_request(self, fields: dict[str, str], images: list[dict]) -> None:
        name = (fields.get("name") or "").replace("\r", " ").replace("\n", " ").strip()
        email = (fields.get("email") or "").replace("\r", " ").replace("\n", " ").strip()
        phone = (fields.get("phone") or "").replace("\r", " ").replace("\n", " ").strip()
        organization = (fields.get("organization") or "").replace("\r", " ").replace("\n", " ").strip()
        website = (fields.get("website") or "").replace("\r", " ").replace("\n", " ").strip()
        linkedin = (fields.get("linkedin") or "").replace("\r", " ").replace("\n", " ").strip()
        socials = (fields.get("socials") or "").replace("\r", " ").replace("\n", " ").strip()
        message = (fields.get("message") or "").strip()
        timeline = (fields.get("timeline") or "").replace("\r", " ").replace("\n", " ").strip()
        service_other = (fields.get("serviceOther") or "").replace("\r", " ").replace("\n", " ").strip()
        service = combine_services(
            (fields.get("service") or "").replace("\r", " ").replace("\n", " ").strip(),
            service_other,
        )

        if not name or not email or not message:
            self.json_response(400, False, "Please fill in your name, email, and project description.")
            return
        if not EMAIL_RE.match(email):
            self.json_response(400, False, "Please enter a valid email address.")
            return
        if not service:
            self.json_response(400, False, "Please choose a service, or describe it under Other.")
            return
        if (
            len(name) > 120
            or len(email) > 160
            or len(phone) > 40
            or len(organization) > 160
            or len(website) > 200
            or len(linkedin) > 200
            or len(socials) > 400
            or len(service) > 400
            or len(service_other) > 160
            or len(timeline) > 160
            or len(message) > 4000
        ):
            self.json_response(400, False, "Please shorten your request and try again.")
            return

        cleaned, image_error = prepare_images(images)
        if image_error:
            self.json_response(400, False, image_error)
            return

        file_names = (
            ", ".join(item["name"] for item in cleaned)
            if cleaned
            else "Please add reference images in the redirected email."
        )
        subject = project_enquiry_subject(service, organization)
        email_args = (
            name,
            email,
            phone,
            organization,
            website,
            linkedin,
            socials,
            service,
            message,
            timeline,
            file_names,
        )
        email_body = project_enquiry_plain(*email_args)
        email_html = project_enquiry_html(*email_args)

        config = load_config()
        email_ok = False
        visitor_ok = False
        visitor_phone = normalize_whatsapp_phone(phone)
        if smtp_configured(config):
            try:
                email_ok = send_email(
                    config,
                    subject,
                    email_body,
                    reply_to=email,
                    images=cleaned,
                    html_body=email_html,
                )
            except Exception:
                import traceback
                traceback.print_exc()
                email_ok = False

        if email_ok and green_api_configured(config) and visitor_phone:
            try:
                visitor_ok = send_whatsapp_to(config, visitor_phone, VISITOR_WHATSAPP)
            except Exception:
                import traceback
                traceback.print_exc()
                visitor_ok = False

        print(
            f"collaboration-request name={name!r} subject={subject!r} "
            f"email_ok={email_ok} visitor_ok={visitor_ok} "
            f"smtp={smtp_configured(config)} green={green_api_configured(config)}",
            flush=True,
        )

        if email_ok:
            self.json_response(200, True, "Enquiry sent.")
            return
        if not smtp_configured(config):
            self.json_response(
                503,
                False,
                "The contact form is not connected yet. Please email sai.prakhya@xtrudeinc.com.",
            )
            return
        self.json_response(
            502,
            False,
            "Could not send your enquiry. Please try again or email sai.prakhya@xtrudeinc.com.",
        )

    def handle_service_request(self):
        path = self.path.split("?", 1)[0]
        if path not in ("/php/send-service-request.php", "/api/service-request"):
            self.send_error(404, "Not found")
            return

        ip = self.client_address[0]
        if not rate_limit_ok(ip):
            self.json_response(429, False, "Too many requests. Please try again later.")
            return

        fields, images = parse_multipart(self)
        kind = (fields.get("kind") or "").replace("\r", " ").replace("\n", " ").strip()
        if kind == "collaboration":
            self.handle_collaboration_request(fields, images)
            return

        name = (fields.get("name") or "").replace("\r", " ").replace("\n", " ").strip()
        email = (fields.get("email") or "").replace("\r", " ").replace("\n", " ").strip()
        phone = (fields.get("phone") or "").replace("\r", " ").replace("\n", " ").strip()
        service = (fields.get("service") or "").replace("\r", " ").replace("\n", " ").strip()
        business = (fields.get("business") or "").replace("\r", " ").replace("\n", " ").strip()
        requirement = (fields.get("requirement") or "").strip()

        visitor_phone = normalize_whatsapp_phone(phone)

        if not name or not email or not requirement:
            self.json_response(400, False, "Please fill in your name, email, and requirements.")
            return
        if not EMAIL_RE.match(email):
            self.json_response(400, False, "Please enter a valid email address.")
            return
        if not visitor_phone:
            self.json_response(400, False, "Please enter a valid WhatsApp number.")
            return
        if len(name) > 120 or len(email) > 160 or len(phone) > 40 or len(service) > 160 or len(business) > 160 or len(requirement) > 4000:
            self.json_response(400, False, "Please shorten your request and try again.")
            return
        cleaned, image_error = prepare_images(images)
        if image_error:
            self.json_response(400, False, image_error)
            return

        image_names = ", ".join(item["name"] for item in cleaned) if cleaned else "None"
        india = timezone(timedelta(hours=5, minutes=30))
        date = datetime.now(india).strftime("%d %B %Y").lstrip("0")
        email_body = (
            "A visitor submitted a service enquiry.\n\n"
            f"Name: {name}\n"
            f"Email: {email}\n"
            f"Phone / WhatsApp: {phone}\n"
            f"Service: {service or 'Not specified'}\n\n"
            "Requirements:\n"
            f"{requirement}\n\n"
            f"Date: {date}"
        )
        whatsapp_message = (
            f"New service enquiry from {name}.\n"
            f"Service: {service or 'Not specified'}\n"
            "Please check your email for the full details."
        )
        visitor_message = (
            "Thank you! We've received your message.\n\n"
            "Here's what you sent us:\n"
            f"{requirement}"
        )

        config = load_config()
        email_ok = False
        whatsapp_ok = False
        visitor_ok = False

        if smtp_configured(config):
            try:
                email_ok = send_email(
                    config,
                    f"New service enquiry from {name}",
                    email_body,
                    reply_to=email,
                    images=cleaned,
                )
            except Exception:
                import traceback
                traceback.print_exc()
                email_ok = False

        if green_api_configured(config):
            if whatsapp_configured(config):
                try:
                    whatsapp_ok = send_whatsapp(config, whatsapp_message)
                except Exception:
                    import traceback
                    traceback.print_exc()
                    whatsapp_ok = False
            try:
                visitor_ok = send_whatsapp_to(config, visitor_phone, visitor_message)
            except Exception:
                import traceback
                traceback.print_exc()
                visitor_ok = False

        print(
            f"service-request name={name!r} email_ok={email_ok} "
            f"whatsapp_ok={whatsapp_ok} visitor_ok={visitor_ok} "
            f"smtp={smtp_configured(config)} green={green_api_configured(config)}",
            flush=True,
        )

        if email_ok or whatsapp_ok or visitor_ok:
            self.json_response(200, True, "Request sent. Check your email for the full enquiry.")
            return
        if not smtp_configured(config) and not green_api_configured(config):
            self.json_response(
                503,
                False,
                "The services form is not connected yet. Please email sai.prakhya@xtrudeinc.com.",
            )
            return
        self.json_response(
            502,
            False,
            "Could not send your request. Please try again or email sai.prakhya@xtrudeinc.com.",
        )

    def json_response(self, status: int, success: bool, message: str) -> None:
        payload = json.dumps({"success": success, "message": message}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args) -> None:
        super().log_message(format, *args)


def main() -> None:
    port = int(os.environ.get("PORT", "8771"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Serving XtrudeInc on http://127.0.0.1:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
