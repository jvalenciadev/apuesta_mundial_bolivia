import React from "react";

/**
 * Renderiza una bandera SVG premium para los países de la Copa Mundial 2026.
 * Esto asegura que se muestre correctamente en todos los sistemas operativos (incluyendo Windows).
 */
export function getFlagSVG(countryName: string): React.JSX.Element {
  const name = countryName.trim().toLowerCase();

  switch (name) {
    case "méxico":
    case "mexico":
      return (
        <svg viewBox="0 0 3 2" className="w-7 h-5 rounded shadow-sm inline-block border border-white/10" aria-label="Bandera de México">
          <rect width="1" height="2" fill="#006847" />
          <rect x="1" width="1" height="2" fill="#FFFFFF" />
          <rect x="2" width="1" height="2" fill="#CE1126" />
          {/* Escudo simplificado */}
          <circle cx="1.5" cy="1" r="0.15" fill="#8B5A2B" opacity="0.8" />
          <circle cx="1.5" cy="0.95" r="0.08" fill="#006847" />
        </svg>
      );

    case "sudáfrica":
    case "sudafrica":
      return (
        <svg viewBox="0 0 6 4" className="w-7 h-5 rounded shadow-sm inline-block border border-white/10" aria-label="Bandera de Sudáfrica">
          <rect width="6" height="4" fill="#002395" />
          <path d="M0,0 L6,0 L6,2 L0,2 Z" fill="#DE3831" />
          <path d="M0,0 L3,2 L0,4 Z" fill="#000000" />
          <path d="M0,0 L3.3,2.2 L6,2.2 L6,1.8 L3.3,1.8 L0,0 Z" fill="#FFFFFF" />
          <path d="M0,4 L3.3,1.8 L6,1.8 L6,2.2 L3.3,2.2 L0,4 Z" fill="#FFFFFF" />
          <path d="M0,0 M0,4 L3,2 Z" stroke="#FFB81C" strokeWidth="0.8" />
          <path d="M0,0 L2.7,1.8 L0,3.6 Z" fill="#000000" />
          <path d="M0,0.4 L2.4,2 L0,3.6 L0,2.4 L1.2,2 L0,1.6 Z" fill="#FFB81C" />
          <path d="M0,1.5 L2.2,2.0 L0,2.5 Z" stroke="#007A3D" strokeWidth="0.5" fill="#007A3D" />
          <path d="M0,1.6 L2.4,2 L0,2.4 L6,2.4 L6,1.6 Z" fill="#007A3D" />
          <path d="M2.4,2 L6,2" stroke="#FFFFFF" strokeWidth="0.4" />
        </svg>
      );

    case "corea del sur":
    case "corea":
      return (
        <svg viewBox="0 0 3 2" className="w-7 h-5 rounded shadow-sm inline-block border border-white/10 bg-white" aria-label="Bandera de Corea del Sur">
          <rect width="3" height="2" fill="#FFFFFF" />
          {/* Taegeuk */}
          <path d="M 1.5 0.65 A 0.35 0.35 0 0 1 1.5 1.35 A 0.175 0.175 0 0 1 1.5 1 A 0.175 0.175 0 0 0 1.5 0.65" fill="#CD2E3A" />
          <path d="M 1.5 1.35 A 0.35 0.35 0 0 1 1.5 0.65 A 0.175 0.175 0 0 1 1.5 1 A 0.175 0.175 0 0 0 1.5 1.35" fill="#0047A0" />
          {/* Trigramas simplificados */}
          <path d="M0.5,0.4 L0.7,0.6" stroke="#000" strokeWidth="0.08" strokeLinecap="round" />
          <path d="M0.45,0.45 L0.65,0.65" stroke="#000" strokeWidth="0.04" />
          <path d="M2.3,0.4 L2.5,0.6" stroke="#000" strokeWidth="0.08" strokeLinecap="round" />
          <path d="M0.5,1.4 L0.7,1.6" stroke="#000" strokeWidth="0.08" strokeLinecap="round" />
          <path d="M2.3,1.4 L2.5,1.6" stroke="#000" strokeWidth="0.08" strokeLinecap="round" />
        </svg>
      );

    case "chequia":
    case "república checa":
      return (
        <svg viewBox="0 0 3 2" className="w-7 h-5 rounded shadow-sm inline-block border border-white/10" aria-label="Bandera de Chequia">
          <rect width="3" height="1" fill="#FFFFFF" />
          <rect y="1" width="3" height="1" fill="#D7141A" />
          <polygon points="0,0 1.2,1 0,2" fill="#11457E" />
        </svg>
      );

    case "canadá":
    case "canada":
      return (
        <svg viewBox="0 0 2 1" className="w-7 h-5 rounded shadow-sm inline-block border border-white/10" aria-label="Bandera de Canadá">
          <rect width="2" height="1" fill="#FF0000" />
          <rect x="0.5" width="1" height="1" fill="#FFFFFF" />
          {/* Hoja de arce simplificada */}
          <path d="M 1 0.25 L 1.05 0.45 L 1.25 0.4 L 1.15 0.55 L 1.3 0.65 L 1.1 0.7 L 1.05 0.85 L 1 0.75 L 0.95 0.85 L 0.9 0.7 L 0.7 0.65 L 0.85 0.55 L 0.75 0.4 L 0.95 0.45 Z" fill="#FF0000" />
        </svg>
      );

    case "bosnia y herzegovina":
    case "bosnia":
      return (
        <svg viewBox="0 0 2 1" className="w-7 h-5 rounded shadow-sm inline-block border border-white/10" aria-label="Bandera de Bosnia y Herzegovina">
          <rect width="2" height="1" fill="#002395" />
          <polygon points="0.5,0 1.5,1 0.5,1" fill="#FECB00" />
          {/* Estrellas simplificadas */}
          <g fill="#FFFFFF">
            <polygon points="0.55,0.1 0.57,0.15 0.62,0.15 0.58,0.18 0.6,0.23 0.55,0.2 0.5,0.23 0.52,0.18 0.48,0.15 0.53,0.15" />
            <polygon points="0.65,0.23 0.67,0.28 0.72,0.28 0.68,0.31 0.7,0.36 0.65,0.33 0.6,0.36 0.62,0.31 0.58,0.28 0.63,0.28" />
            <polygon points="0.75,0.36 0.77,0.41 0.82,0.41 0.78,0.44 0.8,0.49 0.75,0.46 0.7,0.49 0.72,0.44 0.68,0.41 0.73,0.41" />
            <polygon points="0.85,0.49 0.87,0.54 0.92,0.54 0.88,0.57 0.9,0.62 0.85,0.59 0.8,0.62 0.82,0.57 0.78,0.54 0.83,0.54" />
            <polygon points="0.95,0.62 0.97,0.67 1.02,0.67 0.98,0.7 1.0,0.75 0.95,0.72 0.9,0.75 0.92,0.7 0.88,0.67 0.93,0.67" />
          </g>
        </svg>
      );

    case "estados unidos":
    case "usa":
    case "u.s.":
    case "ee.uu.":
    case "eeuu":
      return (
        <svg viewBox="0 0 19 10" className="w-7 h-5 rounded shadow-sm inline-block border border-white/10" aria-label="Bandera de EE. UU.">
          {/* 13 rayas */}
          <rect width="19" height="10" fill="#B22234" />
          <rect y="0.769" width="19" height="0.769" fill="#FFFFFF" />
          <rect y="1.538" width="19" height="0.769" fill="#FFFFFF" />
          <rect y="2.308" width="19" height="0.769" fill="#FFFFFF" />
          <rect y="3.077" width="19" height="0.769" fill="#FFFFFF" />
          <rect y="3.846" width="19" height="0.769" fill="#FFFFFF" />
          <rect y="4.615" width="19" height="0.769" fill="#FFFFFF" />
          <rect y="5.385" width="19" height="0.769" fill="#FFFFFF" />
          <rect y="6.154" width="19" height="0.769" fill="#FFFFFF" />
          <rect y="6.923" width="19" height="0.769" fill="#FFFFFF" />
          <rect y="7.692" width="19" height="0.769" fill="#FFFFFF" />
          <rect y="8.462" width="19" height="0.769" fill="#FFFFFF" />
          <rect y="9.231" width="19" height="0.769" fill="#FFFFFF" />
          {/* Canton azul */}
          <rect width="7.6" height="5.385" fill="#3C3B6E" />
          {/* Estrellas simplificadas (patrón representativo) */}
          <g fill="#FFFFFF">
            <circle cx="1.2" cy="0.8" r="0.12" />
            <circle cx="2.4" cy="0.8" r="0.12" />
            <circle cx="3.6" cy="0.8" r="0.12" />
            <circle cx="4.8" cy="0.8" r="0.12" />
            <circle cx="6.0" cy="0.8" r="0.12" />
            <circle cx="1.8" cy="1.6" r="0.12" />
            <circle cx="3.0" cy="1.6" r="0.12" />
            <circle cx="4.2" cy="1.6" r="0.12" />
            <circle cx="5.4" cy="1.6" r="0.12" />
            <circle cx="1.2" cy="2.4" r="0.12" />
            <circle cx="2.4" cy="2.4" r="0.12" />
            <circle cx="3.6" cy="2.4" r="0.12" />
            <circle cx="4.8" cy="2.4" r="0.12" />
            <circle cx="6.0" cy="2.4" r="0.12" />
            <circle cx="1.8" cy="3.2" r="0.12" />
            <circle cx="3.0" cy="3.2" r="0.12" />
            <circle cx="4.2" cy="3.2" r="0.12" />
            <circle cx="5.4" cy="3.2" r="0.12" />
            <circle cx="1.2" cy="4.0" r="0.12" />
            <circle cx="2.4" cy="4.0" r="0.12" />
            <circle cx="3.6" cy="4.0" r="0.12" />
            <circle cx="4.8" cy="4.0" r="0.12" />
            <circle cx="6.0" cy="4.0" r="0.12" />
          </g>
        </svg>
      );

    case "paraguay":
      return (
        <svg viewBox="0 0 3 2" className="w-7 h-5 rounded shadow-sm inline-block border border-white/10" aria-label="Bandera de Paraguay">
          <rect width="3" height="0.667" fill="#D7141A" />
          <rect y="0.667" width="3" height="0.667" fill="#FFFFFF" />
          <rect y="1.333" width="3" height="0.667" fill="#0038A8" />
          {/* Escudo simplificado en el medio */}
          <circle cx="1.5" cy="1" r="0.15" fill="#FFFFFF" />
          <circle cx="1.5" cy="1" r="0.12" fill="none" stroke="#0038A8" strokeWidth="0.02" />
          <polygon points="1.5,0.92 1.52,0.98 1.58,0.98 1.53,1.01 1.55,1.07 1.5,1.04 1.45,1.07 1.47,1.01 1.42,0.98 1.48,0.98" fill="#FFB81C" />
        </svg>
      );

    default:
      return (
        <span className="inline-flex items-center justify-center w-7 h-5 rounded bg-emerald-950/20 text-[9px] font-black text-emerald-400 border border-emerald-500/20 uppercase">
          {countryName.substring(0, 3)}
        </span>
      );
  }
}
