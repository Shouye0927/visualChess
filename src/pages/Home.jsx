import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  // 卡片資料：把三張卡片的內容抽出來方便維護
  const cards = [
    {
      // 卡片 1：The Thought of Square
      icon: "grid_view",
      tag: "Heatmap",
      title: "The Thought of Square",
      desc: "Quantify the strategic weight and influence of every coordinate in real-time with centipawn precision.",
      cta: "Analyze Squares",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAk4djaR7PY4exk04eEZigBezyoYXu7bSpFfqa8Z3vOtgzkbm2bM8R5Ur1egX6Pbq_3ROpz120Xo0XCA787q1sTK7O4YfH56WzU37FMIBDeq5i9Av6cbJr30W150pbz_oosy_LiQELHMFXS5S7dyX6N2qrz0O-zh7VOV6zaO1_WkfImGHFR53e6AmqyDVFdJ8G3TEd89Qcbc--sO0HFZZ2kkDUxYGb2wk488IioBe756JQ_Opnq6m38z43qjQtJdRYfK2CpCI-uP6k",
      alt: "Chess Heatmap",
      path: "/thought-of-square",
    },
    {
      // 卡片 2：Victim of Sniper
      icon: "track_changes",
      tag: "Visibility",
      title: "Victim of Sniper",
      desc: "Identify and neutralize long-range Bishop and Rook threats before they strike with X-ray detection.",
      cta: "Identify Threats",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAOBThuv70mgib4HZd7f02tXOnV2Sz54B2CjWLAhD2YsfIQRilrwdEK3Z6d9WMYuv5KNpT5NSikyrjgNJota9RwMYVb4rxOCMPMw-R6mE7YMvGpzao79dgEHWmosh7Ciye2SKC4prvPhK9dLrf7ABlO4yb-NXCMtrrrdjbkLwzg3BVXvuiaY6lfM5r9DTnD4gU5qx0nQuQ359VHFKtcxAf3KTmcdYFwtLiQYFI34PfJQfhaUJ53gwIgiBaqV2IU9NPgVTjZgOJHycU",
      alt: "Long Range Attack Visual",
      path: "/victim-of-sniper",
    },
    {
      // 卡片 3：Opening Tree
      icon: "account_tree",
      tag: "Theory",
      title: "Opening Tree",
      desc: "Map out every variation with an interactive geometric tree navigating through centuries of theory.",
      cta: "Explore Branches",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDF2ufoEQBv4cXr1OKkAntHaP6YpYwgQz81xU3AP9O55Oaf_nyPtT6jX3S_xxLqc-1BSSX_zpcFLTPuvEvxHaf9Ea5-XJfVrhWfABokX-pvKPrTrWObA6B22hOfCx3jbU_gSt4wUp99KbtVzDWC36iggHq3JwH0FVIGSHE_27Sw6TM5GyCkr8L9BEWLQVqFymbBcTWjDG2Ulu5s9R643-qTukxKQkjJFl7hvIrFK9M7tcRc576T0kw38Rj7QKyt7SubMf46wMuaXjI",
      alt: "Geometric Tree Structure",
      path: "/opening-tree",
    },
  ];

  return (
    <>
      {/* 樣式區塊：把所有 CSS 都寫在這裡，避免依賴 Tailwind 或其他套件 */}
      <style>{`
        /* 載入外部字體：Playfair Display (標題)、Inter (內文)、JetBrains Mono (數據) */
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
        /* 載入 Material Symbols 圖示字體 */
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        /* 元件根容器：填滿整個視窗、深色背景、置中內容 */
        .ga-root {
          background-color: #0A0A0A;
          color: #eae1d4;
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 64px;
          position: relative;
          overflow: hidden;
          /* 中央徑向光暈效果 */
          background-image: radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.08) 0%, transparent 70%), linear-gradient(#0A0A0A,#0A0A0A);
        }

        /* 背景模糊光球：營造金色氛圍 */
        .ga-bg-blur {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          background: rgba(242, 202, 80, 0.05);
          border-radius: 50%;
          filter: blur(100px);
          z-index: 0;
          pointer-events: none;
        }

        /* Hero 區塊：標題與副標題容器 */
        .ga-hero {
          text-align: center;
          margin-bottom: 48px;
          position: relative;
          z-index: 1;
          animation: ga-fade-in 1s ease-out;
        }

        /* 進場動畫：淡入 + 由下往上 */
        @keyframes ga-fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* 主標題：使用 Playfair Display 字體、金色 */
        .ga-title {
          font-family: 'Playfair Display', serif;
          font-size: 48px;
          line-height: 1.1;
          letter-spacing: -0.02em;
          font-weight: 700;
          color: #f2ca50;
          margin: 0 0 16px 0;
          text-transform: uppercase;
        }

        /* 標題第二段：使用淺色，與金色形成對比 */
        .ga-title-light {
          color: #eae1d4;
        }

        /* 副標題：斜體、半透明、限制寬度 */
        .ga-subtitle {
          font-size: 18px;
          line-height: 1.6;
          color: #d0c5af;
          max-width: 640px;
          margin: 0 auto;
          font-style: italic;
          opacity: 0.8;
        }

        /* 卡片網格：桌面三欄、手機單欄 */
        .ga-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          width: 100%;
          max-width: 1152px;
          position: relative;
          z-index: 1;
        }

        /* 響應式：768px 以下改為單欄 */
        @media (max-width: 768px) {
          .ga-root { padding: 32px 20px; }
          .ga-grid { grid-template-columns: 1fr; }
          .ga-title { font-size: 32px; }
        }

        /* 卡片本體：玻璃擬態效果 (毛玻璃 + 半透明) */
        .ga-card {
          background: rgba(26, 26, 26, 0.5);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: all 0.5s ease;
        }

        /* 卡片 hover：金色光暈 + 上浮 */
        .ga-card:hover {
          box-shadow: 0 0 30px rgba(212, 175, 55, 0.15);
          border-color: rgba(212, 175, 55, 0.3);
          transform: translateY(-8px);
        }

        /* 卡片圖片容器：固定高度、裁切溢出 */
        .ga-card-img-wrap {
          position: relative;
          height: 192px;
          overflow: hidden;
        }

        /* 卡片圖片：覆蓋容器、降低不透明度 */
        .ga-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.6;
          transition: transform 0.7s ease;
        }

        /* 圖片 hover 時放大 */
        .ga-card:hover .ga-card-img {
          transform: scale(1.1);
        }

        /* 圖片底部漸層遮罩：讓圖片自然融入卡片背景 */
        .ga-card-img-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, #16130b 10%, transparent 90%);
          pointer-events: none;
        }

        /* 圖片左上角的標籤膠囊 */
        .ga-card-tag {
          position: absolute;
          top: 16px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          background: rgba(242, 202, 80, 0.2);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 4px;
          border: 1px solid rgba(242, 202, 80, 0.3);
        }

        /* 標籤文字：小字、間距大、金色 */
        .ga-card-tag-text {
          font-size: 10px;
          font-weight: 700;
          color: #f2ca50;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        /* 標籤圖示：金色、固定大小 */
        .ga-card-tag-icon {
          font-family: 'Material Symbols Outlined';
          font-size: 16px;
          color: #f2ca50;
          vertical-align: middle;
        }

        /* 卡片內文區塊 */
        .ga-card-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }

        /* 卡片標題 */
        .ga-card-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          line-height: 1.3;
          font-weight: 500;
          color: #eae1d4;
          margin: 0 0 8px 0;
          transition: color 0.3s ease;
        }

        /* 卡片 hover 時標題變金色 */
        .ga-card:hover .ga-card-title {
          color: #f2ca50;
        }

        /* 卡片描述文字 */
        .ga-card-desc {
          color: #d0c5af;
          font-size: 14px;
          line-height: 1.6;
          margin: 0 0 24px 0;
          flex-grow: 1;
        }

        /* 卡片底部 CTA：金色文字 + 箭頭 */
        .ga-card-cta {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f2ca50;
          font-weight: 700;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          transition: transform 0.3s ease;
        }

        /* CTA hover 時往右位移 */
        .ga-card:hover .ga-card-cta {
          transform: translateX(8px);
        }

        /* CTA 內箭頭圖示 */
        .ga-card-cta-icon {
          font-family: 'Material Symbols Outlined';
          font-size: 14px;
          vertical-align: middle;
        }
      `}</style>

      {/* 元件結構開始 */}
      <div className="ga-root">
        {/* 背景裝飾光球 */}
        <div className="ga-bg-blur" />

        {/* Hero 區：主標題與副標題 */}
        <div className="ga-hero">
          <h1 className="ga-title">
            Be<span className="ga-title-light">at The GM</span>
          </h1>
          <p className="ga-subtitle">
            A simple chess analysis tool that visualizes the strategic weight of
            every square, identifies long-range threats, and maps out opening
            theory with an interactive geometric tree.
          </p>
        </div>

        {/* 三張特色卡片 */}
        <div className="ga-grid">
          {cards.map((card, idx) => (
            <div
              className="ga-card"
              key={idx}
              onClick={() => navigate(card.path)}
            >
              {/* 卡片圖片區 */}
              <div className="ga-card-img-wrap">
                <img className="ga-card-img" src={card.img} alt={card.alt} />
                <div className="ga-card-img-overlay" />
                {/* 左上角分類標籤 */}
                <div className="ga-card-tag">
                  <span className="ga-card-tag-icon">{card.icon}</span>
                  <span className="ga-card-tag-text">{card.tag}</span>
                </div>
              </div>
              {/* 卡片文字內容區 */}
              <div className="ga-card-body">
                <h3 className="ga-card-title">{card.title}</h3>
                <p className="ga-card-desc">{card.desc}</p>
                {/* CTA 連結 */}
                <div className="ga-card-cta">
                  {card.cta}
                  <span className="ga-card-cta-icon">arrow_forward</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
