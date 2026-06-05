function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function extractSquare(notation, color) {
  // 1. 先處理特殊情況：王車易位 (Castle)
  if (notation.startsWith("O-O")) {
    const isLongCastle = notation === "O-O-O"; // 三個 O 代表長易位

    if (color === "white") {
      return isLongCastle ? "c1" : "g1"; // 白方國王的落點
    } else {
      return isLongCastle ? "c8" : "g8"; // 黑方國王的落點
    }
  }

  // 2. 一般情況：用原本的正規表達式抓取落地格子
  const match = notation.match(/[a-h][1-8]/);
  return match ? match[0] : null;
}

export function processChessMoves(rawGameData) {
  const moves = rawGameData.moves;
  const increment = 10; // 每步加 10 秒

  // 根據 Lichess 廣播特點，第一步走完前，初始時間其實是 10 分鐘 + 10 秒加秒 = 610 秒
  let whiteLastTime = 10 * 60 + increment;
  let blackLastTime = 10 * 60 + increment;

  return moves.map((move) => {
    const currentTime = timeToSeconds(move.clk);
    let timeSpent = 0;

    // 正確的倒推公式：實際花費時間 = 前一步剩餘 - 當前剩餘 + 每步加秒
    if (move.color === "white") {
      timeSpent = whiteLastTime - currentTime + increment;
      whiteLastTime = currentTime; // 更新白方時間記號
    } else {
      timeSpent = blackLastTime - currentTime + increment;
      blackLastTime = currentTime; // 更新黑方時間記號
    }

    // 確保不會因為網路廣播延遲紀錄導致負數
    timeSpent = Math.max(0, timeSpent);

    return {
      ply: move.ply,
      color: move.color,
      notation: move.notation,
      square: extractSquare(move.notation, move.color), // 從棋譜中提取落地格子
      timeSpent: timeSpent, // 這才是真正扣掉加秒後的「純思考時間」
      eval: move.eval,
    };
  });
}
