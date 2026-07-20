#!/usr/bin/env python3
"""8비트 스타일 음원(효과음 + 배경음악) 생성기.

외부 라이브러리 없이(표준 라이브러리만 사용) 사각파/삼각파/사인파/노이즈를
합성해서 WAV 파일로 저장합니다. 모든 멜로디는 이 프로젝트를 위해 새로
작곡한 오리지널 곡이며, 실제 게임 음원을 녹음하거나 추출한 것이 아닙니다.

실행:
    python3 tools/generate_audio.py

결과물은 ``assets/audio/`` 아래에 생성됩니다.
"""

from __future__ import annotations

import array
import math
import os
import random
import wave
from typing import Iterable, List, Sequence, Tuple

SAMPLE_RATE = 22050
_RNG = random.Random(42)

Note = Tuple[str, int, float]  # (음이름 or 'R', 옥타브, 박자 수)

_SEMITONES = {
    "C": -9, "C#": -8, "Db": -8, "D": -7, "D#": -6, "Eb": -6,
    "E": -5, "F": -4, "F#": -3, "Gb": -3, "G": -2, "G#": -1,
    "Ab": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2,
}


def note_to_freq(name: str, octave: int) -> float:
    """음이름+옥타브를 주파수(Hz)로 변환한다. A4 = 440Hz 기준."""
    if name == "R":
        return 0.0
    semitone = _SEMITONES[name] + (octave - 4) * 12
    return 440.0 * (2.0 ** (semitone / 12.0))


# ---------------------------------------------------------------------------
# 파형 생성기
# ---------------------------------------------------------------------------

def render_tone(freq_hz: float, duration_s: float, waveform: str = "square",
                 duty: float = 0.5, amp: float = 1.0) -> List[float]:
    n = max(int(SAMPLE_RATE * duration_s), 0)
    out = [0.0] * n
    if freq_hz <= 0:
        return out
    for i in range(n):
        t = i / SAMPLE_RATE
        phase = (t * freq_hz) % 1.0
        if waveform == "square":
            v = 1.0 if phase < duty else -1.0
        elif waveform == "triangle":
            v = (4 * phase - 1) if phase < 0.5 else (3 - 4 * phase)
        elif waveform == "sine":
            v = math.sin(2 * math.pi * freq_hz * t)
        elif waveform == "sawtooth":
            v = 2 * phase - 1
        else:
            raise ValueError(f"unknown waveform: {waveform}")
        out[i] = v * amp
    return out


def sweep(f0: float, f1: float, duration: float, waveform: str = "square",
          duty: float = 0.5, amp: float = 0.5) -> List[float]:
    """f0 -> f1 로 부드럽게 이동하는 피치 스윕(점프/파이프/깃발 효과음용)."""
    n = int(SAMPLE_RATE * duration)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        frac = i / n if n else 0.0
        f = f0 + (f1 - f0) * frac
        phase += f / SAMPLE_RATE
        p = phase % 1.0
        if waveform == "square":
            v = 1.0 if p < duty else -1.0
        elif waveform == "triangle":
            v = (4 * p - 1) if p < 0.5 else (3 - 4 * p)
        elif waveform == "sawtooth":
            v = 2 * p - 1
        elif waveform == "sine":
            v = math.sin(2 * math.pi * phase)
        else:
            raise ValueError(f"unknown waveform: {waveform}")
        out[i] = v * amp
    return out


def noise_samples(duration: float, amp: float = 1.0) -> List[float]:
    n = int(SAMPLE_RATE * duration)
    return [(_RNG.random() * 2 - 1) * amp for _ in range(n)]


