"""Pruebas sintéticas, sin documentos ni datos de clientes."""
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject, NumberObject

spec = importlib.util.spec_from_file_location("extract_pdf", Path(__file__).with_name("extract_pdf.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExtractTests(unittest.TestCase):
    def test_rotated_pdf_preserves_paths_color_and_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sintetico.pdf"
            writer = PdfWriter()
            page = writer.add_blank_page(width=300, height=200)
            stream = DecodedStreamObject()
            stream.set_data(b"1 0 0 RG 10 20 m 110 20 l S 0 1 0 RG 10 30 100 80 re S")
            page[NameObject("/Contents")] = writer._add_object(stream)
            page[NameObject("/Rotate")] = NumberObject(90)
            with path.open("wb") as output:
                writer.write(output)
            result = module.extract(path)
            self.assertEqual(result["pages"][0]["rotation"], 90)
            self.assertEqual(result["pages"][0]["width"], 200)
            self.assertEqual(len(result["pages"][0]["paths"]), 2)
            line = result["pages"][0]["paths"][0]
            self.assertEqual(line["stroke"], (1, 0, 0))
            self.assertEqual(line["points"], [[20, 10], [20, 110]])
            self.assertEqual(result["sha256"], module.extract(path)["sha256"])
            self.assertFalse(result["metric_geometry"])
            with self.assertRaises(ValueError):
                module.extract(path, [2])

    def test_does_not_join_subpaths_or_flatten_bezier(self):
        page = SimpleNamespace(lines=[], rects=[], chars=[], images=[], width=200, height=200, rotation=0,
            curves=[{"path": [("m", (0, 0)), ("l", (5, 0)), ("m", (20, 0)), ("l", (25, 0))], "object_type": "curve"},
                    {"path": [("m", (0, 0)), ("c", (1, 1), (2, 2), (3, 0))], "object_type": "curve"}],
            extract_words=lambda: [])
        result = module.extract_page(page, 1)
        self.assertEqual(len(result["paths"]), 2)
        self.assertEqual(result["unsupported_objects"], 1)
        self.assertFalse(result["paths"][0]["closed"])

    def test_raster_only_is_not_a_measured_plan(self):
        page = SimpleNamespace(lines=[], rects=[], curves=[], chars=[], images=[{}], width=200, height=200, rotation=0,
                               extract_words=lambda: [])
        result = module.extract_page(page, 1)
        self.assertEqual(result["paths"], [])
        self.assertTrue(result["requires_calibration"])
        self.assertIn("OCR", " ".join(result["warnings"]))

    def test_does_not_parse_arbitrary_non_pdf_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "no.pdf"
            path.write_bytes(b"Texto plano")
            with self.assertRaises(ValueError):
                module.extract(path)


if __name__ == "__main__":
    unittest.main()
