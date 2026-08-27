#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# gen-music.py — Banda sonora del launch de Salud Digital
# ───────────────────────────────────────────────────────────────────
# 35 s, instrumental, sin percusión agresiva y con el medio despejado
# para que quepan encima los SFX y una eventual locución.
#
# Tonalidad: RE. La misma que los efectos (Dsus2), para que música y
# sonido pertenezcan al mismo sitio y no a dos proyectos distintos.
#
# El armazón armónico es un PEDAL de RE con las voces de arriba
# moviéndose, no un carrusel de acordes: es lo que separa "caro y
# atemporal" de "librería corporativa". Solo hay dos movimientos reales
# —el IV en el segundo crescendo y el V que lo tensa— y ambos existen
# para preparar la resolución del pico.
#
# El tempo no es constante a propósito: hay pulso en los dos crescendos
# y tiempo libre en medio. Un metrónomo de 35 s cansa y el encargo pedía
# evitar patrones rítmicos constantes.
#
# Uso: python3 tools/gen-music.py [--out ruta.wav] [--secs 35]
# ═══════════════════════════════════════════════════════════════════
import numpy as np, wave, os, sys, math

SR = 48000
DUR = 35.0
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'launch-score.wav')
rng = np.random.default_rng(11)

# ── Notas (RE). Se nombran para que la partitura se lea. ───────────
def hz(n): return 440.0 * (2 ** ((n - 69) / 12.0))
D1, D2, D3, D4, D5, D6 = hz(26), hz(38), hz(50), hz(62), hz(74), hz(86)
E3, E4, E5 = hz(52), hz(64), hz(76)
Fs3, Fs4, Fs5 = hz(54), hz(66), hz(78)
G2, G3, G4, G5 = hz(43), hz(55), hz(67), hz(79)
A1, A2, A3, A4, A5 = hz(33), hz(45), hz(57), hz(69), hz(81)
B3, B4 = hz(59), hz(71)
Cs4, Cs5 = hz(61), hz(73)

N = int(SR * (DUR + 3.0))          # cola de reverberación aparte
def n_of(s): return int(SR * s)
def ts(n): return np.arange(n) / SR

# ── Filtros y espacio ──────────────────────────────────────────────
def svf(x, fc, q=0.9, mode='lp'):
    n = len(x)
    fc = np.clip(np.asarray(fc, dtype=float) * np.ones(n), 20.0, SR * 0.24)
    f = np.minimum(2.0 * np.sin(np.pi * fc / SR), 0.95)
    dq = min(1.0 / q, 1.0)
    low = band = 0.0
    out = np.empty(n)
    if mode == 'lp':
        for i in range(n):
            hi = x[i] - low - dq * band
            band += f[i] * hi; low += f[i] * band; out[i] = low
    elif mode == 'hp':
        for i in range(n):
            hi = x[i] - low - dq * band
            band += f[i] * hi; low += f[i] * band; out[i] = hi
    else:
        for i in range(n):
            hi = x[i] - low - dq * band
            band += f[i] * hi; low += f[i] * band; out[i] = band
    return out

def onepole(x, fc):
    a = math.exp(-2.0 * math.pi * fc / SR)
    y = np.empty(len(x)); p = 0.0
    for i in range(len(x)):
        p = (1 - a) * x[i] + a * p; y[i] = p
    return y

def ir_hall(dur=3.0, decay=4.2, bright=5200.0, pre=0.022):
    n = n_of(dur)
    t = np.linspace(0, 1, n)
    d = rng.standard_normal(n) * np.exp(-decay * t)
    # difusión creciente: sin esto suena a ruido con envolvente, no a sala
    d *= (0.3 + 0.7 * np.minimum(t * 6, 1))
    d = onepole(d, bright)
    ir = np.zeros(n + n_of(pre)); ir[n_of(pre):] = d
    ir[:n_of(0.006)] *= np.linspace(0, 1, n_of(0.006))
    return ir / (np.max(np.abs(ir)) + 1e-9) * 0.55

def conv(x, ir):
    m = len(x) + len(ir) - 1
    K = 1 << (m - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, K) * np.fft.rfft(ir, K), K)[:len(x)]

HALL = ir_hall(3.0, 4.2, 5200)
ROOM = ir_hall(1.3, 6.5, 4200, 0.010)

def delay(x, time_s, fb=0.34, mix=0.32):
    d = n_of(time_s); y = x.copy()
    for k in range(1, 6):
        g = fb ** k
        if g < 0.02: break
        y[d * k:] += x[:len(x) - d * k] * g * mix
    return y

