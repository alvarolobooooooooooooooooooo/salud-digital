#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# gen-sfx.py — Diseño por síntesis de los SFX del launch
# ───────────────────────────────────────────────────────────────────
# No son tonos de relleno: cada sonido se construye con las capas que
# le tocan (sub con envolvente de tono, transitorio filtrado, cuerpo
# armónico, cola por convolución) usando la misma técnica de los packs
# de interfaz premium.
#
# Todos comparten familia tonal —Dsus2 (D · E · A)— para que se oigan
# del mismo sitio, y todos salen con headroom: el motor tiene su propia
# mezcla y nada debe llegar a clipear.
#
# Uso:  python3 tools/gen-sfx.py [--only nombre]
# ═══════════════════════════════════════════════════════════════════
import numpy as np, wave, os, sys, math

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'sfx')

# Familia tonal: Dsus2. Cálido y neutro; el menor sonaba a tráiler y el
# mayor a corporativo de stock.
D1, D2, D3, D4, D5 = 36.71, 73.42, 146.83, 293.66, 587.33
E3, E4 = 164.81, 329.63
A2, A3, A4, A5 = 110.0, 220.0, 440.0, 880.0

rng = np.random.default_rng(20260825)

# ── utilidades ─────────────────────────────────────────────────────
def n_of(sec): return int(SR * sec)
def ts(n): return np.arange(n) / SR

def ramp(n, a=0.0, b=1.0, curve=1.0):
    x = np.linspace(0, 1, n) ** curve
    return a + (b - a) * x

def env(n, atk, dec, curve=2.5, hold=0.0):
    """Ataque lineal corto, caída exponencial. La caída manda el carácter."""
    e = np.zeros(n)
    na, nh = n_of(atk), n_of(hold)
    na = max(1, min(na, n))
    e[:na] = np.linspace(0, 1, na)
    rest = n - na - nh
    if nh: e[na:na+nh] = 1.0
    if rest > 0:
        e[na+nh:] = np.exp(-np.linspace(0, curve * 5, rest))
    return e

def glide(f0, f1, n, curve=2.0):
    """Sine con frecuencia variable: se integra la fase, si no hay saltos."""
    f = f0 + (f1 - f0) * (np.linspace(0, 1, n) ** curve)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)

def pink(n):
    """Ruido rosa por conformado espectral: 1/f. Menos áspero que el blanco."""
    w = rng.standard_normal(n)
    F = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1] if len(f) > 1 else 1.0
    F /= np.sqrt(f)
    x = np.fft.irfft(F, n)
    return x / (np.max(np.abs(x)) + 1e-9)

def svf(x, fc, q=0.9, mode='bp'):
    """Filtro de variable de estado con corte VARIABLE en el tiempo.
       Hace falta que el corte se mueva: los barridos son el 80% del
       carácter de un whoosh, y con un filtro fijo no existen.

       Los topes de f y dq no son cosmética: este filtro se dispara a
       infinito en cuanto f + 1/q se acerca a 2, y a 11 kHz con Q bajo
       eso pasa. Por eso el corte suave de agudos usa un polo simple."""
    x = np.asarray(x, dtype=float)
    if x.ndim == 2:
        return np.stack([svf(x[:, c], fc, q, mode) for c in range(x.shape[1])], axis=1)
    n = len(x)
    fc = np.clip(np.asarray(fc, dtype=float) * np.ones(n), 20.0, SR * 0.24)
    f = np.minimum(2.0 * np.sin(np.pi * fc / SR), 0.95)
    dq = min(1.0 / q, 1.0)
    low = band = 0.0
    out = np.empty(n)
    if mode == 'lp':
        for i in range(n):
            hi = x[i] - low - dq * band
            band += f[i] * hi
            low += f[i] * band
            out[i] = low
    elif mode == 'hp':
        for i in range(n):
            hi = x[i] - low - dq * band
            band += f[i] * hi
            low += f[i] * band
            out[i] = hi
    else:
        for i in range(n):
            hi = x[i] - low - dq * band
            band += f[i] * hi
            low += f[i] * band
            out[i] = band
    return out

