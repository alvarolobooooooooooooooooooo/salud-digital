/* Batch 3: Fats + Typical + Drinks + Snacks + Postres + Condiments */
(() => {
  function register() {
    if (!window.FOOD_ICONS) { setTimeout(register, 50); return; }
  const FC = {
    leaf:'#5A8C3E', leafDark:'#3D6B2A', leafLight:'#7DAA52',
    meat:'#B5573E', meatDark:'#8C3F2C',
    chicken:'#D9A56B', chickenDark:'#A06D3F',
    tortilla:'#F2D9A3', tortillaDark:'#C9A567',
    beans:'#7A3E2E', beansDark:'#582718',
    cheese:'#F2DC8A', cheeseDark:'#C9B05A',
    yolk:'#E8A93C', plantain:'#E8C04A',
    bowlOuter:'#B8BFC9', bowlInner:'#E5E8EC',
    plateOuter:'#C9CFD7', plateInner:'#F2F4F7',
    rice:'#FAFAF5',
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

  const Glass = ({ liquid, label, labelColor, foam, gas }) => (
    <g>
      <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#5A7A92" opacity="0.3"/>
      <path d="M 14 10 L 34 10 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="#FAFAFA" opacity="0.6"/>
      <path d="M 14 10 L 34 10 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="none" stroke="#7AA0BC" strokeWidth="1.2"/>
      <path d="M 16 16 L 32 16 L 31 36 Q 31 38 29 38 L 19 38 Q 17 38 17 36 Z" fill={liquid}/>
      {foam && <ellipse cx="24" cy="16" rx="8" ry="1.5" fill="#FAFAEA"/>}
      {gas && [22,24,26,28].map(x => <circle key={x} cx={x} cy={20+x%4} r="0.6" fill="#FAFAFA" opacity="0.7"/>)}
      <path d="M 19 12 L 19 36" stroke="#FFFFFF" strokeWidth="2" opacity="0.4"/>
      {label && <text x="24" y="28" fontFamily="sans-serif" fontSize="5.5" fontWeight="700" fill={labelColor || "#FFFFFF"} textAnchor="middle">{label}</text>}
    </g>
  );

  const Cup = ({ liquid, foam, steam }) => (
    <g>
      <ellipse cx="22" cy="40" rx="12" ry="1.5" fill="#5A4828" opacity="0.3"/>
      <path d="M 10 18 L 34 18 L 32 38 Q 32 40 30 40 L 14 40 Q 12 40 12 38 Z" fill="#FAFAFA"/>
      <path d="M 10 18 L 34 18 L 32 38 Q 32 40 30 40 L 14 40 Q 12 40 12 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
      <path d="M 34 22 Q 42 22 42 28 Q 42 34 34 34" fill="none" stroke="#B8BFC9" strokeWidth="1.5"/>
      <ellipse cx="22" cy="20" rx="11" ry="2" fill={liquid}/>
      {foam && <ellipse cx="22" cy="19" rx="10" ry="1.5" fill="#FAFAEA"/>}
      {steam && (
        <g opacity="0.6">
          <path d="M 16 14 Q 17 10 16 6" stroke="#B8BFC9" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M 22 12 Q 23 8 22 4" stroke="#B8BFC9" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M 28 14 Q 29 10 28 6" stroke="#B8BFC9" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        </g>
      )}
    </g>
  );

  const Bottle = ({ liquid, capColor, label, labelColor }) => (
    <g>
      <ellipse cx="24" cy="40" rx="9" ry="1.5" fill="#5A4828" opacity="0.3"/>
      <rect x="21" y="6" width="6" height="6" fill={capColor || '#3A3A3A'} rx="0.5"/>
      <path d="M 20 12 L 28 12 L 28 16 L 30 18 L 30 38 Q 30 40 28 40 L 20 40 Q 18 40 18 38 L 18 18 L 20 16 Z" fill="#E5E8EC" opacity="0.5"/>
      <path d="M 20 12 L 28 12 L 28 16 L 30 18 L 30 38 Q 30 40 28 40 L 20 40 Q 18 40 18 38 L 18 18 L 20 16 Z" fill="none" stroke="#7AA0BC" strokeWidth="1.2"/>
      <path d="M 19 20 L 29 20 L 29 36 Q 29 38 27 38 L 21 38 Q 19 38 19 36 Z" fill={liquid}/>
      <rect x="19" y="24" width="10" height="8" fill="#FAFAFA" rx="1"/>
      {label && <text x="24" y="30" fontFamily="sans-serif" fontSize="5" fontWeight="700" fill={labelColor || liquid} textAnchor="middle">{label}</text>}
    </g>
  );

  const Can = ({ topColor, bodyColor, label, labelColor }) => (
    <g>
      <ellipse cx="24" cy="40" rx="9" ry="1.5" fill="#5A4A28" opacity="0.3"/>
      <ellipse cx="24" cy="12" rx="9" ry="2.5" fill={topColor}/>
      <path d="M 15 12 L 33 12 L 33 38 Q 33 40 31 40 L 17 40 Q 15 40 15 38 Z" fill={bodyColor}/>
      <path d="M 15 12 L 33 12 L 33 38 Q 33 40 31 40 L 17 40 Q 15 40 15 38 Z" fill="none" stroke="#1A2235" strokeWidth="1.2" opacity="0.4"/>
      <path d="M 17 16 L 17 36" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.3"/>
      {label && <text x="24" y="28" fontFamily="sans-serif" fontSize="6" fontWeight="800" fill={labelColor || "#FFFFFF"} textAnchor="middle">{label}</text>}
    </g>
  );

  const Bag = ({ body, label, labelColor }) => (
    <g>
      <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#5A4828" opacity="0.3"/>
      <path d="M 14 8 L 34 8 L 36 16 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 L 12 16 Z" fill={body}/>
      <path d="M 14 8 L 34 8 L 36 16 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 L 12 16 Z" fill="none" stroke="#1A2235" strokeWidth="1.2" opacity="0.4"/>
      <path d="M 12 12 L 36 12" stroke="#1A2235" strokeWidth="0.6" opacity="0.3"/>
      <path d="M 18 8 L 18 6 L 30 6 L 30 8" stroke="#1A2235" strokeWidth="1" fill="none" opacity="0.6"/>
      <rect x="16" y="20" width="16" height="10" fill="#FAFAFA" rx="1" opacity="0.95"/>
      {label && <text x="24" y="27" fontFamily="sans-serif" fontSize="6" fontWeight="800" fill={labelColor || body} textAnchor="middle">{label}</text>}
    </g>
  );

  const newIcons = {
    // ===== GRASAS =====
    'aceite-vegetal': (
      <Bottle liquid="#F2DC8A" capColor="#A87520" label="VEGETAL" labelColor="#A87520"/>
    ),
    'aceite-coco': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <path d="M 14 18 L 34 18 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="#FAFAFA"/>
        <path d="M 14 18 L 34 18 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
        <rect x="20" y="14" width="8" height="6" fill="#FAFAFA" stroke="#B8BFC9" strokeWidth="1.2" rx="1"/>
        <rect x="18" y="24" width="12" height="10" fill="#5A3818" rx="1"/>
        <text x="24" y="31" fontFamily="sans-serif" fontSize="5" fontWeight="800" fill="#FAFAFA" textAnchor="middle">COCO</text>
      </g>
    ),
    'margarina': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#7A6228" opacity="0.3"/>
        <rect x="10" y="14" width="28" height="24" fill="#E89B5A" stroke="#A86528" strokeWidth="1.2" rx="2"/>
        <rect x="14" y="18" width="20" height="14" fill="#FAFAFA" rx="1"/>
        <text x="24" y="27" fontFamily="sans-serif" fontSize="6" fontWeight="800" fill="#A86528" textAnchor="middle">MARG.</text>
      </g>
    ),
    'manteca': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#A89478" opacity="0.3"/>
        <ellipse cx="24" cy="24" rx="14" ry="11" fill="#FAFAFA"/>
        <ellipse cx="24" cy="24" rx="14" ry="11" fill="none" stroke="#D9D0B8" strokeWidth="1.2"/>
        <ellipse cx="24" cy="22" rx="12" ry="8" fill="#FFFFFF" opacity="0.7"/>
        <text x="24" y="36" fontFamily="sans-serif" fontSize="5" fontWeight="700" fill="#8C7028" textAnchor="middle">MANTECA</text>
      </g>
    ),
    'mani-crema': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#5A3818" opacity="0.3"/>
        <ellipse cx="24" cy="10" rx="10" ry="2.5" fill="#7A2A18"/>
        <path d="M 14 10 L 34 10 L 33 38 Q 33 40 31 40 L 17 40 Q 15 40 15 38 Z" fill="#A88847"/>
        <path d="M 14 10 L 34 10 L 33 38 Q 33 40 31 40 L 17 40 Q 15 40 15 38 Z" fill="none" stroke="#5A3818" strokeWidth="1.2"/>
        <rect x="16" y="18" width="16" height="16" fill="#FAFAEA" rx="1"/>
        <text x="24" y="25" fontFamily="sans-serif" fontSize="5" fontWeight="800" fill="#7A4818" textAnchor="middle">CREMA</text>
        <text x="24" y="31" fontFamily="sans-serif" fontSize="5" fontWeight="800" fill="#7A4818" textAnchor="middle">DE MANÍ</text>
      </g>
    ),
    'almendras': (
      <Plate>
        {[[14,22,30],[20,20,-10],[26,22,20],[32,20,-15],[18,26,5],[28,26,-20],[24,24,15]].map(([cx,cy,rot],i) => (
          <g key={i} transform={`rotate(${rot} ${cx} ${cy})`}>
            <ellipse cx={cx} cy={cy} rx="3" ry="1.8" fill="#A8744A"/>
            <ellipse cx={cx} cy={cy} rx="3" ry="1.8" fill="none" stroke="#5A2818" strokeWidth="0.5"/>
            <ellipse cx={cx-0.5} cy={cy-0.3} rx="1.5" ry="0.7" fill="#C9A56B" opacity="0.7"/>
          </g>
        ))}
      </Plate>
    ),
    'nueces': (
      <Plate>
        {[[16,22],[26,22],[18,26],[30,24]].map(([cx,cy],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="3.5" fill="#A88056"/>
            <circle cx={cx} cy={cy} r="3.5" fill="none" stroke="#5A3818" strokeWidth="0.6"/>
            {/* brain texture */}
            <path d={`M ${cx-2} ${cy-2} Q ${cx} ${cy-3} ${cx+2} ${cy-2} M ${cx-2} ${cy+2} Q ${cx} ${cy+3} ${cx+2} ${cy+2}`} stroke="#5A3818" strokeWidth="0.4" fill="none"/>
            <path d={`M ${cx} ${cy-3} L ${cx} ${cy+3}`} stroke="#5A3818" strokeWidth="0.5"/>
            <path d={`M ${cx-3} ${cy} L ${cx-1} ${cy} M ${cx+1} ${cy} L ${cx+3} ${cy}`} stroke="#5A3818" strokeWidth="0.4"/>
          </g>
        ))}
      </Plate>
    ),
    'pistachos': (
      <Plate>
        {[[14,22],[20,20],[26,22],[32,20],[18,26],[28,26]].map(([cx,cy],i) => (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx="3.5" ry="2.5" fill="#E0C99A"/>
            <ellipse cx={cx} cy={cy} rx="3.5" ry="2.5" fill="none" stroke="#A88847" strokeWidth="0.5"/>
            <ellipse cx={cx} cy={cy} rx="2" ry="1.5" fill="#7DAA52"/>
            <path d={`M ${cx-2} ${cy} L ${cx+2} ${cy}`} stroke="#A88847" strokeWidth="0.4"/>
          </g>
        ))}
      </Plate>
    ),
    'marañon': (
      <Plate>
        {[[14,22,-20],[20,20,30],[26,22,-15],[32,20,40],[18,26,10]].map(([cx,cy,rot],i) => (
          <g key={i} transform={`rotate(${rot} ${cx} ${cy})`}>
            <path d={`M ${cx-4} ${cy} Q ${cx-3} ${cy-3} ${cx} ${cy-2} Q ${cx+3} ${cy-1} ${cx+4} ${cy+1} Q ${cx+1} ${cy+3} ${cx-2} ${cy+2} Q ${cx-4} ${cy+1} ${cx-4} ${cy} Z`} fill="#E0C99A"/>
            <path d={`M ${cx-4} ${cy} Q ${cx-3} ${cy-3} ${cx} ${cy-2} Q ${cx+3} ${cy-1} ${cx+4} ${cy+1} Q ${cx+1} ${cy+3} ${cx-2} ${cy+2} Q ${cx-4} ${cy+1} ${cx-4} ${cy} Z`} fill="none" stroke="#A88847" strokeWidth="0.5"/>
          </g>
        ))}
      </Plate>
    ),
    'semillas-chia': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <path d="M 8 36 Q 12 24 24 22 Q 36 24 40 36 Z" fill="#3A2818"/>
        <path d="M 8 36 Q 12 24 24 22 Q 36 24 40 36 Z" fill="none" stroke="#1A1208" strokeWidth="1"/>
        {[14,18,22,26,30,34].map(x => (
          [28,32].map(y => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="0.7" ry="0.4" fill="#2A1A10" transform={`rotate(${(x*y)%180} ${x} ${y})`}/>
          ))
        ))}
        {[16,20,24,28,32].map(x => (
          <ellipse key={`top-${x}`} cx={x+(x%3)} cy={26} rx="0.7" ry="0.4" fill="#5A4030" transform={`rotate(${x*5} ${x} 26)`}/>
        ))}
      </g>
    ),
    'semillas-linaza': (
      <Bowl fill="#A87520" dark="#7A5018">
        {[14,17,20,23,26,29,32].map(x => (
          [21,23].map(y => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1.2" ry="0.5" fill="#5A3818" transform={`rotate(${x*5} ${x} ${y})`}/>
          ))
        ))}
      </Bowl>
    ),
    'semillas-girasol': (
      <Plate>
        {[[14,22,30],[20,20,-15],[26,22,20],[32,20,-10],[18,26,15],[28,26,-25],[24,24,5]].map(([cx,cy,rot],i) => (
          <g key={i} transform={`rotate(${rot} ${cx} ${cy})`}>
            <path d={`M ${cx} ${cy-3} L ${cx-2} ${cy} L ${cx} ${cy+3} L ${cx+2} ${cy} Z`} fill="#3A2818" stroke="#1A1208" strokeWidth="0.5"/>
            <path d={`M ${cx} ${cy-2.5} L ${cx-1} ${cy} L ${cx} ${cy+2.5}`} stroke="#5A4030" strokeWidth="0.3" fill="none"/>
          </g>
        ))}
      </Plate>
    ),
    'aceitunas': (
      <Bowl fill="#3A6850" dark="#2A4838">
        {[[16,22],[20,21],[24,22],[28,21],[32,22],[18,24],[22,24],[26,24],[30,24]].map(([cx,cy],i) => (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx="2" ry="1.4" fill="#7DAA8E"/>
            <ellipse cx={cx} cy={cy} rx="2" ry="1.4" fill="none" stroke="#3A5828" strokeWidth="0.4"/>
            <circle cx={cx+0.5} cy={cy+0.2} r="0.5" fill="#D14635"/>
          </g>
        ))}
      </Bowl>
    ),

    // ===== TYPICAL ===== 
    'baleada-super': (
      <g>
        <ellipse cx="24" cy="38" rx="18" ry="2" fill="#7A5A28" opacity="0.3"/>
        <path d="M 8 26 Q 8 14 24 12 Q 40 14 40 26 Q 40 32 24 32 Q 8 32 8 26 Z" fill="#F5E5C2"/>
        <path d="M 8 26 Q 8 14 24 12 Q 40 14 40 26 Q 40 32 24 32 Q 8 32 8 26 Z" fill="none" stroke="#A88847" strokeWidth="1.2"/>
        <path d="M 12 20 Q 24 26 36 20" stroke="#A88847" strokeWidth="1" fill="none"/>
        {/* lots of fillings */}
        <circle cx="16" cy="20" r="2" fill={FC.meat}/>
        <circle cx="20" cy="20" r="2" fill={FC.yolk}/>
        <circle cx="24" cy="18" r="2" fill={FC.cheese}/>
        <circle cx="28" cy="20" r="2" fill="#5A8C3E"/>
        <circle cx="32" cy="20" r="2" fill={FC.beans}/>
        <ellipse cx="24" cy="22" rx="2" ry="1" fill={FC.beans}/>
        <path d="M 16 18 Q 18 16 20 18" stroke="#5A8C3E" strokeWidth="1" fill="none"/>
      </g>
    ),
    'sopa-res': (
      <Bowl fill="#A85838" dark="#7A3818">
        <ellipse cx="20" cy="22" rx="2.5" ry="1.3" fill={FC.meatDark}/>
        <ellipse cx="28" cy="22" rx="2.5" ry="1.3" fill={FC.meatDark}/>
        <circle cx="18" cy="24" r="0.8" fill="#E08745"/>
        <circle cx="30" cy="24" r="0.8" fill={FC.leafLight}/>
        <ellipse cx="24" cy="23" rx="2" ry="0.8" fill="#F2D89A"/>
        <path d="M 20 16 Q 21 12 20 8 M 28 16 Q 29 12 28 8" stroke="#B8BFC9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6"/>
      </Bowl>
    ),
    'sopa-caracol': (
      <Bowl fill="#7DAA8E" dark="#3A6850">
        {/* coconut milk swirl */}
        <ellipse cx="24" cy="22" rx="10" ry="1.5" fill="#FAFAEA" opacity="0.5"/>
        {/* snail shell */}
        <g transform="translate(22 22)">
          <circle r="3" fill="#8C5828" stroke="#5A3818" strokeWidth="0.5"/>
          <path d="M -2 0 Q 0 -2 2 0 Q 0 2 -2 0" stroke="#5A3818" strokeWidth="0.6" fill="none"/>
        </g>
        <circle cx="14" cy="23" r="1.5" fill="#E08745"/>
        <circle cx="32" cy="22" r="1.2" fill="#5A8C3E"/>
        <path d="M 20 16 Q 21 12 20 8 M 28 16 Q 29 12 28 8" stroke="#B8BFC9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6"/>
      </Bowl>
    ),
    'sopa-frijoles': (
      <Bowl fill="#582718" dark="#3A1808">
        {[[16,22],[22,22],[28,22],[32,22],[18,24],[24,24],[30,24]].map(([cx,cy],i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="1.5" ry="0.8" fill={FC.beans}/>
        ))}
        <ellipse cx="24" cy="23" rx="3" ry="0.6" fill="#F2DC8A" opacity="0.7"/>
        <path d="M 20 16 Q 21 12 20 8" stroke="#B8BFC9" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6"/>
      </Bowl>
    ),
    'nacatamal': (
      <g>
        <ellipse cx="24" cy="40" rx="16" ry="2" fill="#5A4A20" opacity="0.3"/>
        {/* bigger than tamal, more abundant */}
        <path d="M 8 12 Q 6 10 10 8 L 38 8 Q 42 10 40 12 L 42 38 Q 42 42 38 42 L 10 42 Q 6 42 6 38 Z" fill="#7A8E48"/>
        <path d="M 8 12 Q 6 10 10 8 L 38 8 Q 42 10 40 12 L 42 38 Q 42 42 38 42 L 10 42 Q 6 42 6 38 Z" fill="none" stroke="#3A5028" strokeWidth="1.2"/>
        {/* ties more decorative */}
        <path d="M 12 12 L 8 4 L 18 10" stroke="#5A4A20" strokeWidth="1.5" fill="none"/>
        <path d="M 36 12 L 40 4 L 30 10" stroke="#5A4A20" strokeWidth="1.5" fill="none"/>
        <path d="M 24 8 L 24 4" stroke="#5A4A20" strokeWidth="1.2"/>
        {/* contents visible */}
        <ellipse cx="24" cy="22" rx="10" ry="6" fill="#E8C56A" opacity="0.4"/>
        <path d="M 14 22 Q 24 18 34 22 M 14 30 Q 24 26 34 30" stroke="#3A5028" strokeWidth="0.5" opacity="0.6" fill="none"/>
      </g>
    ),
    'pupusa-queso': (
      <g>
        <ellipse cx="24" cy="36" rx="16" ry="2" fill="#7A5A28" opacity="0.3"/>
        <ellipse cx="24" cy="24" rx="16" ry="12" fill={FC.tortilla}/>
        <ellipse cx="24" cy="24" rx="16" ry="12" fill="none" stroke={FC.tortillaDark} strokeWidth="1.2"/>
        {/* lots of cheese visible */}
        <ellipse cx="20" cy="22" rx="2.5" ry="1" fill={FC.cheese} opacity="0.7"/>
        <ellipse cx="28" cy="24" rx="2.5" ry="1" fill={FC.cheese} opacity="0.7"/>
        <ellipse cx="24" cy="26" rx="2" ry="0.8" fill={FC.cheese} opacity="0.7"/>
        <circle cx="14" cy="20" r="1" fill="#A88847"/>
        <circle cx="32" cy="26" r="1.2" fill="#A88847"/>
        <circle cx="24" cy="18" r="0.8" fill="#A88847"/>
      </g>
    ),
    'pastelitos': (
      <Plate>
        {[[14,22],[24,20],[32,24]].map(([cx,cy],i) => (
          <g key={i}>
            <path d={`M ${cx-5} ${cy-3} L ${cx+5} ${cy-3} L ${cx+5} ${cy+3} L ${cx-5} ${cy+3} Z`} fill="#E8B872"/>
            <path d={`M ${cx-5} ${cy-3} L ${cx+5} ${cy-3} L ${cx+5} ${cy+3} L ${cx-5} ${cy+3} Z`} fill="none" stroke="#8C5828" strokeWidth="0.8"/>
            {/* crimp pattern */}
            <path d={`M ${cx-5} ${cy-3} L ${cx-4} ${cy-2} L ${cx-3} ${cy-3} L ${cx-2} ${cy-2} L ${cx-1} ${cy-3} L ${cx} ${cy-2} L ${cx+1} ${cy-3} L ${cx+2} ${cy-2} L ${cx+3} ${cy-3} L ${cx+4} ${cy-2} L ${cx+5} ${cy-3}`} stroke="#A87520" strokeWidth="0.5" fill="none"/>
            <line x1={cx} y1={cy-2} x2={cx} y2={cy+2} stroke="#A87520" strokeWidth="0.4"/>
          </g>
        ))}
      </Plate>
    ),
    'tacos-honduren': (
      <Plate>
        {[[14,22],[24,20],[34,22]].map(([cx,cy],i) => (
          <g key={i}>
            {/* taco shell */}
            <path d={`M ${cx-7} ${cy+4} Q ${cx-7} ${cy-4} ${cx} ${cy-4} Q ${cx+7} ${cy-4} ${cx+7} ${cy+4} L ${cx+7} ${cy+5} L ${cx-7} ${cy+5} Z`} fill={FC.tortilla} stroke={FC.tortillaDark} strokeWidth="0.6"/>
            {/* meat */}
            <ellipse cx={cx} cy={cy-1} rx="5" ry="1.2" fill={FC.meat}/>
            {/* lettuce */}
            <path d={`M ${cx-5} ${cy-3} Q ${cx} ${cy-4} ${cx+5} ${cy-3}`} stroke={FC.leaf} strokeWidth="1.2" fill="none"/>
            {/* cheese */}
            <circle cx={cx-2} cy={cy-2.5} r="0.5" fill={FC.cheese}/>
            <circle cx={cx+2} cy={cy-2.5} r="0.5" fill={FC.cheese}/>
          </g>
        ))}
      </Plate>
    ),
    'catrachas': (
      <Plate>
        {[[14,22],[24,20],[34,22]].map(([cx,cy],i) => (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx="6" ry="4" fill="#C9A567" stroke="#8C5828" strokeWidth="0.6"/>
            <ellipse cx={cx} cy={cy} rx="5" ry="3" fill={FC.beansDark}/>
            <ellipse cx={cx} cy={cy} rx="4" ry="2" fill="#FAFAEA"/>
            <circle cx={cx-1.5} cy={cy} r="0.7" fill={FC.cheese}/>
            <circle cx={cx+1.5} cy={cy} r="0.7" fill={FC.cheese}/>
            <circle cx={cx} cy={cy-1} r="0.6" fill={FC.cheese}/>
          </g>
        ))}
      </Plate>
    ),
    'yuca-chicharron': (
      <Plate>
        {/* yuca sticks */}
        <rect x="10" y="18" width="4" height="10" fill="#F2D89A" stroke="#A88847" strokeWidth="0.5" rx="1"/>
        <rect x="15" y="20" width="4" height="9" fill="#E8C56A" stroke="#A88847" strokeWidth="0.5" rx="1"/>
        <rect x="20" y="22" width="4" height="8" fill="#F2D89A" stroke="#A88847" strokeWidth="0.5" rx="1"/>
        {/* chicharrón pieces */}
        <path d="M 26 18 Q 32 16 36 20 Q 38 24 32 26 Q 26 24 26 18 Z" fill="#A8482A" stroke="#5A1808" strokeWidth="0.8"/>
        <path d="M 28 28 Q 34 26 36 30 Q 32 32 28 28 Z" fill="#8C2A18" stroke="#5A1808" strokeWidth="0.8"/>
        {/* repollo */}
        <path d="M 12 28 Q 16 26 20 28 M 22 30 Q 26 28 30 30" stroke={FC.leafLight} strokeWidth="1.5" fill="none"/>
      </Plate>
    ),
    'horchata': (
      <Glass liquid="#F5E5C2" label="HORCHATA" labelColor="#A88847"/>
    ),
    'atol-elote': (
      <Cup liquid="#F2DC8A" steam={true}/>
    ),
    'pan-yema': (
      <g>
        <ellipse cx="24" cy="38" rx="14" ry="2" fill="#7A5828" opacity="0.4"/>
        <path d="M 10 24 Q 10 14 24 12 Q 38 14 38 24 Q 38 36 24 36 Q 10 36 10 24 Z" fill={FC.yolk}/>
        <path d="M 10 24 Q 10 14 24 12 Q 38 14 38 24 Q 38 36 24 36 Q 10 36 10 24 Z" fill="none" stroke="#8C5828" strokeWidth="1.2"/>
        <ellipse cx="24" cy="18" rx="6" ry="2" fill="#E8B872" opacity="0.7"/>
        <path d="M 14 26 Q 24 28 34 26" stroke="#A87520" strokeWidth="0.6" fill="none"/>
      </g>
    ),
    'quesadillas-hn': (
      <Plate>
        <path d="M 8 28 L 24 18 L 40 28 L 40 30 L 8 30 Z" fill={FC.cheese}/>
        <path d="M 8 28 L 24 18 L 40 28 L 40 30 L 8 30 Z" fill="none" stroke={FC.cheeseDark} strokeWidth="1.2"/>
        <path d="M 8 28 L 40 28" stroke={FC.cheeseDark} strokeWidth="0.8"/>
        <circle cx="14" cy="26" r="0.6" fill="#A87520"/>
        <circle cx="22" cy="24" r="0.6" fill="#A87520"/>
        <circle cx="30" cy="26" r="0.6" fill="#A87520"/>
        {/* sugar topping */}
        <path d="M 14 22 Q 16 20 18 22 M 22 20 Q 24 18 26 20 M 30 22 Q 32 20 34 22" stroke="#FAFAEA" strokeWidth="1.5" fill="none" opacity="0.8"/>
      </Plate>
    ),
    'rosquillas-miel': (
      <Bowl fill="#A87520" dark="#7A5018">
        {[[16,22],[24,20],[32,22]].map(([cx,cy],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="4" fill="#C9A56B"/>
            <circle cx={cx} cy={cy} r="4" fill="none" stroke="#8C5828" strokeWidth="0.6"/>
            <circle cx={cx} cy={cy} r="1.2" fill="#8C5828"/>
            {/* miel drips */}
            <path d={`M ${cx-3} ${cy+3} Q ${cx-3} ${cy+5} ${cx-2} ${cy+5}`} stroke="#E8A93C" strokeWidth="0.8" fill="none"/>
          </g>
        ))}
      </Bowl>
    ),
    'tres-leches': (
      <Plate>
        {/* cake slice */}
        <path d="M 10 30 L 14 14 L 34 14 L 38 30 Z" fill="#FAEFC0" stroke="#A88847" strokeWidth="1"/>
        {/* layers */}
        <line x1="11" y1="22" x2="37" y2="22" stroke="#A88847" strokeWidth="0.5"/>
        <line x1="12" y1="27" x2="36" y2="27" stroke="#A88847" strokeWidth="0.5"/>
        {/* whipped cream top */}
        <path d="M 14 14 Q 18 10 22 14 Q 26 10 30 14 Q 34 10 34 14" fill="#FFFFFF" stroke="#D9D0B8" strokeWidth="0.8"/>
        {/* cherry */}
        <circle cx="24" cy="10" r="2.5" fill="#C73A3A"/>
        <path d="M 24 8 Q 26 5 28 6" stroke="#5A3E28" strokeWidth="0.8" fill="none"/>
        {/* milk soak drips */}
        <ellipse cx="20" cy="20" rx="2" ry="0.6" fill="#E0D0A8" opacity="0.6"/>
        <ellipse cx="28" cy="24" rx="2" ry="0.6" fill="#E0D0A8" opacity="0.6"/>
      </Plate>
    ),

    // ===== BEBIDAS =====
    'agua': (<Glass liquid="#C2DDE8" label=""/>),
    'agua-coco': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#3A1808" opacity="0.4"/>
        <ellipse cx="24" cy="22" rx="14" ry="16" fill="#5A3818"/>
        <ellipse cx="24" cy="22" rx="14" ry="16" fill="none" stroke="#3A1808" strokeWidth="1.2"/>
        {/* straw */}
        <rect x="22" y="4" width="3" height="20" fill="#D14635" stroke="#8C2A20" strokeWidth="0.6"/>
        <ellipse cx="23.5" cy="6" rx="1.5" ry="0.6" fill="#8C2A20"/>
        {/* coconut hairs */}
        {[0,60,120,180,240,300].map(a => {
          const rad = a * Math.PI / 180;
          return <line key={a} x1={24 + Math.cos(rad)*10} y1={22 + Math.sin(rad)*12} x2={24 + Math.cos(rad)*14} y2={22 + Math.sin(rad)*16} stroke="#3A1808" strokeWidth="0.4"/>;
        })}
      </g>
    ),
    'cafe-negro': (<Cup liquid="#3A2010" steam={true}/>),
    'cafe-leche': (<Cup liquid="#A8744A" steam={true}/>),
    'cafe-cremoso': (<Cup liquid="#C9A56B" foam={true} steam={true}/>),
    'te-verde': (<Cup liquid="#7DAA52" steam={true}/>),
    'te-negro': (<Cup liquid="#5A2818" steam={true}/>),
    'jugo-naranja': (<Glass liquid="#E0992E" label="NARANJA" labelColor="#7A4818"/>),
    'jugo-pina': (<Glass liquid="#F2DC8A" label="PIÑA" labelColor="#8C5828"/>),
    'jugo-mango': (<Glass liquid="#E89B3C" label="MANGO" labelColor="#7A3818"/>),
    'jugo-envasado': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <path d="M 16 8 L 32 8 L 34 14 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 L 14 14 Z" fill="#E0992E"/>
        <path d="M 16 8 L 32 8 L 34 14 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 L 14 14 Z" fill="none" stroke="#7A4818" strokeWidth="1.2"/>
        <path d="M 16 8 L 22 8 L 22 4 L 20 4 Z" fill="#FAFAFA" stroke="#7A4818" strokeWidth="0.8"/>
        <rect x="16" y="18" width="16" height="14" fill="#FAFAFA" rx="1"/>
        <text x="24" y="25" fontFamily="sans-serif" fontSize="5.5" fontWeight="800" fill="#7A4818" textAnchor="middle">JUGO</text>
        <circle cx="20" cy="29" r="1.5" fill="#E0992E"/>
        <circle cx="24" cy="29" r="1.5" fill="#E0992E"/>
        <circle cx="28" cy="29" r="1.5" fill="#E0992E"/>
      </g>
    ),
    'refresco-cola': (<Can topColor="#3A3A3A" bodyColor="#3A1808" label="COLA" labelColor="#FAFAFA"/>),
    'refresco-dieta': (<Can topColor="#3A3A3A" bodyColor="#7A1010" label="DIET" labelColor="#FAFAFA"/>),
    'refresco-natural': (<Glass liquid="#E89B3C" label="REFRESCO" labelColor="#7A3818"/>),
    'limonada': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#5A7028" opacity="0.3"/>
        <path d="M 14 10 L 34 10 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="#FAFAFA" opacity="0.5"/>
        <path d="M 14 10 L 34 10 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="none" stroke="#7AA0BC" strokeWidth="1.2"/>
        <path d="M 16 16 L 32 16 L 31 36 Q 31 38 29 38 L 19 38 Q 17 38 17 36 Z" fill="#F2DC8A"/>
        {/* lemon slice */}
        <circle cx="24" cy="14" r="3" fill="#F2DC8A" stroke="#A87520" strokeWidth="0.6"/>
        <path d="M 21 14 L 27 14 M 24 11 L 24 17" stroke="#A87520" strokeWidth="0.4"/>
        {/* bubbles */}
        <circle cx="22" cy="22" r="0.6" fill="#FAFAFA" opacity="0.8"/>
        <circle cx="26" cy="26" r="0.6" fill="#FAFAFA" opacity="0.8"/>
      </g>
    ),
    'gatorade': (<Bottle liquid="#5588B5" capColor="#E0992E" label="SPORT" labelColor="#5588B5"/>),
    'energizante': (<Can topColor="#3A3A3A" bodyColor="#7DAA52" label="ENERGY" labelColor="#3A5028"/>),
    'cerveza': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <path d="M 14 12 L 34 12 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="#FAFAFA" opacity="0.6"/>
        <path d="M 14 12 L 34 12 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="none" stroke="#A88847" strokeWidth="1.2"/>
        {/* beer */}
        <path d="M 16 18 L 32 18 L 31 36 Q 31 38 29 38 L 19 38 Q 17 38 17 36 Z" fill="#E0992E"/>
        {/* foam */}
        <ellipse cx="24" cy="14" rx="10" ry="3" fill="#FAFAEA"/>
        <ellipse cx="20" cy="12" rx="3" ry="1.5" fill="#FFFFFF"/>
        <ellipse cx="28" cy="13" rx="2" ry="1" fill="#FFFFFF"/>
        {/* bubbles */}
        <circle cx="22" cy="24" r="0.7" fill="#FAFAEA" opacity="0.7"/>
        <circle cx="26" cy="28" r="0.5" fill="#FAFAEA" opacity="0.7"/>
        <circle cx="24" cy="32" r="0.6" fill="#FAFAEA" opacity="0.7"/>
      </g>
    ),
    'cerveza-light': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <path d="M 14 12 L 34 12 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="#FAFAFA" opacity="0.6"/>
        <path d="M 14 12 L 34 12 L 32 38 Q 32 40 30 40 L 18 40 Q 16 40 16 38 Z" fill="none" stroke="#A88847" strokeWidth="1.2"/>
        <path d="M 16 18 L 32 18 L 31 36 Q 31 38 29 38 L 19 38 Q 17 38 17 36 Z" fill="#F2DC8A"/>
        <ellipse cx="24" cy="14" rx="10" ry="3" fill="#FAFAEA"/>
        <text x="24" y="30" fontFamily="sans-serif" fontSize="5" fontWeight="800" fill="#A87520" textAnchor="middle">LIGHT</text>
      </g>
    ),
    'vino-tinto': (
      <g>
        <ellipse cx="24" cy="40" rx="9" ry="1.5" fill="#3A1A28" opacity="0.4"/>
        {/* wine glass */}
        <path d="M 14 8 Q 14 22 24 22 Q 34 22 34 8 Z" fill="#FAFAFA" opacity="0.5"/>
        <path d="M 14 8 Q 14 22 24 22 Q 34 22 34 8 Z" fill="none" stroke="#7AA0BC" strokeWidth="1.2"/>
        {/* wine */}
        <path d="M 16 10 Q 16 20 24 20 Q 32 20 32 10 Z" fill="#5A1A28"/>
        {/* stem */}
        <rect x="23" y="22" width="2" height="14" fill="#FAFAFA" stroke="#7AA0BC" strokeWidth="0.8"/>
        {/* base */}
        <ellipse cx="24" cy="38" rx="6" ry="1" fill="#FAFAFA" stroke="#7AA0BC" strokeWidth="0.8"/>
      </g>
    ),
    'licor': (
      <g>
        <ellipse cx="24" cy="40" rx="9" ry="1.5" fill="#5A4828" opacity="0.3"/>
        {/* shot glass */}
        <path d="M 16 16 L 32 16 L 30 38 Q 30 40 28 40 L 20 40 Q 18 40 18 38 Z" fill="#FAFAFA" opacity="0.5"/>
        <path d="M 16 16 L 32 16 L 30 38 Q 30 40 28 40 L 20 40 Q 18 40 18 38 Z" fill="none" stroke="#A88847" strokeWidth="1.2"/>
        <path d="M 18 20 L 30 20 L 29 36 Q 29 38 27 38 L 21 38 Q 19 38 19 36 Z" fill="#A87520"/>
        <ellipse cx="24" cy="20" rx="6" ry="0.8" fill="#C9A56B"/>
      </g>
    ),
    'licuado-frutas': (
      <Glass liquid="#E8946A" label="LICUADO" labelColor="#A8482A" foam={true}/>
    ),
    'batido-proteina': (
      <Bottle liquid="#A8744A" capColor="#3A3A3A" label="PROTEÍNA" labelColor="#5A2818"/>
    ),
    'chocolate-caliente': (<Cup liquid="#5A2818" foam={true} steam={true}/>),

    // ===== SNACKS =====
    'papas-fritas-bolsa': (<Bag body="#F2DC8A" label="PAPAS" labelColor="#A87520"/>),
    'churros': (
      <Plate>
        {[[14,22,30],[20,20,-15],[26,22,20],[32,20,-10]].map(([cx,cy,rot],i) => (
          <g key={i} transform={`rotate(${rot} ${cx} ${cy})`}>
            <path d={`M ${cx-4} ${cy} L ${cx+4} ${cy}`} stroke="#E0992E" strokeWidth="3" strokeLinecap="round"/>
            <path d={`M ${cx-4} ${cy} L ${cx+4} ${cy}`} stroke="#8C5828" strokeWidth="0.4" strokeDasharray="1 1"/>
          </g>
        ))}
      </Plate>
    ),
    'palomitas': (
      <Bowl fill="#FAEFC0" dark="#D9D0B8">
        {[[14,20],[18,20],[22,20],[26,20],[30,20],[34,20],[16,22],[20,22],[24,22],[28,22],[32,22],[14,24],[20,24],[26,24],[32,24]].map(([cx,cy],i) => (
          <g key={i}>
            <path d={`M ${cx-1.5} ${cy-1} Q ${cx-2} ${cy-2} ${cx} ${cy-2} Q ${cx+2} ${cy-2} ${cx+1.5} ${cy-1} Q ${cx+2} ${cy} ${cx} ${cy+1} Q ${cx-2} ${cy} ${cx-1.5} ${cy-1} Z`} fill="#FAFAEA" stroke="#A88847" strokeWidth="0.3"/>
          </g>
        ))}
      </Bowl>
    ),
    'palomitas-mant': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="1.5" fill="#7A2A18" opacity="0.4"/>
        {/* striped popcorn bucket */}
        <path d="M 12 14 L 36 14 L 38 40 L 10 40 Z" fill="#FAFAFA"/>
        <path d="M 12 14 L 36 14 L 38 40 L 10 40 Z" fill="none" stroke="#A82010" strokeWidth="1.2"/>
        <path d="M 15 14 L 17 40 M 21 14 L 22 40 M 27 14 L 26 40 M 33 14 L 31 40" stroke="#D14635" strokeWidth="2.5"/>
        {/* popcorn on top */}
        {[[14,12],[18,10],[22,12],[26,10],[30,12],[34,10]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="2.5" fill="#FAEFC0" stroke="#A88847" strokeWidth="0.3"/>
        ))}
      </g>
    ),
    'galletas-dulces': (
      <Plate>
        {[[14,22],[26,20],[32,24]].map(([cx,cy],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="5" fill="#D9B176" stroke="#8C5828" strokeWidth="0.6"/>
            <circle cx={cx-2} cy={cy-1} r="0.8" fill="#5A3818"/>
            <circle cx={cx+2} cy={cy+1} r="0.8" fill="#5A3818"/>
            <circle cx={cx+1} cy={cy-2} r="0.6" fill="#5A3818"/>
            <circle cx={cx-1} cy={cy+2} r="0.6" fill="#5A3818"/>
          </g>
        ))}
      </Plate>
    ),
    'galletas-relleno': (
      <Plate>
        {[[14,22],[26,20],[32,24]].map(([cx,cy],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="5" fill="#3A2010" stroke="#1A1208" strokeWidth="0.6"/>
            <circle cx={cx} cy={cy} r="3.5" fill="#3A2010" stroke="#FAFAFA" strokeWidth="0.8"/>
            <text x={cx} y={cy+1} fontFamily="sans-serif" fontSize="3.5" fontWeight="800" fill="#FAFAFA" textAnchor="middle">OREO</text>
          </g>
        ))}
      </Plate>
    ),
    'chocolate': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="1.5" fill="#3A1808" opacity="0.4"/>
        {/* bar */}
        <rect x="10" y="16" width="28" height="20" fill="#7A4818" stroke="#3A1808" strokeWidth="1.2"/>
        {/* squares grid */}
        {[10,18,26,34].map(x => (
          [16,26].map(y => (
            <rect key={`${x}-${y}`} x={x} y={y} width="6" height="8" fill="none" stroke="#3A1808" strokeWidth="0.8"/>
          ))
        ))}
        {/* shine */}
        <rect x="12" y="18" width="2" height="16" fill="#A8744A" opacity="0.4"/>
      </g>
    ),
    'helado': (
      <g>
        <ellipse cx="24" cy="40" rx="9" ry="1.5" fill="#5A4828" opacity="0.3"/>
        {/* cone */}
        <path d="M 16 22 L 32 22 L 24 40 Z" fill="#D9B176"/>
        <path d="M 16 22 L 32 22 L 24 40 Z" fill="none" stroke="#8C5828" strokeWidth="0.8"/>
        {/* waffle pattern */}
        <path d="M 18 26 L 22 22 M 22 30 L 26 22 M 26 30 L 30 22 M 22 36 L 28 26" stroke="#A87520" strokeWidth="0.4"/>
        {/* ice cream scoop */}
        <circle cx="24" cy="18" r="9" fill="#F5C2D4"/>
        <circle cx="24" cy="18" r="9" fill="none" stroke="#C97AA0" strokeWidth="0.8"/>
        <path d="M 18 14 Q 22 12 26 14 Q 30 12 30 16" stroke="#FAFAEA" strokeWidth="1" fill="none" opacity="0.7"/>
        {/* cherry */}
        <circle cx="24" cy="10" r="2" fill="#C73A3A"/>
        <path d="M 24 8 L 26 6" stroke="#5A3E28" strokeWidth="0.8"/>
      </g>
    ),
    'paleta': (
      <g>
        <ellipse cx="24" cy="42" rx="9" ry="1.5" fill="#5A4828" opacity="0.3"/>
        {/* stick */}
        <rect x="23" y="28" width="2" height="14" fill="#C9A56B" stroke="#8C5828" strokeWidth="0.4"/>
        {/* popsicle */}
        <path d="M 14 8 Q 14 6 16 6 L 32 6 Q 34 6 34 8 L 34 28 Q 34 30 32 30 L 16 30 Q 14 30 14 28 Z" fill="#D14635"/>
        <path d="M 14 8 Q 14 6 16 6 L 32 6 Q 34 6 34 8 L 34 28 Q 34 30 32 30 L 16 30 Q 14 30 14 28 Z" fill="none" stroke="#8C2A20" strokeWidth="1.2"/>
        <path d="M 18 8 L 18 28 M 24 6 L 24 28 M 30 8 L 30 28" stroke="#FFFFFF" strokeWidth="1" opacity="0.4"/>
      </g>
    ),

    // ===== POSTRES =====
    'flan': (
      <Plate>
        {/* caramel base */}
        <path d="M 14 22 Q 14 18 24 18 Q 34 18 34 22 Q 34 26 24 28 Q 14 26 14 22 Z" fill="#A87520" stroke="#5A3818" strokeWidth="0.8"/>
        {/* flan top */}
        <path d="M 14 22 Q 14 18 24 18 Q 34 18 34 22" fill="#FAEFC0" stroke="#A88847" strokeWidth="0.6"/>
        <ellipse cx="24" cy="20" rx="9" ry="1.8" fill="#F2DC8A"/>
        {/* caramel sauce dripping */}
        <path d="M 12 22 Q 10 24 12 26 Q 14 25 16 24" fill="#7A5018"/>
        <path d="M 36 22 Q 38 24 36 26 Q 34 25 32 24" fill="#7A5018"/>
      </Plate>
    ),
    'gelatina': (
      <g>
        <ellipse cx="24" cy="40" rx="14" ry="1.5" fill="#5A1A28" opacity="0.3"/>
        {/* wobbly cube */}
        <path d="M 12 36 Q 12 12 16 12 L 32 12 Q 36 12 36 36 Z" fill="#D14672" opacity="0.85"/>
        <path d="M 12 36 Q 12 12 16 12 L 32 12 Q 36 12 36 36 Z" fill="none" stroke="#8C2A48" strokeWidth="1.2"/>
        {/* top reflection */}
        <ellipse cx="24" cy="14" rx="9" ry="2" fill="#E8718A"/>
        {/* wobble lines */}
        <path d="M 14 22 Q 24 20 34 22" stroke="#FAFAEA" strokeWidth="0.5" fill="none" opacity="0.5"/>
        <path d="M 14 28 Q 24 26 34 28" stroke="#FAFAEA" strokeWidth="0.5" fill="none" opacity="0.5"/>
      </g>
    ),
    'pastel': (
      <Plate>
        <path d="M 10 32 L 14 14 L 34 14 L 38 32 Z" fill="#5A2818"/>
        <path d="M 10 32 L 14 14 L 34 14 L 38 32 Z" fill="none" stroke="#3A1008" strokeWidth="1"/>
        {/* layers */}
        <line x1="11" y1="22" x2="37" y2="22" stroke="#FAFAEA" strokeWidth="1"/>
        <line x1="12" y1="27" x2="36" y2="27" stroke="#FAFAEA" strokeWidth="1"/>
        {/* chocolate frosting top */}
        <path d="M 14 14 Q 18 10 22 14 Q 26 10 30 14 Q 34 10 34 14" fill="#3A1008" stroke="#1A0808" strokeWidth="0.8"/>
        {/* cherry */}
        <circle cx="24" cy="10" r="2.5" fill="#C73A3A"/>
        <path d="M 24 8 Q 26 5 28 6" stroke="#5A3E28" strokeWidth="0.8" fill="none"/>
      </Plate>
    ),
    'donas': (
      <Plate>
        <circle cx="24" cy="22" r="10" fill="#D9B176"/>
        <circle cx="24" cy="22" r="10" fill="none" stroke="#8C5828" strokeWidth="1"/>
        <circle cx="24" cy="22" r="3" fill={FC.plateInner}/>
        <circle cx="24" cy="22" r="3" fill="none" stroke="#8C5828" strokeWidth="0.6"/>
        {/* pink glaze */}
        <path d="M 14 22 Q 24 12 34 22 Q 32 24 28 22 Q 24 18 20 22 Q 16 24 14 22 Z" fill="#F5C2D4" stroke="#C97AA0" strokeWidth="0.6"/>
        {/* sprinkles */}
        {[[18,18,30],[22,16,-20],[26,16,40],[30,18,-10],[20,22,15],[28,22,-25]].map(([cx,cy,rot],i) => (
          <rect key={i} x={cx-1} y={cy-0.3} width="2" height="0.6" fill={['#D14635','#E0992E','#7DAA52','#5588B5','#C73A7A'][i % 5]} transform={`rotate(${rot} ${cx} ${cy})`}/>
        ))}
      </Plate>
    ),
    'cheesecake': (
      <Plate>
        {/* base */}
        <path d="M 10 30 L 14 18 L 34 18 L 38 30 Z" fill="#FAEFC0" stroke="#A88847" strokeWidth="0.8"/>
        {/* crust */}
        <path d="M 10 30 L 14 26 L 34 26 L 38 30" fill="#8C5828" stroke="#5A3018" strokeWidth="0.6"/>
        {/* strawberry topping */}
        <path d="M 16 16 Q 24 14 32 18 L 32 20 Q 24 16 16 18 Z" fill="#D14672" stroke="#8C2A48" strokeWidth="0.6"/>
        <circle cx="20" cy="16" r="1.2" fill="#C73A3A"/>
        <circle cx="28" cy="16" r="1.2" fill="#C73A3A"/>
      </Plate>
    ),

    // ===== CONDIMENTOS =====
    'azucar-blanca': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#5A4828" opacity="0.3"/>
        <path d="M 12 14 L 36 14 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 Z" fill="#FAFAFA"/>
        <path d="M 12 14 L 36 14 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
        <rect x="12" y="14" width="24" height="6" fill="#C9CFD7"/>
        <rect x="16" y="22" width="16" height="14" fill="#F2F4F7" rx="1"/>
        <text x="24" y="31" fontFamily="sans-serif" fontSize="5.5" fontWeight="800" fill="#7AA0BC" textAnchor="middle">AZÚCAR</text>
      </g>
    ),
    'azucar-morena': (
      <g>
        <ellipse cx="24" cy="40" rx="13" ry="1.5" fill="#5A3818" opacity="0.3"/>
        <path d="M 12 28 Q 16 16 24 14 Q 32 16 36 28 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="#A87520"/>
        <path d="M 12 28 Q 16 16 24 14 Q 32 16 36 28 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 Z" fill="none" stroke="#5A3018" strokeWidth="1.2"/>
        {[[16,22],[20,20],[24,18],[28,20],[32,22]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="0.8" fill="#5A3018"/>
        ))}
      </g>
    ),
    'miel': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#7A4818" opacity="0.4"/>
        {/* jar */}
        <path d="M 14 14 L 34 14 L 34 16 L 36 18 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 L 12 18 L 14 16 Z" fill="#FAFAFA" opacity="0.6"/>
        <path d="M 14 14 L 34 14 L 34 16 L 36 18 L 36 38 Q 36 40 34 40 L 14 40 Q 12 40 12 38 L 12 18 L 14 16 Z" fill="none" stroke="#7AA0BC" strokeWidth="1.2"/>
        {/* honey */}
        <path d="M 14 18 L 34 18 L 34 36 Q 34 38 32 38 L 16 38 Q 14 38 14 36 Z" fill="#E8A93C"/>
        {/* dipper */}
        <rect x="22" y="6" width="4" height="10" fill="#A87520" stroke="#5A3818" strokeWidth="0.5"/>
        <ellipse cx="24" cy="14" rx="3" ry="2" fill="#A87520" stroke="#5A3818" strokeWidth="0.5"/>
        {/* honeycomb pattern visible */}
        <path d="M 18 24 L 22 22 L 22 26 L 18 28 Z M 22 26 L 26 24 L 26 28 L 22 30 Z" fill="#C28823" opacity="0.5"/>
      </g>
    ),
    'sal': (
      <g>
        <ellipse cx="24" cy="40" rx="10" ry="1.5" fill="#5A4828" opacity="0.3"/>
        {/* shaker */}
        <path d="M 18 14 L 30 14 L 30 12 L 18 12 Z" fill="#C9CFD7" stroke="#7AA0BC" strokeWidth="1.2"/>
        <path d="M 16 16 L 32 16 L 30 38 Q 30 40 28 40 L 20 40 Q 18 40 18 38 Z" fill="#FAFAFA"/>
        <path d="M 16 16 L 32 16 L 30 38 Q 30 40 28 40 L 20 40 Q 18 40 18 38 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
        <circle cx="21" cy="14" r="0.8" fill="#5A4828"/>
        <circle cx="24" cy="14" r="0.8" fill="#5A4828"/>
        <circle cx="27" cy="14" r="0.8" fill="#5A4828"/>
        <rect x="19" y="22" width="10" height="12" fill="#F2F4F7" stroke="#B8BFC9" strokeWidth="0.6" rx="1"/>
        <text x="24" y="30" fontFamily="sans-serif" fontSize="6" fontWeight="800" fill="#7AA0BC" textAnchor="middle">SAL</text>
      </g>
    ),
    'edulcorante': (
      <g>
        <ellipse cx="24" cy="40" rx="12" ry="1.5" fill="#5A4828" opacity="0.3"/>
        {/* sachet */}
        <path d="M 10 14 L 38 14 L 38 38 L 10 38 Z" fill="#5588B5"/>
        <path d="M 10 14 L 38 14 L 38 38 L 10 38 Z" fill="none" stroke="#2A4868" strokeWidth="1.2"/>
        <path d="M 10 14 L 14 10 L 38 14 M 10 14 L 14 18" stroke="#2A4868" strokeWidth="0.8" fill="none"/>
        <text x="24" y="26" fontFamily="sans-serif" fontSize="5.5" fontWeight="800" fill="#FAFAFA" textAnchor="middle">EDULCO-</text>
        <text x="24" y="32" fontFamily="sans-serif" fontSize="5.5" fontWeight="800" fill="#FAFAFA" textAnchor="middle">RANTE</text>
      </g>
    ),
    'salsa-tomate': (
      <Bottle liquid="#D14635" capColor="#A82010" label="KETCHUP" labelColor="#A82010"/>
    ),
    'mayonesa': (
      <g>
        <ellipse cx="24" cy="40" rx="11" ry="1.5" fill="#A89478" opacity="0.3"/>
        <rect x="20" y="6" width="8" height="6" fill="#5588B5" rx="0.5"/>
        <path d="M 16 12 L 32 12 L 32 16 L 34 18 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 L 14 18 L 16 16 Z" fill="#FAFAFA"/>
        <path d="M 16 12 L 32 12 L 32 16 L 34 18 L 34 38 Q 34 40 32 40 L 16 40 Q 14 40 14 38 L 14 18 L 16 16 Z" fill="none" stroke="#B8BFC9" strokeWidth="1.2"/>
        <rect x="16" y="22" width="16" height="12" fill="#5588B5" rx="1"/>
        <text x="24" y="30" fontFamily="sans-serif" fontSize="5" fontWeight="800" fill="#FAFAFA" textAnchor="middle">MAYO</text>
      </g>
    ),
    'mostaza': (
      <Bottle liquid="#E8A93C" capColor="#7A5018" label="MOSTAZA" labelColor="#7A5018"/>
    ),
    'salsa-soya': (
      <Bottle liquid="#3A1808" capColor="#C73A3A" label="SOYA" labelColor="#FAFAFA"/>
    ),
    'vinagre': (
      <Bottle liquid="#F2DC8A" capColor="#A87520" label="VINAGRE" labelColor="#A87520"/>
    ),
    'aderezo-cesar': (
      <Bottle liquid="#FAEFC0" capColor="#7AA0BC" label="CÉSAR" labelColor="#5A8C6E"/>
    ),
    'aderezo-ranch': (
      <Bottle liquid="#FAFAEA" capColor="#5A8C3E" label="RANCH" labelColor="#5A8C3E"/>
    ),
  };

  Object.assign(window.FOOD_ICONS, newIcons);
  }
  register();
})();
