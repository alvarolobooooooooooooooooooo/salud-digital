#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# mix-sfx.py — Mezcla los SFX a una pista única para el vídeo
# ───────────────────────────────────────────────────────────────────
# Reproduce FUERA DE LÍNEA exactamente lo que hace el navegador: mismos
# instantes, mismos niveles por canal, mismo tono por disparo, y la cama
# del flujo respirando con la misma curva de velocidad de cámara. Así lo
# que se oye en el MP4 es lo mismo que se oye en la página.
#
# Uso: node tools/sfx-cuesheet.js --json > /tmp/s.json
#      python3 tools/mix-sfx.py /tmp/s.json launch-audio.wav
# ═══════════════════════════════════════════════════════════════════
import json, sys, wave, os, math
import numpy as np

SR = 48000
SFXDIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'sfx')

def rd(path):
    w = wave.open(path, 'rb'); n = w.getnframes(); ch = w.getnchannels()
    b = w.readframes(n); w.close()
    a = np.frombuffer(b, dtype=np.uint8).reshape(-1, 3)
    v = (a[:, 0].astype(np.int32) | a[:, 1].astype(np.int32) << 8 | a[:, 2].astype(np.int32) << 16)
    v = np.where(v & 0x800000, v - 0x1000000, v).astype(float) / 8388608.0
    return v.reshape(-1, ch) if ch == 2 else np.stack([v, v], axis=1)

def resample(x, rate):
    """Igual que playbackRate del navegador: interpolación lineal."""
    if abs(rate - 1.0) < 1e-6: return x
    n = int(len(x) / rate)
    idx = np.arange(n) * rate
    i0 = np.floor(idx).astype(int); fr = (idx - i0)[:, None]
    i1 = np.minimum(i0 + 1, len(x) - 1)
    return x[i0] * (1 - fr) + x[i1] * fr

def main():
    sched_path, out_path = sys.argv[1], sys.argv[2]
    d = json.load(open(sched_path))
    reg, cats, master = d['registry'], d['categories'], d['master']
    vel = np.array(d['velocity'])
    total = n_total = int((d['duration'] + 1.2) * SR)
    mix = np.zeros((n_total, 2))

    cache = {}
    def buf(name):
        if name not in cache:
            f = os.path.join(SFXDIR, reg[name]['file'])
            cache[name] = rd(f) if os.path.exists(f) else None
        return cache[name]

    beds = {}
    placed = 0
    for c in d['schedule']:
        name = c['sfx']; b = buf(name)
        if b is None: continue
        g = c.get('gain', 1.0) * reg[name]['gain'] * cats[reg[name]['cat']] * master
        if c.get('bed') == 'start':
            beds[name] = {'t': c['t'], 'g': g}
            continue
        if c.get('bed') == 'stop':
            bd = beds.pop(name, None)
            if bd: place_bed(mix, b, bd['t'], c['t'], bd['g'], name, vel)
            continue
        x = resample(b, c.get('rate', 1.0)) * g
        s = int(c['t'] * SR)
        e = min(s + len(x), n_total)
        if e > s: mix[s:e] += x[:e - s]
        placed += 1
    for name, bd in beds.items():
        place_bed(mix, buf(name), bd['t'], d['duration'], bd['g'], name, vel)

    peak = np.max(np.abs(mix))
    # Techo a -1 dBTP con saturación blanda: la suma de capas puede pasarse
    # puntualmente y un limitador duro se oye.
    mix = np.tanh(mix * 1.05) / np.tanh(1.05) * 0.89
    lim = np.max(np.abs(mix))
    print('  pico antes del techo: %.2f dBFS · después: %.2f dBFS · %d disparos colocados'
          % (20 * math.log10(peak + 1e-9), 20 * math.log10(lim + 1e-9), placed))

    dd = (np.clip(mix, -1, 1).reshape(-1) * (2 ** 23 - 1)).astype('<i4')
    bts = np.frombuffer(dd.tobytes(), dtype=np.uint8).reshape(-1, 4)[:, :3].tobytes()
    w = wave.open(out_path, 'wb'); w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
    w.writeframes(bts); w.close()
    print('  → ' + out_path + '  (%.1f s)' % (len(mix) / SR))

def place_bed(mix, b, t0, t1, g, name, vel):
    """Cama en bucle entre dos instantes, con la misma respiración que en
       el navegador (el volumen sigue la velocidad de cámara) y fundidos
       de entrada y salida de 0,3 s."""
    s, e = int(t0 * SR), min(int(t1 * SR), len(mix))
    if e <= s: return
    n = e - s
    tile = np.tile(b, (n // len(b) + 2, 1))[:n]
    env = np.ones(n)
    f = int(0.3 * SR)
    if n > 2 * f:
        env[:f] = np.linspace(0, 1, f); env[-f:] = np.linspace(1, 0, f)
    if name == 'data-flow':
        idx = np.clip((np.arange(n) / SR + t0) * 60, 0, len(vel) - 1).astype(int)
        env = env * (0.55 + np.minimum(vel[idx], 1.2) * 0.45)
    mix[s:e] += tile * (env * g)[:, None]

if __name__ == '__main__':
    main()