def fftconv(x, ir):
    n = len(x) + len(ir) - 1
    N = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:n]
    return y

def make_ir(dur=1.2, decay=5.0, bright=4200.0):
    """Cola sintética. Con un delay simple sonaría a eco; esto suena a sala."""
    n = n_of(dur)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, decay, n))
    ir = svf(ir, np.linspace(bright, 700, n), 0.7, 'lp')
    ir[:n_of(0.004)] *= np.linspace(0, 1, n_of(0.004))
    return ir / (np.max(np.abs(ir)) + 1e-9) * 0.5

def verb(x, amount=0.25, dur=1.1, decay=5.0, bright=4200.0):
    ir = make_ir(dur, decay, bright)
    wet = fftconv(x, ir)[:len(x) + n_of(dur)]
    dry = np.zeros(len(wet)); dry[:len(x)] = x
    return dry + wet * amount

def soft(x, drive=1.0):
    """Saturación blanda: quita picos sin que se oiga distorsión."""
    return np.tanh(x * drive) / np.tanh(drive)

def onepole_lp(x, fc):
    """Polo simple: estable a cualquier frecuencia, que es justo lo que
       necesita el techo de agudos."""
    x = np.asarray(x, dtype=float)
    if x.ndim == 2:
        return np.stack([onepole_lp(x[:, c], fc) for c in range(x.shape[1])], axis=1)
    a = math.exp(-2.0 * math.pi * fc / SR)
    y = np.empty(len(x)); prev = 0.0
    for i in range(len(x)):
        prev = (1 - a) * x[i] + a * prev
        y[i] = prev
    return y

def air(x, cut=11000.0):
    """Techo suave: por encima de esto sólo hay aspereza digital."""
    return onepole_lp(x, cut)

def dcblock(x, fc=18.0):
    """Quita la componente continua. Un offset de 0,01 no se oye como
       tono pero se come headroom y da un golpe sordo en algunos equipos."""
    x = np.asarray(x, dtype=float)
    if x.ndim == 2:
        return np.stack([dcblock(x[:, c], fc) for c in range(x.shape[1])], axis=1)
    a = math.exp(-2.0 * math.pi * fc / SR)
    y = np.empty(len(x)); xp = yp = 0.0
    for i in range(len(x)):
        yp = a * yp + x[i] - xp
        xp = x[i]; y[i] = yp
    return y

def fit(a, n):
    if len(a) >= n: return a[:n]
    return np.concatenate([a, np.zeros(n - len(a))])

def st(l, r=None, width=1.0):
    if r is None: r = l.copy()
    m = (l + r) * 0.5
    s = (l - r) * 0.5 * width
    return np.stack([m + s, m - s], axis=1)

def pan_sweep(x, a=-0.9, b=0.9):
    p = np.linspace(a, b, len(x))
    ang = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(ang), x * np.sin(ang)], axis=1)

def norm(sig, peak_db=-6.0):
    """El fundido de ENTRADA es de 0,6 ms a propósito: con los 4 ms de
       antes, un transitorio como el clic tenía su pico dentro del propio
       fundido y salía 2 dB por debajo de lo pedido."""
    sig = np.asarray(sig, dtype=float)
    if sig.ndim == 1: sig = st(sig)
    ni, no = n_of(0.0006), n_of(0.005)
    if len(sig) > ni + no:
        sig[:ni] *= np.linspace(0, 1, ni)[:, None]
        sig[-no:] *= np.linspace(1, 0, no)[:, None]
    pk = np.max(np.abs(sig)) + 1e-12
    return sig / pk * (10 ** (peak_db / 20.0))

