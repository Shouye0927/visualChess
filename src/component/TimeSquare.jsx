import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

export function TimeSquare({ processedMoves, currentPly, setCurrentPly }) {
  const svgRef = useRef(null);
  const simulationRef = useRef(null);

  // 💡 解決 D3 閉包陷阱的核心：使用 Ref 來動態儲存最新的狀態與方法
  const stateRef = useRef({ currentPly, setCurrentPly, processedMoves });

  // 每次渲染時，都把最新收到的 props 同步更新到 Ref 裡面
  useEffect(() => {
    stateRef.current = { currentPly, setCurrentPly, processedMoves };
  });

  // 彈出歷程選單的狀態
  const [menuConfig, setMenuConfig] = useState({
    visible: false,
    x: 0,
    y: 0,
    history: [],
  });

  // 模式開關狀態
  const [isExplosionMode, setIsExplosionMode] = useState(false);
  const [isSplitMode, setIsSplitMode] = useState(false);

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const squareSize = 30;
  const margin = 140;
  const width = squareSize * 8 + margin * 2;
  const height = squareSize * 8 + margin * 2;

  const IconPrev = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  );

  const IconNext = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  );

  // 計算每個格子的目標座標 (Center X, Center Y)
  const getPos = (square) => {
    const fIdx = files.indexOf(square[0]);
    const rIdx = ranks.indexOf(parseInt(square[1]));
    return {
      tx: margin + fIdx * squareSize + squareSize / 2,
      ty: margin + rIdx * squareSize + squareSize / 2,
    };
  };

  // 1. 根據目前的步數，計算「當前累積」的格子時間 (用於棋盤模式)
  const currentSquareData = useMemo(() => {
    const data = {};
    files.forEach((f) =>
      ranks.forEach((r) => {
        data[`${f}${r}`] = 0;
      }),
    );
    for (let i = 0; i < currentPly; i++) {
      const move = processedMoves[i];
      if (move && move.square && data[move.square] !== undefined) {
        data[move.square] += move.timeSpent;
      }
    }
    return data;
  }, [processedMoves, currentPly]);

  // 計算全域最大時間 (用於比例尺)
  const globalMaxTime = useMemo(() => {
    const totalData = {};
    processedMoves.forEach((move) => {
      if (move.square)
        totalData[move.square] = (totalData[move.square] || 0) + move.timeSpent;
    });
    return d3.max(Object.values(totalData)) || 1;
  }, [processedMoves]);

  // 2. ✨ 核心 D3 渲染與物理模擬 ✨
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // 💡 關鍵修復：取得「上一幀」的物理節點狀態，把座標記錄下來
    const oldNodes = simulationRef.current ? simulationRef.current.nodes() : [];
    const oldNodeMap = new Map(oldNodes.map((n) => [n.id, n]));

    // 清空舊畫布，準備重新繪製
    svg.selectAll("*").remove();
    const cellGroup = svg.append("g").attr("class", "cells");

    // 設定尺寸比例尺
    const sizeScale = d3
      .scaleLinear()
      .domain([0, globalMaxTime])
      .range([squareSize, 110]);

    let nodes = [];

    if (isSplitMode) {
      // 🟢 分塊模式：將每一「步」轉為獨立節點
      nodes = processedMoves
        .slice(0, currentPly)
        .filter((m) => m.square && files.includes(m.square[0]))
        .map((m, i) => {
          const id = `move-${i}`;
          const pos = getPos(m.square);
          const tTime = m.timeSpent || 0;

          // 找找看這個步數是不是已經在畫面上了？
          const oldNode = oldNodeMap.get(id);

          return {
            id,
            square: m.square,
            targetX: pos.tx,
            targetY: pos.ty,
            // 💡 如果已經存在，直接沿用它被炸開後的座標與速度！如果沒有，才給它初始座標
            x: oldNode ? oldNode.x : pos.tx + (Math.random() - 0.5) * 20,
            y: oldNode ? oldNode.y : pos.ty + (Math.random() - 0.5) * 20,
            vx: oldNode ? oldNode.vx : 0,
            vy: oldNode ? oldNode.vy : 0,
            size: Math.max(20, sizeScale(tTime) * 0.6),
            color: m.color,
            notation: m.notation,
            timeSpent: tTime,
          };
        });
    } else {
      // 🟡 棋盤模式：維持 64 格
      files.forEach((f) => {
        ranks.forEach((r) => {
          const sq = `${f}${r}`;
          const pos = getPos(sq);
          const tTime = currentSquareData[sq] || 0;

          const oldNode = oldNodeMap.get(sq);

          nodes.push({
            id: sq,
            square: sq,
            targetX: pos.tx,
            targetY: pos.ty,
            // 💡 棋盤模式同樣沿用舊座標，讓模式切換時方塊會平滑過渡
            x: oldNode ? oldNode.x : pos.tx,
            y: oldNode ? oldNode.y : pos.ty,
            vx: oldNode ? oldNode.vx : 0,
            vy: oldNode ? oldNode.vy : 0,
            size: tTime > 0 ? sizeScale(tTime) : squareSize,
            totalTime: tTime,
          });
        });
      });
    }

    // 建立 D3 節點元素 (這行之後的程式碼維持不變，繼續接 cells 宣告...)
    const cells = cellGroup
      .selectAll(".chess-cell")
      .data(nodes, (d) => d.id)
      .enter()
      .append("g")
      .attr("class", "chess-cell")
      .style("cursor", "pointer");

    // 繪製方塊
    cells
      .append("rect")
      .attr("width", (d) => d.size)
      .attr("height", (d) => d.size)
      .attr("x", (d) => -d.size / 2)
      .attr("y", (d) => -d.size / 2)
      .attr("rx", isSplitMode ? 6 : 0)
      .attr("fill", (d) => {
        // 💡 同步顏色邏輯：無論何種模式，都依據棋盤格子的黑白來決定底色
        const isDarkSquare =
          (files.indexOf(d.square[0]) + ranks.indexOf(parseInt(d.square[1]))) %
            2 ===
          1;
        return isDarkSquare ? "#b58863" : "#f0d9b5";
      })
      .attr("stroke", (d) =>
        isSplitMode || d.totalTime > 0 ? "#ea580c" : "#cbd5e1",
      )
      .attr("stroke-width", (d) =>
        isSplitMode || d.totalTime > 0 ? 1.5 : 0.5,
      );

    // 繪製文字標籤
    cells
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", (d) => (d.size < 40 ? "9px" : "12px"))
      .attr("font-weight", "600")
      .attr("fill", (d) => {
        // 💡 同步顏色邏輯：依據棋盤格子決定文字的對比色 (必須要 return！)
        const isDarkSquare =
          (files.indexOf(d.square[0]) + ranks.indexOf(parseInt(d.square[1]))) %
            2 ===
          1;
        return isDarkSquare ? "#f0d9b5" : "#b58863";
      })
      .text((d) => (isSplitMode ? d.notation : d.id));

    // Hover 提示
    cells
      .append("title")
      .text((d) =>
        isSplitMode
          ? `Step: ${d.notation}\nTimeSpent: ${d.timeSpent} 秒\nSquare: ${d.square}`
          : `Square: ${d.id}\nTotal Thinking Time: ${d.totalTime} 秒`,
      );

    // ✨ 點擊事件
    cells.on("click", function (event, d) {
      event.stopPropagation();
      const { processedMoves: currentMoves } = stateRef.current;
      const history = [];

      currentMoves
        .slice(0, stateRef.current.currentPly)
        .forEach((move, index) => {
          if (move.square === d.square) {
            history.push({
              plyIndex: index + 1,
              notation: move.notation,
              color: move.color === "white" ? "White" : "Black",
              timeSpent: move.timeSpent,
            });
          }
        });

      if (history.length === 0) return;

      if (history.length === 1) {
        stateRef.current.setCurrentPly(history[0].plyIndex);
        setMenuConfig((prev) => ({ ...prev, visible: false }));
      } else {
        const rect = svgRef.current.getBoundingClientRect();
        setMenuConfig({
          visible: true,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          history: history,
        });
      }
    });

    // ✨ 啟動物理模擬
    const attractStrength = isExplosionMode ? 0.05 : isSplitMode ? 0.3 : 0.75;
    const repelStrength = isExplosionMode ? -50 : isSplitMode ? -15 : 0;

    simulationRef.current = d3
      .forceSimulation(nodes)
      .force("x", d3.forceX((d) => d.targetX).strength(attractStrength))
      .force("y", d3.forceY((d) => d.targetY).strength(attractStrength))
      .force("charge", d3.forceManyBody().strength(repelStrength))
      .force(
        "collision",
        d3
          .forceCollide()
          .radius((d) => d.size / 2 + 2)
          .iterations(4),
      )
      .velocityDecay(isSplitMode ? 0.6 : 0.35);

    // ✨ 邊界限制邏輯 (Bounding Box) 加入到 tick 函式中
    const padding = 5; // 邊距緩衝
    simulationRef.current.on("tick", () => {
      cells.attr("transform", (d) => {
        // 計算半徑，確保整個方塊都在畫布內
        const r = d.size / 2;
        // 強制限制 x 與 y 座標不能超過畫布邊界
        d.x = Math.max(r + padding, Math.min(width - r - padding, d.x));
        d.y = Math.max(r + padding, Math.min(height - r - padding, d.y));
        return `translate(${d.x}, ${d.y})`;
      });
    });

    return () => {
      if (simulationRef.current) simulationRef.current.stop();
    };
  }, [currentPly, processedMoves, isExplosionMode, isSplitMode, globalMaxTime]);

  // 點擊別處關閉多步選單
  useEffect(() => {
    const closeMenu = () =>
      setMenuConfig((prev) => ({ ...prev, visible: false }));
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const handleNext = () => {
    if (currentPly < processedMoves.length) setCurrentPly((prev) => prev + 1);
  };
  const handlePrev = () => {
    if (currentPly > 0) setCurrentPly((prev) => prev - 1);
  };
  const handleReset = () => setCurrentPly(0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        position: "relative",
      }}
    >
      {/* 視覺切換開關 */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <label
          style={{
            color: "#94a3b8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <input
            type="checkbox"
            checked={isExplosionMode}
            onChange={() => setIsExplosionMode(!isExplosionMode)}
          />
          Explosion Mode
        </label>
        <label
          style={{
            color: "#94a3b8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <input
            type="checkbox"
            checked={isSplitMode}
            onChange={() => setIsSplitMode(!isSplitMode)}
          />
          Split Mode
        </label>
      </div>

      {/* 棋盤畫布外殼 */}
      <div
        style={{
          background: "#1e293b",
          padding: "20px",
          borderRadius: "16px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
          position: "relative",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width="500px"
          height="500px"
        />

        {/* 多步棋跳轉選單 */}
        {menuConfig.visible && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: menuConfig.y,
              left: menuConfig.x,
              background: "#1e293b",
              border: "1px solid #475569",
              borderRadius: "8px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
              zIndex: 100,
              maxHeight: "180px",
              overflowY: "auto",
              padding: "6px",
              minWidth: "180px",
            }}
          >
            <div
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                padding: "4px 8px",
                borderBottom: "1px solid #334155",
              }}
            >
              Multiple moves found on {menuConfig.history[0].square}:
            </div>
            {menuConfig.history.map((item) => (
              <div
                key={item.plyIndex}
                onClick={() => {
                  setCurrentPly(item.plyIndex);
                  setMenuConfig((prev) => ({ ...prev, visible: false }));
                }}
                style={{
                  padding: "6px 10px",
                  color: "#f8fafc",
                  fontSize: "12px",
                  cursor: "pointer",
                  borderRadius: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#334155")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span>
                  Step {item.plyIndex} ({item.notation})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 播放控制按鈕 */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <button onClick={handleReset} style={btnStyle}>
          Reset
        </button>
        <button
          onClick={handlePrev}
          disabled={currentPly === 0}
          style={btnStyle}
        >
          <IconPrev />
        </button>
        <span
          style={{
            color: "#cbd5e1",
            fontSize: "16px",
            fontWeight: "600",
            minWidth: "100px",
            textAlign: "center",
          }}
        >
          {currentPly === 0
            ? "Start to explore!"
            : `Step: ${currentPly} / ${processedMoves.length}`}
        </span>
        <button
          onClick={handleNext}
          disabled={currentPly === processedMoves.length}
          style={btnStyle}
        >
          <IconNext />
        </button>
      </div>
    </div>
  );
}

const btnStyle = {
  background: "#334155",
  color: "#f8fafc",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
};
