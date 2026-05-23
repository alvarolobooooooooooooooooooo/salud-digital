/* Professional food illustrations — flat SVG, clinical palette
   Each icon: 48x48 viewBox, 2-3 tone flat design
   Color palette inspired by Salud Digital design system + muted naturals
*/

const FOOD_COLORS = {
  // proteins
  meat: '#B5573E', meatDark: '#8C3F2C',
  chicken: '#D9A56B', chickenDark: '#A06D3F', chickenSkin: '#C68A4F',
  fish: '#9BB5C8', fishDark: '#6E8FA8',
  egg: '#FFFFFF', eggShell: '#F0E5D0', yolk: '#E8A93C', yolkDark: '#C28823',
  beans: '#7A3E2E', beansDark: '#582718',
  // carbs
  rice: '#FAFAF5', riceDark: '#E6E0CC', riceShadow: '#D9D1B8',
  tortilla: '#F2D9A3', tortillaDark: '#C9A567', tortillaShadow: '#A88847',
  bread: '#D9B176', breadDark: '#A87A3E', breadCrust: '#8C5E2A',
  plantain: '#E8C04A', plantainDark: '#B89230', plantainGreen: '#9CB060',
  yuca: '#F0E0C0', yucaDark: '#B8A076', yucaSkin: '#7A5E3A',
  pasta: '#F2D89A', pastaDark: '#C9A85F',
  oat: '#D9C99A', oatDark: '#A8946A',
  // vegetables  
  tomato: '#D14635', tomatoDark: '#A8302A', leaf: '#5A8C3E', leafDark: '#3D6B2A',
  lettuce: '#7DAA52', lettuceDark: '#587A38',
  cabbage: '#C2D49A', cabbageDark: '#8FA868',
  carrot: '#E08745', carrotDark: '#B86528',
  cucumber: '#6B9A4E', cucumberDark: '#4A7035', cucumberFlesh: '#D4E5B8',
  pepper: '#D9472F', pepperGreen: '#4A8038', stem: '#5A7A38',
  broccoli: '#5A8C3E', broccoliDark: '#3D6B2A',
  pumpkin: '#D67B2E', pumpkinDark: '#A8581A',
  // fruits
  mango: '#E89B3C', mangoDark: '#B87520', mangoRed: '#D14E2E',
  papaya: '#E08745', papayaFlesh: '#E8A85A',
  watermelon: '#D14635', watermelonRind: '#5A8C3E', watermelonSeeds: '#2A1A12',
  banana: '#E8C04A', bananaDark: '#B89230', bananaSpot: '#8C6A28',
  pineapple: '#D9A53A', pineappleDark: '#A87E20', pineappleLeaf: '#5A8C3E',
  apple: '#C73A3A', appleDark: '#962A2A', appleStem: '#5A3E28',
  orange: '#E08745', orangeDark: '#B86528',
  strawberry: '#C73A3A', strawberryDark: '#962A2A', strawberrySeeds: '#F0E5A0',
  // dairy
  cheese: '#F2DC8A', cheeseDark: '#C9B05A', cheeseRind: '#8C7028',
  milk: '#FAFAFA', milkShadow: '#E0E0E0', milkBlue: '#5588B5',
  yogurt: '#FAFAF5', yogurtShadow: '#E6E0D0',
  butter: '#F2DC8A', butterShadow: '#D9C26A',
  // fats
  avocado: '#5A7A38', avocadoFlesh: '#A8B85A', avocadoPit: '#7A5E3A',
  oil: '#D9C26A', oilDark: '#A89642', oilBottle: '#7DAA8E',
  nuts: '#D9A56B', nutsDark: '#A06D3F',
  // typical
  baleadaBg: '#F2D9A3', baleadaBgDark: '#C9A567',
  // bowls/plates
  bowl: '#E5E8EC', bowlDark: '#B8BFC9', bowlShadow: '#9BA3AE',
  plate: '#F2F4F7', plateDark: '#C9CFD7',
};

// SVG building blocks - render functions
const FC = FOOD_COLORS;

/* ====== ICON COMPONENTS ====== */

const Bowl = ({ children }) => (
  <g>
    <ellipse cx="24" cy="38" rx="20" ry="4" fill={FC.bowlShadow} opacity="0.3"/>
    <path d="M 6 26 Q 6 40 24 40 Q 42 40 42 26 Z" fill={FC.bowl}/>
    <path d="M 6 26 Q 6 40 24 40 Q 42 40 42 26" fill="none" stroke={FC.bowlDark} strokeWidth="1.2"/>
    <ellipse cx="24" cy="26" rx="18" ry="3.5" fill={FC.bowlDark}/>
    {children}
  </g>
);

const Plate = ({ children }) => (
  <g>
    <ellipse cx="24" cy="26" rx="22" ry="7" fill={FC.plateDark}/>
    <ellipse cx="24" cy="25" rx="22" ry="6.5" fill={FC.plate}/>
    <ellipse cx="24" cy="24" rx="17" ry="5" fill={FC.plate} stroke={FC.plateDark} strokeWidth="0.6"/>
    {children}
  </g>
);

