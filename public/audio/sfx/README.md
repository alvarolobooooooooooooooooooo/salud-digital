# SFX del launch de Salud Digital

Los 13 archivos están **diseñados por síntesis** con
`python3 tools/gen-sfx.py` (numpy). No son tonos de relleno: cada uno se
construye con sus capas —sub con envolvente de tono, transitorio
filtrado, cuerpo armónico, cola por convolución— y todos comparten
familia tonal, **Dsus2 (D · E · A)**, para que se oigan del mismo sitio.

Lo que la síntesis NO da es la calidez de una grabación real (metal,
aire, materiales). Si más adelante consigues librería, **sustituye el
archivo y ya está**: mismo nombre, misma carpeta, cero código. Para
regenerar uno solo: `python3 tools/gen-sfx.py --only logo-pulse`.

---

## Dónde van

```
Salud digital/public/audio/sfx/<nombre>.wav
```

Formato recomendado: **WAV 48 kHz, 24 bit, mono o estéreo**. El sistema
también acepta `.mp3`/`.m4a` si se cambia la extensión en el catálogo
(`public/launch/audio.js`, objeto `REGISTRY`).

Deja **al menos 3 dB de headroom** en cada archivo: el motor ya aplica su
propia mezcla por canal y no debe llegar a clipear.

---

## Los doce archivos


| Archivo | Canal | Duración | Qué tiene que contar |
|---|---|---|---|
| `logo-pulse.wav` | logo | 0,8–1,5 s | El logotipo cuaja. Pulso grave y limpio con una resonancia corta y elegante. Nada de bass drop ni de láser. |
| `connection-bloom.wav` | logo | 1,5–2,5 s | Puntos de información conectándose. Partículas digitales suaves, textura armónica, densidad creciente. |
| `data-activation.wav` | transitions | 1,5–2,5 s | Un sistema complejo que acaba de encenderse. Contenido, sin aspaviento. |
| `ui-morph.wav` | transitions | 0,8–1,4 s | La red se convierte en interfaz. Transitorio suave + whoosh + una capa tonal. Tiene que **acabar cuando acaba el morph**. |
| `camera-acceleration.wav` | transitions | 0,6–1,0 s | Arranca casi inaudible y sube en intensidad y tono. Aceleración física. |
| `high-speed-pass.wav` | transitions | 0,4–0,8 s | El pase rápido por delante de una pantalla. Limpio y con fuerza, nunca agresivo. Ni avión ni nave. |
| `cinematic-brake.wav` | impacts | 0,8–1,6 s | De rápido a parado. Succión invertida + transitorio grave + resonancia corta. Una cámara frenando con precisión, no un accidente. |
| `data-flow.wav` | ui | **loop, 2–4 s** | Cama casi subliminal: pulsos diminutos, brillo digital suave. Tiene que enlazar consigo misma sin costura. |
| `ui-click.wav` | ui | 0,1–0,3 s | Interacción precisa, suave, táctil. No un clic de sistema operativo. |
| `device-shift.wav` | transitions | 0,4–0,7 s | Cambio de formato. Whoosh muy corto con una textura tecnológica sutil. |
| `final-riser.wav` | impacts | **1,7 s** | Anticipación → tensión → entrega. Elegante, no tráiler. Debe resolver exactamente en el impacto. |
| `final-impact.wav` | impacts | 1,5–3 s | El sonido más importante del film. Profundo, limpio, memorable. Revelación de marca tecnológica, no explosión. |

### Opcional

| Archivo | Canal | Duración | Qué es |
|---|---|---|---|
| `ambience.wav` | ambience | **loop, 8–20 s** | Cama de fondo para todo el film. Si no está, el launch suena igual de bien: no cuenta como pendiente. |

---

## Cuándo suena cada uno

Los tiempos **no están escritos a mano**: se derivan al arrancar,
muestreando la pista de cámara del film. `cuesheet.txt` (en esta misma
carpeta) tiene la tabla completa, con el nivel y el tono de cada
disparo. Se regenera con:

```
node tools/sfx-cuesheet.js
```

Detalle que importa para el diseño: `high-speed-pass` suena **cuatro
veces** en la rampa, y el nivel y el tono de cada una salen de la
velocidad **medida** de la cámara en ese instante. Por eso los cuatro
pases suenan emparentados pero no idénticos. Basta con entregar **un**
archivo; el sistema hace el resto.

Lo mismo con `data-flow`: es una cama en bucle cuyo volumen respira con
la velocidad de la cámara mientras dura la escena del flujo.

---

## Probarlos

Abre `/launch.html`, pulsa el botón de sonido (abajo a la izquierda) y
luego **D** para el panel de desarrollo. Abajo hay un banco de pruebas:
cada sonido se dispara suelto y un punto indica si el archivo está
(verde), falta (ámbar) o es opcional (gris). También hay faders por
canal para ajustar la mezcla en caliente.

---

## Mezcla

Niveles por canal en `public/launch/audio.js` (`CATEGORIES`), y el nivel
propio de cada sonido dentro de su canal en `REGISTRY`. El master arranca
a 0,9 para dejar aire.

```
master 0.90
├─ logo         0.90    logo-pulse · connection-bloom
├─ transitions  0.85    ui-morph · camera-acceleration · high-speed-pass · device-shift · data-activation
├─ ui           0.80    ui-click · data-flow
├─ impacts      1.00    cinematic-brake · final-riser · final-impact
└─ ambience     0.60    ambience
```


---

## La banda sonora

`public/audio/launch-score.wav` es el máster (35 s, 48 kHz/24 bit) y
`launch-score.m4a` la versión que carga la página. Los genera
`python3 tools/gen-music.py`.

Misma tonalidad que los efectos —**RE**— para que música y sonido
pertenezcan al mismo sitio. El armazón es un **pedal de RE** con las
voces de arriba moviéndose; solo hay dos movimientos armónicos reales
(el IV en el segundo crescendo y el V que lo tensa) y existen para que
la resolución del pico signifique algo.

El tempo **no** es constante: 87 BPM hasta el corte, tiempo libre en el
tramo de aire, y 99 BPM en el segundo crescendo. La aceleración se nota
sin que nadie la cuente, y evita el patrón rítmico continuo que el
encargo descartaba.

En la página, la música va **anclada al reloj del film**: al pausar se
para y al saltar reentra con desplazamiento, no desde el principio.

El medio (1–4 kHz) se deja despejado a propósito: ahí viven los efectos
y cabría una locución.