def apply_adsr(samples: Sequence[float], attack: float = 0.01, decay: float = 0.05,
                sustain_level: float = 0.7, release: float = 0.05) -> List[float]:
    n = len(samples)
    a = min(int(SAMPLE_RATE * attack), n)
    d = min(int(SAMPLE_RATE * decay), max(n - a, 0))
    r = min(int(SAMPLE_RATE * release), max(n - a - d, 0))
    s = max(n - a - d - r, 0)

    env: List[float] = []
    env.extend((i / a if a else 1.0) for i in range(a))
    env.extend((1.0 - (1.0 - sustain_level) * (i / d if d else 1.0)) for i in range(d))
    env.extend([sustain_level] * s)
    env.extend((sustain_level * (1.0 - (i + 1) / r if r else 0.0)) for i in range(r))
    while len(env) < n:
        env.append(0.0)
    env = env[:n]
    return [smp * e for smp, e in zip(samples, env)]


def mix(tracks: Iterable[Sequence[float]], weights: Sequence[float] | None = None) -> List[float]:
    tracks = list(tracks)
    if weights is None:
        weights = [1.0] * len(tracks)
    n = max((len(t) for t in tracks), default=0)
    out = [0.0] * n
    for t, w in zip(tracks, weights):
        for i, v in enumerate(t):
            out[i] += v * w
    peak = max((abs(x) for x in out), default=0.0)
    if peak > 0.95:
        scale = 0.95 / peak
        out = [x * scale for x in out]
    return out


def _paste(seg: List[float], sound: Sequence[float]) -> List[float]:
    for i in range(min(len(seg), len(sound))):
        seg[i] = sound[i]
    return seg


