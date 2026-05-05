// ── honduranFoods.js — Base de datos referencial de alimentos hondureños ──
// Los valores nutricionales son estimaciones profesionales basadas en porciones
// estándar y pueden variar según preparación, ingredientes y tamaño de porción.
// Deben ser revisados por el profesional de nutrición.

(function (global) {
  const FOODS = [
    // ── Desayunos hondureños ──
    {
      id: 'baleada-sencilla',
      name: 'Baleada sencilla',
      aliases: ['baleada', 'baleada con frijol y queso'],
      category: 'Desayunos hondureños',
      region: 'Norte',
      description: 'Tortilla de harina con frijoles fritos, queso seco y mantequilla',
      serving: { label: '1 baleada', grams: 130 },
      nutrition: { calories: 320, protein: 11, carbs: 38, fat: 13, fiber: 5, sugar: 2, sodium: 480 },
      ingredients: ['tortilla de harina', 'frijoles', 'queso seco', 'mantequilla'],
      allergens: ['gluten', 'lactosa'],
      confidence: 'professional_estimate',
      source: 'Estimación profesional'
    },
    {
      id: 'baleada-huevo',
      name: 'Baleada con huevo',
      aliases: ['baleada con huevo revuelto'],
      category: 'Desayunos hondureños',
      region: 'Norte',
      description: 'Baleada sencilla con huevo revuelto añadido',
      serving: { label: '1 baleada', grams: 175 },
      nutrition: { calories: 410, protein: 18, carbs: 39, fat: 19, fiber: 5, sugar: 2, sodium: 540 },
      ingredients: ['tortilla de harina', 'frijoles', 'queso', 'mantequilla', 'huevo'],
      allergens: ['gluten', 'lactosa', 'huevo'],
      confidence: 'professional_estimate'
    },
    {
      id: 'baleada-completa',
      name: 'Baleada completa',
      aliases: ['baleada con todo'],
      category: 'Desayunos hondureños',
      region: 'Norte',
      description: 'Baleada con frijoles, queso, mantequilla, huevo y aguacate',
      serving: { label: '1 baleada', grams: 220 },
      nutrition: { calories: 520, protein: 21, carbs: 42, fat: 28, fiber: 8, sugar: 2, sodium: 580 },
      ingredients: ['tortilla de harina', 'frijoles', 'queso', 'mantequilla', 'huevo', 'aguacate'],
      allergens: ['gluten', 'lactosa', 'huevo'],
      confidence: 'professional_estimate'
    },
    {
      id: 'pollo-tajadas',
      name: 'Pollo con tajadas',
      aliases: ['pollo frito con tajadas', 'pollo con plátano'],
      category: 'Almuerzos típicos',
      description: 'Pollo frito acompañado de tajadas de plátano verde y repollo',
      serving: { label: '1 plato', grams: 380 },
      nutrition: { calories: 720, protein: 36, carbs: 62, fat: 38, fiber: 5, sugar: 4, sodium: 720 },
      ingredients: ['pollo', 'plátano verde', 'aceite', 'repollo', 'salsa'],
      confidence: 'professional_estimate'
    },
    {
      id: 'tajadas-carne-molida',
      name: 'Tajadas con carne molida',
      category: 'Almuerzos típicos',
      description: 'Tajadas de plátano verde con carne molida guisada y repollo',
      serving: { label: '1 plato', grams: 350 },
      nutrition: { calories: 680, protein: 28, carbs: 60, fat: 36, fiber: 5, sugar: 4, sodium: 660 },
      ingredients: ['plátano verde', 'carne molida', 'aceite', 'repollo'],
      confidence: 'professional_estimate'
    },
    {
      id: 'plato-tipico',
      name: 'Plato típico hondureño',
      aliases: ['plato típico', 'desayuno típico'],
      category: 'Almuerzos típicos',
      description: 'Frijoles, queso, crema, huevo, aguacate, plátano y tortillas',
      serving: { label: '1 plato', grams: 420 },
      nutrition: { calories: 780, protein: 27, carbs: 78, fat: 40, fiber: 12, sugar: 6, sodium: 740 },
      ingredients: ['frijoles', 'queso', 'crema', 'huevo', 'aguacate', 'plátano', 'tortilla'],
      allergens: ['lactosa', 'huevo'],
      confidence: 'professional_estimate'
    },
    {
      id: 'carne-asada-chismol',
      name: 'Carne asada con chismol',
      category: 'Almuerzos típicos',
      description: 'Carne de res asada con chismol, tortillas y frijoles',
      serving: { label: '1 plato', grams: 360 },
      nutrition: { calories: 640, protein: 42, carbs: 48, fat: 28, fiber: 9, sugar: 4, sodium: 700 },
      ingredients: ['carne de res', 'tomate', 'cebolla', 'cilantro', 'tortilla', 'frijoles'],
      confidence: 'professional_estimate'
    },

    // ── Sopas ──
    {
      id: 'sopa-res',
      name: 'Sopa de res',
      category: 'Sopas',
      description: 'Sopa de carne de res con verduras y plátano',
      serving: { label: '1 plato hondo', grams: 500 },
      nutrition: { calories: 460, protein: 32, carbs: 38, fat: 18, fiber: 6, sugar: 6, sodium: 980 },
      ingredients: ['carne de res', 'plátano', 'yuca', 'zanahoria', 'repollo', 'cilantro'],
      confidence: 'professional_estimate'
    },
    {
      id: 'sopa-frijoles-huevo',
      name: 'Sopa de frijoles con huevo',
      category: 'Sopas',
      description: 'Caldo de frijoles con huevo entero',
      serving: { label: '1 plato hondo', grams: 400 },
      nutrition: { calories: 320, protein: 18, carbs: 32, fat: 14, fiber: 9, sugar: 2, sodium: 620 },
      ingredients: ['frijoles', 'huevo', 'cebolla', 'culantro'],
      allergens: ['huevo'],
      confidence: 'professional_estimate'
    },
    {
      id: 'sopa-caracol',
      name: 'Sopa de caracol',
      category: 'Sopas',
      region: 'Garífuna / Costa Norte',
      description: 'Sopa garífuna de caracol con leche de coco, plátano y yuca',
      serving: { label: '1 plato hondo', grams: 500 },
      nutrition: { calories: 540, protein: 28, carbs: 48, fat: 26, fiber: 6, sugar: 8, sodium: 880 },
      ingredients: ['caracol', 'leche de coco', 'plátano', 'yuca', 'malanga'],
      confidence: 'professional_estimate'
    },
    {
      id: 'sopa-mondongo',
      name: 'Sopa de mondongo',
      category: 'Sopas',
      description: 'Sopa de panza de res con verduras',
      serving: { label: '1 plato hondo', grams: 500 },
      nutrition: { calories: 420, protein: 30, carbs: 36, fat: 16, fiber: 6, sugar: 6, sodium: 920 },
      ingredients: ['mondongo', 'yuca', 'plátano', 'zanahoria', 'cilantro'],
      confidence: 'professional_estimate'
    },

    // ── Antojitos ──
    {
      id: 'yuca-chicharron',
      name: 'Yuca con chicharrón',
      category: 'Antojitos',
      description: 'Yuca cocida con chicharrón frito, repollo y chismol',
      serving: { label: '1 plato', grams: 350 },
      nutrition: { calories: 620, protein: 22, carbs: 70, fat: 28, fiber: 5, sugar: 4, sodium: 740 },
      ingredients: ['yuca', 'chicharrón', 'repollo', 'chismol'],
      confidence: 'professional_estimate'
    },
    {
      id: 'nacatamal',
      name: 'Nacatamal hondureño',
      category: 'Antojitos',
      description: 'Tamal de masa con cerdo o pollo, arroz y verduras envuelto en hoja de plátano',
      serving: { label: '1 nacatamal', grams: 280 },
      nutrition: { calories: 480, protein: 18, carbs: 56, fat: 20, fiber: 4, sugar: 3, sodium: 620 },
      ingredients: ['masa de maíz', 'cerdo', 'arroz', 'papa', 'aceitunas'],
      confidence: 'professional_estimate'
    },
    {
      id: 'montuca',
      name: 'Montuca',
      aliases: ['tamal de elote dulce'],
      category: 'Antojitos',
      description: 'Tamal de elote tierno con carne',
      serving: { label: '1 unidad', grams: 200 },
      nutrition: { calories: 360, protein: 12, carbs: 48, fat: 14, fiber: 4, sugar: 8, sodium: 440 },
      ingredients: ['elote', 'carne de cerdo', 'manteca'],
      confidence: 'professional_estimate'
    },
    {
      id: 'tamalito-elote',
      name: 'Tamalito de elote',
      category: 'Antojitos',
      description: 'Tamal pequeño hecho de masa de elote dulce',
      serving: { label: '1 unidad', grams: 110 },
      nutrition: { calories: 220, protein: 4, carbs: 36, fat: 8, fiber: 3, sugar: 9, sodium: 180 },
      ingredients: ['elote', 'azúcar', 'mantequilla'],
      allergens: ['lactosa'],
      confidence: 'professional_estimate'
    },
    {
      id: 'pastelito-carne',
      name: 'Pastelito de carne',
      aliases: ['pastelito hondureño'],
      category: 'Antojitos',
      description: 'Empanada frita de masa de maíz rellena de carne y papa',
      serving: { label: '1 unidad', grams: 120 },
      nutrition: { calories: 280, protein: 10, carbs: 32, fat: 13, fiber: 3, sugar: 1, sodium: 360 },
      ingredients: ['masa de maíz', 'carne', 'papa', 'aceite'],
      confidence: 'professional_estimate'
    },
    {
      id: 'enchilada-hondurena',
      name: 'Enchilada hondureña',
      category: 'Antojitos',
      description: 'Tortilla frita con carne molida, repollo, queso y salsa',
      serving: { label: '1 unidad', grams: 140 },
      nutrition: { calories: 310, protein: 12, carbs: 30, fat: 16, fiber: 3, sugar: 3, sodium: 420 },
      ingredients: ['tortilla', 'carne molida', 'repollo', 'queso', 'salsa'],
      allergens: ['lactosa'],
      confidence: 'professional_estimate'
    },
    {
      id: 'catrachitas',
      name: 'Catrachitas',
      category: 'Antojitos',
      description: 'Tortilla frita con frijoles fritos y queso rallado',
      serving: { label: '1 porción (3 uds)', grams: 150 },
      nutrition: { calories: 340, protein: 12, carbs: 38, fat: 16, fiber: 6, sugar: 2, sodium: 460 },
      ingredients: ['tortilla', 'frijoles', 'queso'],
      allergens: ['lactosa'],
      confidence: 'professional_estimate'
    },
    {
      id: 'anafre',
      name: 'Anafre de frijoles',
      category: 'Antojitos',
      description: 'Frijoles fritos con queso derretido servidos calientes con tortillas',
      serving: { label: '1 porción', grams: 220 },
      nutrition: { calories: 420, protein: 18, carbs: 36, fat: 22, fiber: 9, sugar: 2, sodium: 580 },
      ingredients: ['frijoles', 'queso', 'chorizo opcional'],
      allergens: ['lactosa'],
      confidence: 'professional_estimate'
    },
    {
      id: 'pescado-frito',
      name: 'Pescado frito con tajadas',
      category: 'Almuerzos típicos',
      region: 'Costa',
      description: 'Pescado entero frito con tajadas de plátano y ensalada',
      serving: { label: '1 plato', grams: 380 },
      nutrition: { calories: 680, protein: 38, carbs: 52, fat: 34, fiber: 4, sugar: 3, sodium: 720 },
      ingredients: ['pescado', 'plátano verde', 'aceite', 'repollo'],
      allergens: ['pescado'],
      confidence: 'professional_estimate'
    },
    {
      id: 'arroz-pollo',
      name: 'Arroz con pollo',
      category: 'Almuerzos típicos',
      description: 'Arroz amarillo con trozos de pollo y verduras',
      serving: { label: '1 plato', grams: 350 },
      nutrition: { calories: 540, protein: 26, carbs: 64, fat: 18, fiber: 3, sugar: 3, sodium: 620 },
      ingredients: ['arroz', 'pollo', 'zanahoria', 'arveja', 'pimiento'],
      confidence: 'professional_estimate'
    },
    {
      id: 'casamiento',
      name: 'Casamiento',
      aliases: ['arroz con frijoles'],
      category: 'Almuerzos típicos',
      description: 'Arroz mezclado con frijoles fritos',
      serving: { label: '1 taza', grams: 200 },
      nutrition: { calories: 320, protein: 11, carbs: 56, fat: 6, fiber: 8, sugar: 2, sodium: 380 },
      ingredients: ['arroz', 'frijoles', 'cebolla'],
      confidence: 'professional_estimate'
    },

    // ── Frijoles y legumbres ──
    {
      id: 'frijoles-cocidos',
      name: 'Frijoles cocidos',
      aliases: ['frijoles parados'],
      category: 'Frijoles y legumbres',
      description: 'Frijoles rojos cocidos en caldo',
      serving: { label: '1 taza', grams: 180 },
      nutrition: { calories: 220, protein: 14, carbs: 40, fat: 1, fiber: 14, sugar: 2, sodium: 320 },
      per100g: { calories: 122, protein: 7.8, carbs: 22.2, fat: 0.6, fiber: 7.8, sugar: 1.1, sodium: 178 },
      ingredients: ['frijoles rojos', 'agua', 'cebolla'],
      confidence: 'professional_estimate'
    },
    {
      id: 'frijoles-fritos',
      name: 'Frijoles fritos',
      aliases: ['frijoles licuados'],
      category: 'Frijoles y legumbres',
      description: 'Frijoles licuados y fritos',
      serving: { label: '1/2 taza', grams: 130 },
      nutrition: { calories: 230, protein: 12, carbs: 30, fat: 9, fiber: 11, sugar: 1, sodium: 380 },
      ingredients: ['frijoles', 'aceite', 'cebolla'],
      confidence: 'professional_estimate'
    },

    // ── Cereales y harinas ──
    {
      id: 'tortilla-maiz',
      name: 'Tortilla de maíz',
      category: 'Cereales y harinas',
      description: 'Tortilla tradicional de maíz',
      serving: { label: '1 unidad mediana', grams: 35 },
      nutrition: { calories: 80, protein: 2, carbs: 17, fat: 1, fiber: 1.5, sugar: 0, sodium: 6 },
      per100g: { calories: 228, protein: 5.7, carbs: 48.5, fat: 2.8, fiber: 4.3, sugar: 0, sodium: 17 },
      confidence: 'professional_estimate'
    },
    {
      id: 'tortilla-harina',
      name: 'Tortilla de harina',
      category: 'Cereales y harinas',
      description: 'Tortilla de harina de trigo',
      serving: { label: '1 unidad mediana', grams: 50 },
      nutrition: { calories: 150, protein: 4, carbs: 26, fat: 3, fiber: 1, sugar: 1, sodium: 280 },
      per100g: { calories: 300, protein: 8, carbs: 52, fat: 6, fiber: 2, sugar: 2, sodium: 560 },
      allergens: ['gluten'],
      confidence: 'professional_estimate'
    },
    {
      id: 'arroz-blanco',
      name: 'Arroz blanco',
      category: 'Cereales y harinas',
      description: 'Arroz blanco cocido',
      serving: { label: '1 taza', grams: 160 },
      nutrition: { calories: 210, protein: 4, carbs: 46, fat: 0.4, fiber: 1, sugar: 0, sodium: 2 },
      per100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0, sodium: 1 },
      confidence: 'validated'
    },

    // ── Plátanos y yuca ──
    {
      id: 'platano-maduro-frito',
      name: 'Plátano maduro frito',
      category: 'Verduras',
      description: 'Plátano maduro frito en aceite',
      serving: { label: '1 plátano', grams: 150 },
      nutrition: { calories: 280, protein: 1.5, carbs: 50, fat: 9, fiber: 4, sugar: 24, sodium: 8 },
      ingredients: ['plátano maduro', 'aceite'],
      confidence: 'professional_estimate'
    },
    {
      id: 'tajadas-verde',
      name: 'Tajadas de plátano verde',
      aliases: ['tajadas verdes', 'patacones'],
      category: 'Verduras',
      description: 'Plátano verde en tajadas fritas y crujientes',
      serving: { label: '1 porción', grams: 130 },
      nutrition: { calories: 280, protein: 2, carbs: 40, fat: 13, fiber: 3, sugar: 4, sodium: 220 },
      ingredients: ['plátano verde', 'aceite', 'sal'],
      confidence: 'professional_estimate'
    },
    {
      id: 'yuca-cocida',
      name: 'Yuca cocida',
      category: 'Verduras',
      description: 'Yuca hervida sin grasa adicional',
      serving: { label: '1 taza', grams: 200 },
      nutrition: { calories: 320, protein: 3, carbs: 78, fat: 0.6, fiber: 4, sugar: 3, sodium: 28 },
      per100g: { calories: 160, protein: 1.4, carbs: 38, fat: 0.3, fiber: 1.8, sugar: 1.7, sodium: 14 },
      confidence: 'validated'
    },

    // ── Lácteos ──
    {
      id: 'queso-seco',
      name: 'Queso seco',
      aliases: ['queso seco hondureño'],
      category: 'Lácteos',
      description: 'Queso seco rallado',
      serving: { label: '30 g (2 cdas)', grams: 30 },
      nutrition: { calories: 110, protein: 7, carbs: 1, fat: 9, fiber: 0, sugar: 0.5, sodium: 320 },
      per100g: { calories: 367, protein: 23, carbs: 3.3, fat: 30, fiber: 0, sugar: 1.7, sodium: 1067 },
      allergens: ['lactosa'],
      confidence: 'professional_estimate'
    },
    {
      id: 'cuajada',
      name: 'Cuajada',
      category: 'Lácteos',
      description: 'Queso fresco hondureño tipo cuajada',
      serving: { label: '50 g', grams: 50 },
      nutrition: { calories: 130, protein: 8, carbs: 2, fat: 10, fiber: 0, sugar: 1, sodium: 240 },
      per100g: { calories: 260, protein: 16, carbs: 4, fat: 20, fiber: 0, sugar: 2, sodium: 480 },
      allergens: ['lactosa'],
      confidence: 'professional_estimate'
    },
    {
      id: 'mantequilla-hondurena',
      name: 'Mantequilla hondureña',
      aliases: ['mantequilla rala', 'mantequilla crema'],
      category: 'Lácteos',
      description: 'Mantequilla líquida típica usada en baleadas',
      serving: { label: '1 cucharada', grams: 15 },
      nutrition: { calories: 50, protein: 0.5, carbs: 1, fat: 5, fiber: 0, sugar: 1, sodium: 60 },
      allergens: ['lactosa'],
      confidence: 'professional_estimate'
    },
    {
      id: 'crema',
      name: 'Crema',
      category: 'Lácteos',
      description: 'Crema espesa típica',
      serving: { label: '2 cucharadas', grams: 30 },
      nutrition: { calories: 110, protein: 1, carbs: 1, fat: 11, fiber: 0, sugar: 1, sodium: 30 },
      allergens: ['lactosa'],
      confidence: 'professional_estimate'
    },

    // ── Frutas / Vegetales ──
    {
      id: 'aguacate',
      name: 'Aguacate',
      category: 'Frutas',
      description: 'Aguacate fresco',
      serving: { label: '1/2 unidad', grams: 100 },
      nutrition: { calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, sugar: 0.7, sodium: 7 },
      per100g: { calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, sugar: 0.7, sodium: 7 },
      confidence: 'validated'
    },
    {
      id: 'huevo',
      name: 'Huevo',
      aliases: ['huevo entero'],
      category: 'Carnes',
      description: 'Huevo de gallina entero',
      serving: { label: '1 unidad grande', grams: 50 },
      nutrition: { calories: 72, protein: 6.3, carbs: 0.4, fat: 5, fiber: 0, sugar: 0.4, sodium: 71 },
      per100g: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0, sugar: 0.7, sodium: 142 },
      allergens: ['huevo'],
      confidence: 'validated'
    },

    // ── Carnes ──
    {
      id: 'pollo-asado',
      name: 'Pollo asado (pechuga)',
      category: 'Carnes',
      description: 'Pechuga de pollo asada sin piel',
      serving: { label: '120 g', grams: 120 },
      nutrition: { calories: 200, protein: 38, carbs: 0, fat: 5, fiber: 0, sugar: 0, sodium: 90 },
      per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, sodium: 74 },
      confidence: 'validated'
    },
    {
      id: 'carne-molida',
      name: 'Carne molida',
      category: 'Carnes',
      description: 'Carne molida de res guisada',
      serving: { label: '120 g', grams: 120 },
      nutrition: { calories: 290, protein: 26, carbs: 4, fat: 19, fiber: 1, sugar: 2, sodium: 380 },
      confidence: 'professional_estimate'
    },
    {
      id: 'carne-asada',
      name: 'Carne asada',
      category: 'Carnes',
      description: 'Carne de res a la parrilla',
      serving: { label: '120 g', grams: 120 },
      nutrition: { calories: 280, protein: 32, carbs: 0, fat: 16, fiber: 0, sugar: 0, sodium: 320 },
      confidence: 'professional_estimate'
    },

    // ── Bebidas ──
    {
      id: 'atol-elote',
      name: 'Atol de elote',
      category: 'Bebidas',
      description: 'Bebida caliente de elote tierno con leche y azúcar',
      serving: { label: '1 taza', grams: 240 },
      nutrition: { calories: 220, protein: 5, carbs: 38, fat: 6, fiber: 2, sugar: 22, sodium: 80 },
      ingredients: ['elote', 'leche', 'azúcar', 'canela'],
      allergens: ['lactosa'],
      confidence: 'professional_estimate'
    },
    {
      id: 'horchata',
      name: 'Horchata',
      category: 'Bebidas',
      description: 'Bebida fría de morro/semillas con leche y azúcar',
      serving: { label: '1 vaso', grams: 250 },
      nutrition: { calories: 200, protein: 4, carbs: 36, fat: 5, fiber: 1, sugar: 28, sodium: 60 },
      ingredients: ['semilla de morro', 'leche', 'azúcar', 'canela'],
      allergens: ['lactosa'],
      confidence: 'professional_estimate'
    },
    {
      id: 'pozol',
      name: 'Pozol',
      category: 'Bebidas',
      description: 'Bebida de maíz y cacao',
      serving: { label: '1 vaso', grams: 250 },
      nutrition: { calories: 180, protein: 4, carbs: 36, fat: 3, fiber: 2, sugar: 22, sodium: 30 },
      ingredients: ['maíz', 'cacao', 'azúcar'],
      confidence: 'professional_estimate'
    },
    {
      id: 'cafe-leche-azucar',
      name: 'Café con leche y azúcar',
      category: 'Bebidas',
      description: 'Café con leche entera y azúcar',
      serving: { label: '1 taza', grams: 240 },
      nutrition: { calories: 110, protein: 4, carbs: 16, fat: 4, fiber: 0, sugar: 14, sodium: 60 },
      allergens: ['lactosa', 'cafeína'],
      confidence: 'professional_estimate'
    },
    {
      id: 'fresco-natural-azucar',
      name: 'Fresco natural con azúcar',
      aliases: ['refresco natural', 'fresco de fruta'],
      category: 'Bebidas',
      description: 'Bebida de fruta natural con azúcar añadida',
      serving: { label: '1 vaso', grams: 250 },
      nutrition: { calories: 140, protein: 0.5, carbs: 36, fat: 0, fiber: 0.5, sugar: 32, sodium: 5 },
      ingredients: ['fruta', 'agua', 'azúcar'],
      confidence: 'professional_estimate'
    }
  ];

  const CATEGORIES = [
    'Desayunos hondureños',
    'Almuerzos típicos',
    'Sopas',
    'Antojitos',
    'Bebidas',
    'Ingredientes base',
    'Garífuna / costa norte',
    'Lácteos',
    'Carnes',
    'Cereales y harinas',
    'Frutas',
    'Verduras',
    'Frijoles y legumbres'
  ];

  function searchFoods(query, category) {
    const q = (query || '').toLowerCase().trim();
    return FOODS.filter(f => {
      if (category && category !== 'Todas' && f.category !== category) return false;
      if (!q) return true;
      const haystack = [
        f.name,
        f.category,
        f.region || '',
        ...(f.aliases || []),
        ...(f.ingredients || [])
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  function getFoodById(id) {
    return FOODS.find(f => f.id === id) || null;
  }

  // Recalcula macros para una porción dada (gramos), basándose en serving o per100g
  function scaleNutrition(food, grams) {
    if (!food) return null;
    const base = food.per100g
      ? { ref: 100, n: food.per100g }
      : { ref: food.serving.grams, n: food.nutrition };
    const factor = grams / base.ref;
    const round = (v) => Math.round((v || 0) * factor * 10) / 10;
    return {
      calories: Math.round((base.n.calories || 0) * factor),
      protein: round(base.n.protein),
      carbs: round(base.n.carbs),
      fat: round(base.n.fat),
      fiber: round(base.n.fiber),
      sugar: round(base.n.sugar),
      sodium: Math.round((base.n.sodium || 0) * factor)
    };
  }

  global.HONDURAN_FOODS = {
    list: FOODS,
    categories: CATEGORIES,
    search: searchFoods,
    getById: getFoodById,
    scale: scaleNutrition
  };
})(typeof window !== 'undefined' ? window : this);