# ── Envolventes ────────────────────────────────────────────────────
def adsr(n, a, d, s, r, curve=2.2):
    e = np.zeros(n)
    na, nd, nr = n_of(a), n_of(d), n_of(r)
    na = max(1, min(na, n))
    e[:na] = np.linspace(0, 1, na) ** 0.7
    i = na
    nd = min(nd, max(0, n - i))
    if nd: e[i:i + nd] = 1 - (1 - s) * np.linspace(0, 1, nd) ** 0.6
    i += nd
    ns = max(0, n - i - nr)
    if ns: e[i:i + ns] = s
    i += ns
    if nr and i < n:
        e[i:] = s * np.exp(-np.linspace(0, curve * 4, n - i))
    return e

# ── Instrumentos ───────────────────────────────────────────────────
def saw(f, n, harm=18, drift=0.0):
    """Diente de sierra ADITIVA: sin aliasing y con el brillo controlado
       armónico a armónico, que es lo que la hace sonar analógica."""
    t = ts(n)
    if drift:
        f = f * (1 + drift * np.sin(2 * np.pi * 0.13 * t + rng.random() * 6))
    ph = 2 * np.pi * np.cumsum(np.ones(n) * f) / SR if np.ndim(f) else 2 * np.pi * f * t
    y = np.zeros(n)
    for k in range(1, harm + 1):
        if f * k > SR * 0.45 if np.ndim(f) == 0 else False: break
        y += np.sin(ph * k) / k
    return y * 0.55

def pad(freqs, dur, a=1.6, r=2.2, det=0.0016, harm=14):
    n = n_of(dur); y = np.zeros(n)
    for f in freqs:
        for k, dt in enumerate((-det, 0.0, det)):
            y += saw(f * (1 + dt), n, harm, drift=0.0006) * (0.8 if dt else 1.0)
    y /= max(1, len(freqs) * 3)
    return y * adsr(n, a, 0.4, 0.85, r)

def strings(freqs, dur, a=0.9, r=1.6, vib=0.0022):
    n = n_of(dur); t = ts(n); y = np.zeros(n)
    for f in freqs:
        lfo = 1 + vib * np.sin(2 * np.pi * 4.7 * t + rng.random() * 6) * np.minimum(t / 0.8, 1)
        for dt in (-0.0022, 0.0, 0.0022):
            ph = 2 * np.pi * np.cumsum(f * (1 + dt) * lfo) / SR
            for k in range(1, 13):
                y += np.sin(ph * k) / (k ** 1.15)
    y /= max(1, len(freqs) * 3 * 4)
    return y * adsr(n, a, 0.5, 0.8, r)

def keys(f, dur=2.2, vel=1.0, ratio=1.0, index=2.6, decay=1.4):
    """FM de dos operadores. Con el índice cayendo da un timbre de piano
       eléctrico cálido; subiendo la relación, campana."""
    n = n_of(dur); t = ts(n)
    idx = index * np.exp(-t * (3.0 / decay))
    y = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * ratio * t))
    return y * adsr(n, 0.003, decay * 0.5, 0.16, decay) * vel

def sub(f, dur, a=0.25, r=1.2, gl=None):
    n = n_of(dur); t = ts(n)
    ff = f if gl is None else f + (gl - f) * (np.linspace(0, 1, n) ** 2)
    ph = 2 * np.pi * np.cumsum(np.ones(n) * ff) / SR
    y = np.sin(ph) + 0.16 * np.sin(2 * ph)      # 2º armónico: audible en altavoz pequeño
    return y * adsr(n, a, 0.3, 0.85, r)

def blip(f, dur=0.09, vel=1.0):
    n = n_of(dur); t = ts(n)
    y = np.sin(2 * np.pi * f * t) * 0.8 + np.sin(2 * np.pi * f * 2 * t) * 0.2
    return y * adsr(n, 0.0012, 0.02, 0.0, dur * 0.8, 3.2) * vel

def shimmer(dur, lo=2600, hi=7000, vel=1.0):
    n = n_of(dur)
    w = rng.standard_normal(n)
    F = np.fft.rfft(w); fr = np.fft.rfftfreq(n, 1 / SR); fr[0] = 1
    F /= np.sqrt(fr); x = np.fft.irfft(F, n)
    x = svf(x, np.linspace(lo, hi, n), 1.3, 'bp')
    return x / (np.max(np.abs(x)) + 1e-9) * adsr(n, dur * 0.55, 0.1, 0.7, dur * 0.4) * vel

def riser(dur, vel=1.0):
    n = n_of(dur)
    w = rng.standard_normal(n)
    x = svf(w, np.exp(np.linspace(np.log(400), np.log(6500), n)), 0.9, 'lp')
    return x / (np.max(np.abs(x)) + 1e-9) * (np.linspace(0, 1, n) ** 2.4) * vel

