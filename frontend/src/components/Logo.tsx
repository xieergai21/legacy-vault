interface LogoProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

export function Logo({ size = 65, animated = false, className = '' }: LogoProps) {
  return (
    <svg 
      className={`logo ${animated ? 'logo-animated' : ''} ${className}`}
      viewBox="0 0 800 700" 
      width={size} 
      height={size}
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e4d7b"/>
          <stop offset="100%" stopColor="#2a6ba8"/>
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4af37"/>
          <stop offset="50%" stopColor="#ffd700"/>
          <stop offset="100%" stopColor="#d4af37"/>
        </linearGradient>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd700" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#ffd700" stopOpacity="0"/>
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="strongGlow">
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <circle cx="400" cy="372" r="200" fill="url(#centerGlow)" opacity="0.4"/>
      
      <g stroke="url(#blueGrad)" strokeWidth="2" opacity="0.6">
        <line x1="400" y1="200" x2="355" y2="243"/><line x1="400" y1="200" x2="445" y2="243"/>
        <line x1="355" y1="243" x2="310" y2="286"/><line x1="355" y1="243" x2="400" y2="286"/>
        <line x1="445" y1="243" x2="400" y2="286"/><line x1="445" y1="243" x2="490" y2="286"/>
        <line x1="265" y1="329" x2="355" y2="329"/><line x1="355" y1="329" x2="445" y2="329"/><line x1="445" y1="329" x2="535" y2="329"/>
        <line x1="220" y1="372" x2="310" y2="372"/><line x1="310" y1="372" x2="400" y2="372"/><line x1="400" y1="372" x2="490" y2="372"/><line x1="490" y1="372" x2="580" y2="372"/>
        <line x1="265" y1="415" x2="355" y2="415"/><line x1="355" y1="415" x2="445" y2="415"/><line x1="445" y1="415" x2="535" y2="415"/>
        <line x1="310" y1="286" x2="265" y2="329"/><line x1="400" y1="286" x2="355" y2="329"/><line x1="400" y1="286" x2="445" y2="329"/><line x1="490" y1="286" x2="535" y2="329"/>
        <line x1="265" y1="329" x2="220" y2="372"/><line x1="355" y1="329" x2="310" y2="372"/><line x1="445" y1="329" x2="490" y2="372"/><line x1="535" y1="329" x2="580" y2="372"/>
        <line x1="220" y1="372" x2="265" y2="415"/><line x1="310" y1="372" x2="355" y2="415"/><line x1="490" y1="372" x2="445" y2="415"/><line x1="580" y1="372" x2="535" y2="415"/>
        <line x1="265" y1="415" x2="310" y2="458"/><line x1="355" y1="415" x2="400" y2="458"/><line x1="445" y1="415" x2="400" y2="458"/><line x1="535" y1="415" x2="490" y2="458"/>
        <line x1="310" y1="458" x2="355" y2="501"/><line x1="400" y1="458" x2="355" y2="501"/><line x1="400" y1="458" x2="445" y2="501"/><line x1="490" y1="458" x2="445" y2="501"/>
        <line x1="355" y1="501" x2="400" y2="544"/><line x1="445" y1="501" x2="400" y2="544"/>
      </g>
      
      <g filter="url(#glow)">
        <polygon points="400,172 428,188 428,220 400,236 372,220 372,188" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.5"/>
        <circle cx="400" cy="204" r="2" fill="#5a8fbd" opacity="0.4"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="355,215 383,231 383,263 355,279 327,263 327,231" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.6"/>
        <circle cx="355" cy="247" r="2" fill="#5a8fbd" opacity="0.5"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="445,215 473,231 473,263 445,279 417,263 417,231" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.6"/>
        <circle cx="445" cy="247" r="2" fill="#5a8fbd" opacity="0.5"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="310,258 338,274 338,306 310,322 282,306 282,274" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.7"/>
        <circle cx="310" cy="290" r="2" fill="#5a8fbd" opacity="0.6"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="400,258 428,274 428,306 400,322 372,306 372,274" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.7"/>
        <circle cx="400" cy="290" r="2" fill="#5a8fbd" opacity="0.6"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="490,258 518,274 518,306 490,322 462,306 462,274" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.7"/>
        <circle cx="490" cy="290" r="2" fill="#5a8fbd" opacity="0.6"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="265,301 293,317 293,349 265,365 237,349 237,317" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.8"/>
        <circle cx="265" cy="333" r="2" fill="#5a8fbd" opacity="0.7"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="355,301 383,317 383,349 355,365 327,349 327,317" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.8"/>
        <circle cx="355" cy="333" r="2" fill="#5a8fbd" opacity="0.7"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="445,301 473,317 473,349 445,365 417,349 417,317" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.8"/>
        <circle cx="445" cy="333" r="2" fill="#5a8fbd" opacity="0.7"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="535,301 563,317 563,349 535,365 507,349 507,317" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.8"/>
        <circle cx="535" cy="333" r="2" fill="#5a8fbd" opacity="0.7"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="220,344 248,360 248,392 220,408 192,392 192,360" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.9"/>
        <circle cx="220" cy="376" r="2" fill="#5a8fbd" opacity="0.8"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="310,344 338,360 338,392 310,408 282,392 282,360" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.9"/>
        <circle cx="310" cy="376" r="2" fill="#5a8fbd" opacity="0.8"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="490,344 518,360 518,392 490,408 462,392 462,360" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.9"/>
        <circle cx="490" cy="376" r="2" fill="#5a8fbd" opacity="0.8"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="580,344 608,360 608,392 580,408 552,392 552,360" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.9"/>
        <circle cx="580" cy="376" r="2" fill="#5a8fbd" opacity="0.8"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="265,387 293,403 293,435 265,451 237,435 237,403" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.8"/>
        <circle cx="265" cy="419" r="2" fill="#5a8fbd" opacity="0.7"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="355,387 383,403 383,435 355,451 327,435 327,403" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.8"/>
        <circle cx="355" cy="419" r="2" fill="#5a8fbd" opacity="0.7"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="445,387 473,403 473,435 445,451 417,435 417,403" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.8"/>
        <circle cx="445" cy="419" r="2" fill="#5a8fbd" opacity="0.7"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="535,387 563,403 563,435 535,451 507,435 507,403" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.8"/>
        <circle cx="535" cy="419" r="2" fill="#5a8fbd" opacity="0.7"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="310,430 338,446 338,478 310,494 282,478 282,446" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.7"/>
        <circle cx="310" cy="462" r="2" fill="#5a8fbd" opacity="0.6"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="400,430 428,446 428,478 400,494 372,478 372,446" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.7"/>
        <circle cx="400" cy="462" r="2" fill="#5a8fbd" opacity="0.6"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="490,430 518,446 518,478 490,494 462,478 462,446" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.7"/>
        <circle cx="490" cy="462" r="2" fill="#5a8fbd" opacity="0.6"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="355,473 383,489 383,521 355,537 327,521 327,489" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.6"/>
        <circle cx="355" cy="505" r="2" fill="#5a8fbd" opacity="0.5"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="445,473 473,489 473,521 445,537 417,521 417,489" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.6"/>
        <circle cx="445" cy="505" r="2" fill="#5a8fbd" opacity="0.5"/>
      </g>
      <g filter="url(#glow)">
        <polygon points="400,516 428,532 428,564 400,580 372,564 372,532" fill="url(#blueGrad)" fillOpacity="0.15" stroke="url(#blueGrad)" strokeWidth="2.5" opacity="0.5"/>
        <circle cx="400" cy="548" r="2" fill="#5a8fbd" opacity="0.4"/>
      </g>
      
      <g className="logo-center">
        <polygon points="400,340 444,365 444,415 400,440 356,415 356,365" fill="none" stroke="url(#goldGrad)" strokeWidth="1" opacity="0.3"/>
        <polygon points="400,348 436,369 436,411 400,432 364,411 364,369" fill="url(#goldGrad)" stroke="url(#goldGrad)" strokeWidth="2.5" filter="url(#strongGlow)"/>
        <circle cx="400" cy="387" r="8" fill="#070b14" opacity="0.95"/>
        <rect x="397" y="393" width="6" height="14" fill="#070b14" opacity="0.95"/>
      </g>
    </svg>
  );
}
