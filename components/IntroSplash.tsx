"use client";

type IntroSplashProps = {
  onDone: () => void;
};

export function IntroSplash({ onDone }: IntroSplashProps) {
  return (
    <div className="intro-splash" role="status" aria-label="Workforce intro animation">
      <style>{`
        .intro-splash {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 72%, rgba(108, 92, 231, 0.13) 0%, rgba(108, 92, 231, 0.05) 28%, transparent 58%),
            linear-gradient(160deg, #ffffff 0%, #F2F4FF 58%, #ffffff 100%);
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          animation: introExit 360ms ease-in 3420ms forwards;
        }

        .intro-stage {
          position: relative;
          width: min(88vw, 430px);
          height: min(78svh, 660px);
          min-height: clamp(480px, 72svh, 520px);
        }

        .intro-floor {
          position: absolute;
          left: 50%;
          top: 58%;
          width: min(76vw, 360px);
          height: 118px;
          border-radius: 999px;
          transform: translateX(-50%);
          background: radial-gradient(ellipse at center, rgba(108, 92, 231, 0.12), rgba(255, 255, 255, 0) 68%);
          filter: blur(0.2px);
        }

        .intro-flamingo {
          position: absolute;
          left: 50%;
          top: 16%;
          width: 280px;
          max-width: 78vw;
          transform: translateX(-50%);
          filter: drop-shadow(0 22px 28px rgba(108, 92, 231, 0.16));
        }

        .intro-neck {
          transform-origin: 139px 205px;
          animation: flamingoBow 1480ms cubic-bezier(0.2, 0, 0, 1) 420ms forwards;
        }

        .intro-head {
          transform-origin: 200px 73px;
          animation: beakSettle 1480ms cubic-bezier(0.2, 0, 0, 1) 420ms forwards;
        }

        .intro-ripple {
          position: absolute;
          left: 50%;
          top: calc(58% + 37px);
          width: 26px;
          height: 26px;
          border: 2px solid rgba(108, 92, 231, 0.34);
          border-radius: 999px;
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.15);
          animation: rippleOut 1050ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .intro-ripple.r2 {
          border-color: rgba(255, 106, 0, 0.18);
          animation-delay: 1040ms;
        }

        .intro-ripple.r1 {
          animation-delay: 940ms;
        }

        .intro-logo-wrap {
          position: absolute;
          left: 50%;
          top: 57%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          transform: translate(-50%, -50%);
        }

        .intro-logo {
          width: 118px;
          height: 118px;
          opacity: 0;
          transform: scale(0.04);
          transform-origin: center;
          filter: drop-shadow(0 16px 34px rgba(108, 92, 231, 0.25));
          animation: logoReveal 900ms cubic-bezier(0.34, 1.56, 0.64, 1) 1520ms forwards;
        }

        .intro-slogan {
          margin: 0;
          color: #FF6A00;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          opacity: 0;
          transform: translateY(10px);
          animation: sloganIn 520ms ease-out 2290ms forwards;
        }

        .intro-skip {
          position: absolute;
          top: calc(14px + env(safe-area-inset-top));
          right: calc(14px + env(safe-area-inset-right));
          min-width: 44px;
          min-height: 44px;
          border: 1px solid rgba(108, 92, 231, 0.18);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.78);
          color: #6C5CE7;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          backdrop-filter: blur(10px);
        }

        .intro-skip:focus-visible {
          outline: 3px solid rgba(255, 106, 0, 0.42);
          outline-offset: 3px;
        }

        @keyframes flamingoBow {
          0%   { transform: rotate(0deg) translate(0, 0); }
          48%  { transform: rotate(28deg) translate(5px, 5px); }
          100% { transform: rotate(51deg) translate(8px, 20px); }
        }

        @keyframes beakSettle {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(-7deg); }
        }

        @keyframes rippleOut {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.15); }
          18%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(9.4); }
        }

        @keyframes logoReveal {
          0%   { opacity: 0; transform: scale(0.04); }
          64%  { opacity: 1; transform: scale(1.12); }
          82%  { opacity: 1; transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes sloganIn {
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes introExit {
          to { opacity: 0; visibility: hidden; }
        }

        @media (prefers-reduced-motion: reduce) {
          .intro-splash {
            animation: introExit 240ms ease-in 1100ms forwards;
          }

          .intro-neck,
          .intro-head,
          .intro-ripple,
          .intro-logo,
          .intro-slogan {
            animation-duration: 1ms !important;
            animation-delay: 120ms !important;
          }
        }

        @media (max-width: 520px) {
          .intro-stage {
            width: min(92vw, 380px);
            height: min(82svh, 560px);
            min-height: clamp(430px, 76svh, 480px);
          }

          .intro-flamingo {
            width: min(248px, 76vw);
            top: 15%;
          }

          .intro-floor {
            top: 60%;
            width: min(84vw, 320px);
          }

          .intro-logo-wrap {
            top: 59%;
            gap: 14px;
          }

          .intro-logo {
            width: 102px;
            height: 102px;
          }

          .intro-slogan {
            font-size: 12px;
            letter-spacing: 0.12em;
            white-space: nowrap;
          }
        }

        @media (max-width: 380px), (max-height: 620px) {
          .intro-stage {
            min-height: 410px;
          }

          .intro-flamingo {
            width: min(228px, 74vw);
            top: 13%;
          }

          .intro-logo {
            width: 92px;
            height: 92px;
          }

          .intro-ripple {
            top: calc(60% + 30px);
          }
        }
      `}</style>

      <button className="intro-skip" type="button" onClick={onDone} aria-label="Skip intro">
        Skip
      </button>

      <div className="intro-stage" aria-hidden="true">
        <div className="intro-floor" />
        <svg className="intro-flamingo" viewBox="0 0 280 340" fill="none">
          <defs>
            <linearGradient id="flamingoBody" x1="58" y1="121" x2="202" y2="267" gradientUnits="userSpaceOnUse">
              <stop stopColor="#B8AFFF" />
              <stop offset="0.55" stopColor="#6C5CE7" />
              <stop offset="1" stopColor="#8F7CFF" />
            </linearGradient>
            <linearGradient id="flamingoWing" x1="84" y1="138" x2="172" y2="232" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F4F1FF" />
              <stop offset="1" stopColor="#8F7CFF" />
            </linearGradient>
          </defs>

          <path d="M139 212C132 249 119 287 105 329" stroke="#6C5CE7" strokeWidth="9" strokeLinecap="round" />
          <path d="M151 214C159 252 165 289 171 329" stroke="#8F7CFF" strokeWidth="9" strokeLinecap="round" />
          <path d="M95 329H116" stroke="#FF6A00" strokeWidth="6" strokeLinecap="round" />
          <path d="M161 329H184" stroke="#FF6A00" strokeWidth="6" strokeLinecap="round" />

          <ellipse cx="135" cy="188" rx="67" ry="52" fill="url(#flamingoBody)" />
          <path d="M82 178C98 139 145 131 183 160C159 159 131 173 114 210C102 202 91 192 82 178Z" fill="url(#flamingoWing)" opacity="0.92" />
          <path d="M187 179C211 190 223 209 219 230C201 218 185 207 170 191C176 185 181 181 187 179Z" fill="#6C5CE7" opacity="0.82" />

          <g className="intro-neck">
            <path
              d="M137 151C126 118 130 88 154 70C174 55 197 60 207 75C218 91 209 110 190 116C176 121 160 116 155 103"
              stroke="#6C5CE7"
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M140 151C132 119 136 92 158 75"
              stroke="#B8AFFF"
              strokeWidth="7"
              strokeLinecap="round"
              opacity="0.58"
            />
            <g className="intro-head">
              <ellipse cx="204" cy="82" rx="22" ry="18" fill="#6C5CE7" />
              <circle cx="210" cy="77" r="2.8" fill="#332F3A" />
              <path d="M221 83C239 85 251 91 258 100C245 107 229 106 218 96Z" fill="#FF6A00" />
              <path d="M249 96C255 98 260 102 263 108C254 112 245 108 239 103Z" fill="#3A3347" />
            </g>
          </g>
        </svg>

        <span className="intro-ripple r1" />
        <span className="intro-ripple r2" />

        <div className="intro-logo-wrap">
          <svg className="intro-logo" viewBox="0 0 88 88" fill="none">
            <defs>
              <linearGradient id="introLogoBg" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F2F4FF" />
                <stop offset="48%" stopColor="#6C5CE7" />
                <stop offset="100%" stopColor="#FF6A00" />
              </linearGradient>
              <linearGradient id="introPin" x1="60" y1="8" x2="76" y2="31" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF6A00" />
                <stop offset="1" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
            <rect width="88" height="88" rx="22" fill="url(#introLogoBg)" />
            <path d="M14 22L26 62L44 36L62 62L74 22" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M68 9C60.8 9 55 14.8 55 22C55 31 68 43 68 43C68 43 81 31 81 22C81 14.8 75.2 9 68 9Z" fill="url(#introPin)" />
            <circle cx="68" cy="22" r="6" fill="white" />
            <line x1="68" y1="22" x2="68" y2="17" stroke="#FF6A00" strokeWidth="1.7" strokeLinecap="round" />
            <line x1="68" y1="22" x2="73" y2="22" stroke="#6C5CE7" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="intro-slogan">Driven by Proof</p>
        </div>
      </div>
    </div>
  );
}
