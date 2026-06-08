import React, { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js"; // 確保你有安裝 npm install chess.js react-chessboard

export function ChessboardViewer({ processedMoves, currentPly }) {
  const [fen, setFen] = useState("start");

  useEffect(() => {
    // 1. 安全檢查：如果還沒抓到資料，回到初始狀態
    if (!processedMoves || processedMoves.length === 0) {
      setFen("start");
      return;
    }

    // 2. 宣告全新的西洋棋邏輯核心
    const game = new Chess();

    // 3. 依序模擬走子，直到當前步數 currentPly
    for (let i = 0; i < currentPly; i++) {
      const move = processedMoves[i];
      if (move && move.notation) {
        try {
          // 嘗試語法 A：直接傳入 SAN 字串 (如 'Nf3') -> 新版 chess.js 標準
          game.move(move.notation);
        } catch (error1) {
          try {
            // 嘗試語法 B：傳入物件 (部分舊版或特殊版本需求)
            game.move({ move: move.notation, sloppy: true });
          } catch (error2) {
            // 如果都失敗，在 Console 印出到底是哪一步棋的 notation 格式有問題
            console.error(
              `第 ${i + 1} 步棋無法被解析。Notation: "${move.notation}"`,
              error2,
            );
            break; // 中斷迴圈，避免後續棋步全部錯亂
          }
        }
      }
    }

    // 4. 將最終盤面轉為 FEN 字串送給 UI 渲染
    setFen(game.fen());
  }, [processedMoves, currentPly]); // 💡 當 currentPly 改變，這裡一定會重新執行

  return (
    <div
      style={{
        width: "440px", // 棋盤外殼大小
        background: "#1e293b",
        padding: "20px",
        borderRadius: "12px",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
      }}
    >
      <Chessboard
        position={fen}
        arePiecesDraggable={false} // 唯讀關閉拖曳
        boardWidth={400}
        customDarkSquareStyle={{ backgroundColor: "#b58863" }}
        customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
        animationDuration={200} // 移動動畫更流暢
      />
    </div>
  );
}