# ── Buses ──────────────────────────────────────────────────────────
BUS = {k: np.zeros(N) for k in ('sub', 'pad', 'str', 'key', 'pls', 'tex')}
def put(bus, sig, t, g=1.0):
    s = n_of(t); e = min(s + len(sig), N)
    if e > s: BUS[bus][s:e] += sig[:e - s] * g

# ═══════════════════════════════════════════════════════════════════
#  PARTITURA
#  Rejilla: compás de 2,75 s hasta el corte (87 BPM) y de 2,425 s
#  después (99 BPM). El segundo tramo va más rápido a propósito: es
#  la aceleración emocional, y se nota sin que nadie cuente.
# ═══════════════════════════════════════════════════════════════════
BAR1, BAR2 = 2.75, 2.425
CUT   = 16.30      # el corte: donde la cámara frena en seco
PEAK  = 24.85      # el pico: donde aparece el logotipo final
REVEAL = 28.80     # se despeja para la marca

# ── 0–5,3 s · atmósfera. Casi nada: curiosidad. ───────────────────
put('sub', sub(D1, 7.0, a=3.0, r=2.4), 0.0, 0.40)
put('pad', pad([D3, A3], 8.0, a=3.6, r=3.0), 0.6, 0.085)
put('key', keys(D4, 3.4, 0.4, 1.0, 1.4, 2.4), 2.55, 0.10)
put('tex', shimmer(3.6, 1100, 2400, 0.4), 2.9, 0.030)
for i in range(3):                                   # pulso mínimo, medio compás
    put('pls', blip(A5, 0.10, 0.4), 3.85 + i * (BAR1 / 2), 0.035)

# ── 5,3–10,5 s · entra el pulso. Elegante y contenido. ────────────
put('key', keys(D5, 2.6, 0.75, 1.0, 2.2, 1.6), 5.30, 0.30)
put('pad', pad([D3, E4, A3], 6.4, a=1.4, r=2.2), 5.30, 0.22)
put('sub', sub(D2, 6.0, a=0.6, r=1.8), 5.30, 0.34)
t = 5.30
while t < 10.6:                                      # corcheas alternas
    put('pls', blip(A5 if int((t - 5.3) / (BAR1 / 8)) % 2 else D6, 0.08, 0.55), t, 0.13)
    t += BAR1 / 8
put('key', keys(E5, 2.0, 0.5, 1.0, 2.0, 1.4), 8.05, 0.20)
put('key', keys(A5, 2.0, 0.42, 1.0, 2.0, 1.3), 9.42, 0.17)

# ── 10,5–16,3 s · crescendo. Se apilan capas, no se acelera el ritmo. ──
put('pad', pad([D3, Fs4, A3, D4], 6.6, a=1.2, r=1.8), 10.55, 0.30)
put('str', strings([Fs4, A4, D5], 6.2, a=1.6, r=1.6), 10.55, 0.20)
put('sub', sub(D2, 6.2, a=0.5, r=1.4), 10.55, 0.40)
t = 10.55
while t < 16.25:                                     # semicorcheas suaves
    k = int((t - 10.55) / (BAR1 / 16))
    put('pls', blip([D6, A5, E5 * 2, A5][k % 4], 0.065, 0.42 + 0.35 * (t - 10.55) / 5.7), t, 0.11)
    t += BAR1 / 16
# giro a si menor: la tensión antes del corte
put('pad', pad([B3, Fs4, D4], 3.0, a=0.9, r=1.2), 13.30, 0.24)
put('str', strings([B4, D5, Fs5], 3.0, a=1.2, r=1.0), 13.30, 0.16)
put('tex', riser(2.6, 0.7), CUT - 2.6, 0.16)

# ── 16,3 s · EL CORTE. No es un drop: es un vacío. ────────────────
#    Todo se para y queda un RE grave abierto. El silencio pesa más
#    que cualquier golpe, y además deja sitio al frenazo de los SFX.
put('sub', sub(A1 * 1.5, 2.2, a=0.006, r=0.9, gl=D1), CUT, 0.72)
put('key', keys(D3, 2.2, 0.85, 1.0, 3.0, 1.1), CUT, 0.20)
put('key', keys(D2, 2.2, 0.6, 1.0, 2.4, 1.2), CUT, 0.13)
# el pad se retira deprisa: el hueco ES la transición
put('pad', pad([D3, A3, D4, E4], 2.4, a=0.5, r=0.8), CUT, 0.15)
put('tex', shimmer(1.8, 2600, 5200, 0.4), CUT + 0.05, 0.035)