def write_wav(path: str, samples: Sequence[float]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ints = array.array("h", (int(max(-1.0, min(1.0, s)) * 32767) for s in samples))
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(ints.tobytes())


# ---------------------------------------------------------------------------
# 멜로디 렌더러
# ---------------------------------------------------------------------------

def render_melody(notes: Sequence[Note], bpm: float, waveform: str = "square",
                   duty: float = 0.5, amp: float = 0.5, gate: float = 0.85,
                   attack: float = 0.004, decay: float = 0.02,
                   sustain: float = 0.85, release: float = 0.03) -> List[float]:
    beat_s = 60.0 / bpm
    out: List[float] = []
    for name, octave, beats in notes:
        dur_s = beats * beat_s
        if name == "R":
            out.extend([0.0] * int(SAMPLE_RATE * dur_s))
            continue
        f = note_to_freq(name, octave)
        tone_len = dur_s * gate
        tone = render_tone(f, tone_len, waveform=waveform, duty=duty, amp=amp)
        tone = apply_adsr(tone, attack=attack, decay=decay, sustain_level=sustain,
                           release=min(release, max(tone_len * 0.4, 0.001)))
        out.extend(tone)
        gap_len = dur_s - tone_len
        if gap_len > 0:
            out.extend([0.0] * int(SAMPLE_RATE * gap_len))
    return out


# ---------------------------------------------------------------------------
# 배경음악: 8마디 루프 오리지널 곡 (신곡 작곡, 기존 게임 음악 인용 없음)
# ---------------------------------------------------------------------------

def build_bgm() -> List[float]:
    bpm = 150

    chords = {
        "C": ("C", 3, "G", 3),
        "F": ("F", 3, "C", 4),
        "G": ("G", 2, "D", 3),
        "Am": ("A", 2, "E", 3),
    }
    bar_chords = ["C", "C", "F", "G", "Am", "Am", "F", "G"]

    bass_notes: List[Note] = []
    for ch in bar_chords:
        rn, ro, fn, fo = chords[ch]
        bass_notes += [(rn, ro, 1.0), (fn, fo, 1.0), (rn, ro, 1.0), (fn, fo, 1.0)]
    total_bass_beats = sum(b for _, _, b in bass_notes)
    assert abs(total_bass_beats - len(bar_chords) * 4) < 1e-9

    melody_bars: List[List[Note]] = [
        [("E", 5, 0.5), ("G", 5, 0.5), ("E", 5, 0.5), ("C", 5, 0.5), ("D", 5, 1.0), ("E", 5, 1.0)],
        [("G", 5, 0.5), ("E", 5, 0.5), ("C", 5, 0.5), ("E", 5, 0.5), ("G", 5, 1.0), ("R", 0, 1.0)],
        [("F", 5, 0.5), ("A", 5, 0.5), ("F", 5, 0.5), ("C", 5, 0.5), ("A", 5, 1.0), ("F", 5, 1.0)],
        [("G", 5, 0.5), ("B", 5, 0.5), ("D", 6, 0.5), ("B", 5, 0.5), ("G", 5, 1.0), ("R", 0, 1.0)],
        [("A", 5, 0.5), ("C", 6, 0.5), ("A", 5, 0.5), ("E", 5, 0.5), ("C", 6, 1.0), ("A", 5, 1.0)],
        [("E", 5, 0.5), ("A", 5, 0.5), ("C", 6, 0.5), ("A", 5, 0.5), ("E", 5, 2.0)],
        [("F", 5, 0.5), ("A", 5, 0.5), ("C", 6, 0.5), ("A", 5, 0.5), ("F", 5, 1.0), ("A", 5, 1.0)],
        [("G", 5, 0.5), ("D", 5, 0.5), ("G", 5, 0.5), ("B", 5, 0.5), ("D", 6, 1.0), ("R", 0, 1.0)],
    ]
    for idx, bar in enumerate(melody_bars):
        total = sum(b for _, _, b in bar)
        assert abs(total - 4.0) < 1e-9, f"melody bar {idx} sums to {total}, expected 4"
    melody_notes = [n for bar in melody_bars for n in bar]

    bass = render_melody(bass_notes, bpm, waveform="triangle", amp=0.5,
                          gate=0.92, sustain=0.8, release=0.05)
    melody = render_melody(melody_notes, bpm, waveform="square", duty=0.25, amp=0.32,
                            gate=0.8, sustain=0.75, release=0.04)
    perc = _build_percussion(len(bar_chords), bpm)

    return mix([bass, melody, perc], weights=[1.0, 1.0, 1.0])


def _build_percussion(bar_count: int, bpm: float) -> List[float]:
    beat_s = 60.0 / bpm
    eighth_s = beat_s / 2
    slot_n = int(SAMPLE_RATE * eighth_s)
    total_eighths = bar_count * 8

    out: List[float] = []
    for i in range(total_eighths):
        beat_index = i // 2
        pos_in_bar = beat_index % 4
        on_beat = (i % 2 == 0)
        seg = [0.0] * slot_n

        if on_beat and pos_in_bar in (0, 2):
            kick = mix([
                render_tone(90, 0.08, "sine", amp=0.55),
                noise_samples(0.05, amp=0.12),
            ])
            kick = apply_adsr(kick, attack=0.001, decay=0.03, sustain_level=0.25, release=0.05)
            seg = _paste(seg, kick)
        elif on_beat and pos_in_bar in (1, 3):
            snare = noise_samples(0.06, amp=0.22)
            snare = apply_adsr(snare, attack=0.001, decay=0.02, sustain_level=0.25, release=0.04)
            seg = _paste(seg, snare)
        else:
            hat = noise_samples(0.025, amp=0.09)
            hat = apply_adsr(hat, attack=0.001, decay=0.008, sustain_level=0.15, release=0.012)
            seg = _paste(seg, hat)
        out.extend(seg)
    return out


# ---------------------------------------------------------------------------
# 효과음
# ---------------------------------------------------------------------------

def sfx_jump() -> List[float]:
    tone = sweep(300, 950, 0.16, waveform="square", amp=0.5)
    return apply_adsr(tone, attack=0.002, decay=0.05, sustain_level=0.6, release=0.08)


def sfx_coin() -> List[float]:
    n1 = render_tone(note_to_freq("B", 5), 0.07, waveform="square", amp=0.5)
    n1 = apply_adsr(n1, attack=0.002, decay=0.01, sustain_level=0.9, release=0.03)
    n2 = render_tone(note_to_freq("E", 6), 0.22, waveform="square", amp=0.5)
    n2 = apply_adsr(n2, attack=0.002, decay=0.02, sustain_level=0.85, release=0.15)
    return n1 + n2


def sfx_stomp() -> List[float]:
    noise_part = noise_samples(0.08, amp=0.35)
    thud = render_tone(120, 0.09, waveform="sine", amp=0.6)
    thud = apply_adsr(thud, attack=0.001, decay=0.03, sustain_level=0.4, release=0.05)
    return mix([noise_part, thud])


def sfx_bump() -> List[float]:
    return sweep(220, 110, 0.09, waveform="square", amp=0.45)


def sfx_break_block() -> List[float]:
    return apply_adsr(noise_samples(0.25, amp=0.5), attack=0.001, decay=0.05,
                       sustain_level=0.5, release=0.19)


def sfx_powerup() -> List[float]:
    notes: List[Note] = [("C", 5, 0.5), ("E", 5, 0.5), ("G", 5, 0.5), ("C", 6, 0.75), ("R", 0, 0.25)]
    return render_melody(notes, bpm=300, waveform="square", duty=0.4, amp=0.42, gate=0.9)


def sfx_hurt() -> List[float]:
    tone = sweep(520, 240, 0.18, waveform="square", amp=0.45)
    return apply_adsr(tone, attack=0.001, decay=0.05, sustain_level=0.5, release=0.08)


def sfx_death() -> List[float]:
    notes: List[Note] = [("G", 4, 0.5), ("F", 4, 0.5), ("D#", 4, 0.5), ("C", 4, 1.5)]
    return render_melody(notes, bpm=140, waveform="square", amp=0.4, gate=0.95,
                          sustain=0.7, release=0.15)


def sfx_flagpole() -> List[float]:
    return sweep(700, 120, 0.9, waveform="triangle", amp=0.45)


def sfx_level_clear() -> List[float]:
    notes: List[Note] = [
        ("C", 5, 0.5), ("E", 5, 0.5), ("G", 5, 0.5), ("C", 6, 0.5),
        ("G", 5, 0.5), ("C", 6, 1.0), ("R", 0, 0.25), ("E", 6, 0.75),
    ]
    return render_melody(notes, bpm=220, waveform="square", duty=0.4, amp=0.45, gate=0.85)


def sfx_game_over() -> List[float]:
    notes: List[Note] = [("C", 4, 1.0), ("G", 3, 1.0), ("E", 3, 1.0), ("C", 3, 2.0)]
    return render_melody(notes, bpm=110, waveform="triangle", amp=0.5, gate=0.95,
                          sustain=0.6, release=0.3)


def sfx_one_up() -> List[float]:
    notes: List[Note] = [("E", 5, 0.33), ("G", 5, 0.33), ("C", 6, 0.33), ("E", 6, 0.66)]
    return render_melody(notes, bpm=260, waveform="square", duty=0.25, amp=0.4, gate=0.9)


def sfx_select() -> List[float]:
    tone = render_tone(880, 0.05, waveform="square", amp=0.35)
    return apply_adsr(tone, attack=0.001, decay=0.01, sustain_level=0.7, release=0.03)


# ---------------------------------------------------------------------------

def main() -> None:
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "audio"))
    files = {
        "bgm_overworld.wav": build_bgm,
        "jump.wav": sfx_jump,
        "coin.wav": sfx_coin,
        "stomp.wav": sfx_stomp,
        "bump.wav": sfx_bump,
        "break_block.wav": sfx_break_block,
        "powerup.wav": sfx_powerup,
        "hurt.wav": sfx_hurt,
        "death.wav": sfx_death,
        "flagpole.wav": sfx_flagpole,
        "level_clear.wav": sfx_level_clear,
        "game_over.wav": sfx_game_over,
        "one_up.wav": sfx_one_up,
        "select.wav": sfx_select,
    }
    for filename, builder in files.items():
        path = os.path.join(base, filename)
        write_wav(path, builder())
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
