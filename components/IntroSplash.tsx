"use client";

type IntroSplashProps = {
  onDone: () => void;
};

export function IntroSplash({ onDone }: IntroSplashProps) {
  return (
    <div className="intro-splash" role="status" aria-label="Opening Workforce">
      <style>{`
        .intro-splash {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 46%, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.72) 24%, rgba(242, 238, 255, 0) 52%),
            linear-gradient(160deg, #ffffff 0%, #f6f2ff 34%, #ebe3ff 70%, #ffffff 100%);
          color: #4c3d9e;
          font-family: Inter, Sarabun, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          animation: introFadeOut 260ms ease-in 1860ms forwards;
        }

        .intro-splash::before {
          content: "";
          position: absolute;
          inset: 12%;
          border: 1px solid rgba(108, 92, 231, 0.08);
          border-radius: 999px;
          transform: rotate(-8deg) scale(0.9);
          opacity: 0;
          animation: orbitIn 720ms cubic-bezier(0.2, 0, 0, 1) 120ms forwards;
        }

        .intro-skip {
          position: absolute;
          top: calc(14px + env(safe-area-inset-top));
          right: calc(14px + env(safe-area-inset-right));
          min-width: 44px;
          min-height: 44px;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.54);
          color: rgba(76, 61, 158, 0.72);
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          opacity: 0;
          backdrop-filter: blur(16px);
          animation: quietControl 220ms ease-out 460ms forwards;
        }

        .intro-skip:focus-visible {
          outline: 3px solid rgba(255, 106, 0, 0.36);
          outline-offset: 3px;
          opacity: 1;
        }

        .intro-mark {
          position: relative;
          display: grid;
          justify-items: center;
          gap: 18px;
          width: min(86vw, 320px);
          padding: 8px;
        }

        .intro-flamingo-line {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(78vw, 292px);
          height: auto;
          opacity: 0;
          transform: translate(-50%, -53%) scale(0.94);
          filter: drop-shadow(0 18px 30px rgba(108, 92, 231, 0.13));
          animation: lineSettle 980ms cubic-bezier(0.18, 0.92, 0.18, 1) 120ms forwards;
        }

        .intro-flamingo-line path {
          stroke-dasharray: 420;
          stroke-dashoffset: 420;
          animation: drawLine 980ms cubic-bezier(0.2, 0, 0, 1) 120ms forwards;
        }

        .intro-flamingo-line circle,
        .intro-flamingo-line ellipse {
          opacity: 0;
          animation: softPop 260ms ease-out 820ms forwards;
        }

        .intro-ripple {
          position: absolute;
          left: 50%;
          top: calc(50% + 46px);
          width: 18px;
          height: 18px;
          border: 1.5px solid rgba(255, 106, 0, 0.24);
          border-radius: 999px;
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.3);
          animation: refinedRipple 760ms cubic-bezier(0.16, 1, 0.3, 1) 700ms forwards;
        }

        .intro-logo-card {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          width: 104px;
          height: 104px;
          border: 1px solid rgba(255, 255, 255, 0.78);
          border-radius: 24px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.04)),
            linear-gradient(145deg, #7b6cf0 0%, #6c5ce7 52%, #5845d8 100%);
          box-shadow:
            0 22px 48px rgba(108, 92, 231, 0.24),
            0 4px 14px rgba(108, 92, 231, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.36);
          opacity: 0;
          transform: translateY(10px) scale(0.82);
          animation: logoCardIn 620ms cubic-bezier(0.2, 0.86, 0.22, 1.08) 540ms forwards;
        }

        .intro-logo-card svg {
          width: 68px;
          height: 68px;
        }

        .intro-wordmark {
          position: relative;
          z-index: 1;
          display: grid;
          justify-items: center;
          gap: 4px;
          opacity: 0;
          transform: translateY(8px);
          animation: wordmarkIn 420ms ease-out 980ms forwards;
        }

        .intro-wordmark strong {
          font-size: clamp(23px, 8vw, 31px);
          line-height: 1;
          font-weight: 800;
          letter-spacing: 0;
          color: #4c3d9e;
        }

        .intro-wordmark span {
          color: #ff6a00;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.18em;
          line-height: 1.4;
          text-transform: uppercase;
        }

        @keyframes orbitIn {
          to { opacity: 1; transform: rotate(-8deg) scale(1); }
        }

        @keyframes quietControl {
          to { opacity: 0.72; }
        }

        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }

        @keyframes lineSettle {
          0% { opacity: 0; transform: translate(-50%, -53%) scale(0.94); }
          68% { opacity: 0.72; }
          100% { opacity: 0.22; transform: translate(-50%, -54%) scale(1); }
        }

        @keyframes softPop {
          to { opacity: 1; }
        }

        @keyframes refinedRipple {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
          28% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(6.2); }
        }

        @keyframes logoCardIn {
          0% { opacity: 0; transform: translateY(10px) scale(0.82); }
          70% { opacity: 1; transform: translateY(0) scale(1.025); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes wordmarkIn {
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes introFadeOut {
          to { opacity: 0; visibility: hidden; }
        }

        @media (prefers-reduced-motion: reduce) {
          .intro-splash {
            animation: introFadeOut 180ms ease-in 920ms forwards;
          }

          .intro-splash::before,
          .intro-skip,
          .intro-flamingo-line,
          .intro-flamingo-line path,
          .intro-flamingo-line circle,
          .intro-flamingo-line ellipse,
          .intro-ripple,
          .intro-logo-card,
          .intro-wordmark {
            animation-duration: 1ms !important;
            animation-delay: 1ms !important;
          }
        }

        @media (max-width: 520px) {
          .intro-mark {
            gap: 16px;
            width: min(88vw, 300px);
          }

          .intro-logo-card {
            width: 92px;
            height: 92px;
            border-radius: 22px;
          }

          .intro-logo-card svg {
            width: 60px;
            height: 60px;
          }

          .intro-wordmark span {
            font-size: 9.5px;
            letter-spacing: 0.14em;
          }
        }

        @media (max-height: 560px) {
          .intro-mark {
            gap: 12px;
            transform: scale(0.9);
          }
        }
      `}</style>

      <button className="intro-skip" type="button" onClick={onDone} aria-label="Skip intro">
        Skip
      </button>

      <div className="intro-mark" aria-hidden="true">
        <svg className="intro-flamingo-line" viewBox="0 0 292 188" fill="none">
          <path
            d="M50 130C77 115 95 91 104 60C113 30 143 20 163 34C183 48 174 76 148 78C132 79 119 72 113 62"
            stroke="#6C5CE7"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M146 78C165 98 184 112 214 118"
            stroke="#B8AFFF"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M170 52C189 54 202 61 211 72"
            stroke="#FF6A00"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <circle cx="164" cy="48" r="3" fill="#4C3D9E" />
          <ellipse cx="211" cy="129" rx="36" ry="8" fill="#FF6A00" fillOpacity="0.14" />
        </svg>

        <span className="intro-ripple" />

        <div className="intro-logo-card">
          <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 13L15 44L25 26" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M31 26L41 44L51 13" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M28 6C22 6 17 11 17 17C17 25 28 36 28 36C28 36 39 25 39 17C39 11 34 6 28 6Z" fill="#FF6A00" />
            <circle cx="28" cy="17" r="6" fill="white" />
            <line x1="28" y1="17" x2="28" y2="12.5" stroke="#FF6A00" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="28" y1="17" x2="32" y2="19" stroke="#FF6A00" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>

        <div className="intro-wordmark">
          <strong>Workforce</strong>
          <span>Driven by Proof</span>
        </div>
      </div>
    </div>
  );
}
