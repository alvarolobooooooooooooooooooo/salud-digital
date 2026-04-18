# Guía de Uso del Odontograma Profesional

## Uso Básico

### Inicializar Odontograma (Editable)
```javascript
// En tu contenedor (div con id="odontogramContainer")
const odontogram = new OdontogramContainer('odontogramContainer', {}, false);

// Parámetros:
// - 'odontogramContainer': ID del div contenedor
// - {}: Estado inicial (vacío = todos sanos)
// - false: No es solo lectura (editable)
```

### Inicializar Odontograma (Solo Lectura)
```javascript
const odontogram = new OdontogramContainer('odontogramContainer', {}, true);
// true = solo lectura, sin herramientas de edición
```

### Cargar Estado Guardado
```javascript
// Obtener estado del servidor
const patientData = await fetch(`/api/patients/${id}`).then(r => r.json());
const savedState = JSON.parse(patientData.odontogram_state || '{}');

// Crear odontograma con estado guardado
const odontogram = new OdontogramContainer('odontogramContainer', savedState, false);
```

### Guardar Estado
```javascript
// Obtener estado actual
const state = odontogram.getState();

// Enviar al servidor
await fetch(`/api/patients/${id}/odontogram`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ odontogram_state: state })
});
```

---

## Estructura del Estado

### Ejemplo Completo
```javascript
{
  18: {  // Diente FDI 18
    condition: 'crown',              // Condición del diente completo
    surfaces: {                       // Condiciones por superficie
      occlusal: 'caries',
      mesial: 'healthy'
    },
    isSelected: false                 // Estado UI (se regenera)
  },
  17: {
    condition: 'healthy',
    surfaces: {},
    isSelected: false
  },
  // ... resto de dientes (11-48)
}
```

### Condiciones Disponibles
```
'healthy'     - Sano
'caries'      - Caries
'restoration' - Resina
'amalgam'     - Amalgama
'crown'       - Corona
'implant'     - Implante
'endodontic'  - Endodoncia
'bridge'      - Puente
'missing'     - Ausente
'extraction'  - Extracción
'sealant'     - Sellante
'fracture'    - Fractura
```

### Superficies (por tipo de diente)
```javascript
// Incisivos y Caninos (5 superficies)
['mesial', 'distal', 'buccal', 'lingual', 'incisal']

// Premolares y Molares (5 superficies)
['mesial', 'distal', 'buccal', 'lingual', 'occlusal']
```

---

## Numeración FDI

### Sistema FDI (ISO 3950) - 4 Dígitos

```
        18  17  16  15  14  13  12  11
        ————————————— Superior ————————————
Derecha |                              | Izquierda
        ————————————— Inferior ————————————
        48  47  46  45  44  43  42  41
        
        38  37  36  35  34  33  32  31
        ————————————— Inferior ————————————
Izquierda|                            | Derecha
        ————————————— Inferior ————————————
        31  32  33  34  35  36  37  38
```

### Desglose FDI
- **Primer dígito**: Quadrante (1=Super-Der, 2=Super-Izq, 3=Inf-Izq, 4=Inf-Der)
- **Segundo dígito**: Posición en el quadrante (1-8, de centro a fondo)

Ejemplos:
- `18`: Primer molar superior derecho
- `11`: Incisivo central superior derecho
- `48`: Tercer molar inferior derecho
- `37`: Segundo molar inferior izquierdo

---

## Métodos Públicos

### getState()
```javascript
const currentState = odontogram.getState();
// Retorna: { fdi: { condition, surfaces, isSelected } }
```

### setState(newState)
```javascript
const newState = JSON.parse(savedData);
odontogram.setState(newState);
// Re-renderiza el odontograma con el nuevo estado
```

### setReadOnly(readOnly)
```javascript
odontogram.setReadOnly(true);  // Cambiar a solo lectura
odontogram.setReadOnly(false); // Cambiar a editable
```

---

## Personalización

### Cambiar Colores de Condiciones
Editar `odontogram.types.js`, objeto `CONDITIONS`:

```javascript
const CONDITIONS = {
  CARIES: { id: 'caries', label: 'Caries', color: '#ef4444', icon: '●' },
  // Cambiar color: '#ef4444' → '#tu-color'
};
```

### Agregar Nueva Condición
1. Editar `odontogram.types.js`
2. Agregar entrada a `CONDITIONS`
3. Agregar a `CONDITION_LIST` (orden importa para UI)
4. Listo - aparece automáticamente en toolbar y leyenda

Ejemplo:
```javascript
FLUOROSIS: { 
  id: 'fluorosis', 
  label: 'Fluorosis',
  color: '#6366f1',  // Índigo
  icon: '◇' 
}
```

### Cambiar Iconos
Los iconos (pequeños símbolos en superficies y toolbar) están en la propiedad `icon` de cada condición.

