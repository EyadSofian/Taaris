#!/usr/bin/env python3
"""Detect GPU VRAM and recommend a local Ollama model (PLAN.md §4).

Run:  python scripts/detect_hardware.py
"""
from __future__ import annotations

import shutil
import subprocess
import sys

# (VRAM floor in GB, model tag, note) — first match wins, scanned high → low.
RECOMMENDATIONS: list[tuple[int, str, str]] = [
    (16, "qwen3:14b", "14B-class - strong Arabic + reasoning (needs rented/large GPU)"),
    (8, "qwen3:8b", "8B - good balance, fits ~8GB VRAM"),
    (0, "qwen3:4b", "4B - fits ~4GB VRAM, fastest; blunt but usable Arabic"),
]


def gpu_vram_mib() -> int | None:
    """Total VRAM of the largest GPU, in MiB, or None if no NVIDIA GPU."""
    if not shutil.which("nvidia-smi"):
        return None
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=15,
            check=True,
        )
        values = [int(x) for x in result.stdout.split() if x.strip().isdigit()]
        return max(values) if values else None
    except Exception:
        return None


def installed_models() -> list[str]:
    """Model tags already pulled into Ollama."""
    if not shutil.which("ollama"):
        return []
    try:
        out = subprocess.run(
            ["ollama", "list"], capture_output=True, text=True, timeout=20
        ).stdout
        return [line.split()[0] for line in out.splitlines()[1:] if line.strip()]
    except Exception:
        return []


def recommend(vram_gb: float) -> tuple[str, str]:
    for floor, model, note in RECOMMENDATIONS:
        if vram_gb >= floor:
            return model, note
    return RECOMMENDATIONS[-1][1], RECOMMENDATIONS[-1][2]


def main() -> int:
    print("=== AI Companion — hardware detection ===")
    mib = gpu_vram_mib()

    if mib is None:
        print("GPU: none detected (no nvidia-smi).")
        print("CPU-only inference is slow — recommend deep API mode or qwen3:4b.")
        return 0

    gb = mib / 1024
    model, note = recommend(gb)
    have = installed_models()

    print(f"GPU VRAM        : {mib} MiB (~{gb:.1f} GB)")
    print(f"Recommended     : {model}  - {note}")
    print(f"Installed models: {', '.join(have) or 'none'}")

    if model not in have:
        print(f"\nPull it with    :  ollama pull {model}")

    if gb < 6:
        print(
            "\nNote (4GB tier):"
            "\n  - qwen3:8b (~5GB) runs with partial CPU offload - better quality, slower."
            "\n  - qwen3:4b fits VRAM - faster, weaker. Choose in Phase 1 via OLLAMA_MODEL."
            "\n  - Uncensored path (sec.4): start with the permissive persona prompt on the base"
            "\n    model; only switch to an abliterated/Dolphin Qwen build if it still feels"
            "\n    restrained."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
