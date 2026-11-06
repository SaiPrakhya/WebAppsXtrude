#!/usr/bin/env python3
"""Local preview server that also posts services requests to WhatsApp."""

from __future__ import annotations

import json
import mimetypes
import os
import ssl
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
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


def load_config() -> dict:
    config = {}
    if CONFIG_PATH.is_file():
        config.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
    if LOCAL_CONFIG_PATH.is_file():
        config.update(json.loads(LOCAL_CONFIG_PATH.read_text(encoding="utf-8")))
    return config


def whatsapp_configured(config: dict) -> bool:
    return all(
        str(config.get(key, "")).strip()
        for key in (
            "greenApiIdInstance",
            "greenApiToken",
            "greenApiUrl",
            "greenApiMediaUrl",
            "whatsappTo",
        )
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


def send_whatsapp(config: dict, message: str, images: list[dict]) -> bool:
    phone = "".join(ch for ch in str(config.get("whatsappTo", "")) if ch.isdigit())
    chat_id = f"{phone}@c.us"
    text_url = (
        f"{config['greenApiUrl'].rstrip('/')}/waInstance{config['greenApiIdInstance']}"
        f"/sendMessage/{config['greenApiToken']}"
    )
    status, _ = json_post(text_url, {"chatId": chat_id, "message": message})
    if status < 200 or status >= 300:
        return False

    file_url = (
        f"{config['greenApiMediaUrl'].rstrip('/')}/waInstance{config['greenApiIdInstance']}"
        f"/sendFileByUpload/{config['greenApiToken']}"
    )
    for image in images:
        status, _ = send_file(file_url, chat_id, image)
        if status < 200 or status >= 300:
            return False
    return True


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
        name = (fields.get("name") or "").replace("\r", " ").replace("\n", " ").strip()
        business = (fields.get("business") or "").replace("\r", " ").replace("\n", " ").strip()
        requirement = (fields.get("requirement") or "").strip()

        if not name or not requirement:
            self.json_response(400, False, "Please fill in your name and requirements.")
            return
        if len(name) > 120 or len(business) > 160 or len(requirement) > 4000:
            self.json_response(400, False, "Please shorten your request and try again.")
            return
        if len(images) > MAX_IMAGES:
            self.json_response(400, False, "You can attach up to 5 images.")
            return

        cleaned = []
        for image in images:
            mime = image["mime"]
            guessed, _ = mimetypes.guess_type(image["name"])
            if mime not in ALLOWED_TYPES:
                mime = guessed or ""
            if mime not in ALLOWED_TYPES:
                self.json_response(400, False, "Please attach JPG, PNG, WEBP, or GIF images only.")
                return
            if len(image["data"]) > MAX_IMAGE_BYTES:
                self.json_response(400, False, "Please keep each image under 8 MB.")
                return
            safe = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in os.path.basename(image["name"]))
            if "." not in safe:
                safe = f"reference.{ALLOWED_TYPES[mime]}"
            image["name"] = safe
            image["mime"] = mime
            cleaned.append(image)

        image_names = ", ".join(item["name"] for item in cleaned) if cleaned else "None"
        india = timezone(timedelta(hours=5, minutes=30))
        date = datetime.now(india).strftime("%d %B %Y").lstrip("0")
        message = (
            f"Name: {name}\n"
            f"Business name: {business or 'None'}\n"
            f"Requirement: {requirement}\n"
            f"Images: {image_names}\n"
            f"Date: {date}"
        )

        config = load_config()
        if not whatsapp_configured(config):
            self.json_response(
                503,
                False,
                "The services form is not connected yet. Please email sai.prakhya@xtrudeinc.com.",
            )
            return

        try:
            ok = send_whatsapp(config, message, cleaned)
        except Exception:
            ok = False

        if ok:
            self.json_response(200, True, "Request sent.")
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
