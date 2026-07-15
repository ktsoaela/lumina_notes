"""Render Markdown notes to PDF via Chrome/Chromium (or Playwright)."""
from __future__ import annotations

import html as html_mod
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger("lumina.export")

PRINT_CSS = """
.lumina-print-inner {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  box-sizing: border-box;
  padding: 28px 32px;
  line-height: 1.6;
  color: #1a1a1a !important;
  background: #ffffff !important;
}
.lumina-print-inner h1 {
  color: #2c3e50 !important;
  border-bottom: 2px solid #547f72;
  padding-bottom: 10px;
  margin-top: 0;
  font-size: 1.6rem;
  font-weight: 600;
}
.lumina-print-inner h2 {
  color: #34495e !important;
  border-bottom: 1px solid #bdc3c7;
  padding-bottom: 5px;
  margin-top: 25px;
}
.lumina-print-inner h3 { color: #2c3e50 !important; margin-top: 20px; }
.lumina-print-inner .document-info { font-size: 14px; color: #555 !important; margin: 12px 0 0 0; }
.lumina-print-inner .document-info p { margin: 4px 0; color: #555 !important; }
.lumina-print-inner .markdown-content { font-size: 14px; color: #1a1a1a !important; }
.lumina-print-inner .markdown-content p { margin-bottom: 12px; }
.lumina-print-inner .markdown-content ul,
.lumina-print-inner .markdown-content ol { margin-bottom: 12px; padding-left: 20px; }
.lumina-print-inner .markdown-content code {
  background-color: #f4f1ea; padding: 2px 4px; border-radius: 3px;
  font-family: 'Courier New', monospace; font-size: 13px;
}
.lumina-print-inner .markdown-content pre {
  background-color: #f4f1ea; padding: 15px; border-radius: 5px;
  overflow-x: auto; border: 1px solid #e9ecef;
}
.lumina-print-inner .markdown-content blockquote {
  border-left: 4px solid #547f72; padding-left: 15px; margin: 15px 0;
  color: #5c6b66 !important; font-style: italic;
}
.lumina-print-inner .markdown-content table { border-collapse: collapse; width: 100%; margin: 15px 0; }
.lumina-print-inner .markdown-content th,
.lumina-print-inner .markdown-content td {
  border: 1px solid #ddd; padding: 8px 12px; text-align: left;
}
.lumina-print-inner .markdown-content th { background-color: #f4f1ea; font-weight: bold; }
body.lumina-print-window {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  margin: 0; color: #1a1a1a; background: #ffffff;
}
"""


def markdown_to_html(markdown: str) -> str:
    text = markdown or ""
    try:
        import markdown as md_lib

        return md_lib.markdown(
            text,
            extensions=["fenced_code", "tables", "nl2br", "sane_lists"],
        )
    except Exception:
        logger.exception("markdown package failed; using plain escape")
        escaped = html_mod.escape(text).replace("\n", "<br />\n")
        return f"<p>{escaped}</p>" if escaped.strip() else "<p><em>No content on this page.</em></p>"


def build_print_html(title: str, markdown: str, document_name: str | None = None) -> str:
    body = markdown_to_html(markdown)
    if not body.strip():
        body = "<p><em>No content on this page.</em></p>"
    printed = __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    file_title = (document_name or title or "note").strip() or "note"
    safe_title = html_mod.escape(title or "Untitled")
    safe_file = html_mod.escape(file_title)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{safe_file}</title>
  <style>{PRINT_CSS}</style>
</head>
<body class="lumina-print-window">
  <div class="lumina-print-inner">
    <h1>{safe_title}</h1>
    <div class="document-info">
      <p><strong>Document Type:</strong> Markdown (.md)</p>
      <p><strong>Printed:</strong> {html_mod.escape(printed)}</p>
    </div>
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
    <div class="markdown-content">{body}</div>
  </div>
</body>
</html>"""


def _chrome_candidates() -> list[Path]:
    env = os.environ.get("CHROME_PATH") or os.environ.get("LUMINA_CHROME_PATH")
    out: list[Path] = []
    if env:
        out.append(Path(env))
    which = shutil.which("chrome") or shutil.which("google-chrome") or shutil.which("chromium")
    if which:
        out.append(Path(which))
    local = os.environ.get("LOCALAPPDATA", "")
    pf = os.environ.get("ProgramFiles", r"C:\Program Files")
    pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    out.extend(
        [
            Path(pf) / "Google/Chrome/Application/chrome.exe",
            Path(pf86) / "Google/Chrome/Application/chrome.exe",
            Path(local) / "Google/Chrome/Application/chrome.exe",
            Path(pf) / "Microsoft/Edge/Application/msedge.exe",
            Path(pf86) / "Microsoft/Edge/Application/msedge.exe",
            Path(local) / "Microsoft/Edge/Application/msedge.exe",
            Path("/usr/bin/google-chrome"),
            Path("/usr/bin/chromium"),
            Path("/usr/bin/chromium-browser"),
            Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
        ]
    )
    seen: set[str] = set()
    uniq: list[Path] = []
    for p in out:
        key = str(p).lower()
        if key in seen:
            continue
        seen.add(key)
        if p.is_file():
            uniq.append(p)
    return uniq


def pdf_via_chrome(html: str) -> bytes:
    browsers = _chrome_candidates()
    if not browsers:
        raise RuntimeError(
            "No Chrome/Edge found. Set CHROME_PATH, or install Google Chrome / Edge."
        )
    with tempfile.TemporaryDirectory(prefix="lumina-pdf-") as td:
        tdir = Path(td)
        html_path = tdir / "document.html"
        pdf_path = tdir / "document.pdf"
        html_path.write_text(html, encoding="utf-8")
        uri = html_path.resolve().as_uri()
        last_err: Exception | None = None
        for browser in browsers:
            cmd = [
                str(browser),
                "--headless=new",
                "--disable-gpu",
                "--no-first-run",
                "--no-default-browser-check",
                "--allow-file-access-from-files",
                f"--print-to-pdf={pdf_path}",
                "--no-pdf-header-footer",
                uri,
            ]
            try:
                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=90,
                    check=False,
                )
                if pdf_path.is_file() and pdf_path.stat().st_size > 64:
                    return pdf_path.read_bytes()
                last_err = RuntimeError(
                    f"{browser.name} exit={proc.returncode} stderr={proc.stderr[-400:]}"
                )
            except Exception as e:
                last_err = e
                logger.warning("Chrome PDF failed with %s: %s", browser, e)
        raise RuntimeError(f"Chrome PDF failed: {last_err}")


def pdf_via_playwright(html: str) -> bytes:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.set_content(html, wait_until="networkidle")
            return page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "12mm", "right": "12mm", "bottom": "12mm", "left": "12mm"},
            )
        finally:
            browser.close()


def render_pdf_bytes(title: str, markdown: str, document_name: str | None = None) -> bytes:
    html = build_print_html(title, markdown, document_name)
    errors: list[str] = []

    try:
        return pdf_via_chrome(html)
    except Exception as e:
        errors.append(f"chrome: {e}")
        logger.warning("Chrome PDF path failed: %s", e)

    try:
        return pdf_via_playwright(html)
    except Exception as e:
        errors.append(f"playwright: {e}")
        logger.warning("Playwright PDF path failed: %s", e)

    raise RuntimeError(
        "Could not render PDF with Chrome or Playwright. " + " | ".join(errors)
    )