Opciones útiles:
```
●  ○  ◆  ◇  ■  □  ▲  △  ⬢  ◎  
⊗  ⧗  ✕  ✓  ⚡  ▬  ⎺  ★  ◉
```

---

## Integración con Backend

### Endpoint Requerido
```
PUT /api/patients/:id/odontogram
Content-Type: application/json

{
  "odontogram_state": "{...JSON string del estado...}"
}
```

### Ejemplo Node.js/Express
```javascript
router.put('/api/patients/:id/odontogram', authenticate, async (req, res) => {
  const { odontogram_state } = req.body;
  
  // Validar JSON válido
  try {
    JSON.parse(odontogram_state);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  // Guardar en DB
  await db.patients.update(
    { id: req.params.id },
    { odontogram_state }
  );
  
  res.json({ ok: true });
});
```

### Ejemplo Lectura
```javascript
router.get('/api/patients/:id', authenticate, async (req, res) => {
  const patient = await db.patients.findById(req.params.id);
  
  // El estado viene como string JSON
  const odontogramState = patient.odontogram_state 
    ? JSON.parse(patient.odontogram_state)
    : {};
  
  res.json({ ...patient, odontogram_state: odontogramState });
});
```

---

## Debugging

### Ver Estado en Consola
```javascript
console.log(odontogram.getState());
```

### Verificar Módulos Cargados
```javascript
// En consola del navegador:
typeof TOOTH_TYPES      // ✓ "object"
typeof CONDITION_LIST   // ✓ "object"
typeof OdontogramTooth  // ✓ "function"
typeof OdontogramContainer // ✓ "function"
```

### Resetear a Estado Inicial
```javascript
odontogram.setState({});
// Todos los dientes vuelven a "sano"
```

---

## Ejemplos de Código

### Ejemplo 1: Cargar y mostrar
```html
<div id="odonto"></div>

<script src="/odontogram.types.js"></script>
<script src="/odontogram.data.js"></script>
<script src="/odontogram.utils.js"></script>
<script src="/odontogram-tooth.js"></script>
<script src="/odontogram-arch.js"></script>
<script src="/odontogram-toolbar.js"></script>
<script src="/odontogram-legend.js"></script>
<script src="/odontogram-container.js"></script>

<script>
  const odont = new OdontogramContainer('odonto', {}, false);
</script>
```

### Ejemplo 2: Con estado guardado
```javascript
async function loadPatientOdontogram(patientId) {
  const patient = await fetch(`/api/patients/${patientId}`)
    .then(r => r.json());
  
  const state = patient.odontogram_state 
    ? JSON.parse(patient.odontogram_state)
    : {};
  
  return new OdontogramContainer('odonto', state, false);
}
```

### Ejemplo 3: Guardar automático
```javascript
let odont;

async function init(patientId) {
  // Cargar
  const patient = await fetch(`/api/patients/${patientId}`)
    .then(r => r.json());
  const state = patient.odontogram_state 
    ? JSON.parse(patient.odontogram_state)
    : {};
  odont = new OdontogramContainer('odonto', state, false);
  
  // Guardar periódicamente
  setInterval(async () => {
    const currentState = odont.getState();
    await fetch(`/api/patients/${patientId}/odontogram`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ odontogram_state: currentState })
    });
  }, 30000); // Cada 30 segundos
}
```

### Ejemplo 4: Exportar datos
```javascript
function exportOdontogramData(odontogram) {
  const state = odontogram.getState();
  
  // Contar condiciones
  const summary = {};
  Object.values(state).forEach(tooth => {
    const cond = tooth.condition;
    summary[cond] = (summary[cond] || 0) + 1;
  });
  
  return {
    timestamp: new Date(),
    totalTeeth: 32,
    state,
    summary  // { 'healthy': 28, 'caries': 2, 'crown': 2 }
  };
}
```

---

## FAQ

### ¿Puedo editar solo superficies?
Sí. El UI permite seleccionar superficie individual y aplicar condición solo a ella.

### ¿Qué pasa si cargo estado inválido?
El odontograma completa automáticamente dientes faltantes con estado sano.

### ¿Es responsivo?
Sí. Grid y toolbar se adaptan a pantallas pequeñas.

### ¿Se puede imprimir?
Sí. Usa `window.print()` en el navegador - el CSS no tiene `@media print` especiales.

### ¿Se borra si recargo la página?
Sí, a menos que guardes con `PUT /api/patients/:id/odontogram`.

### ¿Cómo agrego un diente temporal?
Edita `odontogram.data.js` y agrega nuevas entradas con `DENTITION.TEMPORARY`.

---

## Soporte y Mantenimiento

Para cambios futuros:
1. **Nuevas condiciones**: Editar `odontogram.types.js`
2. **Cambios visuales**: Editar componentes individuales (tooth.js, arch.js, etc.)
3. **Lógica**: Editar `odontogram-container.js` o agregar en `utils.js`
4. **Datos**: Editar `odontogram.data.js`

Arquitectura modular permite cambios sin afectar resto del sistema.
