/* Honduras food database - per portion / racion estándar */
/* Categorías: carbohidrato, proteina, vegetal, fruta, grasa, lacteo, tipico */
const FOODS = [
  // ===== CARBOHIDRATOS =====
  { id: 'arroz-blanco', name: 'Arroz blanco', emoji: '🍚', cat: 'carbohidrato', portion: '½ taza (100 g)', kcal: 130, p: 2.7, c: 28, g: 0.3 },
  { id: 'tortilla-maiz', name: 'Tortilla de maíz', emoji: '🫓', cat: 'carbohidrato', portion: '1 unidad (30 g)', kcal: 65, p: 1.5, c: 13, g: 0.7 },
  { id: 'tortilla-harina', name: 'Tortilla de harina', emoji: '🫓', cat: 'carbohidrato', portion: '1 unidad (40 g)', kcal: 130, p: 3.5, c: 22, g: 3 },
  { id: 'platano-verde', name: 'Plátano verde cocido', emoji: '🍌', cat: 'carbohidrato', portion: '½ taza (75 g)', kcal: 90, p: 1, c: 24, g: 0.2 },
  { id: 'tajadas-maduras', name: 'Tajadas de maduro', emoji: '🍌', cat: 'carbohidrato', portion: '4 rodajas (80 g)', kcal: 170, p: 1, c: 32, g: 5 },
  { id: 'tajadas-verdes', name: 'Tajadas verdes fritas', emoji: '🍟', cat: 'carbohidrato', portion: '½ taza (60 g)', kcal: 160, p: 1, c: 22, g: 8 },
  { id: 'yuca-cocida', name: 'Yuca cocida', emoji: '🥔', cat: 'carbohidrato', portion: '½ taza (100 g)', kcal: 160, p: 1.4, c: 38, g: 0.3 },
  { id: 'pan-frances', name: 'Pan francés', emoji: '🥖', cat: 'carbohidrato', portion: '1 pieza (50 g)', kcal: 140, p: 4, c: 27, g: 1.5 },
  { id: 'camote', name: 'Camote (batata)', emoji: '🍠', cat: 'carbohidrato', portion: '½ taza (100 g)', kcal: 90, p: 2, c: 21, g: 0.1 },
  { id: 'avena', name: 'Avena cocida', emoji: '🥣', cat: 'carbohidrato', portion: '½ taza (120 g)', kcal: 75, p: 2.5, c: 13, g: 1.5 },
  { id: 'pasta', name: 'Pasta cocida', emoji: '🍝', cat: 'carbohidrato', portion: '½ taza (75 g)', kcal: 110, p: 4, c: 21, g: 0.7 },

  // ===== PROTEÍNAS =====
  { id: 'pollo-plancha', name: 'Pollo a la plancha', emoji: '🍗', cat: 'proteina', portion: '100 g', kcal: 165, p: 31, c: 0, g: 3.6 },
  { id: 'pollo-frito', name: 'Pollo frito', emoji: '🍗', cat: 'proteina', portion: '1 pieza (120 g)', kcal: 290, p: 26, c: 8, g: 17 },
  { id: 'carne-asada', name: 'Carne de res asada', emoji: '🥩', cat: 'proteina', portion: '100 g', kcal: 220, p: 26, c: 0, g: 12 },
  { id: 'carne-molida', name: 'Carne molida guisada', emoji: '🥩', cat: 'proteina', portion: '100 g', kcal: 210, p: 22, c: 2, g: 13 },
  { id: 'chorizo', name: 'Chorizo hondureño', emoji: '🌭', cat: 'proteina', portion: '50 g', kcal: 180, p: 9, c: 1, g: 16 },
  { id: 'huevo', name: 'Huevo cocido', emoji: '🥚', cat: 'proteina', portion: '1 unidad (50 g)', kcal: 78, p: 6, c: 0.6, g: 5 },
  { id: 'huevo-revuelto', name: 'Huevo revuelto', emoji: '🍳', cat: 'proteina', portion: '1 unidad (60 g)', kcal: 110, p: 7, c: 1, g: 8.5 },
  { id: 'pescado', name: 'Pescado a la plancha (tilapia)', emoji: '🐟', cat: 'proteina', portion: '100 g', kcal: 130, p: 26, c: 0, g: 2.7 },
  { id: 'pescado-frito', name: 'Pescado frito', emoji: '🐟', cat: 'proteina', portion: '120 g', kcal: 260, p: 22, c: 5, g: 17 },
  { id: 'atun-agua', name: 'Atún en agua', emoji: '🐟', cat: 'proteina', portion: '½ lata (60 g)', kcal: 70, p: 16, c: 0, g: 0.5 },
  { id: 'frijoles', name: 'Frijoles rojos cocidos', emoji: '🫘', cat: 'proteina', portion: '½ taza (90 g)', kcal: 115, p: 7.5, c: 20, g: 0.5 },
  { id: 'frijoles-fritos', name: 'Frijoles fritos', emoji: '🫘', cat: 'proteina', portion: '½ taza (90 g)', kcal: 165, p: 7, c: 19, g: 7 },

  // ===== VEGETALES =====
  { id: 'ensalada-mixta', name: 'Ensalada mixta', emoji: '🥗', cat: 'vegetal', portion: '1 taza (80 g)', kcal: 25, p: 1.5, c: 5, g: 0.2 },
  { id: 'repollo-curtido', name: 'Repollo curtido', emoji: '🥬', cat: 'vegetal', portion: '½ taza (50 g)', kcal: 18, p: 1, c: 4, g: 0.1 },
  { id: 'tomate', name: 'Tomate', emoji: '🍅', cat: 'vegetal', portion: '1 unidad (120 g)', kcal: 22, p: 1, c: 5, g: 0.2 },
  { id: 'pepino', name: 'Pepino', emoji: '🥒', cat: 'vegetal', portion: '½ taza (60 g)', kcal: 8, p: 0.5, c: 2, g: 0.1 },
  { id: 'lechuga', name: 'Lechuga', emoji: '🥬', cat: 'vegetal', portion: '1 taza (50 g)', kcal: 8, p: 0.5, c: 1.5, g: 0.1 },
  { id: 'zanahoria', name: 'Zanahoria rallada', emoji: '🥕', cat: 'vegetal', portion: '½ taza (55 g)', kcal: 23, p: 0.5, c: 5.5, g: 0.1 },
  { id: 'ayote', name: 'Ayote guisado', emoji: '🎃', cat: 'vegetal', portion: '½ taza (100 g)', kcal: 30, p: 1, c: 7, g: 0.1 },
  { id: 'chile-dulce', name: 'Chile dulce (pimiento)', emoji: '🫑', cat: 'vegetal', portion: '½ taza (75 g)', kcal: 20, p: 1, c: 4.5, g: 0.2 },
  { id: 'brocoli', name: 'Brócoli al vapor', emoji: '🥦', cat: 'vegetal', portion: '1 taza (90 g)', kcal: 30, p: 2.5, c: 6, g: 0.3 },
  { id: 'sopa-verduras', name: 'Sopa de verduras', emoji: '🥣', cat: 'vegetal', portion: '1 taza (240 ml)', kcal: 70, p: 3, c: 12, g: 1.5 },

  // ===== FRUTAS =====
  { id: 'mango', name: 'Mango', emoji: '🥭', cat: 'fruta', portion: '½ unidad (100 g)', kcal: 60, p: 0.8, c: 15, g: 0.4 },
  { id: 'papaya', name: 'Papaya', emoji: '🥭', cat: 'fruta', portion: '1 taza (140 g)', kcal: 55, p: 0.9, c: 14, g: 0.2 },
  { id: 'sandia', name: 'Sandía', emoji: '🍉', cat: 'fruta', portion: '1 taza (150 g)', kcal: 46, p: 1, c: 11, g: 0.2 },
  { id: 'banano', name: 'Banano (guineo)', emoji: '🍌', cat: 'fruta', portion: '1 unidad (118 g)', kcal: 105, p: 1.3, c: 27, g: 0.4 },
  { id: 'pina', name: 'Piña', emoji: '🍍', cat: 'fruta', portion: '1 taza (165 g)', kcal: 82, p: 0.9, c: 22, g: 0.2 },
  { id: 'manzana', name: 'Manzana', emoji: '🍎', cat: 'fruta', portion: '1 unidad (180 g)', kcal: 95, p: 0.5, c: 25, g: 0.3 },
  { id: 'naranja', name: 'Naranja', emoji: '🍊', cat: 'fruta', portion: '1 unidad (130 g)', kcal: 62, p: 1.2, c: 15, g: 0.2 },
  { id: 'fresas', name: 'Fresas', emoji: '🍓', cat: 'fruta', portion: '1 taza (150 g)', kcal: 49, p: 1, c: 12, g: 0.5 },

  // ===== LÁCTEOS =====
  { id: 'queso-fresco', name: 'Queso fresco hondureño', emoji: '🧀', cat: 'lacteo', portion: '30 g', kcal: 85, p: 6, c: 1, g: 6.5 },
  { id: 'cuajada', name: 'Cuajada', emoji: '🧀', cat: 'lacteo', portion: '30 g', kcal: 80, p: 5.5, c: 1, g: 6 },
  { id: 'mantequilla-crema', name: 'Mantequilla crema', emoji: '🥛', cat: 'lacteo', portion: '1 cda (15 g)', kcal: 50, p: 0.5, c: 1, g: 5 },
  { id: 'leche-entera', name: 'Leche entera', emoji: '🥛', cat: 'lacteo', portion: '1 taza (240 ml)', kcal: 150, p: 8, c: 12, g: 8 },
  { id: 'leche-descremada', name: 'Leche descremada', emoji: '🥛', cat: 'lacteo', portion: '1 taza (240 ml)', kcal: 85, p: 8, c: 12, g: 0.2 },
  { id: 'yogurt', name: 'Yogur natural', emoji: '🥛', cat: 'lacteo', portion: '1 taza (170 g)', kcal: 100, p: 9, c: 12, g: 2.5 },

  // ===== GRASAS =====
  { id: 'aguacate', name: 'Aguacate', emoji: '🥑', cat: 'grasa', portion: '½ unidad (75 g)', kcal: 120, p: 1.5, c: 6, g: 11 },
  { id: 'aceite-oliva', name: 'Aceite de oliva', emoji: '🫒', cat: 'grasa', portion: '1 cda (14 g)', kcal: 120, p: 0, c: 0, g: 14 },
  { id: 'mantequilla', name: 'Mantequilla', emoji: '🧈', cat: 'grasa', portion: '1 cda (14 g)', kcal: 100, p: 0.1, c: 0, g: 11 },
  { id: 'mani', name: 'Maní tostado', emoji: '🥜', cat: 'grasa', portion: '30 g', kcal: 170, p: 7, c: 5, g: 14 },

  // ===== TÍPICOS HONDUREÑOS =====
  { id: 'baleada-sencilla', name: 'Baleada sencilla', emoji: '🫓', cat: 'tipico', portion: '1 unidad', kcal: 320, p: 11, c: 38, g: 14, info: 'tortilla + frijoles + mantequilla + queso' },
  { id: 'baleada-mixta', name: 'Baleada mixta', emoji: '🫓', cat: 'tipico', portion: '1 unidad', kcal: 480, p: 22, c: 42, g: 25, info: '+ huevo + aguacate' },
  { id: 'casamiento', name: 'Casamiento', emoji: '🍚', cat: 'tipico', portion: '1 taza (200 g)', kcal: 280, p: 9, c: 50, g: 5, info: 'arroz + frijoles' },
  { id: 'pollo-tajadas', name: 'Pollo con tajadas', emoji: '🍗', cat: 'tipico', portion: '1 porción', kcal: 620, p: 32, c: 48, g: 32, info: 'pollo frito + tajadas + repollo' },
  { id: 'plato-tipico', name: 'Plato típico hondureño', emoji: '🍽️', cat: 'tipico', portion: '1 porción', kcal: 780, p: 35, c: 75, g: 38, info: 'carne + frijoles + arroz + queso + plátano' },
  { id: 'sopa-mondongo', name: 'Sopa de mondongo', emoji: '🥣', cat: 'tipico', portion: '1 plato (350 ml)', kcal: 320, p: 22, c: 18, g: 17, info: 'mondongo + yuca + verduras' },
  { id: 'tamal', name: 'Tamal hondureño', emoji: '🫔', cat: 'tipico', portion: '1 unidad', kcal: 280, p: 10, c: 38, g: 10 },
  { id: 'anafres', name: 'Anafres', emoji: '🍲', cat: 'tipico', portion: '1 porción', kcal: 380, p: 14, c: 36, g: 21, info: 'frijoles + queso + totopos' },
  { id: 'pupusa-revuelta', name: 'Pupusa revuelta', emoji: '🫓', cat: 'tipico', portion: '1 unidad', kcal: 285, p: 10, c: 32, g: 13 },
  { id: 'enchiladas', name: 'Enchilada hondureña', emoji: '🌮', cat: 'tipico', portion: '1 unidad', kcal: 220, p: 9, c: 22, g: 11 },
  { id: 'rosquillas', name: 'Rosquillas', emoji: '🍩', cat: 'tipico', portion: '2 unidades', kcal: 180, p: 4, c: 22, g: 8 },
];