def seamless(sig, xf=0.25):
    """Bucle sin costura: la cola se funde sobre la cabeza y se recorta."""
    if sig.ndim == 1: sig = st(sig)
    L = n_of(xf); n = len(sig)
    fi = np.linspace(0, 1, L)[:, None]
    head = sig[:L] * fi + sig[n - L:] * (1 - fi)
    out = np.concatenate([head, sig[L:n - L]])
    return out

def write(name, sig, peak_db=-6.0, loop=False):
    sig = np.asarray(sig, dtype=float)
    if sig.ndim == 1: sig = st(sig)
    sig = dcblock(sig)
    if loop:
        pk = np.max(np.abs(sig)) + 1e-12
        sig = sig / pk * (10 ** (peak_db / 20.0))
        sig = seamless(sig)
    else:
        sig = norm(sig, peak_db)
    sig = np.clip(sig, -1.0, 1.0)
    d = (sig.reshape(-1) * (2 ** 23 - 1)).astype('<i4')
    b = np.frombuffer(d.tobytes(), dtype=np.uint8).reshape(-1, 4)[:, :3].tobytes()
    p = os.path.join(OUT, name + '.wav')
    w = wave.open(p, 'wb'); w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
    w.writeframes(b); w.close()
    print('  %-22s %5.2f s  %6.0f KB' % (name + '.wav', len(sig) / SR, os.path.getsize(p) / 1024))

# ═══════════════════════════════════════════════════════════════════
#  LOS SONIDOS
# ═══════════════════════════════════════════════════════════════════

def logo_pulse():
    """Formación → impacto contenido → resonancia elegante."""
    n = n_of(1.3)
    sub = glide(D2 * 1.5, D1, n, 1.6) * env(n, 0.004, 1.0, 1.4)
    body = sum(glide(f, f * 0.995, n, 1) * env(n, 0.006, 0.75, 2.2) * a
               for f, a in [(D3, 0.45), (A3, 0.28), (D4, 0.20), (E4, 0.10)])
    body = svf(body, np.linspace(2600, 900, n), 0.8, 'lp')
    tr = svf(pink(n_of(0.09)), np.linspace(2400, 700, n_of(0.09)), 1.1, 'bp')
    tr *= env(n_of(0.09), 0.0015, 0.07, 3.0) * 0.5
    x = sub * 0.95 + body * 0.55 + fit(tr, n) * 0.35
    x = verb(x, 0.22, 0.55, 6.5, 3600)
    return air(soft(x, 1.2))

def connection_bloom():
    """Puntos conectándose: densidad creciente de granos afinados."""
    n = n_of(2.3)
    out = np.zeros(n + n_of(0.3))
    pitches = [D4, E4, A4, D5, E4 * 2, A5]
    # la densidad crece: el instante de cada grano sale de una rampa
    k = 62
    u = np.sort(rng.random(k) ** 1.9)           # se apelmazan al final
    for i, uu in enumerate(u):
        st_i = int(uu * n_of(1.95))
        dur = n_of(0.012 + rng.random() * 0.05)
        f = pitches[rng.integers(len(pitches))] * (1 + (rng.random() - .5) * 0.006)
        g = np.sin(2 * np.pi * f * ts(dur)) * env(dur, 0.001, dur / SR * 0.9, 2.6)
        g *= 0.03 + 0.62 * uu
        out[st_i:st_i + dur] += fit(g, dur)
    shimmer = svf(pink(n), np.linspace(1800, 5200, n), 1.4, 'bp')
    shimmer *= ramp(n, 0.0, 0.5, 3.2) * np.concatenate([np.ones(n_of(1.9)), np.linspace(1, 0, n - n_of(1.9))])
    x = fit(out, n) * 0.9 + shimmer * 0.16
    x = verb(x, 0.28, 0.7, 5.5, 5200)
    return air(x)

