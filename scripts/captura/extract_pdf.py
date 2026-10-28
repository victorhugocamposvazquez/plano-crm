#!/usr/bin/env python3
"""Inspección local de PDF vectorial. No hace OCR ni envía datos a proveedores."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import pdfplumber

MAX_BYTES = 50 * 1024 * 1024
MAX_PAGES = 200
MAX_OBJECTS = 50000


def extract_page(page, number):
    paths = []
    unsupported = 0
    objects = list(page.lines) + list(page.rects) + list(page.curves)
    if len(objects) + len(page.chars) > MAX_OBJECTS:
        raise ValueError(f"La página {number} supera el límite de objetos; no se ha truncado.")
    for index, obj in enumerate(objects):
        # pdfplumber expone path en coordenadas de página, origen superior izquierdo.
        commands = obj.get("path", [])
        if not commands or any(command[0] not in ("m", "l", "h") for command in commands):
            unsupported += 1
            continue  # Una curva Bézier no es la recta entre sus puntos de control.
        subpaths = []
        points = []
        for command in commands:
            if command[0] == "m":
                if points:
                    subpaths.append((points, False))
                points = [list(command[1])]
            elif command[0] == "l":
                points.append(list(command[1]))
            elif command[0] == "h":
                if points:
                    subpaths.append((points, True))
                    points = []
        if points:
            subpaths.append((points, len(points) > 2 and points[0] == points[-1]))
        for part, (points, closed) in enumerate(subpaths):
            if len(points) < 2:
                continue
            paths.append({
                "id": f"p{number}-o{index}-s{part}", "points": points, "closed": closed,
                "stroke": obj.get("stroking_color"), "fill": obj.get("non_stroking_color"),
                "has_stroke": bool(obj.get("stroke")), "has_fill": bool(obj.get("fill")),
                "line_width": obj.get("linewidth"), "object_type": obj["object_type"],
            })
    warnings = ["Los trazados no están clasificados: pueden ser muros, cotas, textos vectorizados o símbolos."]
    if unsupported:
        warnings.append(f"{unsupported} objetos con curvas u operadores no soportados: geometría omitida explícitamente.")
    if not paths:
        warnings.append("No hay trazados lineales compatibles; requiere revisión y posiblemente OCR/vectorización.")
    if page.images:
        warnings.append("Hay imágenes incrustadas; no se han interpretado ni convertido en geometría.")
    return {
        "page": number, "width": page.width, "height": page.height,
        "rotation": page.rotation,
        "coordinate_system": "pdf_points_top_left_rotation_applied",
        "paths": paths,
        "words": [{k: word[k] for k in ("text", "x0", "top", "x1", "bottom")} for word in page.extract_words()],
        "image_count": len(page.images), "unsupported_objects": unsupported,
        "requires_calibration": True, "warnings": warnings,
    }


def extract(path, pages=None):
    path = Path(path)
    if not path.is_file() or path.stat().st_size > MAX_BYTES:
        raise ValueError("Selecciona un PDF local de hasta 50 MiB.")
    # Leer una sola instantánea: el hash y el análisis corresponden a los mismos bytes.
    import io
    content = path.read_bytes()
    if len(content) > MAX_BYTES or not content.startswith(b"%PDF-"):
        raise ValueError("El archivo no es un PDF compatible o supera el límite.")
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        if len(pdf.pages) > MAX_PAGES:
            raise ValueError("El documento supera 200 páginas. Separa los planos antes de analizarlos.")
        total_pages = len(pdf.pages)
        selected = sorted(set(pages if pages is not None else range(1, total_pages + 1)))
        if not selected or any(n < 1 or n > len(pdf.pages) for n in selected):
            raise ValueError("La selección de páginas está fuera del documento.")
        result = [extract_page(pdf.pages[n - 1], n) for n in selected]
    return {
        "schema_version": 1, "kind": "pdf_geometry", "sha256": hashlib.sha256(content).hexdigest(),
        "extractor": {"name": "pdfplumber", "version": pdfplumber.__version__},
        "total_pages": total_pages, "selected_pages": selected, "pages": result,
        "metric_geometry": False, "semantic_classification": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--pages", nargs="+", type=int, help="Páginas, empezando por 1. Por defecto todas.")
    parser.add_argument("--output", type=Path, required=True, help="Nuevo JSON local; nunca sobreescribe.")
    args = parser.parse_args()
    try:
        result = extract(args.pdf, args.pages)
        with args.output.open("x", encoding="utf-8") as output:
            json.dump(result, output, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
            output.write("\n")
        print(json.dumps({"pages": len(result["pages"]), "paths": sum(len(p["paths"]) for p in result["pages"]),
                          "metric_geometry": False, "output": str(args.output)}, ensure_ascii=False))
    except Exception as error:
        # No volcar texto del documento ni rutas de cliente en registros de error.
        print(json.dumps({"error": str(error) if isinstance(error, ValueError) else "No se pudo extraer el PDF o crear un archivo nuevo.",
                          "type": type(error).__name__}, ensure_ascii=False), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