const CATEGORIES = [
  { id: 'all',          label: 'Todos',          color: '#0080B0' },
  { id: 'tipico',       label: 'Típicos HN',     color: '#002A60' },
  { id: 'carbohidrato', label: 'Carbohidratos',  color: '#E0992E' },
  { id: 'proteina',     label: 'Proteínas',      color: '#B5573E' },
  { id: 'vegetal',      label: 'Vegetales',      color: '#5A8C3E' },
  { id: 'fruta',        label: 'Frutas',         color: '#D14635' },
  { id: 'lacteo',       label: 'Lácteos',        color: '#5588B5' },
  { id: 'grasa',        label: 'Grasas',         color: '#7A5E3A' },
];

// Map category to plate zone
const CAT_ZONE = {
  carbohidrato: 'carb',
  proteina: 'pro',
  vegetal: 'veg',
  fruta: 'veg',
  lacteo: 'pro',
  grasa: 'pro',
  tipico: 'pro',
};

const ZONE_LABEL = {
  veg: 'Vegetales y frutas',
  pro: 'Proteínas',
  carb: 'Carbohidratos',
};

const MEALS = [
  { id: 'desayuno', label: 'Desayuno', time: '7:00', target: 450 },
  { id: 'snack-am', label: 'Snack AM', time: '10:30', target: 150 },
  { id: 'almuerzo', label: 'Almuerzo', time: '13:00', target: 600 },
  { id: 'snack-pm', label: 'Snack PM', time: '16:30', target: 150 },
  { id: 'cena', label: 'Cena', time: '19:30', target: 450 },
];

// Substitutions: what equivalent food from same cat
const SUBSTITUTIONS = {
  'arroz-blanco': ['pasta', 'tortilla-maiz', 'yuca-cocida', 'platano-verde'],
  'pollo-plancha': ['pescado', 'atun-agua', 'carne-asada'],
  'frijoles': ['atun-agua', 'huevo', 'pollo-plancha'],
  'tajadas-maduras': ['camote', 'platano-verde', 'arroz-blanco'],
  'queso-fresco': ['cuajada', 'yogurt'],
  'leche-entera': ['leche-descremada', 'yogurt'],
  'baleada-sencilla': ['casamiento', 'pupusa-revuelta'],
  'aguacate': ['aceite-oliva', 'mani'],
  'banano': ['manzana', 'naranja', 'mango'],
};

window.FOODS = FOODS;
window.CATEGORIES = CATEGORIES;
window.CAT_ZONE = CAT_ZONE;
window.ZONE_LABEL = ZONE_LABEL;
window.MEALS = MEALS;
window.SUBSTITUTIONS = SUBSTITUTIONS;
