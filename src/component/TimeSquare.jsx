import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

export function TimeSquare({ processedMoves }) {
  const svgRef = useRef(null);
  const simulationRef = useRef(null); // 用來儲存物理模擬器實例，跨 render 存取

  //  controlar 當前播放到第幾步 (0 代表純棋盤狀態)
  const [currentPly, setCurrentPly] = useState(0);

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const squareSize = 30;
  const margin = 140;
  const width = squareSize * 8 + margin * 2;
  const height = squareSize * 8 + margin * 2;

  // 1. 根據目前的步數，計算「當前累積」的格子時間
  const currentSquareData = useMemo(() => {
    const data = {};
    files.forEach((f) =>
      ranks.forEach((r) => {
        data[`${f}${r}`] = 0;
      }),
    );

    // 只統計到目前 currentPly 為止的棋步
    for (let i = 0; i < currentPly; i++) {
      const move = processedMoves[i];
      if (move && move.square && data[move.square] !== undefined) {
        data[move.square] += move.timeSpent;
      }
    }
    return data;
  }, [processedMoves, currentPly]);

  // 計算整場比賽的最大時間（作為固定的比例尺最高點，避免每步的最高點不同導致縮放混亂）
  const globalMaxTime = useMemo(() => {
    const totalData = {};
    processedMoves.forEach((move) => {
      if (move.square)
        totalData[move.square] = (totalData[move.square] || 0) + move.timeSpent;
    });
    return d3.max(Object.values(totalData)) || 1;
  }, [processedMoves]);

  // 2. 初始化棋盤的 DOM 結構（只執行一次，避免畫面閃爍）
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // 清空舊的

    const cellGroup = svg.append("g").attr("class", "cells");

    // 建立 64 個格子的初始靜態 Node 資料
    const initialNodes = [];
    files.forEach((f) => {
      ranks.forEach((r) => {
        const key = `${f}${r}`;
        const fIdx = files.indexOf(f);
        const rIdx = ranks.indexOf(r);
        const targetX = margin + fIdx * squareSize + squareSize / 2;
        const targetY = margin + rIdx * squareSize + squareSize / 2;

        initialNodes.push({
          id: key,
          file: f,
          rank: r,
          x: targetX,
          y: targetY,
          targetX: targetX,
          targetY: targetY,
          size: squareSize, // 初始大小都是 30
          totalTime: 0,
        });
      });
    });

    // 繪製 64 個 g 元素
    const cells = cellGroup
      .selectAll(".chess-cell")
      .data(initialNodes, (d) => d.id)
      .enter()
      .append("g")
      .attr("class", "chess-cell")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

    // 畫方形
    cells
      .append("rect")
      .attr("width", (d) => d.size)
      .attr("height", (d) => d.size)
      .attr("x", (d) => -d.size / 2)
      .attr("y", (d) => -d.size / 2)
      .attr("fill", (d) =>
        (files.indexOf(d.file) + ranks.indexOf(d.rank)) % 2 === 1
          ? "#b58863"
          : "#f0d9b5",
      )
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 0.5);

    // 畫文字
    cells
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "9px")
      .attr("font-weight", "600")
      .attr("fill", (d) =>
        (files.indexOf(d.file) + ranks.indexOf(d.rank)) % 2 === 1
          ? "#f0d9b5"
          : "#b58863",
      )
      .text((d) => d.id);

    cells.append("title");

    // 初始化物理模擬器，並存入 Ref 中
    simulationRef.current = d3
      .forceSimulation(initialNodes)
      .force("x", d3.forceX((d) => d.targetX).strength(0.75))
      .force("y", d3.forceY((d) => d.targetY).strength(0.75))
      .force(
        "collision",
        d3
          .forceCollide()
          .radius((d) => d.size * 0.62)
          .iterations(4),
      )
      .velocityDecay(0.35);

    // 物理引擎計算時更新 DOM 位置
    simulationRef.current.on("tick", () => {
      svg
        .selectAll(".chess-cell")
        .attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    });

    return () => {
      if (simulationRef.current) simulationRef.current.stop();
    };
  }, []); // 💡 空陣列：只在組件 mount 時執行一次

  // 3. 當 currentSquareData 改變時（按下上一步/下一步），動態調整大小並重啟物理引擎
  useEffect(() => {
    if (!simulationRef.current) return;

    const sizeScale = d3
      .scaleLinear()
      .domain([0, globalMaxTime])
      .range([squareSize, 110]);

    // 取得當前的物理 Nodes 資料
    const currentNodes = simulationRef.current.nodes();

    // 更新每個 Node 的目標大小與時間
    currentNodes.forEach((node) => {
      node.totalTime = currentSquareData[node.id] || 0;
      node.size = sizeScale(node.totalTime);
    });

    // 核心：使用 D3 Transition 讓方塊外觀「平滑變大/變小」
    const svg = d3.select(svgRef.current);
    const cells = svg.selectAll(".chess-cell").data(currentNodes, (d) => d.id);

    cells
      .select("rect")
      .transition()
      .duration(300) // 300毫秒的平滑變形
      .attr("width", (d) => d.size)
      .attr("height", (d) => d.size)
      .attr("x", (d) => -d.size / 2)
      .attr("y", (d) => -d.size / 2)
      .attr("stroke", (d) => (d.totalTime > 0 ? "#ea580c" : "#cbd5e1"))
      .attr("stroke-width", (d) => (d.totalTime > 0 ? 1.5 : 0.5));

    cells
      .select("text")
      .transition()
      .duration(300)
      .attr("font-size", (d) => (d.size < 40 ? "9px" : "12px"));

    cells
      .select("title")
      .text((d) => `格子: ${d.id}\n總思考時間: ${d.totalTime} 秒`);

    // 🔥 重新設定碰撞半徑（因為 size 變了），並叫醒物理引擎（Re-heat）
    simulationRef.current
      .force(
        "collision",
        d3
          .forceCollide()
          .radius((d) => d.size * 0.62)
          .iterations(4),
      )
      .alpha(0.3) // 給予物理引擎一點能量
      .restart(); // 開始推開！
  }, [currentSquareData, globalMaxTime]);

  // 4. 播放控制按鈕事件
  const handleNext = () => {
    if (currentPly < processedMoves.length) setCurrentPly((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (currentPly > 0) setCurrentPly((prev) => prev - 1);
  };

  const handleReset = () => {
    setCurrentPly(0);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
      }}
    >
      {/* 🎮 播放控制面板 */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <button onClick={handleReset} style={btnStyle}>
          ↩️ 重設
        </button>
        <button
          onClick={handlePrev}
          disabled={currentPly === 0}
          style={btnStyle}
        >
          ◀️ 上一步
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
            ? "初始棋盤"
            : `步數: ${currentPly} / ${processedMoves.length}`}
        </span>
        <button
          onClick={handleNext}
          disabled={currentPly === processedMoves.length}
          style={btnStyle}
        >
          下一步 ▶️
        </button>
      </div>

      {/* 顯示當前這一步的棋譜資訊 */}
      {currentPly > 0 && processedMoves[currentPly - 1] && (
        <div style={{ color: "#ea580c", fontWeight: "bold", fontSize: "14px" }}>
          當前動態：
          {processedMoves[currentPly - 1].color === "white" ? "白方" : "黑方"}{" "}
          走{" "}
          <span
            style={{
              background: "#475569",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            {processedMoves[currentPly - 1].notation}
          </span>{" "}
          (思考了 {processedMoves[currentPly - 1].timeSpent} 秒)
        </div>
      )}

      {/* 棋盤畫布 */}
      <div
        style={{
          background: "#1e293b",
          padding: "20px",
          borderRadius: "16px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          style={{ maxWidth: `${width}px` }}
        />
      </div>
    </div>
  );
}

// 簡單的按鈕樣式
const btnStyle = {
  background: "#334155",
  color: "#f8fafc",
  border: "none",
  padding: "8px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
  transition: "background 0.2s",
};
