"""Generate synthetic evaluation attachments; requires reportlab and Poppler."""

from pathlib import Path
from subprocess import run
from reportlab.pdfgen import canvas

destination = Path(__file__).parent / "summary-fixtures"
destination.mkdir(exist_ok=True)


def text_pdf(name, lines):
    """Write a legible, single-page synthetic support document."""
    output = destination / name
    document = canvas.Canvas(str(output), pagesize=(700, 360), invariant=True)
    document.setTitle("Synthetic Pocket Trash evaluation fixture")
    document.setFont("Helvetica", 18)
    for index, line in enumerate(lines):
        document.drawString(32, 320 - index * 32, line)
    document.save()
    return output


report = text_pdf("report.pdf", [
    "SYNTHETIC SUPPORT REPORT - NOT REAL USER DATA",
    "Environment: Firefox 145, macOS 15.6",
    "Steps: Open collection; choose Export; select CSV.",
    "Expected: download a CSV containing all 37 owned pens.",
    "Actual: CSV contains 36 pens; the archived pen is missing.",
    "Impact: one user cannot reconcile their collection backup.",
    "Earlier report of 35 pens was a counting mistake.",
])
run(["pdftoppm", "-scale-to", "1000", "-singlefile", "-png", str(report), str(destination / "report-page")], check=True)
screen = text_pdf("scan.pdf", [
    "SYNTHETIC SCREENSHOT - NOT REAL USER DATA",
    "Pocket Trash / Upload image",
    "Upload rejected: IMAGE_ORIENTATION_17",
    "Only portrait photos fail; landscape photos upload.",
    "Browser version: [unreadable]",
    "No root cause or reproduction count is known.",
])
run(["pdftoppm", "-scale-to", "1000", "-singlefile", "-png", str(screen), str(destination / "screenshot")], check=True)
scanned = canvas.Canvas(str(screen), pagesize=(700, 360), invariant=True)
scanned.setTitle("Synthetic scanned support attachment")
scanned.drawImage(str(destination / "screenshot.png"), 0, 0, width=700, height=360)
scanned.save()
run(["pdftoppm", "-scale-to", "1000", "-singlefile", "-png", str(screen), str(destination / "scan-page")], check=True)
