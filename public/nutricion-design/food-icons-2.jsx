/* Extra unique food icons — Batch 1: Carbs + Proteins
   Registers icons into window.FOOD_ICONS after main file loads.
*/
(() => {
  function register() {
    if (!window.FOOD_ICONS) { setTimeout(register, 50); return; }
  const FC = {
    rice:'#FAFAF5', riceDark:'#E6E0CC', riceBrown:'#C9A56B',
    meat:'#B5573E', meatDark:'#8C3F2C', salmonPink:'#E89B7A',
    chicken:'#D9A56B', chickenDark:'#A06D3F', chickenSkin:'#C68A4F',
    tortilla:'#F2D9A3', tortillaDark:'#C9A567',
    bread:'#D9B176', breadDark:'#A87A3E', breadCrust:'#8C5E2A',
    plantain:'#E8C04A', plantainDark:'#B89230', plantainRipe:'#E89B3C',
    yuca:'#F0E0C0', yucaDark:'#B8A076',
    leaf:'#5A8C3E', leafDark:'#3D6B2A', leafLight:'#7DAA52',
    carrot:'#E08745', carrotDark:'#B86528',
    cheese:'#F2DC8A', cheeseDark:'#C9B05A', cheeseRind:'#8C7028',
    yolk:'#E8A93C', yolkDark:'#C28823',
    bowlOuter:'#B8BFC9', bowlInner:'#E5E8EC',
    plateOuter:'#C9CFD7', plateInner:'#F2F4F7',
  };

  const Bowl = ({ children, fill, dark }) => (
    <g>
      <ellipse cx="24" cy="38" rx="20" ry="4" fill="#9BA3AE" opacity="0.3"/>
      <path d="M 6 26 Q 6 40 24 40 Q 42 40 42 26 Z" fill={FC.bowlInner}/>
      <path d="M 6 26 Q 6 40 24 40 Q 42 40 42 26" fill="none" stroke={FC.bowlOuter} strokeWidth="1.2"/>
      <ellipse cx="24" cy="26" rx="18" ry="3.5" fill={dark || FC.bowlOuter}/>
      <ellipse cx="24" cy="25" rx="17" ry="2.8" fill={fill}/>
      {children}
    </g>
  );

  const Plate = ({ children }) => (
    <g>
      <ellipse cx="24" cy="26" rx="22" ry="7" fill={FC.plateOuter}/>
      <ellipse cx="24" cy="25" rx="22" ry="6.5" fill={FC.plateInner}/>
      <ellipse cx="24" cy="24" rx="17" ry="5" fill={FC.plateInner} stroke={FC.plateOuter} strokeWidth="0.6"/>
      {children}
    </g>
  );

  const newIcons = {
    // ==== CARBS ====
    'arroz-integral': (
      <Bowl fill={FC.riceBrown} dark="#8C6E3E">
        {[[18,22],[22,21],[26,22],[30,21],[20,24],[28,24],[24,22]].map(([cx,cy],i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="1.5" ry="0.8" fill="#A88847"/>
        ))}
      </Bowl>
    ),
    'arroz-frito': (
      <Bowl fill="#E8D080" dark="#8C6E3E">
        {[[18,22],[24,22],[30,22],[20,24],[28,24]].map(([cx,cy],i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="1.4" ry="0.7" fill="#D9B26A"/>
        ))}
        <circle cx="20" cy="23" r="1" fill={FC.carrot}/>
        <circle cx="28" cy="22" r="0.9" fill={FC.leafLight}/>
        <circle cx="26" cy="24" r="0.8" fill={FC.yolk}/>
      </Bowl>
    ),
    'tortilla-integral': (
      <g>
        <ellipse cx="24" cy="26" rx="18" ry="4" fill="#7A5E2A" opacity="0.4"/>
        <ellipse cx="24" cy="24" rx="18" ry="14" fill="#A8744A"/>
        <ellipse cx="24" cy="24" rx="18" ry="14" fill="none" stroke="#5A3818" strokeWidth="1"/>
        {[[20,22],[26,24],[18,28],[30,20],[22,26],[28,18],[16,22],[32,28]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="0.8" fill="#5A3818" opacity="0.6"/>
        ))}
      </g>
    ),
    'platano-maduro': (
      <g>
        <path d="M 8 22 Q 6 14 14 12 Q 30 14 38 20 Q 42 30 38 36 Q 28 38 18 36 Q 8 32 8 22 Z" fill={FC.plantainRipe}/>
        <path d="M 8 22 Q 6 14 14 12 Q 30 14 38 20 Q 42 30 38 36 Q 28 38 18 36 Q 8 32 8 22 Z" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
        <path d="M 12 24 Q 22 26 32 28" stroke="#8C5828" strokeWidth="0.7" fill="none" opacity="0.6"/>
        <circle cx="18" cy="22" r="1" fill="#6E4818"/>
        <circle cx="26" cy="26" r="0.8" fill="#6E4818"/>
        <circle cx="32" cy="22" r="0.9" fill="#6E4818"/>
      </g>
    ),
    'yuca-frita': (
      <g>
        <ellipse cx="24" cy="38" rx="18" ry="2" fill="#7A5828" opacity="0.4"/>
        <rect x="13" y="20" width="4" height="16" fill="#E8C56A" stroke="#8C5828" strokeWidth="0.6" rx="1" transform="rotate(-12 15 28)"/>
        <rect x="20" y="18" width="4" height="18" fill="#F2D89A" stroke="#8C5828" strokeWidth="0.6" rx="1"/>
        <rect x="27" y="20" width="4" height="16" fill="#E8C56A" stroke="#8C5828" strokeWidth="0.6" rx="1" transform="rotate(8 29 28)"/>
        <rect x="32" y="22" width="4" height="14" fill="#F2D89A" stroke="#8C5828" strokeWidth="0.6" rx="1" transform="rotate(18 34 29)"/>
      </g>
    ),
    'pan-blanco': (
      <g>
        <ellipse cx="24" cy="38" rx="16" ry="2" fill="#A88847" opacity="0.3"/>
        <path d="M 8 16 L 40 16 L 40 38 L 8 38 Z" fill="#FAF0D9"/>
        <path d="M 8 16 L 40 16 L 40 38 L 8 38 Z" fill="none" stroke="#C9A56B" strokeWidth="1.2"/>
        <path d="M 8 16 Q 8 12 14 12 L 34 12 Q 40 12 40 16" fill="#D9B176" stroke="#8C5828" strokeWidth="1.2"/>
        <line x1="14" y1="22" x2="34" y2="22" stroke="#E0D0A8" strokeWidth="0.6"/>
        <line x1="14" y1="28" x2="34" y2="28" stroke="#E0D0A8" strokeWidth="0.6"/>
      </g>
    ),
    'pan-integral': (
      <g>
        <ellipse cx="24" cy="38" rx="16" ry="2" fill="#5A3818" opacity="0.4"/>
        <path d="M 8 16 L 40 16 L 40 38 L 8 38 Z" fill="#A8744A"/>
        <path d="M 8 16 L 40 16 L 40 38 L 8 38 Z" fill="none" stroke="#5A3818" strokeWidth="1.2"/>
        <path d="M 8 16 Q 8 12 14 12 L 34 12 Q 40 12 40 16" fill="#7A4818" stroke="#3A2010" strokeWidth="1.2"/>
        {[[14,22],[20,24],[28,22],[34,24],[16,28],[24,30],[32,28]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="0.8" fill="#5A3818"/>
        ))}
      </g>
    ),
    'pan-dulce': (
      <g>
        <ellipse cx="24" cy="38" rx="14" ry="2" fill="#7A5828" opacity="0.4"/>
        <path d="M 10 24 Q 10 14 24 12 Q 38 14 38 24 Q 38 36 24 36 Q 10 36 10 24 Z" fill="#E8B872"/>
        <path d="M 10 24 Q 10 14 24 12 Q 38 14 38 24 Q 38 36 24 36 Q 10 36 10 24 Z" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
        <path d="M 14 18 Q 18 16 22 18 M 26 18 Q 30 16 34 18" stroke="#FAFAEA" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.85"/>
        <path d="M 20 14 L 28 22 M 28 14 L 20 22" stroke="#A87520" strokeWidth="1"/>
      </g>
    ),
    'pan-pita': (
      <g>
        <ellipse cx="24" cy="32" rx="16" ry="3" fill="#A88847" opacity="0.3"/>
        <ellipse cx="24" cy="26" rx="18" ry="10" fill="#F2D89A"/>
        <ellipse cx="24" cy="26" rx="18" ry="10" fill="none" stroke="#A88847" strokeWidth="1.2"/>
        <path d="M 14 20 Q 24 18 34 20" stroke="#C9A567" strokeWidth="1" fill="none"/>
        <ellipse cx="24" cy="22" rx="8" ry="2" fill="none" stroke="#A88847" strokeWidth="0.6"/>
      </g>
    ),
    'pan-rallado': (
      <g>
        <ellipse cx="24" cy="38" rx="14" ry="2" fill="#7A5828" opacity="0.3"/>
        <path d="M 10 36 Q 14 22 24 20 Q 34 22 38 36 Z" fill="#E8B872"/>
        <path d="M 10 36 Q 14 22 24 20 Q 34 22 38 36 Z" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
        {[[16,30],[20,28],[24,26],[28,28],[32,30],[18,34],[24,32],[30,34],[22,30],[26,30]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="0.6" fill="#8C5828"/>
        ))}
      </g>
    ),
    'papa-cocida': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#7A5828" opacity="0.3"/>
        <ellipse cx="24" cy="26" rx="14" ry="11" fill="#E8D08A"/>
        <ellipse cx="24" cy="26" rx="14" ry="11" fill="none" stroke="#A88847" strokeWidth="1.2"/>
        {[[16,22,1.5,1],[22,20,1.2,0.8],[30,24,1.5,1],[26,30,1.3,0.9],[18,30,1.2,0.8]].map(([cx,cy,rx,ry],i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#8C7028" opacity="0.7"/>
        ))}
      </g>
    ),
    'papa-frita': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="1.5" fill="#7A5828" opacity="0.3"/>
        <path d="M 12 16 L 36 16 L 32 40 L 16 40 Z" fill="#D14635"/>
        <path d="M 12 16 L 36 16 L 32 40 L 16 40 Z" fill="none" stroke="#8C2A20" strokeWidth="1.2"/>
        <rect x="13" y="18" width="22" height="3" fill="#FAFAFA"/>
        <rect x="14" y="6" width="3" height="14" fill="#E8C56A" stroke="#8C5828" strokeWidth="0.6" rx="0.5"/>
        <rect x="19" y="4" width="3" height="16" fill="#F2D89A" stroke="#8C5828" strokeWidth="0.6" rx="0.5"/>
        <rect x="24" y="6" width="3" height="14" fill="#E8C56A" stroke="#8C5828" strokeWidth="0.6" rx="0.5"/>
        <rect x="29" y="3" width="3" height="17" fill="#F2D89A" stroke="#8C5828" strokeWidth="0.6" rx="0.5"/>
      </g>
    ),
    'pure-papa': (
      <Bowl fill="#FAFAEA" dark="#E0D0A8">
        <path d="M 14 24 Q 18 20 24 22 Q 30 20 34 24" fill="#FAFAEA" stroke="#C9B05A" strokeWidth="0.8"/>
        <path d="M 16 26 Q 22 24 28 26 Q 32 24 32 26" fill="none" stroke="#C9B05A" strokeWidth="0.6"/>
        <ellipse cx="24" cy="23" rx="3" ry="1.5" fill="#FAEFC0"/>
        <rect x="22" y="20" width="4" height="2" fill="#E8A93C" rx="0.5"/>
      </Bowl>
    ),
    'malanga': (
      <g>
        <ellipse cx="24" cy="40" rx="12" ry="1.5" fill="#3A2818" opacity="0.4"/>
        <path d="M 14 14 Q 12 26 18 36 Q 30 38 34 30 Q 38 18 30 12 Q 20 10 14 14 Z" fill="#A86838"/>
        <path d="M 14 14 Q 12 26 18 36 Q 30 38 34 30 Q 38 18 30 12 Q 20 10 14 14 Z" fill="none" stroke="#5A3818" strokeWidth="1.2"/>
        <path d="M 14 20 Q 22 22 32 20" stroke="#5A3818" strokeWidth="0.8" fill="none"/>
        <path d="M 14 28 Q 22 30 32 28" stroke="#5A3818" strokeWidth="0.8" fill="none"/>
        <path d="M 12 18 L 8 16 M 14 14 L 12 10 M 32 12 L 34 8 M 36 22 L 40 22" stroke="#3A2010" strokeWidth="0.8"/>
      </g>
    ),
    'avena-cruda': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#7A5828" opacity="0.3"/>
        <path d="M 10 14 L 38 14 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="#E8D080"/>
        <path d="M 10 14 L 38 14 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="none" stroke="#8C7028" strokeWidth="1.2"/>
        <path d="M 12 14 Q 16 10 20 14 Q 24 10 28 14 Q 32 10 36 14" fill="#E8D080" stroke="#8C7028" strokeWidth="0.8"/>
        {[[16,12],[22,11],[28,12],[34,11]].map(([cx,cy],i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="2" ry="0.8" fill="#D9C99A" stroke="#A88847" strokeWidth="0.5"/>
        ))}
        <rect x="15" y="22" width="18" height="10" fill="#FAFAFA" rx="1"/>
        <text x="24" y="29" fontFamily="sans-serif" fontSize="6" fontWeight="700" fill="#8C7028" textAnchor="middle">AVENA</text>
      </g>
    ),
    'pasta-integral': (
      <Bowl fill="#A8744A" dark="#8C6E3E">
        <path d="M 14 23 Q 18 20 22 23 Q 26 26 30 23 Q 34 20 34 23" fill="none" stroke="#7A4818" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M 14 21 Q 18 18 22 21 Q 26 24 30 21" fill="none" stroke="#7A4818" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M 16 25 Q 20 22 24 25 Q 28 28 32 25" fill="none" stroke="#7A4818" strokeWidth="1.6" strokeLinecap="round"/>
      </Bowl>
    ),
    'fideos-sopa': (
      <Bowl fill="#D9A55A" dark="#A87A2A">
        <path d="M 14 22 Q 16 24 18 22 Q 20 20 22 22" stroke="#F2D89A" strokeWidth="1.4" fill="none"/>
        <path d="M 24 23 Q 26 25 28 23 Q 30 21 32 23" stroke="#F2D89A" strokeWidth="1.4" fill="none"/>
        <path d="M 16 24 Q 20 22 24 24 Q 28 22 32 24" stroke="#F2D89A" strokeWidth="1.4" fill="none"/>
      </Bowl>
    ),
    'quinoa': (
      <Bowl fill="#D9C99A" dark="#A88847">
        {[[16,22],[18,23],[20,22],[22,23],[24,22],[26,23],[28,22],[30,23],[32,22]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="0.7" fill={i % 2 ? "#E8B872" : "#A88847"}/>
        ))}
      </Bowl>
    ),
    'maicena': (
      <g>
        <ellipse cx="22" cy="40" rx="12" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <path d="M 10 18 L 34 18 L 32 38 Q 32 40 30 40 L 14 40 Q 12 40 12 38 Z" fill="#FAFAFA"/>
        <path d="M 10 18 L 34 18 L 32 38 Q 32 40 30 40 L 14 40 Q 12 40 12 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
        <path d="M 34 22 Q 42 22 42 28 Q 42 34 34 34" fill="none" stroke="#B8BFC9" strokeWidth="1.5"/>
        <ellipse cx="22" cy="19" rx="11" ry="2" fill="#F2DC8A"/>
        <ellipse cx="22" cy="18.5" rx="10" ry="1.2" fill="#FAEFC0"/>
        <g opacity="0.6">
          <path d="M 16 14 Q 17 10 16 6" stroke="#B8BFC9" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M 22 12 Q 23 8 22 4" stroke="#B8BFC9" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M 28 14 Q 29 10 28 6" stroke="#B8BFC9" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        </g>
      </g>
    ),
    'elote': (
      <g>
        <path d="M 12 36 L 8 14 Q 14 10 18 14 L 20 16" fill={FC.leafLight} stroke={FC.leafDark} strokeWidth="1"/>
        <path d="M 36 36 L 40 14 Q 34 10 30 14 L 28 16" fill={FC.leafLight} stroke={FC.leafDark} strokeWidth="1"/>
        <ellipse cx="24" cy="26" rx="8" ry="14" fill="#FAEFA0"/>
        <ellipse cx="24" cy="26" rx="8" ry="14" fill="none" stroke="#C9A567" strokeWidth="1.2"/>
        {[14,18,22,26,30,34].map(y => (
          [18,22,26,30].map(x => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="#F2DC8A" stroke="#C9A567" strokeWidth="0.4"/>
          ))
        ))}
        <path d="M 22 10 L 20 6 M 24 9 L 24 5 M 26 10 L 28 6" stroke="#E0A56B" strokeWidth="1.2" strokeLinecap="round"/>
      </g>
    ),
    'maiz-grano': (
      <Bowl fill="#F2DC8A" dark="#A88847">
        {[14,18,22,26,30,34].map(x => (
          [22,24].map(y => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="#FAEFA0" stroke="#C9A567" strokeWidth="0.4"/>
          ))
        ))}
      </Bowl>
    ),
    'cereal-caja': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <rect x="12" y="10" width="24" height="30" fill="#D14635" stroke="#8C2A20" strokeWidth="1.2"/>
        <rect x="14" y="14" width="20" height="14" fill="#F2DC8A" rx="1"/>
        <ellipse cx="24" cy="22" rx="7" ry="2" fill="#FAFAFA"/>
        <ellipse cx="22" cy="20" rx="1.5" ry="1" fill="#A8744A"/>
        <ellipse cx="26" cy="20" rx="1.5" ry="1" fill="#A8744A"/>
        <ellipse cx="24" cy="19" rx="1.5" ry="1" fill="#A8744A"/>
        <text x="24" y="36" fontFamily="sans-serif" fontSize="5" fontWeight="800" fill="#FAFAFA" textAnchor="middle">CEREAL</text>
      </g>
    ),
    'galletas-soda': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="1.5" fill="#A88847" opacity="0.3"/>
        {[[24,30],[22,24],[26,18]].map(([cx,cy],i) => (
          <g key={i}>
            <rect x={cx-12} y={cy-3} width="24" height="6" fill="#FAEFC0" stroke="#A88847" strokeWidth="0.8" rx="1"/>
            {[cx-7, cx-3, cx+1, cx+5].map((x,j) => (
              <g key={j}>
                <circle cx={x} cy={cy-1} r="0.5" fill="#A88847"/>
                <circle cx={x} cy={cy+1} r="0.5" fill="#A88847"/>
              </g>
            ))}
          </g>
        ))}
      </g>
    ),
    'galletas-maria': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="1.5" fill="#A88847" opacity="0.3"/>
        {[[16,30],[28,28],[20,20]].map(([cx,cy],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="9" fill="#E8B872" stroke="#8C5828" strokeWidth="1"/>
            <text x={cx} y={cy+2} fontFamily="serif" fontSize="6" fontWeight="700" fill="#8C5828" textAnchor="middle">M</text>
          </g>
        ))}
      </g>
    ),
    'galletas-integ': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="1.5" fill="#5A3818" opacity="0.4"/>
        {[[16,30],[28,28],[20,20]].map(([cx,cy],i) => (
          <g key={i}>
            <rect x={cx-7} y={cy-7} width="14" height="14" fill="#A8744A" stroke="#5A3818" strokeWidth="1" rx="1"/>
            {[[-3,-3],[3,-3],[-3,3],[3,3],[0,0]].map(([dx,dy],j) => (
              <circle key={j} cx={cx+dx} cy={cy+dy} r="0.6" fill="#5A3818"/>
            ))}
          </g>
        ))}
      </g>
    ),
    'arroz-leche': (
      <Bowl fill="#FAFAEA" dark="#E0D0A8">
        {[[18,22],[24,22],[30,22],[20,24],[28,24]].map(([cx,cy],i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="1.4" ry="0.7" fill="#FAFAFA"/>
        ))}
        <path d="M 14 20 L 18 22 M 22 20 L 26 22 M 30 20 L 34 22" stroke="#8C5828" strokeWidth="0.6"/>
      </Bowl>
    ),

    // ==== PROTEINS ====
    'pollo-guisado': (
      <Bowl fill="#D17848" dark="#A85838">
        <ellipse cx="20" cy="22" rx="3" ry="1.5" fill={FC.chickenSkin}/>
        <ellipse cx="28" cy="22" rx="3.5" ry="1.5" fill={FC.chicken}/>
        <ellipse cx="24" cy="24" rx="2" ry="1" fill={FC.chickenSkin}/>
        <circle cx="18" cy="24" r="0.8" fill={FC.carrot}/>
        <circle cx="32" cy="23" r="0.8" fill={FC.leafLight}/>
      </Bowl>
    ),
    'pollo-asado': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="2" fill="#5A3818" opacity="0.4"/>
        <path d="M 12 28 Q 8 16 18 12 Q 28 8 36 14 Q 42 24 38 32 Q 32 38 24 38 Q 14 36 12 28 Z" fill="#C9743A"/>
        <path d="M 12 28 Q 8 16 18 12 Q 28 8 36 14 Q 42 24 38 32 Q 32 38 24 38 Q 14 36 12 28 Z" fill="none" stroke="#7A3818" strokeWidth="1.2"/>
        <path d="M 14 32 L 10 38 L 14 38 Z" fill="#C9743A" stroke="#7A3818" strokeWidth="1"/>
        <path d="M 34 32 L 38 38 L 34 38 Z" fill="#C9743A" stroke="#7A3818" strokeWidth="1"/>
        {[[18,16],[26,12],[30,18],[20,22],[28,24],[34,22]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="0.8" fill="#5A3818"/>
        ))}
      </g>
    ),
    'pollo-empanizado': (
      <g>
        <ellipse cx="24" cy="38" rx="14" ry="2" fill="#5A3818" opacity="0.4"/>
        <path d="M 12 26 Q 10 14 24 12 Q 38 14 36 26 Q 36 34 24 34 Q 12 34 12 26 Z" fill="#E8C56A"/>
        <path d="M 12 26 Q 10 14 24 12 Q 38 14 36 26 Q 36 34 24 34 Q 12 34 12 26 Z" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
        {[[16,16],[22,14],[28,16],[32,20],[18,20],[24,22],[30,24],[20,26],[26,28],[14,22]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="0.7" fill="#A88847"/>
        ))}
      </g>
    ),
    'pechuga-pollo': (
      <g>
        <ellipse cx="24" cy="38" rx="13" ry="2" fill="#7A4520" opacity="0.4"/>
        <path d="M 24 14 Q 12 14 12 24 Q 12 34 24 38 Q 36 34 36 24 Q 36 14 24 14 Z" fill={FC.chicken}/>
        <path d="M 24 14 Q 12 14 12 24 Q 12 34 24 38 Q 36 34 36 24 Q 36 14 24 14 Z" fill="none" stroke={FC.chickenDark} strokeWidth="1.2"/>
        <path d="M 24 14 L 24 36" stroke={FC.chickenDark} strokeWidth="0.6" opacity="0.5"/>
        <path d="M 16 22 Q 20 20 24 22 Q 28 20 32 22" stroke={FC.chickenDark} strokeWidth="0.6" fill="none"/>
      </g>
    ),
    'pavo': (
      <g>
        <ellipse cx="24" cy="38" rx="14" ry="2" fill="#5A3818" opacity="0.4"/>
        <path d="M 10 24 Q 10 14 24 12 Q 38 14 38 24 Q 38 34 24 36 Q 10 34 10 24 Z" fill="#E8B872"/>
        <path d="M 10 24 Q 10 14 24 12 Q 38 14 38 24 Q 38 34 24 36 Q 10 34 10 24 Z" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
        <path d="M 36 30 Q 42 28 42 32 Q 40 36 36 36" fill="#E8B872" stroke="#8C5828" strokeWidth="1"/>
        <path d="M 14 20 Q 24 18 34 20 M 14 28 Q 24 26 34 28" stroke="#A87520" strokeWidth="0.6" fill="none"/>
      </g>
    ),
    'res-guisada': (
      <Bowl fill="#8C3F2C" dark="#5A2818">
        <ellipse cx="20" cy="22" rx="3" ry="1.5" fill={FC.meat}/>
        <ellipse cx="28" cy="22" rx="3.5" ry="1.5" fill={FC.meatDark}/>
        <ellipse cx="24" cy="24" rx="2" ry="1" fill={FC.meat}/>
        <circle cx="18" cy="24" r="0.8" fill={FC.carrot}/>
        <circle cx="32" cy="23" r="0.8" fill={FC.carrot}/>
      </Bowl>
    ),
    'bistec': (
      <g>
        <ellipse cx="24" cy="38" rx="14" ry="2" fill="#5A2818" opacity="0.4"/>
        <path d="M 10 18 Q 10 12 20 12 Q 32 10 38 18 Q 40 28 32 34 Q 18 36 12 30 Q 8 22 10 18 Z" fill={FC.meat}/>
        <path d="M 10 18 Q 10 12 20 12 Q 32 10 38 18 Q 40 28 32 34 Q 18 36 12 30 Q 8 22 10 18 Z" fill="none" stroke={FC.meatDark} strokeWidth="1.2"/>
        <ellipse cx="18" cy="22" rx="2.5" ry="0.8" fill="#FAFAFA" stroke="#B8BFC9" strokeWidth="0.6"/>
        <ellipse cx="28" cy="24" rx="2.5" ry="0.8" fill="#FAFAFA" stroke="#B8BFC9" strokeWidth="0.6"/>
        <ellipse cx="22" cy="28" rx="2.5" ry="0.8" fill="#FAFAFA" stroke="#B8BFC9" strokeWidth="0.6"/>
        <ellipse cx="32" cy="30" rx="2" ry="0.7" fill="#FAFAFA" stroke="#B8BFC9" strokeWidth="0.6"/>
      </g>
    ),
    'carne-cerdo': (
      <g>
        <ellipse cx="24" cy="38" rx="14" ry="2" fill="#7A2A18" opacity="0.4"/>
        <path d="M 10 24 Q 8 14 22 12 Q 38 14 38 22 Q 40 32 32 36 Q 14 36 10 24 Z" fill="#E89B7A"/>
        <path d="M 10 24 Q 8 14 22 12 Q 38 14 38 22 Q 40 32 32 36 Q 14 36 10 24 Z" fill="none" stroke="#A8482A" strokeWidth="1.2"/>
        <path d="M 14 18 Q 22 22 30 18" stroke="#FAFAEA" strokeWidth="1.5" fill="none" opacity="0.7"/>
        <path d="M 16 28 Q 24 24 32 28" stroke="#FAFAEA" strokeWidth="1.5" fill="none" opacity="0.7"/>
      </g>
    ),
    'chuleta-cerdo': (
      <g>
        <ellipse cx="24" cy="38" rx="14" ry="2" fill="#7A2A18" opacity="0.4"/>
        <path d="M 38 24 Q 40 16 42 20 Q 44 24 42 26 L 38 26" fill="#FAEFC0" stroke="#A88847" strokeWidth="1"/>
        <path d="M 8 18 Q 8 12 16 12 L 38 12 L 38 26 L 38 36 Q 30 38 18 36 Q 8 32 8 24 Z" fill="#D9784A"/>
        <path d="M 8 18 Q 8 12 16 12 L 38 12 L 38 26 L 38 36 Q 30 38 18 36 Q 8 32 8 24 Z" fill="none" stroke="#8C2A20" strokeWidth="1.2"/>
        <path d="M 14 20 Q 22 18 30 20 M 14 28 Q 22 26 30 28" stroke="#8C2A20" strokeWidth="0.6" fill="none" opacity="0.6"/>
      </g>
    ),
    'costilla': (
      <g>
        <ellipse cx="24" cy="38" rx="15" ry="2" fill="#5A1A10" opacity="0.5"/>
        <path d="M 8 18 L 40 18 L 40 34 L 8 34 Z" fill="#8C3818"/>
        <path d="M 8 18 L 40 18 L 40 34 L 8 34 Z" fill="none" stroke="#5A1A10" strokeWidth="1.2"/>
        {[14,20,26,32,38].map(x => (
          <line key={x} x1={x} y1="18" x2={x} y2="34" stroke="#5A1A10" strokeWidth="1.5"/>
        ))}
        <path d="M 10 18 Q 12 14 14 18 M 22 18 Q 24 14 26 18 M 30 18 Q 32 14 34 18" fill="#5A1A10"/>
        <path d="M 10 22 Q 24 20 38 22" stroke="#3A1008" strokeWidth="0.8" fill="none"/>
      </g>
    ),
    'jamon': (
      <g>
        <ellipse cx="24" cy="38" rx="16" ry="2" fill="#7A2A18" opacity="0.3"/>
        {[28,22,16].map((y,i) => (
          <g key={i}>
            <ellipse cx="24" cy={y} rx="16" ry="4" fill={i === 0 ? "#D9683E" : i === 1 ? "#E8784A" : "#E8946A"}/>
            <ellipse cx="24" cy={y} rx="16" ry="4" fill="none" stroke="#A8482A" strokeWidth="0.8"/>
            <ellipse cx="24" cy={y} rx="3" ry="1" fill="#FAFAEA" opacity="0.6"/>
          </g>
        ))}
      </g>
    ),
    'salchicha': (
      <g>
        <ellipse cx="24" cy="38" rx="16" ry="2" fill="#5A2818" opacity="0.4"/>
        <path d="M 8 22 Q 8 14 24 14 Q 40 14 40 22 Q 40 32 24 32 Q 8 32 8 22 Z" fill="#E8B872"/>
        <path d="M 8 22 Q 8 14 24 14 Q 40 14 40 22 Q 40 32 24 32 Q 8 32 8 22 Z" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
        <path d="M 10 22 Q 10 17 24 17 Q 38 17 38 22 Q 38 27 24 27 Q 10 27 10 22 Z" fill="#C9683E"/>
        <path d="M 10 22 Q 10 17 24 17 Q 38 17 38 22 Q 38 27 24 27 Q 10 27 10 22 Z" fill="none" stroke="#7A2A18" strokeWidth="1"/>
        <path d="M 14 19 Q 18 21 22 19 Q 26 21 30 19 Q 34 21 34 19" stroke="#E8A93C" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </g>
    ),
    'tocino': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="1.5" fill="#7A2A18" opacity="0.4"/>
        <g transform="translate(0, -2)">
          <path d="M 6 16 Q 14 14 22 18 Q 30 22 42 18 L 42 24 Q 30 28 22 24 Q 14 20 6 24 Z" fill="#C9683E"/>
          <path d="M 6 16 Q 14 14 22 18 Q 30 22 42 18 L 42 24 Q 30 28 22 24 Q 14 20 6 24 Z" fill="none" stroke="#7A2A18" strokeWidth="0.8"/>
          <path d="M 8 19 Q 16 17 22 21 Q 30 25 40 21" stroke="#FAEFD0" strokeWidth="1.2" fill="none"/>
        </g>
        <g transform="translate(0, 8)">
          <path d="M 6 16 Q 14 14 22 18 Q 30 22 42 18 L 42 24 Q 30 28 22 24 Q 14 20 6 24 Z" fill="#C9683E"/>
          <path d="M 6 16 Q 14 14 22 18 Q 30 22 42 18 L 42 24 Q 30 28 22 24 Q 14 20 6 24 Z" fill="none" stroke="#7A2A18" strokeWidth="0.8"/>
          <path d="M 8 19 Q 16 17 22 21 Q 30 25 40 21" stroke="#FAEFD0" strokeWidth="1.2" fill="none"/>
        </g>
      </g>
    ),
    'huevo-frito': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="2" fill="#A89478" opacity="0.3"/>
        <path d="M 8 26 Q 6 16 14 14 Q 24 10 32 14 Q 42 16 42 26 Q 40 36 24 36 Q 10 36 8 26 Z" fill="#FAFAFA"/>
        <path d="M 8 26 Q 6 16 14 14 Q 24 10 32 14 Q 42 16 42 26 Q 40 36 24 36 Q 10 36 8 26 Z" fill="none" stroke="#D9D0B8" strokeWidth="1.2"/>
        <circle cx="22" cy="22" r="6" fill={FC.yolk}/>
        <circle cx="22" cy="22" r="6" fill="none" stroke={FC.yolkDark} strokeWidth="0.8"/>
        <ellipse cx="20" cy="20" rx="2" ry="1.5" fill="#FAEFA0"/>
        <path d="M 12 18 Q 14 16 16 18 M 30 14 Q 32 12 34 14" stroke="#C9A567" strokeWidth="1" fill="none"/>
      </g>
    ),
    'tortilla-huevo': (
      <g>
        <ellipse cx="24" cy="38" rx="14" ry="2" fill="#7A6228" opacity="0.4"/>
        <path d="M 8 22 Q 8 14 24 12 Q 40 14 40 22 Q 40 30 24 32 Q 8 30 8 22 Z" fill={FC.yolk}/>
        <path d="M 8 22 Q 8 14 24 12 Q 40 14 40 22 Q 40 30 24 32 Q 8 30 8 22 Z" fill="none" stroke={FC.yolkDark} strokeWidth="1.2"/>
        <path d="M 12 20 Q 24 26 36 20" stroke={FC.yolkDark} strokeWidth="1" fill="none"/>
        <circle cx="18" cy="20" r="0.8" fill={FC.leafDark}/>
        <circle cx="28" cy="22" r="0.8" fill="#D14635"/>
        <circle cx="24" cy="18" r="0.7" fill={FC.leafDark}/>
      </g>
    ),
    'claras': (
      <Bowl fill="#FAFAFA" dark="#E0E0E0">
        <ellipse cx="20" cy="22" rx="3" ry="1.2" fill="#FFFFFF"/>
        <ellipse cx="28" cy="22" rx="3" ry="1.2" fill="#FFFFFF"/>
        <ellipse cx="24" cy="24" rx="2" ry="0.8" fill="#FFFFFF"/>
      </Bowl>
    ),
    'salmon': (
      <g>
        <path d="M 6 24 L 14 18 Q 28 14 38 22 Q 36 28 38 30 Q 28 36 14 30 Z" fill={FC.salmonPink}/>
        <path d="M 6 24 L 14 18 Q 28 14 38 22 Q 36 28 38 30 Q 28 36 14 30 Z" fill="none" stroke="#A8482A" strokeWidth="1.2"/>
        <path d="M 38 22 L 44 16 L 42 24 L 44 32 L 38 28" fill={FC.salmonPink} stroke="#A8482A" strokeWidth="1.2"/>
        <path d="M 10 22 Q 22 22 32 24" stroke="#D9683E" strokeWidth="1.5" fill="none"/>
        <path d="M 10 28 Q 22 28 32 26" stroke="#D9683E" strokeWidth="1.5" fill="none"/>
        <circle cx="14" cy="22" r="1.2" fill="#1A2235"/>
      </g>
    ),
    'atun-aceite': (
      <g>
        <path d="M 12 14 L 36 14 L 38 16 L 38 34 L 36 36 L 12 36 L 10 34 L 10 16 Z" fill="#E0A53A"/>
        <path d="M 12 14 L 36 14 L 38 16 L 38 34 L 36 36 L 12 36 L 10 34 L 10 16 Z" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
        <rect x="12" y="14" width="24" height="3" fill="#8C5828"/>
        <rect x="14" y="20" width="20" height="10" fill="#F2DC8A" rx="1"/>
        <text x="24" y="27" fontFamily="sans-serif" fontSize="6" fontWeight="700" fill="#8C5828" textAnchor="middle">ATÚN</text>
      </g>
    ),
    'sardinas': (
      <g>
        <path d="M 10 14 L 38 14 L 38 36 L 10 36 Z" fill="#D14635"/>
        <path d="M 10 14 L 38 14 L 38 36 L 10 36 Z" fill="none" stroke="#8C2A20" strokeWidth="1.2"/>
        <rect x="10" y="14" width="28" height="3" fill="#FAFAFA"/>
        {[20,24,28].map(y => (
          <g key={y}>
            <ellipse cx="22" cy={y} rx="8" ry="1.5" fill="#9BB5C8"/>
            <path d={`M 30 ${y} L 33 ${y-2} L 33 ${y+2} Z`} fill="#9BB5C8"/>
            <circle cx="17" cy={y} r="0.6" fill="#1A2235"/>
          </g>
        ))}
      </g>
    ),
    'camarones': (
      <Plate>
        {[[14,22,30],[20,18,-15],[28,22,15],[22,26,-30],[32,26,40]].map(([cx,cy,rot],i) => (
          <g key={i} transform={`rotate(${rot} ${cx} ${cy})`}>
            <path d={`M ${cx-5} ${cy} Q ${cx-3} ${cy-3} ${cx} ${cy-2} Q ${cx+3} ${cy-2} ${cx+5} ${cy} Q ${cx+3} ${cy+2} ${cx} ${cy+2} Q ${cx-3} ${cy+2} ${cx-5} ${cy} Z`} fill="#E8946A"/>
            <path d={`M ${cx+5} ${cy} L ${cx+7} ${cy-2} L ${cx+7} ${cy+2} Z`} fill="#E8946A" stroke="#A8482A" strokeWidth="0.6"/>
            <line x1={cx-3} y1={cy-1} x2={cx-3} y2={cy+1} stroke="#A8482A" strokeWidth="0.5"/>
            <line x1={cx+1} y1={cy-1} x2={cx+1} y2={cy+1} stroke="#A8482A" strokeWidth="0.5"/>
          </g>
        ))}
      </Plate>
    ),
    'frijoles-negros': (
      <Bowl fill="#1A0A05" dark="#0A0502">
        {[[16,22,4,2.5],[22,21,4,2.5],[28,22,4,2.5],[32,23,3.5,2],[18,24,4,2.5],[26,24,4,2.5]].map(([cx,cy,rx,ry],i) => (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#2A1A12" transform={`rotate(${i*15} ${cx} ${cy})`}/>
            <ellipse cx={cx} cy={cy} rx={rx*0.5} ry={ry*0.3} fill="#5A4030" opacity="0.5" transform={`rotate(${i*15} ${cx} ${cy})`}/>
          </g>
        ))}
      </Bowl>
    ),
    'lentejas': (
      <Bowl fill="#A85838" dark="#8C4828">
        {[14,17,20,23,26,29,32].map(x => (
          [21,23,25].map(y => (
            <ellipse key={`${x}-${y}`} cx={x+(y%2)} cy={y} rx="1.2" ry="0.6" fill="#C9683E" transform={`rotate(${(x*y)%180} ${x} ${y})`}/>
          ))
        ))}
      </Bowl>
    ),
    'garbanzos': (
      <Bowl fill="#E8C56A" dark="#A88847">
        {[[15,22],[19,22],[23,22],[27,22],[31,22],[17,24],[21,24],[25,24],[29,24]].map(([cx,cy],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="1.8" fill="#F2DC8A"/>
            <circle cx={cx-0.5} cy={cy-0.5} r="0.5" fill="#FAEFC0"/>
          </g>
        ))}
      </Bowl>
    ),
    'soya': (
      <Bowl fill="#A8744A" dark="#8C5828">
        {[[16,22],[20,22],[24,22],[28,22],[32,22],[18,24],[26,24]].map(([cx,cy],i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="1.6" ry="1" fill="#D9A56B"/>
        ))}
      </Bowl>
    ),
    'tofu': (
      <Plate>
        {[[16,20,8,6],[28,22,8,6],[22,28,8,6]].map(([cx,cy,w,h],i) => (
          <g key={i}>
            <rect x={cx-w/2} y={cy-h/2} width={w} height={h} fill="#FAFAFA" stroke="#B8BFC9" strokeWidth="0.8" rx="0.5"/>
            <line x1={cx-w/2+2} y1={cy} x2={cx+w/2-2} y2={cy} stroke="#D9D9D9" strokeWidth="0.4"/>
          </g>
        ))}
      </Plate>
    ),
    'higado': (
      <Plate>
        <path d="M 12 22 Q 10 14 22 14 Q 36 12 38 22 Q 38 30 24 30 Q 12 30 12 22 Z" fill="#7A3818" stroke="#3A1008" strokeWidth="1"/>
        <ellipse cx="16" cy="20" rx="4" ry="0.8" fill="#FAFAFA" stroke="#B8BFC9" strokeWidth="0.5"/>
        <ellipse cx="28" cy="22" rx="4" ry="0.8" fill="#FAFAFA" stroke="#B8BFC9" strokeWidth="0.5"/>
        <ellipse cx="22" cy="26" rx="4" ry="0.8" fill="#FAFAFA" stroke="#B8BFC9" strokeWidth="0.5"/>
        <path d="M 18 18 Q 24 16 30 18" stroke="#3A1008" strokeWidth="0.6" fill="none"/>
      </Plate>
    ),
  };

  Object.assign(window.FOOD_ICONS, newIcons);
  }
  register();
})();
