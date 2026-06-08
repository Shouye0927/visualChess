import React, { useState, useEffect, useMemo } from "react";
import { processChessMoves } from "../utils/parseChessData";
import { TimeSquare } from "../component/TimeSquare";
import { ChessBoardViewer } from "../component/ChessBoardViewer";
import { Chessboard } from "react-chessboard";

function ThoughtOfSquare() {
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPly, setCurrentPly] = useState(0);

  const DATA_URL =
    "https://raw.githubusercontent.com/Shouye0927/chess_data_provider/main/one_rapid_game.json";

  useEffect(() => {
    const fetchChessData = async () => {
      try {
        setLoading(true);
        const response = await fetch(DATA_URL);

        if (!response.ok) {
          throw new Error(`網路請求失敗，狀態碼: ${response.status}`);
        }

        const json = await response.json();
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

  // 💡 優化 1：使用 useMemo 確保棋譜只在 gameData 改變時解析一次
  const processedMoves = useMemo(() => {
    return gameData ? processChessMoves(gameData) : [];
  }, [gameData]);

  // 💡 優化 2：把 console.log 移進 useEffect 中，只有在棋譜「真正解析完成」時才印一次！
  // 這樣就不會因為畫面的反覆重繪而狂噴 log 造成效能卡頓
  useEffect(() => {
    if (processedMoves.length > 0) {
      console.log("🎯 [App] 棋譜全新解析成功，總步數：", processedMoves.length);
    }
  }, [processedMoves]); // 依賴 processedMoves 和 currentPly，確保在這兩者真正更新時才印出

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

  if (!processedMoves || processedMoves.length === 0) return null;

  return (
    <div
      style={{
        padding: "30px",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "1000px",
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
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: "40px",
            flexWrap: "nowrap",
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

          {/* 右側：即時棋盤 */}
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
            <ChessBoardViewer
              processedMoves={processedMoves}
              currentPly={currentPly}
            />
          </section>
        </div>
        {/* <ChessGame /> */}
      </main>
    </div>
  );
}

export default ThoughtOfSquare;
