export default function BrandedLoading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "linear-gradient(160deg, #ffffff 0%, #f0ecff 65%, #fff5ef 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
      }}
    >
      <style>{`
        @keyframes wSlide {
          0%   { transform: translate(calc(-50% - 140px), -50%) scale(1);   opacity: 0; }
          22%  { transform: translate(-50%, -50%) scale(1);                  opacity: 1; }
          58%  { transform: translate(-50%, -50%) rotate(360deg) scale(0.6); opacity: 0.7; }
          70%  { transform: translate(-50%, -50%) rotate(720deg) scale(0);   opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        }
        @keyframes pinSlide {
          0%   { transform: translate(calc(-50% + 140px), -50%) scale(1);    opacity: 0; }
          22%  { transform: translate(-50%, -50%) scale(1);                   opacity: 1; }
          58%  { transform: translate(-50%, -50%) rotate(-360deg) scale(0.6); opacity: 0.7; }
          70%  { transform: translate(-50%, -50%) rotate(-720deg) scale(0);   opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        }
        @keyframes logoIn {
          0%, 64% { transform: translate(-50%, -50%) scale(0) rotate(-180deg); opacity: 0; }
          76%     { transform: translate(-50%, -50%) scale(1.18) rotate(6deg);  opacity: 1; }
          86%     { transform: translate(-50%, -50%) scale(0.94) rotate(-2deg); opacity: 1; }
          100%    { transform: translate(-50%, -50%) scale(1) rotate(0deg);     opacity: 1; }
        }
        @keyframes tagIn {
          0%, 78% { opacity: 0; transform: translateY(14px); }
          100%    { opacity: 1; transform: translateY(0); }
        }
        @keyframes clockSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .bl-w    { animation: wSlide  3s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        .bl-pin  { animation: pinSlide 3s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        .bl-logo { animation: logoIn  3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .bl-tag  { animation: tagIn   3s ease forwards; }
      `}</style>

      {/* Stage */}
      <div style={{ position: "relative", width: 160, height: 120 }}>

        {/* ── W block (from left) ── */}
        <div
          className="bl-w"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 76,
            height: 76,
            background: "linear-gradient(135deg, #6C5CE7 0%, #4C1D95 100%)",
            borderRadius: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 24px rgba(108,92,231,0.45)",
          }}
        >
          <svg width="46" height="36" viewBox="0 0 46 36" fill="none">
            <path
              d="M2 4L11 32L23 14L35 32L44 4"
              stroke="white"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* ── Location pin with spinning clock (from right) ── */}
        <div
          className="bl-pin"
          style={{ position: "absolute", top: "50%", left: "50%" }}
        >
          <svg width="62" height="76" viewBox="0 0 62 76" fill="none" overflow="visible">
            {/* Pin body */}
            <path
              d="M31 0C14.4 0 1 13.4 1 30C1 47.6 31 76 31 76C31 76 61 47.6 61 30C61 13.4 47.6 0 31 0Z"
              fill="#FF6A00"
            />
            {/* Drop shadow */}
            <ellipse cx="31" cy="74" rx="9" ry="3" fill="rgba(0,0,0,0.18)" />
            {/* Clock face */}
            <circle cx="31" cy="29" r="17" fill="white" />
            {/* Tick marks */}
            {[0, 60, 120, 180, 240, 300].map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const x1 = 31 + 13 * Math.sin(rad);
              const y1 = 29 - 13 * Math.cos(rad);
              const x2 = 31 + 15.5 * Math.sin(rad);
              const y2 = 29 - 15.5 * Math.cos(rad);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FF6A00" strokeWidth="1.5" strokeLinecap="round" />;
            })}
            {/* Hour hand (spinning) */}
            <g style={{ transformOrigin: "31px 29px", animation: "clockSpin 1.2s linear infinite" }}>
              <line x1="31" y1="29" x2="31" y2="18" stroke="#6C5CE7" strokeWidth="2.8" strokeLinecap="round" />
            </g>
            {/* Minute hand (faster) */}
            <g style={{ transformOrigin: "31px 29px", animation: "clockSpin 0.4s linear infinite" }}>
              <line x1="31" y1="29" x2="40" y2="29" stroke="#FF6A00" strokeWidth="2" strokeLinecap="round" />
            </g>
            {/* Center dot */}
            <circle cx="31" cy="29" r="2.5" fill="#1E3A8A" />
          </svg>
        </div>

        {/* ── Final logo mark (appears after merge) ── */}
        <div
          className="bl-logo"
          style={{ position: "absolute", top: "50%", left: "50%" }}
        >
          <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
            <defs>
              <linearGradient id="lgBg" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1E3A8A" />
                <stop offset="55%" stopColor="#6C5CE7" />
                <stop offset="100%" stopColor="#FF6A00" />
              </linearGradient>
              <linearGradient id="lgPin" x1="0" y1="0" x2="0" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FF6A00" />
                <stop offset="100%" stopColor="#FF9500" />
              </linearGradient>
            </defs>
            {/* Rounded square */}
            <rect width="88" height="88" rx="22" fill="url(#lgBg)" />
            {/* W shape */}
            <path
              d="M14 22L26 62L44 36L62 62L74 22"
              stroke="white"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Pin badge top-right */}
            <circle cx="68" cy="20" r="14" fill="url(#lgPin)" />
            <path d="M68 10C63.6 10 60 13.6 60 18C60 22.4 68 30 68 30C68 30 76 22.4 76 18C76 13.6 72.4 10 68 10Z" fill="url(#lgPin)" />
            <circle cx="68" cy="17" r="5" fill="white" opacity="0.9" />
            {/* Tiny clock hands in pin */}
            <line x1="68" y1="17" x2="68" y2="13" stroke="#FF6A00" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="68" y1="17" x2="72" y2="17" stroke="#6C5CE7" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Tagline */}
      <div
        className="bl-tag"
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "#6C5CE7",
          textTransform: "uppercase",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Driven by Proof
      </div>
    </div>
  );
}