# ── 16,3–20 s · aire y precisión. Casi nada otra vez. ─────────────
put('key', keys(A4, 2.4, 0.42, 1.0, 1.9, 1.5), 18.10, 0.105)
put('key', keys(D5, 2.4, 0.34, 1.0, 1.8, 1.5), 19.20, 0.085)
for i in range(5):
    put('pls', blip(A5, 0.07, 0.34), 17.35 + i * 0.55, 0.030)

# ── 20–24,85 s · segundo crescendo. Aquí entra lo humano. ─────────
#    SOL (IV) para levantar y LA (V) para tensar: la única progresión
#    real de la pieza, y existe para que el pico resuelva de verdad.
put('pad', pad([G3, B3, D4, A4], 3.1, a=0.5, r=1.4), 20.00, 0.30)
put('str', strings([B4, D5, G5], 3.2, a=0.9, r=1.5), 20.00, 0.22)
put('sub', sub(G2, 3.0, a=0.25, r=1.2), 20.00, 0.42)
put('key', keys(D5, 2.2, 0.55, 1.0, 2.0, 1.5), 20.00, 0.24)
put('key', keys(B4, 2.0, 0.45, 1.0, 2.0, 1.3), 21.21, 0.20)

put('pad', pad([A2, Cs4, E4, A4], 2.6, a=0.5, r=1.0), 22.425, 0.30)
put('str', strings([Cs5, E5, A5], 2.8, a=0.8, r=1.2), 22.425, 0.24)
put('sub', sub(A1, 2.6, a=0.25, r=0.9), 22.425, 0.44)
put('key', keys(E5, 2.0, 0.5, 1.0, 2.0, 1.4), 22.425, 0.22)
put('key', keys(Cs5, 1.8, 0.45, 1.0, 2.0, 1.2), 23.64, 0.18)
t = 20.00
while t < PEAK - 0.05:                               # corcheas que respiran
    put('pls', blip([D6, A5, Fs5 * 2, A5][int((t - 20) / (BAR2 / 8)) % 4], 0.07,
                    0.35 + 0.5 * (t - 20) / 4.85), t, 0.10)
    t += BAR2 / 8
put('tex', riser(2.2, 0.55), PEAK - 2.2, 0.13)

# ── 24,85–28,8 s · el pico. RE mayor add9, abierto y sostenido. ───
#    Sostenido, no percutido: el impacto de los SFX cae justo aquí y
#    tiene que poder atravesar la música, no pelearse con ella.
put('sub', sub(D2, 5.4, a=0.05, r=2.4, gl=D1), PEAK, 1.15)
put('pad', pad([D3, A3, D4, E4, Fs4], 6.4, a=0.22, r=2.8), PEAK, 0.52)
put('str', strings([Fs5, A5, D6], 5.6, a=0.35, r=2.4), PEAK, 0.42)
put('str', strings([D4, Fs4, A4], 5.6, a=0.45, r=2.4), PEAK, 0.34)
put('key', keys(D5, 3.4, 0.8, 1.0, 2.4, 2.2), PEAK, 0.36)
put('key', keys(D4, 3.4, 0.6, 1.0, 2.0, 2.4), PEAK, 0.28)
put('key', keys(A5, 3.0, 0.4, 2.0, 1.6, 2.0), PEAK + 0.62, 0.14)
put('tex', shimmer(4.2, 2800, 6500, 0.6), PEAK, 0.055)
t = PEAK
while t < 27.6:
    put('pls', blip(D6, 0.06, 0.3), t, 0.07)
    t += BAR2 / 8

# ── 28,8–31 s · se despeja para la marca. ─────────────────────────
put('pad', pad([D3, A3, D4], 4.6, a=1.2, r=2.6), REVEAL, 0.105)
put('sub', sub(D1, 4.4, a=0.9, r=2.2), REVEAL, 0.24)

# ── 31–35 s · resolución final. Un RE add9 y silencio. ────────────
put('key', keys(D5, 3.4, 0.6, 1.0, 1.8, 2.6), 31.30, 0.135)
put('key', keys(E5, 3.2, 0.38, 1.0, 1.7, 2.4), 31.72, 0.088)
put('key', keys(A4, 3.2, 0.34, 1.0, 1.6, 2.4), 32.10, 0.075)
put('pad', pad([D2, D3, E4, A3], 4.2, a=1.4, r=2.6), 31.30, 0.145)
put('sub', sub(D1, 3.6, a=1.2, r=2.0), 31.30, 0.17)
put('tex', shimmer(3.0, 1400, 3000, 0.35), 31.30, 0.022)

