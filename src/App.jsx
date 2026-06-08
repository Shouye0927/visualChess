import React, { useState, useEffect, useMemo } from "react";
import { processChessMoves } from "./utils/parseChessData";
import { TimeSquare } from "./component/TimeSquare";
// 💡 1. 引入剛剛建立的棋盤檢視器組件
import { ChessboardViewer } from "./component/ChessboardViewer";

function App() {
  // 建立存放資料與載入狀態的 State
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  //將步數狀態提升到 App 層，方便未來傳給「棋局畫面組件」
  const [currentPly, setCurrentPly] = useState(0);

  // GitHub Raw Data 的雲端網址
  const DATA_URL =
    "https://raw.githubusercontent.com/Shouye0927/chess_data_provider/main/one_rapid_game.json";

  useEffect(() => {
    // 定義非同步撈取資料的函式
    const fetchChessData = async () => {
      try {
        setLoading(true);
        const response = await fetch(DATA_URL);

        if (!response.ok) {
          throw new Error(`網路請求失敗，狀態碼: ${response.status}`);
        }

        const json = await response.json();
        // 因為你的 JSON 最外層是一個陣列 [ { metadata, moves } ]，撈取第一筆對局
        setGameData(json[0]);
        setLoading(false);
      } catch (err) {
        console.error("讀取西洋棋資料時發生錯誤:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchChessData();
  }, []);

  //3. 核心修復：使用 useMemo 快取解析結果
  const processedMoves = useMemo(() => {
    // 在 App.jsx 的 useMemo 後面暫時加入
    // 確保有資料才進行解析
    return gameData ? processChessMoves(gameData) : [];
  }, [gameData]); // 只有當從雲端抓下來的 gameData 改變時，才重新解析
  console.log("解析完成的 processedMoves:", processedMoves);

  // 1. 如果還在下載資料，顯示 Loading
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: "18px", color: "#4a5568" }}>
          ⏳ 正在從雲端載入西洋棋賽事數據...
        </div>
      </div>
    );
  }

  // 2. 如果讀取失敗，顯示錯誤訊息
  if (error) {
    return (
      <div
        style={{ padding: "30px", color: "#e53e3e", fontFamily: "sans-serif" }}
      >
        <h3>❌ 資料載入失敗</h3>
        <p>{error}</p>
      </div>
    );
  }

  // 如果還沒有解析出結果，先不渲染主體
  if (!processedMoves || processedMoves.length === 0) return null;

  return (
    <div
      style={{
        padding: "30px",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "1000px", // 💡 因為放了兩個大組件，稍微調寬容器最大寬度
        margin: "0 auto",
      }}
    >
      <header
        style={{
          marginBottom: "20px",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "15px",
        }}
      >
        <h1 style={{ fontSize: "24px", margin: "0 0 8px 0" }}>
          西洋棋對局思考時間熱區圖 (雲端資料版)
        </h1>
        <p style={{ color: "#4a5568", margin: "4px 0" }}>
          ⚪ <strong>白方 (IM {gameData.metadata.White}):</strong>{" "}
          {gameData.metadata.WhiteElo}
          <span style={{ margin: "0 10px" }}>vs</span>⚫{" "}
          <strong>黑方 ({gameData.metadata.Black}):</strong>{" "}
          {gameData.metadata.BlackElo}
        </p>
        <p style={{ color: "#718096", fontSize: "14px", margin: "4px 0" }}>
          開局：{gameData.metadata.Opening} ({gameData.metadata.ECO})
        </p>
      </header>

      <main>
        {/* 佈局：左右並排 */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: "40px",
            flexWrap: "nowrap", // 強迫在寬螢幕下不換行
          }}
        >
          {/* 左側：熱區圖 */}
          <section style={{ flex: "0 0 auto" }}>
            <h2
              style={{
                fontSize: "18px",
                color: "#94a3b8",
                marginBottom: "15px",
              }}
            >
              思考時間熱區 (可點擊格子)
            </h2>
            <TimeSquare
              processedMoves={processedMoves}
              currentPly={currentPly}
              setCurrentPly={setCurrentPly}
            />
          </section>

          {/* 💡 2. 右側：實際即時棋盤 */}
          <section style={{ flex: "0 0 auto" }}>
            <h2
              style={{
                fontSize: "18px",
                color: "#94a3b8",
                marginBottom: "15px",
              }}
            >
              當前棋局畫面
            </h2>
            <ChessboardViewer
              processedMoves={processedMoves}
              currentPly={currentPly}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