def data_activation():
    """Un sistema complejo que acaba de encenderse. Contenido."""
    n = n_of(2.4)
    bed = svf(pink(n), np.exp(np.linspace(np.log(180), np.log(4200), n)), 0.9, 'lp')
    bed *= ramp(n, 0, 1, 1.5) * np.concatenate([np.ones(n_of(1.7)), np.linspace(1, 0, n - n_of(1.7))]) * 0.4
    pad = np.zeros(n)
    for f, a in [(D3, .5), (E3, .3), (A3, .38), (D4, .22)]:
        for det in (-0.4, 0.4):
            pad += np.sin(2 * np.pi * (f + det) * ts(n)) * a
    pad *= ramp(n, 0, 1, 2.2) * np.concatenate([np.ones(n_of(1.75)), np.linspace(1, 0, n - n_of(1.75))]) * 0.13
    pad = svf(pad, np.linspace(700, 2400, n), 0.8, 'lp')
    pings = np.zeros(n)
    for i, (tt, f) in enumerate([(1.30, D5), (1.46, A4), (1.62, E4 * 2)]):
        s = n_of(tt); d = n_of(0.22)
        pings[s:s + d] += np.sin(2 * np.pi * f * ts(d)) * env(d, 0.002, 0.18, 3.0) * (0.16 - i * 0.03)
    x = bed + pad + pings
    x = verb(x, 0.24, 0.7, 5.5, 4200)
    return air(x)

def ui_morph():
    """Transitorio suave + whoosh + capa tonal. Acaba con el morph."""
    n = n_of(1.05)
    fc = np.concatenate([np.linspace(420, 2500, n_of(.55)), np.linspace(2500, 850, n - n_of(.55))])
    wh = svf(pink(n), fc, 1.0, 'bp') * (np.sin(np.linspace(0, np.pi, n)) ** 1.3) * 0.85
    ton = glide(A4, D5, n, 1.4) * env(n, 0.12, 0.5, 2.0) * 0.13
    ton = svf(ton, np.linspace(1800, 3000, n), 0.7, 'lp')
    click = svf(pink(n_of(0.05)), np.linspace(1900, 900, n_of(0.05)), 1.3, 'bp')
    click *= env(n_of(0.05), 0.001, 0.04, 3.0) * 0.30
    x = wh + ton
    x[n_of(0.88):n_of(0.88) + n_of(0.05)] += click
    x = verb(x, 0.15, 0.35, 7.0, 4000)
    return air(x)

def camera_acceleration():
    """Empieza casi inaudible y sube en intensidad y tono."""
    n = n_of(0.95)
    fc = np.exp(np.linspace(np.log(150), np.log(3200), n))
    wh = svf(pink(n), fc, 1.1, 'bp') * ramp(n, 0.0, 1.0, 2.8)
    low = glide(A2, A4 * 0.55, n, 2.4) * ramp(n, 0, 0.30, 3.0)
    x = wh * 0.9 + low
    x[-n_of(0.05):] *= np.linspace(1, 0.25, n_of(0.05))
    return air(soft(x, 1.1))

def high_speed_pass():
    """Pase rápido con Doppler: el barrido cruza justo en el centro."""
    n = n_of(0.62)
    half = n // 2
    fc = np.concatenate([np.exp(np.linspace(np.log(600), np.log(3000), half)),
                         np.exp(np.linspace(np.log(3000), np.log(700), n - half))])
    core = svf(pink(n), fc, 1.25, 'bp')
    core = svf(core, np.full(n, 220.0), 0.7, 'hp')        # sin retumbe
    amp = np.sin(np.linspace(0, np.pi, n)) ** 1.6
    body = svf(pink(n), fc * 0.45, 0.9, 'bp') * amp * 0.35
    x = core * amp + body
    return air(pan_sweep(x, -0.85, 0.85) * 1.0)

