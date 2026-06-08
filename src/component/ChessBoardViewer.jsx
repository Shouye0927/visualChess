import React, { useEffect, useState, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

// 西洋棋起手式的標準完整 FEN
const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function ChessBoardViewer({ processedMoves, currentPly }) {
  const [fen, setFen] = useState(INITIAL_FEN);

  // 💡 用 useMemo 計算 FEN，避免 useEffect 內 setFen 多一次 render
  const computedFen = useMemo(() => {
    // 沒資料就回到起手式
    if (!processedMoves || processedMoves.length === 0) {
      return INITIAL_FEN;
    }

    // 建立全新棋局實例
    const game = new Chess();

    // 同步逐步走子
    for (let i = 0; i < currentPly; i++) {
      const move = processedMoves[i];
      if (!move || !move.notation) continue;

      // ✨ 關鍵修正：清洗 notation（不要殺空白，只剝註解符號）
      const cleanedNotation = move.notation
        .replace(/0-0-0/g, "O-O-O") // 長易位修正（數字 0 → 字母 O）
        .replace(/0-0/g, "O-O") // 短易位修正
        .replace(/[!?]+/g, "") // 移除 !, ?, !!, ??, !?, ?! 等註解
        .replace(/\{[^}]*\}/g, "") // 移除 PGN 註解 {...}
        .replace(/\([^)]*\)/g, "") // 移除變化 (...)
        .replace(/\$\d+/g, "") // 移除 NAG 標籤 $1, $2...
        .trim(); // 只 trim 前後空白，內部不動

      if (!cleanedNotation) continue;

      try {
        // 使用 strict: false 容錯模式
        const result = game.move(cleanedNotation, { strict: false });
        if (!result) {
          console.warn(
            `⚠️ 第 ${i + 1} 步無效: "${cleanedNotation}" (原始: "${move.notation}")`,
          );
        }
      } catch (error) {
        console.error(
          `❌ 第 ${i + 1} 步無法解析: 原始="${move.notation}" 清洗後="${cleanedNotation}"`,
          error.message,
        );
        // 不 break，繼續嘗試下一步
      }
    }

    // ✨ 取得完整的 FEN（chess.js 自動產生 6 欄位完整字串）
    const finalFen = game.fen();
    console.log("🎯 [computedFen] Ply:", currentPly, "FEN:", finalFen);
    return finalFen;
  }, [processedMoves, currentPly]);

  // 把計算好的 FEN 寫進 state
  useEffect(() => {
    setFen(computedFen);
  }, [computedFen]);

  return (
    <div
      style={{
        width: "440px",
        background: "#1e293b",
        padding: "20px",
        borderRadius: "12px",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
      }}
    >
      <Chessboard
        id="MainChessBoard"
        position={fen}
        arePiecesDraggable={false}
        boardWidth={400}
        animationDuration={300}
        customDarkSquareStyle={{ backgroundColor: "#b58863" }}
        customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
      />
    </div>
  );
}