// Individual icons keyed by food id
const FOOD_ICONS = {
  // ===== CARBOHIDRATOS =====
  'arroz-blanco': (
    <Bowl>
      <ellipse cx="24" cy="24" rx="14" ry="3.2" fill={FC.riceDark}/>
      <ellipse cx="24" cy="23" rx="13" ry="2.6" fill={FC.rice}/>
      {[[18,22],[22,21],[26,22],[30,21],[20,24],[28,24],[24,22]].map(([cx,cy],i) => (
        <ellipse key={i} cx={cx} cy={cy} rx="1.5" ry="0.8" fill={FC.riceShadow}/>
      ))}
    </Bowl>
  ),

  'tortilla-maiz': (
    <g>
      <ellipse cx="24" cy="26" rx="18" ry="4" fill={FC.tortillaShadow} opacity="0.5"/>
      <ellipse cx="24" cy="24" rx="18" ry="14" fill={FC.tortilla}/>
      <ellipse cx="24" cy="24" rx="18" ry="14" fill="none" stroke={FC.tortillaDark} strokeWidth="1"/>
      <ellipse cx="22" cy="22" rx="2" ry="1.2" fill={FC.tortillaDark} opacity="0.4"/>
      <ellipse cx="28" cy="26" rx="1.5" ry="1" fill={FC.tortillaDark} opacity="0.4"/>
      <ellipse cx="18" cy="26" rx="1.5" ry="1" fill={FC.tortillaDark} opacity="0.4"/>
      <ellipse cx="30" cy="20" rx="1" ry="0.6" fill={FC.tortillaDark} opacity="0.5"/>
    </g>
  ),

  'tortilla-harina': (
    <g>
      <ellipse cx="24" cy="26" rx="18" ry="4" fill={FC.tortillaShadow} opacity="0.3"/>
      <ellipse cx="24" cy="24" rx="18" ry="14" fill="#F5E5C2"/>
      <ellipse cx="24" cy="24" rx="18" ry="14" fill="none" stroke="#C9A86A" strokeWidth="1"/>
      <ellipse cx="20" cy="22" rx="1.2" ry="0.7" fill="#A88847" opacity="0.4"/>
      <ellipse cx="28" cy="24" rx="1" ry="0.6" fill="#A88847" opacity="0.4"/>
    </g>
  ),

  'platano-verde': (
    <g>
      <path d="M 8 32 Q 6 18 16 12 Q 18 14 18 18 Q 30 14 38 22 Q 42 30 38 36 Q 32 38 24 36 Q 12 38 8 32 Z" fill={FC.plantainGreen}/>
      <path d="M 8 32 Q 6 18 16 12 Q 18 14 18 18 Q 30 14 38 22 Q 42 30 38 36 Q 32 38 24 36 Q 12 38 8 32 Z" fill="none" stroke="#7A8E48" strokeWidth="1.2"/>
      <path d="M 12 26 Q 22 22 32 28" stroke="#7A8E48" strokeWidth="0.8" fill="none" opacity="0.6"/>
    </g>
  ),

  'tajadas-maduras': (
    <g>
      {[[14,28,4],[24,22,5],[34,28,4]].map(([cx,cy,r],i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy+1} rx={r+2} ry={r-1} fill={FC.plantainDark} opacity="0.4"/>
          <ellipse cx={cx} cy={cy} rx={r+2} ry={r} fill={FC.plantain}/>
          <ellipse cx={cx} cy={cy} rx={r} ry={r-1.5} fill="#F5D480"/>
          <circle cx={cx} cy={cy} r="0.8" fill={FC.plantainDark}/>
        </g>
      ))}
    </g>
  ),

  'tajadas-verdes': (
    <g>
      {[[14,28,4],[24,22,5],[34,28,4]].map(([cx,cy,r],i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy+1} rx={r+2} ry={r-1} fill="#8B6E2E" opacity="0.4"/>
          <ellipse cx={cx} cy={cy} rx={r+2} ry={r} fill="#D9B26A"/>
          <ellipse cx={cx} cy={cy} rx={r} ry={r-1.5} fill="#F2D89A"/>
        </g>
      ))}
    </g>
  ),

  'yuca-cocida': (
    <g>
      <path d="M 10 30 Q 8 16 14 14 L 32 14 Q 40 16 38 30 Q 36 36 30 36 L 16 36 Q 12 36 10 30 Z" fill={FC.yuca}/>
      <path d="M 10 30 Q 8 16 14 14 L 32 14 Q 40 16 38 30 Q 36 36 30 36 L 16 36 Q 12 36 10 30 Z" fill="none" stroke={FC.yucaDark} strokeWidth="1.2"/>
      <line x1="14" y1="20" x2="34" y2="20" stroke={FC.yucaDark} strokeWidth="0.6" opacity="0.5"/>
      <line x1="14" y1="30" x2="34" y2="30" stroke={FC.yucaDark} strokeWidth="0.6" opacity="0.5"/>
    </g>
  ),

  'pan-frances': (
    <g>
      <ellipse cx="24" cy="38" rx="16" ry="2" fill={FC.breadCrust} opacity="0.3"/>
      <path d="M 8 28 Q 6 14 24 12 Q 42 14 40 28 Q 38 34 24 34 Q 10 34 8 28 Z" fill={FC.bread}/>
      <path d="M 8 28 Q 6 14 24 12 Q 42 14 40 28 Q 38 34 24 34 Q 10 34 8 28 Z" fill="none" stroke={FC.breadDark} strokeWidth="1.2"/>
      <path d="M 14 20 L 16 16" stroke={FC.breadCrust} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M 22 18 L 24 14" stroke={FC.breadCrust} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M 30 20 L 32 16" stroke={FC.breadCrust} strokeWidth="1.5" strokeLinecap="round"/>
    </g>
  ),

  'camote': (
    <g>
      <ellipse cx="24" cy="36" rx="18" ry="2" fill="#8C4A1F" opacity="0.3"/>
      <path d="M 8 24 Q 6 14 18 12 Q 36 14 40 22 Q 42 32 32 36 Q 14 36 10 30 Q 6 26 8 24 Z" fill="#B86F38"/>
      <path d="M 8 24 Q 6 14 18 12 Q 36 14 40 22 Q 42 32 32 36 Q 14 36 10 30 Q 6 26 8 24 Z" fill="none" stroke="#7A4520" strokeWidth="1.2"/>
      <circle cx="14" cy="20" r="1" fill="#7A4520" opacity="0.5"/>
      <circle cx="32" cy="24" r="1" fill="#7A4520" opacity="0.5"/>
    </g>
  ),

  'avena': (
    <Bowl>
      <ellipse cx="24" cy="24" rx="14" ry="3.2" fill={FC.oatDark}/>
      <ellipse cx="24" cy="23" rx="13" ry="2.6" fill={FC.oat}/>
      {[[18,22],[22,21],[26,22],[30,21],[20,24],[28,24]].map(([cx,cy],i) => (
        <ellipse key={i} cx={cx} cy={cy} rx="1.6" ry="0.6" fill={FC.oatDark} opacity="0.6"/>
      ))}
    </Bowl>
  ),

  'pasta': (
    <Bowl>
      <ellipse cx="24" cy="24" rx="14" ry="3.2" fill={FC.pastaDark}/>
      <path d="M 14 23 Q 18 20 22 23 Q 26 26 30 23 Q 34 20 34 23" fill="none" stroke={FC.pasta} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M 14 21 Q 18 18 22 21 Q 26 24 30 21" fill="none" stroke={FC.pasta} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M 16 25 Q 20 22 24 25 Q 28 28 32 25" fill="none" stroke={FC.pasta} strokeWidth="1.6" strokeLinecap="round"/>
    </Bowl>
  ),

  // ===== PROTEÍNAS =====
  'pollo-plancha': (
    <g>
      <ellipse cx="24" cy="38" rx="14" ry="2" fill="#7A4520" opacity="0.3"/>
      <path d="M 14 24 Q 10 12 22 10 Q 36 12 36 22 Q 38 30 30 34 Q 16 36 14 30 Z" fill={FC.chicken}/>
      <path d="M 14 24 Q 10 12 22 10 Q 36 12 36 22 Q 38 30 30 34 Q 16 36 14 30 Z" fill="none" stroke={FC.chickenDark} strokeWidth="1.2"/>
      <path d="M 18 18 Q 22 14 28 16" stroke={FC.chickenDark} strokeWidth="0.8" fill="none" opacity="0.6"/>
      <path d="M 20 26 Q 24 22 30 24" stroke={FC.chickenDark} strokeWidth="0.8" fill="none" opacity="0.6"/>
    </g>
  ),

  'pollo-frito': (
    <g>
      <ellipse cx="24" cy="40" rx="12" ry="2" fill="#5A3818" opacity="0.4"/>
      {/* drumstick */}
      <path d="M 16 28 Q 10 16 18 10 Q 28 6 34 14 Q 38 22 32 28 L 30 34 Q 28 38 22 38 Q 16 36 16 28 Z" fill="#C68A4F"/>
      <path d="M 16 28 Q 10 16 18 10 Q 28 6 34 14 Q 38 22 32 28 L 30 34 Q 28 38 22 38 Q 16 36 16 28 Z" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
      {/* bone */}
      <ellipse cx="30" cy="36" rx="3" ry="2" fill="#F0E5D0"/>
      <ellipse cx="30" cy="36" rx="3" ry="2" fill="none" stroke="#8C5828" strokeWidth="0.8"/>
      {/* texture dots for fried */}
      <circle cx="20" cy="18" r="0.8" fill="#8C5828"/>
      <circle cx="26" cy="14" r="0.8" fill="#8C5828"/>
      <circle cx="22" cy="24" r="0.8" fill="#8C5828"/>
      <circle cx="28" cy="22" r="0.8" fill="#8C5828"/>
    </g>
  ),

  'carne-asada': (
    <g>
      <ellipse cx="24" cy="38" rx="16" ry="2" fill="#5A2818" opacity="0.4"/>
      <path d="M 8 22 Q 8 12 24 10 Q 40 12 40 22 Q 40 32 24 34 Q 8 32 8 22 Z" fill={FC.meat}/>
      <path d="M 8 22 Q 8 12 24 10 Q 40 12 40 22 Q 40 32 24 34 Q 8 32 8 22 Z" fill="none" stroke={FC.meatDark} strokeWidth="1.2"/>
      <path d="M 14 18 Q 24 14 34 18" stroke={FC.meatDark} strokeWidth="0.8" fill="none"/>
      <path d="M 14 24 Q 24 20 34 24" stroke="#7A2818" strokeWidth="0.8" fill="none" opacity="0.7"/>
      <path d="M 14 28 Q 24 24 34 28" stroke={FC.meatDark} strokeWidth="0.8" fill="none"/>
    </g>
  ),

  'carne-molida': (
    <Bowl>
      <ellipse cx="24" cy="24" rx="14" ry="3.2" fill={FC.meatDark}/>
      {[[16,22],[20,21],[24,22],[28,21],[32,22],[18,24],[26,24],[22,23],[30,24]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="1.4" fill={i % 2 ? FC.meat : '#9A4028'}/>
      ))}
    </Bowl>
  ),

  'chorizo': (
    <g>
      <path d="M 8 24 Q 10 16 20 14 Q 32 14 40 24 Q 38 32 28 32 Q 16 34 8 24 Z" fill="#A8392A"/>
      <path d="M 8 24 Q 10 16 20 14 Q 32 14 40 24 Q 38 32 28 32 Q 16 34 8 24 Z" fill="none" stroke="#6E2418" strokeWidth="1.2"/>
      {/* ties */}
      <path d="M 8 22 L 6 24 L 8 26" stroke="#6E2418" strokeWidth="1.2" fill="none"/>
      <path d="M 40 22 L 42 24 L 40 26" stroke="#6E2418" strokeWidth="1.2" fill="none"/>
      {/* texture */}
      <circle cx="16" cy="20" r="0.8" fill="#E8B070" opacity="0.7"/>
      <circle cx="24" cy="22" r="0.8" fill="#E8B070" opacity="0.7"/>
      <circle cx="32" cy="22" r="0.8" fill="#E8B070" opacity="0.7"/>
      <circle cx="20" cy="26" r="0.8" fill="#E8B070" opacity="0.7"/>
    </g>
  ),

  'huevo': (
    <g>
      <ellipse cx="24" cy="38" rx="12" ry="1.5" fill="#A89478" opacity="0.3"/>
      <ellipse cx="24" cy="24" rx="11" ry="14" fill={FC.eggShell}/>
      <ellipse cx="24" cy="24" rx="11" ry="14" fill="none" stroke="#C9B58E" strokeWidth="1.2"/>
      <ellipse cx="20" cy="18" rx="3" ry="4" fill="#FFFFFF" opacity="0.5"/>
    </g>
  ),

  'huevo-revuelto': (
    <g>
      <ellipse cx="24" cy="34" rx="18" ry="2" fill="#A89478" opacity="0.3"/>
      <path d="M 8 26 Q 10 16 24 16 Q 40 18 40 28 Q 36 32 24 32 Q 12 32 8 26 Z" fill="#FAFAFA"/>
      <path d="M 8 26 Q 10 16 24 16 Q 40 18 40 28 Q 36 32 24 32 Q 12 32 8 26 Z" fill="none" stroke="#D9D0B8" strokeWidth="1"/>
      <ellipse cx="18" cy="22" rx="4" ry="3" fill={FC.yolk}/>
      <ellipse cx="30" cy="24" rx="3" ry="2.5" fill={FC.yolk}/>
      <ellipse cx="24" cy="28" rx="2.5" ry="2" fill={FC.yolkDark}/>
    </g>
  ),

  'pescado': (
    <g>
      <path d="M 6 24 L 14 18 Q 28 14 38 22 Q 36 28 38 30 Q 28 36 14 30 Z" fill={FC.fish}/>
      <path d="M 6 24 L 14 18 Q 28 14 38 22 Q 36 28 38 30 Q 28 36 14 30 Z" fill="none" stroke={FC.fishDark} strokeWidth="1.2"/>
      {/* tail */}
      <path d="M 38 22 L 44 16 L 42 24 L 44 32 L 38 28" fill={FC.fish} stroke={FC.fishDark} strokeWidth="1.2"/>
      {/* eye */}
      <circle cx="14" cy="22" r="1.5" fill="#FFFFFF"/>
      <circle cx="14" cy="22" r="0.8" fill="#1A2235"/>
      {/* fin */}
      <path d="M 20 18 L 24 12 L 26 18" fill={FC.fish} stroke={FC.fishDark} strokeWidth="1"/>
      {/* gill */}
      <path d="M 18 20 Q 17 24 18 28" stroke={FC.fishDark} strokeWidth="0.8" fill="none"/>
    </g>
  ),

  'pescado-frito': (
    <g>
      <path d="M 6 24 L 14 18 Q 28 14 38 22 Q 36 28 38 30 Q 28 36 14 30 Z" fill="#D9A56B"/>
      <path d="M 6 24 L 14 18 Q 28 14 38 22 Q 36 28 38 30 Q 28 36 14 30 Z" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
      <path d="M 38 22 L 44 16 L 42 24 L 44 32 L 38 28" fill="#D9A56B" stroke="#8C5828" strokeWidth="1.2"/>
      <circle cx="14" cy="22" r="1.2" fill="#1A2235"/>
      {[[20,22],[26,20],[30,26],[22,28]].map(([cx,cy],i) => <circle key={i} cx={cx} cy={cy} r="0.6" fill="#8C5828"/>)}
    </g>
  ),

  'atun-agua': (
    <g>
      <path d="M 12 14 L 36 14 L 38 16 L 38 34 L 36 36 L 12 36 L 10 34 L 10 16 Z" fill="#9BB5C8"/>
      <path d="M 12 14 L 36 14 L 38 16 L 38 34 L 36 36 L 12 36 L 10 34 L 10 16 Z" fill="none" stroke="#5A7A92" strokeWidth="1.2"/>
      <rect x="12" y="14" width="24" height="3" fill="#5A7A92"/>
      <rect x="14" y="20" width="20" height="10" fill="#F2F2F2" rx="1"/>
      <text x="24" y="27" fontFamily="sans-serif" fontSize="6" fontWeight="700" fill="#5A7A92" textAnchor="middle">ATÚN</text>
    </g>
  ),

  'frijoles': (
    <Bowl>
      <ellipse cx="24" cy="24" rx="14" ry="3.2" fill={FC.beansDark}/>
      {[[16,22,4,2.5],[22,21,4,2.5],[28,22,4,2.5],[32,23,3.5,2],[18,24,4,2.5],[26,24,4,2.5]].map(([cx,cy,rx,ry],i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={FC.beans} transform={`rotate(${i*15} ${cx} ${cy})`}/>
          <ellipse cx={cx} cy={cy} rx={rx*0.5} ry={ry*0.3} fill="#FFFFFF" opacity="0.3" transform={`rotate(${i*15} ${cx} ${cy})`}/>
        </g>
      ))}
    </Bowl>
  ),

  'frijoles-fritos': (
    <Bowl>
      <ellipse cx="24" cy="24" rx="14" ry="3.2" fill="#3A1A0E"/>
      <ellipse cx="24" cy="23" rx="13" ry="2.6" fill="#5A2818"/>
      <ellipse cx="20" cy="22" rx="3" ry="1.5" fill="#7A3E2E" opacity="0.6"/>
      <ellipse cx="28" cy="23" rx="3" ry="1.5" fill="#7A3E2E" opacity="0.6"/>
    </Bowl>
  ),

  // ===== VEGETALES =====
  'ensalada-mixta': (
    <Bowl>
      {/* Lettuce base */}
      <path d="M 10 22 Q 14 18 20 20 Q 24 18 28 20 Q 34 18 38 22 Q 38 25 24 25 Q 10 25 10 22 Z" fill={FC.leaf}/>
      <path d="M 12 22 Q 16 19 22 21" fill="none" stroke={FC.leafDark} strokeWidth="0.6"/>
      <path d="M 26 21 Q 32 19 36 22" fill="none" stroke={FC.leafDark} strokeWidth="0.6"/>
      {/* Tomato */}
      <circle cx="18" cy="22" r="2" fill={FC.tomato}/>
      <circle cx="30" cy="22" r="2" fill={FC.tomato}/>
      {/* Carrot bits */}
      <rect x="22" y="21" width="2" height="3" fill={FC.carrot} rx="0.5"/>
      <rect x="26" y="22" width="2" height="2" fill={FC.carrot} rx="0.5"/>
    </Bowl>
  ),

  'repollo-curtido': (
    <g>
      <ellipse cx="24" cy="36" rx="16" ry="2" fill="#7A8E48" opacity="0.3"/>
      <circle cx="24" cy="24" r="14" fill={FC.cabbage}/>
      <circle cx="24" cy="24" r="14" fill="none" stroke={FC.cabbageDark} strokeWidth="1.2"/>
      <path d="M 12 22 Q 18 26 24 22 Q 30 26 36 22" stroke={FC.cabbageDark} strokeWidth="0.8" fill="none"/>
      <path d="M 14 28 Q 20 32 26 28 Q 32 32 34 28" stroke={FC.cabbageDark} strokeWidth="0.8" fill="none"/>
      <path d="M 16 18 Q 22 14 28 16 Q 34 14 32 18" stroke={FC.cabbageDark} strokeWidth="0.8" fill="none"/>
    </g>
  ),

  'tomate': (
    <g>
      <ellipse cx="24" cy="38" rx="14" ry="2" fill="#7A1818" opacity="0.3"/>
      <circle cx="24" cy="26" r="14" fill={FC.tomato}/>
      <circle cx="24" cy="26" r="14" fill="none" stroke={FC.tomatoDark} strokeWidth="1.2"/>
      <ellipse cx="20" cy="22" rx="3" ry="2" fill="#E8716A" opacity="0.7"/>
      {/* Stem */}
      <path d="M 20 14 L 22 12 L 24 13 L 26 11 L 28 13 L 30 12 L 28 16 L 26 14 L 24 16 L 22 14 Z" fill={FC.leafDark}/>
      <path d="M 24 13 L 24 16" stroke={FC.leafDark} strokeWidth="1"/>
    </g>
  ),

  'pepino': (
    <g>
      <ellipse cx="24" cy="28" rx="18" ry="2" fill="#3A5028" opacity="0.3"/>
      <path d="M 6 24 Q 6 18 12 16 L 36 14 Q 42 14 42 22 Q 42 28 36 30 L 12 30 Q 6 30 6 24 Z" fill={FC.cucumber}/>
      <path d="M 6 24 Q 6 18 12 16 L 36 14 Q 42 14 42 22 Q 42 28 36 30 L 12 30 Q 6 30 6 24 Z" fill="none" stroke={FC.cucumberDark} strokeWidth="1.2"/>
      <line x1="14" y1="18" x2="14" y2="28" stroke={FC.cucumberDark} strokeWidth="0.6"/>
      <line x1="22" y1="16" x2="22" y2="28" stroke={FC.cucumberDark} strokeWidth="0.6"/>
      <line x1="30" y1="16" x2="30" y2="28" stroke={FC.cucumberDark} strokeWidth="0.6"/>
    </g>
  ),

  'lechuga': (
    <g>
      <ellipse cx="24" cy="38" rx="16" ry="2" fill="#3A5028" opacity="0.3"/>
      <path d="M 6 26 Q 8 14 18 12 Q 24 8 30 12 Q 40 14 42 26 Q 42 36 24 36 Q 6 36 6 26 Z" fill={FC.lettuce}/>
      <path d="M 6 26 Q 8 14 18 12 Q 24 8 30 12 Q 40 14 42 26 Q 42 36 24 36 Q 6 36 6 26 Z" fill="none" stroke={FC.lettuceDark} strokeWidth="1.2"/>
      <path d="M 24 12 L 24 34" stroke={FC.lettuceDark} strokeWidth="1"/>
      <path d="M 14 18 Q 18 22 24 22" fill="none" stroke={FC.lettuceDark} strokeWidth="0.8"/>
      <path d="M 34 18 Q 30 22 24 22" fill="none" stroke={FC.lettuceDark} strokeWidth="0.8"/>
      <path d="M 12 26 Q 18 30 24 30" fill="none" stroke={FC.lettuceDark} strokeWidth="0.8"/>
      <path d="M 36 26 Q 30 30 24 30" fill="none" stroke={FC.lettuceDark} strokeWidth="0.8"/>
    </g>
  ),

  'zanahoria': (
    <g>
      {/* Leaves */}
      <path d="M 20 12 Q 18 6 14 6 Q 12 8 14 12 M 24 10 Q 24 4 24 4 M 28 12 Q 30 6 34 6 Q 36 8 34 12" stroke={FC.leafDark} strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Carrot body */}
      <path d="M 16 14 L 20 36 Q 22 40 24 40 Q 26 40 28 36 L 32 14 Z" fill={FC.carrot}/>
      <path d="M 16 14 L 20 36 Q 22 40 24 40 Q 26 40 28 36 L 32 14 Z" fill="none" stroke={FC.carrotDark} strokeWidth="1.2"/>
      <line x1="20" y1="20" x2="28" y2="20" stroke={FC.carrotDark} strokeWidth="0.6"/>
      <line x1="20" y1="26" x2="28" y2="26" stroke={FC.carrotDark} strokeWidth="0.6"/>
      <line x1="22" y1="32" x2="26" y2="32" stroke={FC.carrotDark} strokeWidth="0.6"/>
    </g>
  ),

  'ayote': (
    <g>
      <ellipse cx="24" cy="40" rx="16" ry="2" fill="#7A3818" opacity="0.3"/>
      <ellipse cx="24" cy="26" rx="18" ry="14" fill={FC.pumpkin}/>
      <ellipse cx="24" cy="26" rx="18" ry="14" fill="none" stroke={FC.pumpkinDark} strokeWidth="1.2"/>
      <path d="M 14 14 Q 14 28 14 38" stroke={FC.pumpkinDark} strokeWidth="0.8" fill="none"/>
      <path d="M 24 12 Q 24 28 24 40" stroke={FC.pumpkinDark} strokeWidth="0.8" fill="none"/>
      <path d="M 34 14 Q 34 28 34 38" stroke={FC.pumpkinDark} strokeWidth="0.8" fill="none"/>
      {/* Stem */}
      <rect x="22" y="10" width="4" height="4" fill={FC.leafDark} rx="1"/>
    </g>
  ),

  'chile-dulce': (
    <g>
      <path d="M 12 22 Q 10 14 18 12 Q 24 10 30 12 Q 38 14 36 22 Q 38 36 24 38 Q 10 36 12 22 Z" fill={FC.pepperGreen}/>
      <path d="M 12 22 Q 10 14 18 12 Q 24 10 30 12 Q 38 14 36 22 Q 38 36 24 38 Q 10 36 12 22 Z" fill="none" stroke="#3A5828" strokeWidth="1.2"/>
      {/* Stem */}
      <path d="M 22 10 L 22 14 M 26 10 L 26 14" stroke={FC.stem} strokeWidth="2" strokeLinecap="round"/>
      <path d="M 18 8 Q 24 6 30 8" stroke={FC.stem} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* Highlight */}
      <ellipse cx="18" cy="20" rx="2" ry="6" fill="#6FAA50" opacity="0.6"/>
    </g>
  ),

  'brocoli': (
    <g>
      <ellipse cx="24" cy="40" rx="12" ry="2" fill="#2A4818" opacity="0.3"/>
      {/* Stem */}
      <rect x="20" y="26" width="8" height="14" fill="#C2D49A" rx="1"/>
      <rect x="20" y="26" width="8" height="14" fill="none" stroke="#7A8E48" strokeWidth="1"/>
      {/* Florets */}
      {[[14,20,6],[24,16,7],[34,20,6],[18,24,5],[30,24,5]].map(([cx,cy,r],i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill={FC.broccoli}/>
          <circle cx={cx-1} cy={cy-1} r="1.5" fill={FC.broccoliDark} opacity="0.5"/>
          <circle cx={cx+1.5} cy={cy+1} r="1.2" fill={FC.broccoliDark} opacity="0.5"/>
        </g>
      ))}
    </g>
  ),

  'sopa-verduras': (
    <Bowl>
      <ellipse cx="24" cy="24" rx="14" ry="3.2" fill="#A87A2A"/>
      <ellipse cx="24" cy="23" rx="13" ry="2.5" fill="#D9A55A"/>
      {/* Veggie bits */}
      <circle cx="18" cy="22" r="1.5" fill={FC.carrot}/>
      <circle cx="22" cy="23" r="1.2" fill={FC.broccoli}/>
      <circle cx="26" cy="22" r="1.4" fill={FC.tomato}/>
      <circle cx="30" cy="23" r="1.2" fill={FC.broccoli}/>
      {/* Steam */}
      <path d="M 18 18 Q 19 14 18 10" stroke={FC.bowlDark} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6"/>
      <path d="M 24 16 Q 25 12 24 8" stroke={FC.bowlDark} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6"/>
      <path d="M 30 18 Q 31 14 30 10" stroke={FC.bowlDark} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6"/>
    </Bowl>
  ),

  // ===== FRUTAS =====
  'mango': (
    <g>
      <ellipse cx="24" cy="38" rx="14" ry="2" fill="#7A4518" opacity="0.3"/>
      <path d="M 14 18 Q 12 32 22 38 Q 36 38 38 24 Q 38 12 28 10 Q 18 10 14 18 Z" fill={FC.mango}/>
      <path d="M 14 18 Q 12 32 22 38 Q 36 38 38 24 Q 38 12 28 10 Q 18 10 14 18 Z" fill="none" stroke={FC.mangoDark} strokeWidth="1.2"/>
      <path d="M 22 14 Q 18 22 22 32" stroke={FC.mangoRed} strokeWidth="3" fill="none" opacity="0.5" strokeLinecap="round"/>
      {/* Stem */}
      <path d="M 28 10 L 26 6" stroke={FC.leafDark} strokeWidth="1.5"/>
      <path d="M 26 6 L 30 4" stroke={FC.leafDark} strokeWidth="1.5"/>
    </g>
  ),

  'papaya': (
    <g>
      <ellipse cx="24" cy="38" rx="14" ry="2" fill="#7A3818" opacity="0.3"/>
      <path d="M 14 14 Q 14 36 24 38 Q 34 36 34 14 Z" fill={FC.papayaFlesh}/>
      <path d="M 14 14 Q 14 36 24 38 Q 34 36 34 14 Z" fill="none" stroke={FC.papayaDark || '#B86528'} strokeWidth="1.2"/>
      <path d="M 16 14 Q 24 6 32 14" fill={FC.cucumber} stroke={FC.cucumberDark} strokeWidth="1.2"/>
      {/* Seeds */}
      <ellipse cx="24" cy="22" rx="3" ry="6" fill="#1A2235" opacity="0.7"/>
      {[[22,18],[26,18],[22,22],[26,22],[22,26],[26,26],[24,20],[24,24]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="0.8" fill="#1A2235"/>
      ))}
    </g>
  ),

  'sandia': (
    <g>
      <path d="M 6 18 L 42 18 L 42 22 Q 38 38 24 38 Q 10 38 6 22 Z" fill={FC.watermelon}/>
      <path d="M 6 18 L 42 18 L 42 22 Q 38 38 24 38 Q 10 38 6 22 Z" fill="none" stroke="#8C2A20" strokeWidth="1.2"/>
      {/* Rind */}
      <path d="M 6 18 L 42 18 L 42 22 Q 38 24 6 22 Z" fill={FC.watermelonRind}/>
      <path d="M 6 18 L 42 18" stroke="#3D6B2A" strokeWidth="1.5"/>
      {/* Seeds */}
      {[[16,28],[20,32],[24,28],[28,32],[32,28],[22,26],[26,26]].map(([cx,cy],i) => (
        <ellipse key={i} cx={cx} cy={cy} rx="1" ry="1.5" fill={FC.watermelonSeeds}/>
      ))}
    </g>
  ),

  'banano': (
    <g>
      <path d="M 8 14 Q 6 28 14 36 Q 22 40 32 36 Q 42 28 40 18 L 38 16 Q 36 26 28 32 Q 18 36 14 28 Q 10 18 12 14 Z" fill={FC.banana}/>
      <path d="M 8 14 Q 6 28 14 36 Q 22 40 32 36 Q 42 28 40 18 L 38 16 Q 36 26 28 32 Q 18 36 14 28 Q 10 18 12 14 Z" fill="none" stroke={FC.bananaDark} strokeWidth="1.2"/>
      <path d="M 14 16 Q 16 26 24 32" stroke={FC.bananaDark} strokeWidth="0.8" fill="none" opacity="0.6"/>
      {/* Stem */}
      <ellipse cx="10" cy="13" rx="3" ry="1.5" fill="#5A4A20" transform="rotate(-30 10 13)"/>
    </g>
  ),

  'pina': (
    <g>
      {/* Leaves */}
      <path d="M 16 8 L 14 4 L 18 6 L 16 2 L 22 4 L 22 0 L 26 4 L 28 0 L 30 4 L 34 2 L 32 6 L 36 4 L 32 8" fill="none" stroke={FC.pineappleLeaf} strokeWidth="2" strokeLinejoin="round"/>
      {/* Body */}
      <ellipse cx="24" cy="24" rx="12" ry="14" fill={FC.pineapple}/>
      <ellipse cx="24" cy="24" rx="12" ry="14" fill="none" stroke={FC.pineappleDark} strokeWidth="1.2"/>
      {/* Cross-hatch pattern */}
      <path d="M 14 14 L 34 22 M 14 22 L 34 30 M 14 30 L 34 38 M 34 14 L 14 22 M 34 22 L 14 30 M 34 30 L 14 38" stroke={FC.pineappleDark} strokeWidth="0.6" opacity="0.6"/>
    </g>
  ),

  'manzana': (
    <g>
      <ellipse cx="24" cy="40" rx="12" ry="2" fill="#5A1A1A" opacity="0.3"/>
      <path d="M 24 12 Q 14 12 12 22 Q 12 36 22 38 Q 24 36 26 38 Q 36 36 36 22 Q 34 12 24 12 Z" fill={FC.apple}/>
      <path d="M 24 12 Q 14 12 12 22 Q 12 36 22 38 Q 24 36 26 38 Q 36 36 36 22 Q 34 12 24 12 Z" fill="none" stroke={FC.appleDark} strokeWidth="1.2"/>
      <ellipse cx="18" cy="18" rx="3" ry="5" fill="#E86A6A" opacity="0.6"/>
      {/* Stem */}
      <rect x="23" y="8" width="2" height="6" fill={FC.appleStem}/>
      {/* Leaf */}
      <path d="M 25 10 Q 30 8 32 12 Q 28 14 25 12" fill={FC.leafDark}/>
    </g>
  ),

  'naranja': (
    <g>
      <ellipse cx="24" cy="40" rx="13" ry="2" fill="#7A3818" opacity="0.3"/>
      <circle cx="24" cy="26" r="14" fill={FC.orange}/>
      <circle cx="24" cy="26" r="14" fill="none" stroke={FC.orangeDark} strokeWidth="1.2"/>
      {[[16,22],[22,18],[30,20],[18,30],[28,32],[24,26]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="0.6" fill={FC.orangeDark} opacity="0.5"/>
      ))}
      {/* Stem leaf */}
      <path d="M 22 12 Q 26 8 30 10 Q 28 14 24 14" fill={FC.leafDark}/>
    </g>
  ),

  'fresas': (
    <g>
      {[[14,28,5],[24,22,5],[34,28,5]].map(([cx,cy,r],i) => (
        <g key={i}>
          <path d={`M ${cx-r} ${cy-2} L ${cx+r} ${cy-2} L ${cx} ${cy+r+2} Z`} fill={FC.strawberry}/>
          <path d={`M ${cx-r} ${cy-2} L ${cx+r} ${cy-2} L ${cx} ${cy+r+2} Z`} fill="none" stroke={FC.strawberryDark} strokeWidth="1"/>
          {/* Leaves */}
          <path d={`M ${cx-3} ${cy-2} L ${cx} ${cy-5} L ${cx+3} ${cy-2} Z`} fill={FC.leafDark}/>
          {/* Seeds */}
          {[[-1,1],[1,2],[0,3],[-2,3],[2,4]].map(([dx,dy],j) => (
            <ellipse key={j} cx={cx+dx} cy={cy+dy} rx="0.4" ry="0.7" fill={FC.strawberrySeeds}/>
          ))}
        </g>
      ))}
    </g>
  ),

  // ===== LÁCTEOS =====
  'queso-fresco': (
    <g>
      <path d="M 8 30 L 24 14 L 40 30 L 40 38 L 8 38 Z" fill={FC.cheese}/>
      <path d="M 8 30 L 24 14 L 40 30 L 40 38 L 8 38 Z" fill="none" stroke={FC.cheeseRind} strokeWidth="1.2"/>
      <path d="M 8 30 L 40 30" stroke={FC.cheeseRind} strokeWidth="1.2"/>
      <circle cx="16" cy="34" r="1" fill={FC.cheeseRind}/>
      <circle cx="24" cy="34" r="1.2" fill={FC.cheeseRind}/>
      <circle cx="32" cy="34" r="1" fill={FC.cheeseRind}/>
    </g>
  ),

  'cuajada': (
    <g>
      <ellipse cx="24" cy="36" rx="14" ry="2" fill="#A89478" opacity="0.3"/>
      <path d="M 12 18 Q 12 14 16 14 L 32 14 Q 36 14 36 18 L 36 32 Q 36 36 32 36 L 16 36 Q 12 36 12 32 Z" fill="#FAFAEA"/>
      <path d="M 12 18 Q 12 14 16 14 L 32 14 Q 36 14 36 18 L 36 32 Q 36 36 32 36 L 16 36 Q 12 36 12 32 Z" fill="none" stroke="#C9B58E" strokeWidth="1.2"/>
      <path d="M 16 22 L 32 22" stroke="#C9B58E" strokeWidth="0.6" opacity="0.6"/>
      <path d="M 16 28 L 32 28" stroke="#C9B58E" strokeWidth="0.6" opacity="0.6"/>
    </g>
  ),

  'mantequilla-crema': (
    <g>
      <ellipse cx="24" cy="38" rx="14" ry="2" fill="#7A6228" opacity="0.3"/>
      <path d="M 10 22 Q 10 16 14 14 L 34 14 Q 38 16 38 22 L 38 34 Q 38 38 34 38 L 14 38 Q 10 38 10 34 Z" fill={FC.butter}/>
      <path d="M 10 22 Q 10 16 14 14 L 34 14 Q 38 16 38 22 L 38 34 Q 38 38 34 38 L 14 38 Q 10 38 10 34 Z" fill="none" stroke="#A88847" strokeWidth="1.2"/>
      <ellipse cx="24" cy="20" rx="10" ry="2" fill={FC.butterShadow}/>
    </g>
  ),

  'leche-entera': (
    <g>
      <path d="M 14 14 L 16 10 L 32 10 L 34 14 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="#FAFAFA"/>
      <path d="M 14 14 L 16 10 L 32 10 L 34 14 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
      <rect x="14" y="14" width="20" height="4" fill={FC.milkBlue}/>
      <rect x="16" y="22" width="16" height="10" fill="#F2F4F7" rx="1"/>
      <text x="24" y="29" fontFamily="sans-serif" fontSize="6" fontWeight="700" fill={FC.milkBlue} textAnchor="middle">LECHE</text>
    </g>
  ),

  'leche-descremada': (
    <g>
      <path d="M 14 14 L 16 10 L 32 10 L 34 14 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="#FAFAFA"/>
      <path d="M 14 14 L 16 10 L 32 10 L 34 14 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
      <rect x="14" y="14" width="20" height="4" fill="#7DAA8E"/>
      <rect x="16" y="22" width="16" height="10" fill="#F2F4F7" rx="1"/>
      <text x="24" y="29" fontFamily="sans-serif" fontSize="5" fontWeight="700" fill="#5A8C6E" textAnchor="middle">DESCR.</text>
    </g>
  ),

  'yogurt': (
    <g>
      <ellipse cx="24" cy="40" rx="13" ry="2" fill="#A89478" opacity="0.3"/>
      <path d="M 12 16 L 36 16 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 Z" fill="#FAFAFA"/>
      <path d="M 12 16 L 36 16 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
      <ellipse cx="24" cy="16" rx="12" ry="2" fill={FC.milkBlue}/>
      <ellipse cx="24" cy="14" rx="12" ry="2" fill="#7AAAD0"/>
      <text x="24" y="32" fontFamily="sans-serif" fontSize="6" fontWeight="700" fill="#5A7A92" textAnchor="middle">YOG</text>
    </g>
  ),

  // ===== GRASAS =====
  'aguacate': (
    <g>
      <ellipse cx="24" cy="40" rx="10" ry="1.5" fill="#3A4818" opacity="0.3"/>
      <path d="M 16 16 Q 14 22 14 28 Q 14 38 24 40 Q 34 38 34 28 Q 34 22 32 18 Q 28 12 24 12 Q 20 12 16 16 Z" fill={FC.avocado}/>
      <path d="M 16 16 Q 14 22 14 28 Q 14 38 24 40 Q 34 38 34 28 Q 34 22 32 18 Q 28 12 24 12 Q 20 12 16 16 Z" fill="none" stroke="#3A4818" strokeWidth="1.2"/>
      {/* Flesh ring */}
      <path d="M 18 18 Q 16 24 16 28 Q 16 36 24 38 Q 32 36 32 28 Q 32 24 30 20" fill={FC.avocadoFlesh}/>
      {/* Pit */}
      <circle cx="24" cy="28" r="5" fill={FC.avocadoPit}/>
      <circle cx="22" cy="26" r="1.5" fill="#A88056"/>
    </g>
  ),

  'aceite-oliva': (
    <g>
      <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#7A6228" opacity="0.3"/>
      <path d="M 22 8 L 26 8 L 26 12 L 28 14 L 28 16 L 32 18 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 L 16 18 L 20 16 L 20 14 L 22 12 Z" fill="#7DAA8E"/>
      <path d="M 22 8 L 26 8 L 26 12 L 28 14 L 28 16 L 32 18 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 L 16 18 L 20 16 L 20 14 L 22 12 Z" fill="none" stroke="#3A6850" strokeWidth="1.2"/>
      <rect x="18" y="22" width="12" height="8" fill="#F2DC8A" rx="1"/>
      <text x="24" y="28" fontFamily="sans-serif" fontSize="5" fontWeight="700" fill="#3A6850" textAnchor="middle">OLIVA</text>
    </g>
  ),

  'mantequilla': (
    <g>
      <ellipse cx="24" cy="36" rx="14" ry="2" fill="#7A6228" opacity="0.3"/>
      <path d="M 10 20 L 38 16 L 38 30 L 10 34 Z" fill={FC.butter}/>
      <path d="M 10 20 L 38 16 L 38 30 L 10 34 Z" fill="none" stroke="#A88847" strokeWidth="1.2"/>
      <path d="M 10 20 L 14 24 L 14 38 L 10 34" fill={FC.butterShadow}/>
      <path d="M 10 20 L 14 24 L 14 38 L 10 34" fill="none" stroke="#A88847" strokeWidth="1"/>
      <path d="M 14 24 L 38 20" stroke="#A88847" strokeWidth="0.8" fill="none"/>
    </g>
  ),

  'mani': (
    <g>
      {[[16,22,30],[26,18,-15],[20,30,40],[32,26,-30],[12,32,-20]].map(([cx,cy,rot],i) => (
        <g key={i} transform={`rotate(${rot} ${cx} ${cy})`}>
          <path d={`M ${cx-5} ${cy} Q ${cx-5} ${cy-3} ${cx-2} ${cy-3} Q ${cx-1} ${cy-1} ${cx+1} ${cy-1} Q ${cx+2} ${cy-3} ${cx+5} ${cy-3} Q ${cx+5} ${cy} ${cx+5} ${cy+3} Q ${cx+2} ${cy+3} ${cx+1} ${cy+1} Q ${cx-1} ${cy+1} ${cx-2} ${cy+3} Q ${cx-5} ${cy+3} ${cx-5} ${cy} Z`} fill={FC.nuts}/>
          <path d={`M ${cx-5} ${cy} Q ${cx-5} ${cy-3} ${cx-2} ${cy-3} Q ${cx-1} ${cy-1} ${cx+1} ${cy-1} Q ${cx+2} ${cy-3} ${cx+5} ${cy-3} Q ${cx+5} ${cy} ${cx+5} ${cy+3} Q ${cx+2} ${cy+3} ${cx+1} ${cy+1} Q ${cx-1} ${cy+1} ${cx-2} ${cy+3} Q ${cx-5} ${cy+3} ${cx-5} ${cy} Z`} fill="none" stroke={FC.nutsDark} strokeWidth="0.8"/>
          <path d={`M ${cx-3} ${cy-2} Q ${cx-3} ${cy} ${cx-3} ${cy+2}`} stroke={FC.nutsDark} strokeWidth="0.4" fill="none"/>
          <path d={`M ${cx+3} ${cy-2} Q ${cx+3} ${cy} ${cx+3} ${cy+2}`} stroke={FC.nutsDark} strokeWidth="0.4" fill="none"/>
        </g>
      ))}
    </g>
  ),

  // ===== TÍPICOS HONDUREÑOS =====
  'baleada-sencilla': (
    <g>
      {/* Folded flour tortilla */}
      <ellipse cx="24" cy="38" rx="18" ry="2" fill="#7A5A28" opacity="0.3"/>
      <path d="M 8 26 Q 8 14 24 12 Q 40 14 40 26 Q 40 32 24 32 Q 8 32 8 26 Z" fill="#F5E5C2"/>
      <path d="M 8 26 Q 8 14 24 12 Q 40 14 40 26 Q 40 32 24 32 Q 8 32 8 26 Z" fill="none" stroke="#A88847" strokeWidth="1.2"/>
      {/* Fold line */}
      <path d="M 12 20 Q 24 26 36 20" stroke="#A88847" strokeWidth="1" fill="none"/>
      {/* Beans peeking */}
      <ellipse cx="22" cy="22" rx="2" ry="1" fill={FC.beans}/>
      <ellipse cx="28" cy="22" rx="2" ry="1" fill={FC.beans}/>
      {/* Cheese crumbs */}
      <circle cx="18" cy="20" r="0.8" fill={FC.cheese}/>
      <circle cx="30" cy="20" r="0.8" fill={FC.cheese}/>
    </g>
  ),

  'baleada-mixta': (
    <g>
      <ellipse cx="24" cy="38" rx="18" ry="2" fill="#7A5A28" opacity="0.3"/>
      <path d="M 8 26 Q 8 14 24 12 Q 40 14 40 26 Q 40 32 24 32 Q 8 32 8 26 Z" fill="#F5E5C2"/>
      <path d="M 8 26 Q 8 14 24 12 Q 40 14 40 26 Q 40 32 24 32 Q 8 32 8 26 Z" fill="none" stroke="#A88847" strokeWidth="1.2"/>
      <path d="M 12 20 Q 24 26 36 20" stroke="#A88847" strokeWidth="1" fill="none"/>
      {/* Filling visible from top */}
      <circle cx="20" cy="20" r="2" fill={FC.yolk}/>
      <circle cx="28" cy="20" r="2" fill={FC.avocado}/>
      <ellipse cx="24" cy="22" rx="2" ry="1" fill={FC.beans}/>
    </g>
  ),

  'casamiento': (
    <Plate>
      {/* Rice and beans mixed */}
      <ellipse cx="24" cy="24" rx="14" ry="3.5" fill="#A88847"/>
      {[[14,23],[18,22],[22,23],[26,22],[30,23],[34,22]].map(([cx,cy],i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy} rx="1.5" ry="0.8" fill={FC.rice}/>
          <ellipse cx={cx+2} cy={cy+1} rx="1.5" ry="0.8" fill={FC.beans}/>
        </g>
      ))}
      {[[16,25],[20,24],[24,25],[28,24],[32,25]].map(([cx,cy],i) => (
        <ellipse key={i} cx={cx} cy={cy} rx="1.6" ry="0.9" fill={i % 2 ? FC.rice : FC.beans}/>
      ))}
    </Plate>
  ),

  'pollo-tajadas': (
    <Plate>
      {/* Chicken piece */}
      <path d="M 12 20 Q 10 14 16 12 Q 22 12 24 16 Q 26 22 22 24 Q 14 25 12 20 Z" fill="#C68A4F"/>
      <path d="M 12 20 Q 10 14 16 12 Q 22 12 24 16 Q 26 22 22 24 Q 14 25 12 20 Z" fill="none" stroke="#8C5828" strokeWidth="1"/>
      {/* Tajadas */}
      <ellipse cx="32" cy="20" rx="4" ry="2.5" fill={FC.plantain} stroke={FC.plantainDark} strokeWidth="0.8"/>
      <ellipse cx="36" cy="24" rx="4" ry="2.5" fill={FC.plantain} stroke={FC.plantainDark} strokeWidth="0.8"/>
      {/* Cabbage */}
      <path d="M 14 26 Q 20 24 26 26" fill="none" stroke={FC.cabbageDark} strokeWidth="2" strokeLinecap="round"/>
    </Plate>
  ),

  'plato-tipico': (
    <Plate>
      {/* Rice */}
      <ellipse cx="16" cy="22" rx="5" ry="2.5" fill={FC.rice} stroke={FC.riceDark} strokeWidth="0.6"/>
      {/* Beans */}
      <ellipse cx="32" cy="22" rx="5" ry="2.5" fill={FC.beans}/>
      {/* Meat */}
      <ellipse cx="24" cy="20" rx="4" ry="2" fill={FC.meat} stroke={FC.meatDark} strokeWidth="0.6"/>
      {/* Tajadas */}
      <ellipse cx="16" cy="26" rx="3" ry="1.8" fill={FC.plantain} stroke={FC.plantainDark} strokeWidth="0.6"/>
      <ellipse cx="32" cy="26" rx="3" ry="1.8" fill={FC.plantain} stroke={FC.plantainDark} strokeWidth="0.6"/>
      {/* Cheese */}
      <ellipse cx="24" cy="26" rx="3" ry="1.5" fill={FC.cheese} stroke={FC.cheeseRind} strokeWidth="0.6"/>
    </Plate>
  ),

  'sopa-mondongo': (
    <Bowl>
      <ellipse cx="24" cy="24" rx="14" ry="3.2" fill="#A85838"/>
      <ellipse cx="24" cy="23" rx="13" ry="2.5" fill="#C97048"/>
      {/* Tripe pieces */}
      <path d="M 18 22 Q 20 21 22 22 Q 21 23 18 22" fill={FC.eggShell}/>
      <path d="M 26 23 Q 28 22 30 23 Q 29 24 26 23" fill={FC.eggShell}/>
      {/* Vegetables */}
      <ellipse cx="20" cy="24" rx="1" ry="0.7" fill={FC.carrot}/>
      <ellipse cx="28" cy="22" rx="1" ry="0.7" fill={FC.yuca}/>
      {/* Steam */}
      <path d="M 18 18 Q 19 14 18 10" stroke={FC.bowlDark} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6"/>
      <path d="M 24 16 Q 25 12 24 8" stroke={FC.bowlDark} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6"/>
      <path d="M 30 18 Q 31 14 30 10" stroke={FC.bowlDark} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6"/>
    </Bowl>
  ),

  'tamal': (
    <g>
      <ellipse cx="24" cy="40" rx="14" ry="2" fill="#5A4A20" opacity="0.3"/>
      {/* Banana leaf wrapping */}
      <path d="M 10 14 Q 8 12 12 10 L 36 10 Q 40 12 38 14 L 40 36 Q 40 40 36 40 L 12 40 Q 8 40 8 36 Z" fill="#7A8E48"/>
      <path d="M 10 14 Q 8 12 12 10 L 36 10 Q 40 12 38 14 L 40 36 Q 40 40 36 40 L 12 40 Q 8 40 8 36 Z" fill="none" stroke="#3A5028" strokeWidth="1.2"/>
      {/* Tie strings */}
      <path d="M 14 14 L 12 8 L 18 12" stroke="#5A4A20" strokeWidth="1.2" fill="none"/>
      <path d="M 34 14 L 36 8 L 30 12" stroke="#5A4A20" strokeWidth="1.2" fill="none"/>
      {/* Center line */}
      <path d="M 24 12 L 24 38" stroke="#3A5028" strokeWidth="0.8"/>
      {/* Vein pattern */}
      <path d="M 24 18 L 18 22 M 24 18 L 30 22 M 24 28 L 18 32 M 24 28 L 30 32" stroke="#3A5028" strokeWidth="0.5" opacity="0.6"/>
    </g>
  ),

  'anafres': (
    <g>
      {/* Clay pot */}
      <path d="M 10 28 Q 10 16 14 14 L 34 14 Q 38 16 38 28 Q 38 38 24 38 Q 10 38 10 28 Z" fill="#A86838"/>
      <path d="M 10 28 Q 10 16 14 14 L 34 14 Q 38 16 38 28 Q 38 38 24 38 Q 10 38 10 28 Z" fill="none" stroke="#5A3818" strokeWidth="1.2"/>
      {/* Beans inside */}
      <ellipse cx="24" cy="20" rx="11" ry="3" fill={FC.beansDark}/>
      <ellipse cx="24" cy="19" rx="10" ry="2" fill={FC.beans}/>
      {/* Cheese on top */}
      <path d="M 14 18 Q 18 16 22 18 Q 26 16 30 18 Q 34 16 36 18" stroke={FC.cheese} strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Steam */}
      <path d="M 20 12 Q 21 8 20 4" stroke="#8C6A28" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6"/>
      <path d="M 28 12 Q 29 8 28 4" stroke="#8C6A28" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6"/>
    </g>
  ),

  'pupusa-revuelta': (
    <g>
      <ellipse cx="24" cy="36" rx="16" ry="2" fill="#7A5A28" opacity="0.3"/>
      <ellipse cx="24" cy="24" rx="16" ry="12" fill={FC.tortilla}/>
      <ellipse cx="24" cy="24" rx="16" ry="12" fill="none" stroke={FC.tortillaDark} strokeWidth="1.2"/>
      {/* Filling visible through */}
      <ellipse cx="20" cy="22" rx="2" ry="1" fill={FC.meat} opacity="0.5"/>
      <ellipse cx="28" cy="24" rx="2" ry="1" fill={FC.cheese} opacity="0.6"/>
      {/* Toasted spots */}
      <circle cx="14" cy="20" r="1" fill="#A88847"/>
      <circle cx="32" cy="26" r="1.2" fill="#A88847"/>
      <circle cx="24" cy="18" r="0.8" fill="#A88847"/>
    </g>
  ),

  'enchiladas': (
    <g>
      <ellipse cx="24" cy="36" rx="16" ry="2" fill="#7A2818" opacity="0.3"/>
      {/* Tostada base */}
      <ellipse cx="24" cy="24" rx="16" ry="11" fill={FC.tortillaDark}/>
      <ellipse cx="24" cy="24" rx="16" ry="11" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
      {/* Beans */}
      <ellipse cx="24" cy="24" rx="12" ry="6" fill={FC.beansDark}/>
      {/* Meat */}
      <ellipse cx="22" cy="22" rx="3" ry="2" fill={FC.meat}/>
      <ellipse cx="28" cy="24" rx="3" ry="2" fill={FC.meat}/>
      {/* Cheese */}
      <circle cx="18" cy="22" r="1.5" fill={FC.cheese}/>
      <circle cx="30" cy="20" r="1.5" fill={FC.cheese}/>
      {/* Cabbage */}
      <path d="M 14 24 Q 18 26 22 24" stroke={FC.cabbageDark} strokeWidth="1.5" fill="none"/>
      <path d="M 26 26 Q 30 24 34 26" stroke={FC.cabbageDark} strokeWidth="1.5" fill="none"/>
      {/* Egg slice */}
      <circle cx="24" cy="20" r="2.5" fill="#FAFAEA"/>
      <circle cx="24" cy="20" r="1.2" fill={FC.yolk}/>
    </g>
  ),

  'rosquillas': (
    <g>
      {[[16,28],[32,28],[24,18]].map(([cx,cy],i) => (
        <g key={i}>
          <ellipse cx={cx} cy={cy+1} rx="6" ry="2" fill="#7A5828" opacity="0.4"/>
          <circle cx={cx} cy={cy} r="6" fill="#C9A56B"/>
          <circle cx={cx} cy={cy} r="6" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
          <circle cx={cx} cy={cy} r="2" fill="#7A5828"/>
          <circle cx={cx-2} cy={cy-1} r="0.6" fill="#8C5828"/>
          <circle cx={cx+2} cy={cy+1} r="0.6" fill="#8C5828"/>
        </g>
      ))}
    </g>
  ),
};

// FoodIcon component
const FoodIcon = ({ id, size = 36 }) => {
  const icon = FOOD_ICONS[id];
  if (!icon) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="#F1F4F8" stroke="#BDC4D0" strokeWidth="1.5" strokeDasharray="3 3"/>
        <text x="24" y="28" fontSize="9" fontFamily="sans-serif" fill="#8A93A4" textAnchor="middle" fontWeight="600">?</text>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block' }}>
      {icon}
    </svg>
  );
};

window.FoodIcon = FoodIcon;
window.FOOD_ICONS = FOOD_ICONS;