# ═══════════════════════════════════════════════════════════════════
#  MEZCLA
#  El medio (1–4 kHz) se deja despejado a propósito: ahí viven los SFX
#  y una eventual locución. Por eso los pads llevan techo bajo y las
#  cuerdas se quedan por encima o por debajo de esa franja.
# ═══════════════════════════════════════════════════════════════════
print('  filtrando buses…')
tt = np.arange(N) / SR
# el pad abre el filtro con la pieza: es el crescendo, más que el volumen
cut = np.interp(tt, [0, 5.3, 10.5, CUT, CUT + 0.2, 20, PEAK, REVEAL, 35],
                     [420, 700, 1500, 2600, 900, 1500, 2800, 1200, 800])
BUS['pad'] = svf(BUS['pad'], cut, 0.75, 'lp')
BUS['str'] = svf(BUS['str'], np.interp(tt, [0, 15, PEAK, 35], [1800, 2600, 4200, 2200]), 0.8, 'lp')
BUS['key'] = onepole(BUS['key'], 6500)
BUS['pls'] = svf(BUS['pls'], np.full(N, 2400.0), 0.9, 'hp')
BUS['sub'] = onepole(BUS['sub'], 190)

BUS['pls'] = delay(BUS['pls'], BAR1 / 8 * 1.5, 0.32, 0.30)   # tresillo: espacio sin ritmo extra

def stereo(x, width, off=0.0):
    n = len(x)
    l = x.copy(); r = x.copy()
    if off:
        d = n_of(abs(off))
        if off > 0: r = np.concatenate([np.zeros(d), x[:-d]])
        else:       l = np.concatenate([np.zeros(d), x[:-d]])
    m = (l + r) * 0.5; s = (l - r) * 0.5
    m2 = m + s * width
    s2 = m - s * width
    return np.stack([m2, s2], axis=1)

print('  espacializando y reverberando…')
mix = np.zeros((N, 2))
mix += stereo(BUS['sub'], 0.0) * 1.00
mix += stereo(BUS['pad'], 1.0, 0.011) * 0.95
mix += stereo(BUS['str'], 1.0, -0.014) * 0.95
mix += stereo(BUS['key'], 0.5, 0.004) * 1.00
mix += stereo(BUS['pls'], 0.9, 0.007) * 1.00
mix += stereo(BUS['tex'], 1.0, -0.009) * 0.55

wet_src = (BUS['pad'] * 0.40 + BUS['str'] * 0.60 + BUS['key'] * 0.50 +
           BUS['tex'] * 0.5 + BUS['pls'] * 0.22)
# La cola se filtra por arriba y por abajo: sin esto rellenaba los huecos
# de la pieza —y los huecos son la mitad del encargo— y embarraba el grave.
wet = conv(wet_src, HALL)
wet = svf(wet, np.full(len(wet), 260.0), 0.7, 'hp')
wet = onepole(wet, 5200)
room = conv(BUS['key'] * 0.5 + BUS['pls'] * 0.4, ROOM)
mix += stereo(wet, 1.0, 0.017) * 0.30
mix += stereo(room, 0.8, -0.006) * 0.18

# limpieza final
mix[:, 0] = svf(mix[:, 0], np.full(N, 28.0), 0.7, 'hp')
mix[:, 1] = svf(mix[:, 1], np.full(N, 28.0), 0.7, 'hp')
mix = np.tanh(mix * 0.85) / np.tanh(0.85)

end = n_of(DUR)
mix = mix[:end]
f = n_of(0.9)
mix[-f:] *= np.linspace(1, 0, f)[:, None]
mix[:n_of(0.02)] *= np.linspace(0, 1, n_of(0.02))[:, None]

pk = np.max(np.abs(mix))
mix = mix / pk * (10 ** (-7.5 / 20.0))     # cabecera para SFX y locución
rms = np.sqrt((mix ** 2).mean())
print('  pico %.1f dBFS · RMS %.1f dBFS' % (20 * math.log10(pk), 20 * math.log10(rms)))

out = OUT
if '--out' in sys.argv: out = sys.argv[sys.argv.index('--out') + 1]
d = (np.clip(mix, -1, 1).reshape(-1) * (2 ** 23 - 1)).astype('<i4')
b = np.frombuffer(d.tobytes(), dtype=np.uint8).reshape(-1, 4)[:, :3].tobytes()
w = wave.open(out, 'wb'); w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
w.writeframes(b); w.close()
print('  → %s  (%.1f s · %.0f KB)' % (out, len(mix) / SR, os.path.getsize(out) / 1024))
