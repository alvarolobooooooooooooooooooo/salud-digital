/* Batch 2: Vegetables + Fruits + Dairy unique icons */
(() => {
  function register() {
    if (!window.FOOD_ICONS) { setTimeout(register, 50); return; }
  const FC = {
    leaf:'#5A8C3E', leafDark:'#3D6B2A', leafLight:'#7DAA52',
    carrot:'#E08745', carrotDark:'#B86528',
    tomato:'#D14635', tomatoDark:'#A8302A',
    cabbage:'#C2D49A', cabbageDark:'#8FA868',
    cheese:'#F2DC8A', cheeseDark:'#C9B05A', cheeseRind:'#8C7028',
    bowlOuter:'#B8BFC9', bowlInner:'#E5E8EC',
    plateOuter:'#C9CFD7', plateInner:'#F2F4F7',
    milkBlue:'#5588B5',
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

  const Carton = ({ topColor, label, labelColor }) => (
    <g>
      <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#A89478" opacity="0.3"/>
      <path d="M 14 14 L 16 10 L 32 10 L 34 14 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="#FAFAFA"/>
      <path d="M 14 14 L 16 10 L 32 10 L 34 14 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
      <rect x="14" y="14" width="20" height="4" fill={topColor}/>
      <rect x="16" y="22" width="16" height="11" fill="#F2F4F7" rx="1"/>
      {label && <text x="24" y="29" fontFamily="sans-serif" fontSize="5.5" fontWeight="700" fill={labelColor || topColor} textAnchor="middle">{label}</text>}
    </g>
  );

  const newIcons = {
    // ===== VEGETABLES =====
    'ensalada-cesar': (
      <Bowl fill="#7DAA52" dark="#5A8C3E">
        <path d="M 14 22 Q 14 18 18 18 Q 22 16 22 22 Q 24 18 28 18 Q 32 18 32 22" fill={FC.leaf} stroke={FC.leafDark} strokeWidth="0.6"/>
        <rect x="16" y="22" width="3" height="3" fill="#D9B176" rx="0.3"/>
        <rect x="26" y="20" width="3" height="3" fill="#D9B176" rx="0.3"/>
        <rect x="30" y="24" width="3" height="3" fill="#D9B176" rx="0.3"/>
        <path d="M 20 24 L 22 22 L 22 24 Z M 28 26 L 30 24 L 30 26 Z" fill="#F2DC8A"/>
      </Bowl>
    ),
    'repollo': (
      <g>
        <ellipse cx="24" cy="38" rx="14" ry="2" fill="#5A6E28" opacity="0.4"/>
        <circle cx="24" cy="24" r="14" fill={FC.cabbage}/>
        <circle cx="24" cy="24" r="14" fill="none" stroke="#7A8E48" strokeWidth="1.2"/>
        <path d="M 24 10 Q 16 14 14 22 Q 16 30 24 32 Q 32 30 34 22 Q 32 14 24 10" stroke="#7A8E48" strokeWidth="0.8" fill="none"/>
        <path d="M 24 12 Q 20 18 24 24 Q 28 18 24 12" stroke="#7A8E48" strokeWidth="0.6" fill="none"/>
      </g>
    ),
    'tomate-cherry': (
      <Plate>
        {[[14,22],[20,20],[26,22],[32,20],[18,26],[28,26]].map(([cx,cy],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="3" fill={FC.tomato}/>
            <circle cx={cx} cy={cy} r="3" fill="none" stroke={FC.tomatoDark} strokeWidth="0.6"/>
            <ellipse cx={cx-1} cy={cy-1} r="0.8" fill="#E8716A"/>
            <path d={`M ${cx-1} ${cy-3} L ${cx} ${cy-4} L ${cx+1} ${cy-3}`} stroke="#5A8C3E" strokeWidth="0.6" fill="none"/>
          </g>
        ))}
      </Plate>
    ),
    'espinaca': (
      <g>
        {[[14,30,-20],[24,18,10],[34,28,25],[18,22,-10],[28,32,5]].map(([cx,cy,rot],i) => (
          <g key={i} transform={`rotate(${rot} ${cx} ${cy})`}>
            <path d={`M ${cx} ${cy-8} Q ${cx-5} ${cy-2} ${cx-3} ${cy+6} Q ${cx} ${cy+8} ${cx+3} ${cy+6} Q ${cx+5} ${cy-2} ${cx} ${cy-8} Z`} fill={FC.leaf}/>
            <path d={`M ${cx} ${cy-8} Q ${cx-5} ${cy-2} ${cx-3} ${cy+6} Q ${cx} ${cy+8} ${cx+3} ${cy+6} Q ${cx+5} ${cy-2} ${cx} ${cy-8} Z`} fill="none" stroke={FC.leafDark} strokeWidth="0.8"/>
            <path d={`M ${cx} ${cy-7} L ${cx} ${cy+7}`} stroke={FC.leafDark} strokeWidth="0.6"/>
          </g>
        ))}
      </g>
    ),
    'espinaca-cocida': (
      <Bowl fill="#3D6B2A" dark="#2A4818">
        <path d="M 14 22 Q 18 20 22 22 Q 26 20 30 22 Q 34 20 34 22" stroke="#5A8C3E" strokeWidth="1.2" fill="none"/>
        <path d="M 16 24 Q 20 22 24 24 Q 28 22 32 24" stroke="#5A8C3E" strokeWidth="1.2" fill="none"/>
        <path d="M 18 26 Q 22 24 26 26 Q 30 24 32 26" stroke="#5A8C3E" strokeWidth="1.2" fill="none"/>
      </Bowl>
    ),
    'acelga': (
      <g>
        <ellipse cx="24" cy="40" rx="10" ry="1.5" fill="#3A5028" opacity="0.3"/>
        <path d="M 18 14 Q 12 22 14 32 Q 18 34 22 32 Q 22 22 22 14 Z" fill={FC.leaf} stroke={FC.leafDark} strokeWidth="0.8"/>
        <path d="M 30 14 Q 36 22 34 32 Q 30 34 26 32 Q 26 22 26 14 Z" fill={FC.leaf} stroke={FC.leafDark} strokeWidth="0.8"/>
        <rect x="22" y="14" width="4" height="26" fill="#FAFAFA" stroke="#B8BFC9" strokeWidth="0.6"/>
        <path d="M 22 14 L 22 40 M 26 14 L 26 40" stroke="#E5E8EC" strokeWidth="0.4"/>
      </g>
    ),
    'zanahoria-cocida': (
      <Bowl fill="#E08745" dark="#A8581A">
        {[16,20,24,28,32].map(x => (
          <g key={x}>
            <circle cx={x} cy="22" r="2" fill={FC.carrot}/>
            <circle cx={x} cy="22" r="1" fill="#F2A56A"/>
          </g>
        ))}
        {[18,22,26,30].map(x => (
          <g key={x}>
            <circle cx={x} cy="25" r="2" fill={FC.carrot}/>
            <circle cx={x} cy="25" r="1" fill="#F2A56A"/>
          </g>
        ))}
      </Bowl>
    ),
    'pipian': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="2" fill="#7A8E28" opacity="0.4"/>
        <ellipse cx="24" cy="26" rx="16" ry="12" fill="#9CB060"/>
        <ellipse cx="24" cy="26" rx="16" ry="12" fill="none" stroke="#5A7028" strokeWidth="1.2"/>
        {[12,18,24,30,36].map(x => (
          <path key={x} d={`M ${x} 16 Q ${x-1} 26 ${x} 36`} stroke="#5A7028" strokeWidth="0.6" fill="none"/>
        ))}
        <rect x="22" y="12" width="4" height="3" fill="#3A5018" rx="1"/>
      </g>
    ),
    'chayote': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#5A7028" opacity="0.4"/>
        <path d="M 14 22 Q 12 16 18 14 Q 24 12 30 14 Q 36 16 34 22 Q 38 32 32 36 Q 24 40 16 36 Q 10 32 14 22 Z" fill={FC.cabbage}/>
        <path d="M 14 22 Q 12 16 18 14 Q 24 12 30 14 Q 36 16 34 22 Q 38 32 32 36 Q 24 40 16 36 Q 10 32 14 22 Z" fill="none" stroke="#7A8E48" strokeWidth="1.2"/>
        <path d="M 18 22 Q 24 20 30 22 M 16 28 Q 24 26 32 28 M 18 34 Q 24 32 30 34" stroke="#7A8E48" strokeWidth="0.6" fill="none"/>
        <ellipse cx="20" cy="22" rx="2" ry="6" fill="#E0E8C2" opacity="0.6"/>
      </g>
    ),
    'chile-picante': (
      <g>
        <path d="M 14 36 Q 18 30 22 26 Q 26 22 28 16 Q 28 12 26 10 Q 24 9 22 12 Q 24 14 22 20 Q 18 26 14 32 Z" fill="#D14635" stroke="#8C2A20" strokeWidth="1.2"/>
        <ellipse cx="20" cy="22" rx="1.5" ry="4" fill="#E86A6A" opacity="0.6" transform="rotate(-30 20 22)"/>
        <rect x="23" y="6" width="2" height="4" fill={FC.leafDark}/>
        <path d="M 22 6 L 18 4 M 26 6 L 30 4" stroke={FC.leafDark} strokeWidth="1" strokeLinecap="round"/>
      </g>
    ),
    'cebolla': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#7A6228" opacity="0.3"/>
        <path d="M 14 26 Q 12 16 24 14 Q 36 16 34 26 Q 36 36 24 38 Q 12 36 14 26 Z" fill="#F2E0B8"/>
        <path d="M 14 26 Q 12 16 24 14 Q 36 16 34 26 Q 36 36 24 38 Q 12 36 14 26 Z" fill="none" stroke="#A88847" strokeWidth="1.2"/>
        <path d="M 20 14 Q 18 24 22 36" stroke="#A88847" strokeWidth="0.6" fill="none"/>
        <path d="M 28 14 Q 30 24 26 36" stroke="#A88847" strokeWidth="0.6" fill="none"/>
        <path d="M 24 14 L 24 38" stroke="#A88847" strokeWidth="0.5"/>
        <path d="M 22 14 L 22 8 L 26 8 L 26 14" stroke={FC.leafLight} strokeWidth="1.5" fill="none"/>
      </g>
    ),
    'cebolla-morada': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#3A1A2A" opacity="0.4"/>
        <path d="M 14 26 Q 12 16 24 14 Q 36 16 34 26 Q 36 36 24 38 Q 12 36 14 26 Z" fill="#8C4A6E"/>
        <path d="M 14 26 Q 12 16 24 14 Q 36 16 34 26 Q 36 36 24 38 Q 12 36 14 26 Z" fill="none" stroke="#5A2A48" strokeWidth="1.2"/>
        <path d="M 20 14 Q 18 24 22 36" stroke="#5A2A48" strokeWidth="0.6" fill="none"/>
        <path d="M 28 14 Q 30 24 26 36" stroke="#5A2A48" strokeWidth="0.6" fill="none"/>
        <path d="M 24 14 L 24 38" stroke="#5A2A48" strokeWidth="0.5"/>
        <path d="M 22 14 L 22 8 L 26 8 L 26 14" stroke={FC.leafLight} strokeWidth="1.5" fill="none"/>
      </g>
    ),
    'ajo': (
      <g>
        <ellipse cx="24" cy="40" rx="10" ry="1.5" fill="#A89478" opacity="0.3"/>
        <path d="M 24 12 Q 12 14 12 26 Q 12 36 24 38 Q 36 36 36 26 Q 36 14 24 12 Z" fill="#FAEFD0"/>
        <path d="M 24 12 Q 12 14 12 26 Q 12 36 24 38 Q 36 36 36 26 Q 36 14 24 12 Z" fill="none" stroke="#C9B58E" strokeWidth="1.2"/>
        <path d="M 24 12 Q 16 18 18 30 M 24 12 L 24 38 M 24 12 Q 32 18 30 30" stroke="#C9B58E" strokeWidth="0.6" fill="none"/>
        <path d="M 22 12 L 24 8 L 26 12" fill="#A88847" stroke="#7A5828" strokeWidth="0.8"/>
        <path d="M 22 38 L 21 41 M 24 38 L 24 42 M 26 38 L 27 41" stroke="#7A5828" strokeWidth="0.6"/>
      </g>
    ),
    'coliflor': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#3A5028" opacity="0.3"/>
        <rect x="20" y="28" width="8" height="12" fill={FC.cabbage} rx="1"/>
        <rect x="20" y="28" width="8" height="12" fill="none" stroke="#7A8E48" strokeWidth="0.8"/>
        {[[14,22,6],[24,16,7],[34,22,6],[18,26,5],[30,26,5],[24,24,6]].map(([cx,cy,r],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="#FAFAEA"/>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#C9B58E" strokeWidth="0.5"/>
            {[[-2,-1],[2,-1],[0,1],[-1,2],[1,-2]].map(([dx,dy],j) => (
              <circle key={j} cx={cx+dx} cy={cy+dy} r="1.2" fill="#FFFFFF" stroke="#D9D0B8" strokeWidth="0.3"/>
            ))}
          </g>
        ))}
      </g>
    ),
    'apio': (
      <g>
        <ellipse cx="24" cy="40" rx="10" ry="1.5" fill="#5A8C3E" opacity="0.3"/>
        {[18,22,26,30].map((x,i) => (
          <g key={i}>
            <rect x={x-2} y={i % 2 ? 18 : 16} width="3.5" height={i % 2 ? 22 : 24} fill="#A8C26A" stroke="#5A8C3E" strokeWidth="0.6" rx="1"/>
            <line x1={x-0.5} y1={i % 2 ? 20 : 18} x2={x-0.5} y2="38" stroke="#5A8C3E" strokeWidth="0.4"/>
          </g>
        ))}
        <path d="M 16 16 Q 12 12 14 8 Q 16 10 18 14" fill={FC.leaf}/>
        <path d="M 32 16 Q 36 12 34 8 Q 32 10 30 14" fill={FC.leaf}/>
      </g>
    ),
    'rabano': (
      <g>
        <path d="M 22 10 Q 16 4 12 10 Q 14 14 20 14" fill={FC.leaf}/>
        <path d="M 26 10 Q 32 4 36 10 Q 34 14 28 14" fill={FC.leaf}/>
        <path d="M 24 8 Q 24 4 24 4" stroke={FC.leafDark} strokeWidth="2"/>
        <circle cx="24" cy="24" r="11" fill={FC.tomato}/>
        <circle cx="24" cy="24" r="11" fill="none" stroke="#8C2A20" strokeWidth="1.2"/>
        <ellipse cx="20" cy="20" rx="3" ry="5" fill="#E86A6A" opacity="0.6"/>
        <path d="M 24 35 Q 26 38 24 42 Q 22 40 24 35" fill="#FAFAEA" stroke="#A88847" strokeWidth="0.6"/>
      </g>
    ),
    'remolacha': (
      <g>
        <path d="M 22 10 Q 16 6 14 10 Q 18 14 22 14" fill="#5A2A48"/>
        <path d="M 26 10 Q 32 6 34 10 Q 30 14 26 14" fill="#5A2A48"/>
        <circle cx="24" cy="26" r="13" fill="#8C2A48"/>
        <circle cx="24" cy="26" r="13" fill="none" stroke="#5A1A28" strokeWidth="1.2"/>
        <ellipse cx="20" cy="22" rx="3" ry="5" fill="#A8385A" opacity="0.6"/>
        <ellipse cx="24" cy="26" rx="9" ry="9" fill="none" stroke="#5A1A28" strokeWidth="0.5" opacity="0.5"/>
        <ellipse cx="24" cy="26" rx="5" ry="5" fill="none" stroke="#5A1A28" strokeWidth="0.5" opacity="0.5"/>
        <path d="M 24 38 L 24 42" stroke="#5A1A28" strokeWidth="1"/>
      </g>
    ),
    'berenjena': (
      <g>
        <path d="M 20 12 L 18 6 L 28 6 L 28 12" fill={FC.leafDark} stroke="#2A3818" strokeWidth="1"/>
        <path d="M 22 8 L 26 8 L 24 12" fill={FC.leaf}/>
        <path d="M 16 14 Q 12 24 14 36 Q 24 40 34 36 Q 36 24 32 14 Q 24 12 16 14 Z" fill="#5A2A6E"/>
        <path d="M 16 14 Q 12 24 14 36 Q 24 40 34 36 Q 36 24 32 14 Q 24 12 16 14 Z" fill="none" stroke="#2A1038" strokeWidth="1.2"/>
        <ellipse cx="20" cy="22" rx="2.5" ry="8" fill="#7A4A8C" opacity="0.6"/>
      </g>
    ),
    'ejotes': (
      <Plate>
        {[[12,22,15],[16,24,-10],[20,22,20],[24,24,-5],[28,22,15],[32,24,-15]].map(([cx,cy,rot],i) => (
          <g key={i} transform={`rotate(${rot} ${cx} ${cy})`}>
            <path d={`M ${cx-6} ${cy} Q ${cx} ${cy-2} ${cx+6} ${cy} Q ${cx} ${cy+2} ${cx-6} ${cy} Z`} fill={FC.leaf} stroke={FC.leafDark} strokeWidth="0.6"/>
            {[-3,-1,1,3].map(dx => (
              <circle key={dx} cx={cx+dx} cy={cy} r="0.6" fill={FC.leafDark}/>
            ))}
          </g>
        ))}
      </Plate>
    ),
    'esparragos': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#3A5028" opacity="0.3"/>
        {[14,18,22,26,30,34].map((x,i) => (
          <g key={i}>
            <path d={`M ${x-2} 12 Q ${x} 8 ${x+2} 12`} fill="#5A8C3E" stroke="#3A5028" strokeWidth="0.5"/>
            <rect x={x-1.5} y="12" width="3" height="26" fill="#7DAA52" stroke="#5A8C3E" strokeWidth="0.5"/>
            <line x1={x} y1="14" x2={x} y2="36" stroke="#3A5028" strokeWidth="0.3"/>
            <path d={`M ${x-1.5} 14 Q ${x} 13 ${x+1.5} 14 M ${x-1.5} 16 Q ${x} 15 ${x+1.5} 16`} stroke="#3A5028" strokeWidth="0.4" fill="none"/>
          </g>
        ))}
      </g>
    ),
    'champinones': (
      <Plate>
        {[[14,22],[20,20],[28,20],[32,22],[24,26]].map(([cx,cy],i) => (
          <g key={i}>
            <rect x={cx-1.5} y={cy+1} width="3" height="5" fill="#FAEFD0" stroke="#A88847" strokeWidth="0.4"/>
            <path d={`M ${cx-5} ${cy+1} Q ${cx-5} ${cy-4} ${cx} ${cy-5} Q ${cx+5} ${cy-4} ${cx+5} ${cy+1} Z`} fill="#D9B58E"/>
            <path d={`M ${cx-5} ${cy+1} Q ${cx-5} ${cy-4} ${cx} ${cy-5} Q ${cx+5} ${cy-4} ${cx+5} ${cy+1} Z`} fill="none" stroke="#8C5828" strokeWidth="0.6"/>
            <circle cx={cx-2} cy={cy-2} r="0.5" fill="#A88847"/>
            <circle cx={cx+1} cy={cy-3} r="0.4" fill="#A88847"/>
          </g>
        ))}
      </Plate>
    ),
    'crema-verduras': (
      <Bowl fill="#9CB060" dark="#5A7A38">
        <path d="M 14 22 Q 24 18 34 24 Q 24 28 14 22" stroke="#FAFAEA" strokeWidth="0.8" fill="none" opacity="0.7"/>
        <ellipse cx="24" cy="22" rx="2" ry="0.6" fill="#FAFAEA" opacity="0.7"/>
        <path d="M 20 16 Q 21 12 20 8" stroke="#B8BFC9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6"/>
        <path d="M 28 16 Q 29 12 28 8" stroke="#B8BFC9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6"/>
      </Bowl>
    ),
    'sopa-pollo': (
      <Bowl fill="#E8D080" dark="#A88847">
        <ellipse cx="18" cy="22" rx="2.5" ry="1.2" fill="#D9A56B"/>
        <ellipse cx="28" cy="22" rx="2.5" ry="1.2" fill="#D9A56B"/>
        <circle cx="22" cy="24" r="0.8" fill={FC.carrot}/>
        <circle cx="30" cy="24" r="0.8" fill={FC.leafLight}/>
        <path d="M 14 24 Q 18 23 22 24 M 26 22 Q 30 23 34 22" stroke="#F2D89A" strokeWidth="1" fill="none"/>
        <path d="M 20 16 Q 21 12 20 8" stroke="#B8BFC9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6"/>
        <path d="M 28 16 Q 29 12 28 8" stroke="#B8BFC9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6"/>
      </Bowl>
    ),

    // ===== FRUITS =====
    'banano-pequeno': (
      <g>
        <path d="M 12 14 Q 10 24 16 32 Q 24 36 30 32 Q 36 24 34 18 L 32 16 Q 32 22 28 28 Q 22 32 18 26 Q 14 18 16 14 Z" fill="#E8C04A"/>
        <path d="M 12 14 Q 10 24 16 32 Q 24 36 30 32 Q 36 24 34 18 L 32 16 Q 32 22 28 28 Q 22 32 18 26 Q 14 18 16 14 Z" fill="none" stroke="#B89230" strokeWidth="1.2"/>
        <ellipse cx="14" cy="13" rx="2.5" ry="1.2" fill="#5A4A20" transform="rotate(-30 14 13)"/>
      </g>
    ),
    'manzana-verde': (
      <g>
        <ellipse cx="24" cy="40" rx="12" ry="2" fill="#3A5028" opacity="0.3"/>
        <path d="M 24 12 Q 14 12 12 22 Q 12 36 22 38 Q 24 36 26 38 Q 36 36 36 22 Q 34 12 24 12 Z" fill="#A8C26A"/>
        <path d="M 24 12 Q 14 12 12 22 Q 12 36 22 38 Q 24 36 26 38 Q 36 36 36 22 Q 34 12 24 12 Z" fill="none" stroke="#3D6B2A" strokeWidth="1.2"/>
        <ellipse cx="18" cy="18" rx="3" ry="5" fill="#C2D49A" opacity="0.6"/>
        <rect x="23" y="8" width="2" height="6" fill="#5A3E28"/>
        <path d="M 25 10 Q 30 8 32 12 Q 28 14 25 12" fill={FC.leafDark}/>
      </g>
    ),
    'mandarina': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#7A3818" opacity="0.3"/>
        <circle cx="24" cy="26" r="12" fill="#E8A52E"/>
        <circle cx="24" cy="26" r="12" fill="none" stroke="#A86528" strokeWidth="1.2"/>
        <path d="M 24 14 L 24 38" stroke="#A86528" strokeWidth="0.5" opacity="0.6"/>
        <path d="M 14 22 L 34 30" stroke="#A86528" strokeWidth="0.5" opacity="0.6"/>
        <path d="M 14 30 L 34 22" stroke="#A86528" strokeWidth="0.5" opacity="0.6"/>
        {[[18,22],[28,22],[22,28],[28,30]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="0.6" fill="#8C5018" opacity="0.5"/>
        ))}
        <path d="M 22 12 Q 24 8 28 10 Q 26 14 24 14" fill={FC.leafDark}/>
      </g>
    ),
    'limon': (
      <g>
        <ellipse cx="24" cy="40" rx="10" ry="1.5" fill="#5A7028" opacity="0.3"/>
        <ellipse cx="24" cy="26" rx="11" ry="14" fill="#C2D44A"/>
        <ellipse cx="24" cy="26" rx="11" ry="14" fill="none" stroke="#7A8E28" strokeWidth="1.2"/>
        <ellipse cx="24" cy="12" rx="2" ry="1" fill="#A8C238"/>
        <ellipse cx="24" cy="40" rx="2" ry="1" fill="#A8C238"/>
        <ellipse cx="20" cy="22" rx="2" ry="5" fill="#E0E89A" opacity="0.6"/>
        {[[18,28],[28,28],[22,32]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="0.5" fill="#5A7028" opacity="0.6"/>
        ))}
      </g>
    ),
    'uvas': (
      <g>
        <path d="M 22 8 L 24 14 L 26 8" stroke="#5A3818" strokeWidth="1.5" fill="none"/>
        <path d="M 28 10 Q 32 8 34 12 Q 30 14 28 12" fill={FC.leaf} stroke={FC.leafDark} strokeWidth="0.6"/>
        {[[24,18],[20,20],[28,20],[18,24],[24,22],[30,24],[22,28],[26,28],[24,32]].map(([cx,cy],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="3.5" fill="#7A4A8C"/>
            <circle cx={cx} cy={cy} r="3.5" fill="none" stroke="#3A1A28" strokeWidth="0.4"/>
            <ellipse cx={cx-1} cy={cy-1} r="0.8" fill="#A88AB8" opacity="0.7"/>
          </g>
        ))}
      </g>
    ),
    'melon': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="1.5" fill="#7A6228" opacity="0.3"/>
        <circle cx="24" cy="24" r="14" fill="#E8B872"/>
        <circle cx="24" cy="24" r="14" fill="none" stroke="#A88847" strokeWidth="1.2"/>
        <path d="M 14 18 Q 24 20 34 18 M 12 24 Q 24 26 36 24 M 14 30 Q 24 32 34 30" stroke="#A88847" strokeWidth="0.5" fill="none"/>
        <path d="M 18 14 Q 16 24 18 34 M 24 12 Q 22 24 24 36 M 30 14 Q 32 24 30 34" stroke="#A88847" strokeWidth="0.5" fill="none"/>
      </g>
    ),
    'pera': (
      <g>
        <ellipse cx="24" cy="40" rx="10" ry="1.5" fill="#7A6228" opacity="0.3"/>
        <path d="M 22 12 Q 18 16 16 22 Q 12 32 18 38 Q 30 40 32 32 Q 32 22 28 16 Q 26 12 22 12 Z" fill="#A8C26A"/>
        <path d="M 22 12 Q 18 16 16 22 Q 12 32 18 38 Q 30 40 32 32 Q 32 22 28 16 Q 26 12 22 12 Z" fill="none" stroke="#5A7028" strokeWidth="1.2"/>
        <ellipse cx="20" cy="22" rx="2" ry="6" fill="#C2D49A" opacity="0.6"/>
        <rect x="23" y="6" width="2" height="6" fill="#5A3E28"/>
        <path d="M 25 8 Q 28 8 28 12" fill={FC.leafDark}/>
      </g>
    ),
    'durazno': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#7A3818" opacity="0.3"/>
        <circle cx="24" cy="26" r="13" fill="#E89B7A"/>
        <circle cx="24" cy="26" r="13" fill="none" stroke="#A8482A" strokeWidth="1.2"/>
        <path d="M 24 13 Q 22 26 24 39" stroke="#A8482A" strokeWidth="0.6" fill="none"/>
        <ellipse cx="20" cy="22" rx="3" ry="6" fill="#F2C0A8" opacity="0.6"/>
        <circle cx="30" cy="20" r="3" fill="#D9683E" opacity="0.5"/>
        <path d="M 22 14 Q 18 10 16 14 Q 20 16 24 14" fill={FC.leafDark}/>
      </g>
    ),
    'ciruela': (
      <g>
        {[[16,28,8],[30,28,8]].map(([cx,cy,r],i) => (
          <g key={i}>
            <ellipse cx={cx} cy={cy+r-1} rx={r-1} ry="1.5" fill="#3A1A28" opacity="0.3"/>
            <circle cx={cx} cy={cy} r={r} fill="#5A2A48"/>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3A1028" strokeWidth="1"/>
            <path d={`M ${cx} ${cy-r+1} Q ${cx-1} ${cy} ${cx} ${cy+r-1}`} stroke="#3A1028" strokeWidth="0.5" fill="none"/>
            <ellipse cx={cx-2} cy={cy-2} rx="2" ry="2" fill="#7A3A5A" opacity="0.6"/>
          </g>
        ))}
        <path d="M 16 20 L 22 14 M 30 20 L 24 14" stroke="#5A3818" strokeWidth="1"/>
      </g>
    ),
    'kiwi': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <ellipse cx="24" cy="26" rx="14" ry="11" fill="#7A5828"/>
        <ellipse cx="24" cy="26" rx="14" ry="11" fill="none" stroke="#3A2810" strokeWidth="1.2"/>
        <ellipse cx="24" cy="26" rx="11" ry="8.5" fill="#9CB060"/>
        <ellipse cx="24" cy="26" rx="11" ry="8.5" fill="none" stroke="#5A8C3E" strokeWidth="0.6"/>
        <circle cx="24" cy="26" r="2" fill="#FAFAEA"/>
        {[0,40,80,120,160,200,240,280,320].map(angle => {
          const rad = angle * Math.PI / 180;
          const sx = 24 + Math.cos(rad) * 5;
          const sy = 26 + Math.sin(rad) * 4;
          return <ellipse key={angle} cx={sx} cy={sy} rx="0.6" ry="1.2" fill="#1A1208" transform={`rotate(${angle} ${sx} ${sy})`}/>;
        })}
      </g>
    ),
    'maracuya': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#5A3818" opacity="0.4"/>
        <circle cx="24" cy="26" r="13" fill="#8C4A28"/>
        <circle cx="24" cy="26" r="13" fill="none" stroke="#3A1808" strokeWidth="1.2"/>
        <circle cx="24" cy="26" r="10" fill="#E0A53A"/>
        {[[20,22],[24,20],[28,22],[20,28],[24,30],[28,28],[22,24],[26,24],[22,30],[26,30]].map(([cx,cy],i) => (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx="1.5" ry="0.9" fill="#E8C56A"/>
            <ellipse cx={cx} cy={cy} rx="1" ry="0.6" fill="#1A1208"/>
          </g>
        ))}
      </g>
    ),
    'coco': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#3A1808" opacity="0.4"/>
        <circle cx="24" cy="24" r="14" fill="#5A3818"/>
        <circle cx="24" cy="24" r="14" fill="none" stroke="#3A1808" strokeWidth="1.2"/>
        {[0,30,60,90,120,150,180,210,240,270,300,330].map(a => {
          const rad = a * Math.PI / 180;
          return <line key={a} x1={24 + Math.cos(rad)*8} y1={24 + Math.sin(rad)*8} x2={24 + Math.cos(rad)*13} y2={24 + Math.sin(rad)*13} stroke="#3A1808" strokeWidth="0.5"/>;
        })}
        <circle cx="20" cy="18" r="1.5" fill="#3A1808"/>
        <circle cx="28" cy="18" r="1.5" fill="#3A1808"/>
        <circle cx="24" cy="22" r="1.5" fill="#3A1808"/>
      </g>
    ),
    'guayaba': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#5A7028" opacity="0.3"/>
        <path d="M 14 24 Q 12 14 22 12 Q 32 12 34 22 Q 38 32 30 38 Q 18 38 14 30 Q 10 26 14 24 Z" fill="#A8C26A"/>
        <path d="M 14 24 Q 12 14 22 12 Q 32 12 34 22 Q 38 32 30 38 Q 18 38 14 30 Q 10 26 14 24 Z" fill="none" stroke="#5A7028" strokeWidth="1.2"/>
        <path d="M 24 12 Q 26 14 24 18 Q 22 14 24 12" fill="#F2DC8A"/>
        <path d="M 22 12 L 22 8 M 24 12 L 24 6 M 26 12 L 26 8" stroke={FC.leafDark} strokeWidth="1"/>
        <ellipse cx="20" cy="22" rx="2" ry="6" fill={FC.cabbage} opacity="0.6"/>
      </g>
    ),
    'zapote': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#5A2818" opacity="0.4"/>
        <ellipse cx="24" cy="26" rx="12" ry="14" fill="#A8482A"/>
        <ellipse cx="24" cy="26" rx="12" ry="14" fill="none" stroke="#5A2818" strokeWidth="1.2"/>
        <ellipse cx="20" cy="20" rx="2" ry="6" fill="#C9683E" opacity="0.5"/>
        {[[18,22],[28,22],[20,28],[26,28],[22,32]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="0.6" fill="#5A2818" opacity="0.6"/>
        ))}
        <ellipse cx="24" cy="13" rx="3" ry="1.5" fill="#3A1808"/>
      </g>
    ),
    'anona': (
      <g>
        <ellipse cx="24" cy="40" rx="12" ry="1.5" fill="#3A5028" opacity="0.3"/>
        <path d="M 14 24 Q 12 14 24 12 Q 36 14 34 24 Q 38 34 30 38 Q 18 38 14 30 Q 10 26 14 24 Z" fill={FC.cabbage}/>
        <path d="M 14 24 Q 12 14 24 12 Q 36 14 34 24 Q 38 34 30 38 Q 18 38 14 30 Q 10 26 14 24 Z" fill="none" stroke="#7A8E48" strokeWidth="1.2"/>
        {[[18,18,3],[24,16,3.5],[30,18,3],[16,24,3],[22,22,3],[28,22,3],[34,24,3],[18,30,3],[24,28,3.5],[30,30,3],[22,34,3],[28,34,3]].map(([cx,cy,r],i) => (
          <path key={i} d={`M ${cx-r} ${cy} Q ${cx} ${cy-r} ${cx+r} ${cy} Q ${cx} ${cy+r/2} ${cx-r} ${cy} Z`} fill={i % 2 ? "#A8C26A" : "#9CB060"} stroke="#7A8E48" strokeWidth="0.4"/>
        ))}
        <rect x="23" y="6" width="2" height="6" fill="#5A3818"/>
      </g>
    ),
    'jocote': (
      <Plate>
        {[[14,22,4],[20,20,4],[26,22,4],[32,20,4],[18,26,4]].map(([cx,cy,r],i) => (
          <g key={i}>
            <ellipse cx={cx} cy={cy+1} rx={r} ry="1" fill="#5A2818" opacity="0.3"/>
            <path d={`M ${cx-r} ${cy} Q ${cx-r} ${cy-r} ${cx} ${cy-r} Q ${cx+r} ${cy-r} ${cx+r} ${cy} Q ${cx+r} ${cy+r} ${cx} ${cy+r} Q ${cx-r} ${cy+r} ${cx-r} ${cy} Z`} fill={i % 2 ? "#D9683E" : "#E0A53A"}/>
            <path d={`M ${cx-r} ${cy} Q ${cx-r} ${cy-r} ${cx} ${cy-r} Q ${cx+r} ${cy-r} ${cx+r} ${cy} Q ${cx+r} ${cy+r} ${cx} ${cy+r} Q ${cx-r} ${cy+r} ${cx-r} ${cy} Z`} fill="none" stroke="#8C2A20" strokeWidth="0.6"/>
            <path d={`M ${cx} ${cy-r} L ${cx} ${cy-r-1}`} stroke="#5A3818" strokeWidth="0.8"/>
          </g>
        ))}
      </Plate>
    ),
    'nance': (
      <Plate>
        {[[14,22],[18,22],[22,22],[26,22],[30,22],[34,22],[16,26],[20,26],[24,26],[28,26],[32,26]].map(([cx,cy],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="2" fill="#E8C56A"/>
            <circle cx={cx} cy={cy} r="2" fill="none" stroke="#A87520" strokeWidth="0.4"/>
            <circle cx={cx-0.5} cy={cy-0.5} r="0.6" fill="#FAEFC0"/>
          </g>
        ))}
      </Plate>
    ),
    'pitahaya': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#7A2A48" opacity="0.4"/>
        <path d="M 14 22 Q 12 12 24 10 Q 36 12 34 22 Q 38 32 30 38 Q 18 38 14 30 Q 10 26 14 22 Z" fill="#D14672"/>
        <path d="M 14 22 Q 12 12 24 10 Q 36 12 34 22 Q 38 32 30 38 Q 18 38 14 30 Q 10 26 14 22 Z" fill="none" stroke="#8C2A48" strokeWidth="1.2"/>
        <path d="M 12 16 L 8 12 L 14 14 M 36 16 L 40 12 L 34 14 M 14 30 L 8 32 L 14 28 M 34 30 L 40 32 L 34 28" fill={FC.leafLight} stroke={FC.leafDark} strokeWidth="0.6"/>
        <path d="M 22 8 L 18 4 L 24 6 L 30 4 L 26 8" fill={FC.leafLight} stroke={FC.leafDark} strokeWidth="0.6"/>
      </g>
    ),
    'tamarindo': (
      <Plate>
        {[[14,22,18,5],[24,20,20,5],[34,22,18,5]].map(([cx,cy,w,h],i) => (
          <g key={i} transform={`rotate(${i*15-15} ${cx} ${cy})`}>
            <path d={`M ${cx-w/2} ${cy} Q ${cx-w/2-2} ${cy-h} ${cx-w/4} ${cy-h} L ${cx+w/4} ${cy-h+1} Q ${cx+w/2+2} ${cy-h-1} ${cx+w/2} ${cy} Q ${cx+w/2-2} ${cy+h} ${cx} ${cy+h} Q ${cx-w/2+2} ${cy+h-1} ${cx-w/2} ${cy} Z`} fill="#7A4818" stroke="#3A1808" strokeWidth="0.8"/>
            <path d={`M ${cx-w/2+2} ${cy} Q ${cx} ${cy+1} ${cx+w/2-2} ${cy}`} stroke="#3A1808" strokeWidth="0.5" fill="none"/>
          </g>
        ))}
      </Plate>
    ),
    'arandanos': (
      <Bowl fill="#4A4A8C" dark="#1A1A38">
        {[[14,22],[18,21],[22,22],[26,21],[30,22],[34,21],[16,24],[20,24],[24,24],[28,24],[32,24]].map(([cx,cy],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="2" fill="#7A7AB8"/>
            <circle cx={cx} cy={cy} r="2" fill="none" stroke="#2A2A5C" strokeWidth="0.4"/>
            <ellipse cx={cx-0.5} cy={cy-0.5} r="0.6" fill="#A8A8D0" opacity="0.6"/>
          </g>
        ))}
      </Bowl>
    ),
    'frutas-secas': (
      <Plate>
        <ellipse cx="14" cy="22" rx="3" ry="2" fill="#5A3818" stroke="#3A1808" strokeWidth="0.5"/>
        <ellipse cx="20" cy="20" rx="3" ry="2" fill="#7A2A18" stroke="#3A1008" strokeWidth="0.5"/>
        <ellipse cx="26" cy="22" rx="3" ry="2" fill="#5A3818" stroke="#3A1808" strokeWidth="0.5"/>
        <ellipse cx="32" cy="20" rx="3" ry="2" fill="#7A2A18" stroke="#3A1008" strokeWidth="0.5"/>
        <ellipse cx="18" cy="26" rx="3" ry="2" fill="#A8744A" stroke="#5A2818" strokeWidth="0.5"/>
        <ellipse cx="24" cy="24" rx="3" ry="2" fill="#E0A53A" stroke="#8C5828" strokeWidth="0.5"/>
        <ellipse cx="30" cy="26" rx="3" ry="2" fill="#5A3818" stroke="#3A1808" strokeWidth="0.5"/>
      </Plate>
    ),
    'platano-fruta': (
      <g>
        <path d="M 8 14 Q 6 24 14 32 Q 22 36 30 32 Q 40 24 38 18 L 36 16 Q 36 22 30 28 Q 22 32 16 28 Q 10 18 12 14 Z" fill="#E8C04A"/>
        <path d="M 8 14 Q 6 24 14 32 Q 22 36 30 32 Q 40 24 38 18 L 36 16 Q 36 22 30 28 Q 22 32 16 28 Q 10 18 12 14 Z" fill="none" stroke="#B89230" strokeWidth="1.2"/>
        <path d="M 14 16 Q 16 24 22 28" stroke="#B89230" strokeWidth="0.6" fill="none" opacity="0.6"/>
        <ellipse cx="10" cy="13" rx="3" ry="1.5" fill="#5A4A20" transform="rotate(-30 10 13)"/>
      </g>
    ),

    // ===== DAIRY =====
    'queso-crema': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#A89478" opacity="0.3"/>
        <path d="M 10 18 L 38 16 L 38 38 L 10 38 Z" fill="#FAEFD0"/>
        <path d="M 10 18 L 38 16 L 38 38 L 10 38 Z" fill="none" stroke="#A88847" strokeWidth="1.2"/>
        <rect x="14" y="22" width="20" height="12" fill="#FAFAFA" rx="1"/>
        <text x="24" y="30" fontFamily="sans-serif" fontSize="6" fontWeight="800" fill="#5588B5" textAnchor="middle">CREMA</text>
        <path d="M 10 18 L 38 16 L 38 14 L 10 16 Z" fill="#C9CFD7" stroke="#8C9CAA" strokeWidth="0.8"/>
      </g>
    ),
    'queso-mozzarella': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#A89478" opacity="0.3"/>
        <circle cx="24" cy="26" r="13" fill="#FAFAEA"/>
        <circle cx="24" cy="26" r="13" fill="none" stroke="#D9D0B8" strokeWidth="1.2"/>
        <ellipse cx="20" cy="22" rx="3" ry="5" fill="#FFFFFF" opacity="0.7"/>
        <path d="M 24 13 L 24 39" stroke="#D9D0B8" strokeWidth="0.6" opacity="0.5"/>
      </g>
    ),
    'queso-cheddar': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="2" fill="#7A4A18" opacity="0.4"/>
        <path d="M 8 32 L 24 16 L 40 32 L 40 38 L 8 38 Z" fill="#E89B5A"/>
        <path d="M 8 32 L 24 16 L 40 32 L 40 38 L 8 38 Z" fill="none" stroke="#A8581A" strokeWidth="1.2"/>
        <path d="M 8 32 L 40 32" stroke="#A8581A" strokeWidth="1"/>
        <circle cx="16" cy="34" r="1" fill="#A8581A"/>
        <circle cx="24" cy="35" r="1.2" fill="#A8581A"/>
        <circle cx="32" cy="34" r="1" fill="#A8581A"/>
      </g>
    ),
    'queso-parmesano': (
      <Plate>
        <path d="M 10 28 L 38 24 L 38 26 L 10 30 Z" fill="#F2DC8A" stroke="#A87520" strokeWidth="0.6"/>
        <path d="M 12 30 L 36 26 L 36 28 L 12 32 Z" fill="#FAEFC0" stroke="#A87520" strokeWidth="0.6"/>
        {[[14,28],[20,27],[26,26],[32,25]].map(([cx,cy],i) => (
          <line key={i} x1={cx} y1={cy} x2={cx+2} y2={cy} stroke="#A87520" strokeWidth="0.4"/>
        ))}
      </Plate>
    ),
    'leche-2': (
      <Carton topColor="#7DAA8E" label="LECHE 2%" labelColor="#5A8C6E"/>
    ),
    'leche-deslactos': (
      <Carton topColor="#E0992E" label="DESLAC." labelColor="#A86528"/>
    ),
    'leche-condensada': (
      <g>
        <ellipse cx="24" cy="40" rx="9" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <ellipse cx="24" cy="12" rx="9" ry="2.5" fill="#F2DC8A"/>
        <path d="M 15 12 L 33 12 L 33 38 Q 33 40 31 40 L 17 40 Q 15 40 15 38 Z" fill="#FAFAFA"/>
        <path d="M 15 12 L 33 12 L 33 38 Q 33 40 31 40 L 17 40 Q 15 40 15 38 Z" fill="none" stroke="#1A2235" strokeWidth="1.2" opacity="0.4"/>
        <rect x="16" y="18" width="16" height="14" fill="#5588B5" rx="1"/>
        <text x="24" y="24" fontFamily="sans-serif" fontSize="5" fontWeight="800" fill="#FAFAFA" textAnchor="middle">LECHE</text>
        <text x="24" y="30" fontFamily="sans-serif" fontSize="4.5" fontWeight="700" fill="#FAFAFA" textAnchor="middle">CONDEN.</text>
      </g>
    ),
    'leche-evaporada': (
      <g>
        <ellipse cx="24" cy="40" rx="9" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <ellipse cx="24" cy="12" rx="9" ry="2.5" fill="#C9CFD7"/>
        <path d="M 15 12 L 33 12 L 33 38 Q 33 40 31 40 L 17 40 Q 15 40 15 38 Z" fill="#FAFAFA"/>
        <path d="M 15 12 L 33 12 L 33 38 Q 33 40 31 40 L 17 40 Q 15 40 15 38 Z" fill="none" stroke="#1A2235" strokeWidth="1.2" opacity="0.4"/>
        <rect x="16" y="18" width="16" height="14" fill="#E08745" rx="1"/>
        <text x="24" y="24" fontFamily="sans-serif" fontSize="5" fontWeight="800" fill="#FAFAFA" textAnchor="middle">LECHE</text>
        <text x="24" y="30" fontFamily="sans-serif" fontSize="4.5" fontWeight="700" fill="#FAFAFA" textAnchor="middle">EVAP.</text>
      </g>
    ),
    'leche-polvo': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <path d="M 10 14 L 38 14 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="#FAFAFA"/>
        <path d="M 10 14 L 38 14 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
        <rect x="10" y="14" width="28" height="6" fill="#5588B5"/>
        <rect x="14" y="24" width="20" height="12" fill="#F2F4F7" rx="1"/>
        <text x="24" y="29" fontFamily="sans-serif" fontSize="5" fontWeight="800" fill="#5588B5" textAnchor="middle">LECHE</text>
        <text x="24" y="34" fontFamily="sans-serif" fontSize="4.5" fontWeight="700" fill="#5588B5" textAnchor="middle">POLVO</text>
      </g>
    ),
    'leche-soya': (
      <Carton topColor="#A8744A" label="SOYA" labelColor="#7A4818"/>
    ),
    'leche-almendra': (
      <Carton topColor="#E8C56A" label="ALMENDRA" labelColor="#A88847"/>
    ),
    'yogurt-griego': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#A89478" opacity="0.3"/>
        <path d="M 12 16 L 36 16 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 Z" fill="#FAFAFA"/>
        <path d="M 12 16 L 36 16 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
        <ellipse cx="24" cy="16" rx="12" ry="2" fill="#3A6850"/>
        <ellipse cx="24" cy="14" rx="12" ry="2" fill="#5A8C6E"/>
        <text x="24" y="32" fontFamily="sans-serif" fontSize="5.5" fontWeight="800" fill="#5A8C6E" textAnchor="middle">GRIEGO</text>
      </g>
    ),
    'yogurt-frutas': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#A89478" opacity="0.3"/>
        <path d="M 12 16 L 36 16 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 Z" fill="#FAFAFA"/>
        <path d="M 12 16 L 36 16 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
        <ellipse cx="24" cy="16" rx="12" ry="2" fill="#A8385A"/>
        <ellipse cx="24" cy="14" rx="12" ry="2" fill="#C73A7A"/>
        {/* fruit pieces */}
        <circle cx="20" cy="22" r="1.5" fill={FC.tomato}/>
        <circle cx="26" cy="20" r="1.2" fill={FC.tomato}/>
        <circle cx="28" cy="24" r="1.5" fill={FC.tomato}/>
        <text x="24" y="33" fontFamily="sans-serif" fontSize="5" fontWeight="800" fill="#C73A7A" textAnchor="middle">FRUTAS</text>
      </g>
    ),
    'crema-leche': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#A89478" opacity="0.3"/>
        <path d="M 14 18 L 34 18 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="#FAFAFA"/>
        <path d="M 14 18 L 34 18 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
        <ellipse cx="24" cy="18" rx="10" ry="2" fill={FC.milkBlue}/>
        <rect x="18" y="24" width="12" height="10" fill="#F2F4F7" rx="1"/>
        <text x="24" y="31" fontFamily="sans-serif" fontSize="5" fontWeight="800" fill={FC.milkBlue} textAnchor="middle">CREMA</text>
      </g>
    ),
  };

  Object.assign(window.FOOD_ICONS, newIcons);
  }
  register();
})();