def cinematic_brake():
    """RÁPIDO → PARADO. Succión, transitorio y una cola corta."""
    n = n_of(1.55)
    stop = n_of(0.72)
    suck = svf(pink(stop), np.exp(np.linspace(np.log(3200), np.log(240), stop)), 1.15, 'bp')
    suck *= ramp(stop, 0.05, 1.0, 2.6)
    x = np.zeros(n); x[:stop] += suck * 0.75
    d = n - stop
    x[stop:] += glide(D2, D1 * 0.9, d, 1.5) * env(d, 0.003, 0.55, 2.0) * 0.9
    tr = svf(pink(n_of(0.06)), np.linspace(1500, 500, n_of(0.06)), 1.2, 'bp')
    x[stop:stop + n_of(0.06)] += tr * env(n_of(0.06), 0.001, 0.05, 3.0) * 0.35
    ring = sum(np.sin(2 * np.pi * f * ts(d)) * a for f, a in [(D3, .28), (A3, .16)])
    x[stop:] += ring * env(d, 0.01, 0.42, 2.6) * 0.4
    x = verb(x, 0.20, 0.5, 7.0, 3000)
    return air(soft(x, 1.15))

def data_flow():
    """Cama casi subliminal. Bucle sin costura."""
    n = n_of(3.2)
    t = ts(n)
    # moduladores con periodo entero dentro del bucle → el loop cierra
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * (1 / 3.2) * t)
    bed = svf(pink(n), 900 + 700 * lfo, 1.2, 'bp') * (0.22 + 0.18 * lfo)
    blips = np.zeros(n)
    for i in range(22):
        s = int(i / 22 * n)
        d = n_of(0.018)
        f = [D5, A5, E4 * 4, D5 * 1.5][i % 4]
        blips[s:s + d] += np.sin(2 * np.pi * f * ts(d)) * env(d, 0.001, 0.014, 3.0) * 0.09
    x = bed + blips
    return air(svf(x, np.full(n, 260.0), 0.7, 'hp'))

def ui_click():
    """Preciso, suave, táctil. Ni metálico ni de sistema operativo."""
    n = n_of(0.17)
    tr = svf(pink(n), np.linspace(2600, 1200, n), 1.4, 'bp') * env(n, 0.0008, 0.028, 3.2)
    thock = np.sin(2 * np.pi * A3 * ts(n)) * env(n, 0.001, 0.045, 3.0) * 0.5
    top = np.sin(2 * np.pi * D5 * 1.5 * ts(n)) * env(n, 0.0008, 0.02, 3.4) * 0.16
    x = tr * 0.7 + thock + top
    return air(soft(x, 1.1), 9000)

def device_shift():
    """Whoosh muy corto con una textura tecnológica sutil."""
    n = n_of(0.58)
    fc = np.concatenate([np.linspace(820, 2300, n_of(.3)), np.linspace(2300, 950, n - n_of(.3))])
    wh = svf(pink(n), fc, 1.15, 'bp') * (np.sin(np.linspace(0, np.pi, n)) ** 1.4)
    grains = np.zeros(n)
    for i in range(7):
        s = int(rng.random() * n_of(0.42)); d = n_of(0.014)
        f = [A4, D5, E4 * 2][i % 3]
        grains[s:s + d] += np.sin(2 * np.pi * f * ts(d)) * env(d, 0.001, 0.011, 3.0) * 0.12
    low = glide(A2 * 0.9, A2 * 1.4, n, 1.6) * (np.sin(np.linspace(0, np.pi, n)) ** 2) * 0.22
    x = wh * 0.8 + grains + low
    x = verb(x, 0.12, 0.25, 8.0, 4000)
    return air(x)

