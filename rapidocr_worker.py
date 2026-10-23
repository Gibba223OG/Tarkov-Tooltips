"""PriceChecker v1.1 offline rapid hover recognizer.

Input: NDJSON {"id":number,"path":cropped_ocr_input.bmp}.
Output: NDJSON results for the main Electron process.
The scanner supplies a tightly cropped 1-3 line tooltip. No document-style
text detection or orientation classification is required in this mode.
"""
import json
import os
import sys
import time

os.environ["OMP_NUM_THREADS"] = "2"
os.environ["OPENBLAS_NUM_THREADS"] = "2"
os.environ["ORT_LOG_SEVERITY_LEVEL"] = "3"


def emit(message):
    sys.stdout.write(json.dumps(message, ensure_ascii=True, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def crop_text_lines(image):
    """Extract 1-3 horizontally aligned text lines from the original tiny crop.

    Detect ink rows using high contrast to the dark game tooltip background.
    Fall back to a whole-image line if there is no reliable segmentation.
    This is only preprocessing; the same PP-OCRv6 recognition model is used.
    """
    height, width = image.shape[:2]
    if width < 20 or height < 10:
        return [image]
    # Tarkov tooltip input has dark background and pale foreground characters.
    # max channel tolerates the distinctive subdued tan font.
    brightness = image.max(axis=2)
    rows = np.flatnonzero((brightness > 95).sum(axis=1) >= 3)
    if rows.size < 4:
        return [image]
    groups = []
    start = previous = int(rows[0])
    for yy in rows[1:]:
        y = int(yy)
        if y - previous > 3:
            if previous - start >= 3:
                groups.append((start, previous))
            start = y
        previous = y
    if previous - start >= 3:
        groups.append((start, previous))
    if not 1 <= len(groups) <= 3:
        return [image]
    output = []
    for top, bottom in groups:
        line = image[max(0, top - 3):min(height, bottom + 4), :, :]
        horizontal = np.flatnonzero((line.max(axis=2) > 85).sum(axis=0) >= 2)
        if horizontal.size:
            left = max(0, int(horizontal[0]) - 5)
            right = min(width, int(horizontal[-1]) + 6)
            line = line[:, left:right, :]
        if line.shape[0] > 7 and line.shape[1] > 15:
            output.append(line)
    return output if output else [image]


try:
    import cv2
    import numpy as np
    from rapidocr import RapidOCR

    cv2.setNumThreads(1)
    # Skip DET and CLS and use the existing small PP-OCRv6 recognition model.
    # Two ONNX threads were selected to reduce total CPU use and hover delay.
    engine = RapidOCR(params={
        "Global.use_det": False,
        "Global.use_cls": False,
        "EngineConfig.onnxruntime.intra_op_num_threads": 2,
        "EngineConfig.onnxruntime.inter_op_num_threads": 1,
    })
    warmup = np.full((26, 450, 3), 33, np.uint8)
    cv2.putText(warmup, "AK-74 5.45x39 6L20",
                (4, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (210, 215, 220), 1)
    engine(warmup)
    emit({"type": "ready", "engine": "RapidOCR recognition-only"})
except Exception as exc:
    emit({"type": "fatal", "error": str(exc)})
    raise SystemExit(1)

for input_line in sys.stdin:
    request = None
    try:
        request = json.loads(input_line)
        request_id = request.get("id")
        image_path = request.get("path")
        if not isinstance(image_path, str) or not os.path.isfile(image_path):
            emit({"id": request_id, "type": "result", "text": "", "error": "image missing"})
            continue
        image = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if image is None:
            emit({"id": request_id, "type": "result", "text": "", "error": "image unreadable"})
            continue
        began = time.perf_counter()
        lines = crop_text_lines(image)
        words = []
        scores = []
        for line in lines:
            result = engine(line)
            if result.txts:
                words.extend(str(value).strip() for value in result.txts if str(value).strip())
                scores.extend(round(float(value), 3) for value in (result.scores or ()))
        emit({
            "id": request_id, "type": "result",
            "text": " ".join(words),
            "lines": words,
            "scores": scores,
            "ms": int(1000 * (time.perf_counter() - began))
        })
    except Exception as exc:
        emit({
            "id": request.get("id") if isinstance(request, dict) else None,
            "type": "result",
            "text": "",
            "error": str(exc),
        })
