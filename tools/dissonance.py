"""Fairycake Falls – a rough dissonance meter for rendered audio.

For every short frame it finds the strong spectral peaks (the notes sounding), turns them into
semitones and counts pairs that clash: a minor second / major seventh / minor ninth (1 or 11
semitones mod 12, the harsh ones) and tritones (6). Prints the share of frames with a clash and
the worst spots, so two renders can be compared. usage: python3 tools/dissonance.py file.wav"""
import sys
import wave
import numpy as np

path = sys.argv[1]
w = wave.open(path)
n, rate, ch = w.getnframes(), w.getframerate(), w.getnchannels()
d = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
mono = d.reshape(-1, ch).mean(axis=1)

WIN = 8192
HOP = 2048
win = np.hanning(WIN)
freqs = np.fft.rfftfreq(WIN, 1 / rate)
frames = []
for i in range(0, len(mono) - WIN, HOP):
    spec = np.abs(np.fft.rfft(mono[i:i + WIN] * win))
    # strong peaks in the melodic range (local maxima, within 24 dB of the frame's loudest peak)
    band = (freqs > 110) & (freqs < 2600)
    s = spec * band
    top = s.max()
    if top < 1e-3:
        frames.append((i / rate, []))
        continue
    peaks = []
    for k in np.where((s[1:-1] > s[:-2]) & (s[1:-1] >= s[2:]) & (s[1:-1] > top * 10 ** (-24 / 20)))[0] + 1:
        # parabolic interpolation of the peak position (the FFT bins are coarse for low notes)
        a, b, c = np.log(s[k - 1] + 1e-12), np.log(s[k] + 1e-12), np.log(s[k + 1] + 1e-12)
        off = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else 0
        fk = freqs[k] + off * (freqs[1] - freqs[0])
        midi = 69 + 12 * np.log2(fk / 440)
        peaks.append((midi, 20 * np.log10(s[k] / top)))
    # merge peaks closer than 0.35 semitone (FFT side lobes)
    peaks.sort()
    merged = []
    for m, lv in peaks:
        if merged and m - merged[-1][0] < 0.35:
            if lv > merged[-1][1]:
                merged[-1] = (m, lv)
        else:
            merged.append((m, lv))
    frames.append((i / rate, merged))

harsh, tri, total = 0, 0, 0
worst = []
for t, peaks in frames:
    if not peaks:
        continue
    total += 1
    h = x = 0
    for a in range(len(peaks)):
        for b in range(a + 1, len(peaks)):
            if min(peaks[a][1], peaks[b][1]) < -18:
                continue  # only pairs of strong notes count (reverb tails and overtones are not a clash)
            iv = (peaks[b][0] - peaks[a][0]) % 12
            dev = min(abs(iv - 1), abs(iv - 11))
            if dev < 0.3:
                h += 1
            if abs(iv - 6) < 0.3:
                x += 1
    if h:
        harsh += 1
        worst.append((h, t, [(round(m, 1), round(lv)) for m, lv in peaks]))
    if x:
        tri += 1
print('%s: frames with a semitone/minor-ninth clash: %.1f %%, with a tritone: %.1f %% (%d frames)' % (path.split('/')[-1], 100 * harsh / total, 100 * tri / total, total))
worst.sort(reverse=True)
for h, t, peaks in worst[:8]:
    print('  t=%5.1fs clashes=%d peaks(midi,dB)=%s' % (t, h, peaks))