def final_riser():
    """Anticipación → tensión → entrega. Con un hueco al final."""
    n = n_of(1.7)
    fc = np.exp(np.linspace(np.log(320), np.log(6000), n))
    bed = svf(pink(n), fc, 0.95, 'lp') * ramp(n, 0.02, 1.0, 2.6) * 0.5
    ton = np.zeros(n)
    for f, a in [(D3, .5), (A3, .34), (D4, .24), (E4, .14)]:
        ton += glide(f, f * 1.12, n, 3.2) * a
    ton *= ramp(n, 0.0, 1.0, 2.4) * 0.22
    ton = svf(ton, np.linspace(900, 5000, n), 0.8, 'lp')
    puls = np.zeros(n)                       # tren de pulsos que acelera
    p, i = 0.0, 0
    while p < 1.58:
        s = n_of(p); d = n_of(0.05)
        if s + d < n:
            puls[s:s + d] += np.sin(2 * np.pi * D4 * ts(d)) * env(d, 0.002, 0.04, 3.0) * (0.05 + 0.10 * p)
        p += max(0.055, 0.30 * (1 - p / 1.75) ** 1.4); i += 1
    x = bed + ton + puls
    # el hueco antes del impacto: es lo que hace que el golpe suene grande
    g = n_of(0.075)
    x[-g:] *= np.linspace(1, 0.05, g)
    return air(soft(x, 1.1))

def final_impact():
    """El sonido más importante: profundo, limpio, memorable."""
    n = n_of(3.0)
    sub = glide(A2 * 0.75, D1, n, 1.3) * env(n, 0.004, 1.7, 1.3) * 1.0
    body = sum(glide(f, f * 0.997, n, 1) * env(n, 0.006, 1.0, 1.9) * a
               for f, a in [(D2, .55), (A2, .30), (D3, .30), (A3, .16), (D4, .10)])
    body = svf(body, np.linspace(2200, 700, n), 0.85, 'lp')
    tr = svf(pink(n_of(0.12)), np.linspace(3000, 800, n_of(0.12)), 1.15, 'bp')
    tr *= env(n_of(0.12), 0.0012, 0.09, 3.0) * 0.55
    bloom = svf(pink(n), np.linspace(2600, 7000, n), 1.2, 'bp')
    bloom *= env(n, 0.05, 0.75, 2.4) * 0.14
    x = sub * 1.0 + body * 0.6 + fit(tr, n) * 0.4 + bloom
    x = verb(x, 0.32, 1.1, 4.5, 3400)
    return air(soft(x, 1.25))

def ambience():
    """Cama de fondo del vacío. Bucle largo, casi inaudible."""
    n = n_of(14.0)
    t = ts(n)
    drone = np.zeros(n)
    for f, a, per in [(D1, .5, 14.0), (D2, .30, 7.0), (A2, .16, 14.0 / 3)]:
        lf = 0.6 + 0.4 * np.sin(2 * np.pi * (1 / per) * t)
        drone += np.sin(2 * np.pi * f * t) * a * lf
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * (1 / 14.0) * t)
    hiss = svf(pink(n), 400 + 900 * lfo, 0.9, 'bp') * (0.10 + 0.06 * lfo)
    x = drone * 0.35 + hiss
    return air(svf(x, np.full(n, 40.0), 0.7, 'hp'), 8000)

SOUNDS = [
    ('logo-pulse',          logo_pulse,          -6.5, False),
    ('connection-bloom',    connection_bloom,    -9.0, False),
    ('data-activation',     data_activation,     -9.5, False),
    ('ui-morph',            ui_morph,            -8.0, False),
    ('camera-acceleration', camera_acceleration, -9.0, False),
    ('high-speed-pass',     high_speed_pass,     -7.5, False),
    ('cinematic-brake',     cinematic_brake,     -5.0, False),
    ('data-flow',           data_flow,          -20.0, True),
    ('ui-click',            ui_click,           -11.0, False),
    ('device-shift',        device_shift,        -9.5, False),
    ('final-riser',         final_riser,         -8.0, False),
    ('final-impact',        final_impact,        -3.5, False),
    ('ambience',            ambience,           -22.0, True),
]

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    only = None
    if '--only' in sys.argv: only = sys.argv[sys.argv.index('--only') + 1]
    print('Sintetizando SFX  ·  48 kHz · 24 bit · estéreo\n')
    for name, fn, pk, loop in SOUNDS:
        if only and name != only: continue
        write(name, fn(), pk, loop)
    print('\n→ ' + os.path.abspath(OUT))
