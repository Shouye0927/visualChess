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

    for (let i = 0; i < currentPly; i++) {
      const move = processedMoves[i];
      if (move && move.square && data[move.square] !== undefined) {
        data[move.square] += move.timeSpent;
      }
    }
    return data;
  }, [processedMoves, currentPly]);

  // 計算全域最大時間
  const globalMaxTime = useMemo(() => {
    const totalData = {};
    processedMoves.forEach((move) => {
      if (move.square)
        totalData[move.square] = (totalData[move.square] || 0) + move.timeSpent;
    });
    return d3.max(Object.values(totalData)) || 1;
  }, [processedMoves]);

  // 2. 初始化 D3 棋盤 (只在元件 Mount 時執行一次，點擊事件透過 Ref 讀取最新狀態)
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const cellGroup = svg.append("g").attr("class", "cells");
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
          targetX,
          targetY,
          size: squareSize,
          totalTime: 0,
        });
      });
    });

    const cells = cellGroup
      .selectAll(".chess-cell")
      .data(initialNodes, (d) => d.id)
      .enter()
      .append("g")
      .attr("class", "chess-cell")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .style("cursor", "pointer");

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

    // ✨ D3 點擊格子事件
    cells.on("click", function (event, d) {
      event.stopPropagation(); // 阻止冒泡

      // 💡 從 stateRef 獲取最新、不被 D3 初始閉包綁架的最新棋譜資料
      const { processedMoves: currentMoves } = stateRef.current;

      const history = [];
      currentMoves.forEach((move, index) => {
        if (move.square === d.id) {
          history.push({
            plyIndex: index + 1,
            notation: move.notation,
            color: move.color === "white" ? "白方" : "黑方",
            timeSpent: move.timeSpent,
          });
        }
      });

      if (history.length === 0) return;

      if (history.length === 1) {
        // ✨ 單次停留：直接呼叫 props 方法連動變更 App 層狀態，推動右側棋盤
        setCurrentPly(history[0].plyIndex);
        setMenuConfig((prev) => ({ ...prev, visible: false }));
      } else {
        // 多次停留：計算點擊相對於容器的位置彈出選單
        const rect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        setMenuConfig({
          visible: true,
          x: x,
          y: y,
          history: history,
        });
      }
    });

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

    simulationRef.current.on("tick", () => {
      svg
        .selectAll(".chess-cell")
        .attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    });

    return () => {
      if (simulationRef.current) simulationRef.current.stop();
    };
  }, []); // 💡 保持空陣列：只在 Mount 時綁定一次監聽器

  // 3. 當 currentSquareData (或 currentPly) 改變時，更新 D3 節點外觀大小
  useEffect(() => {
    if (!simulationRef.current) return;

    const sizeScale = d3
      .scaleLinear()
      .domain([0, globalMaxTime])
      .range([squareSize, 110]);
    const currentNodes = simulationRef.current.nodes();

    currentNodes.forEach((node) => {
      node.totalTime = currentSquareData[node.id] || 0;
      node.size = sizeScale(node.totalTime);
    });

    const svg = d3.select(svgRef.current);
    const cells = svg.selectAll(".chess-cell").data(currentNodes, (d) => d.id);

    cells
      .select("rect")
      .transition()
      .duration(300)
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

    simulationRef.current
      .force(
        "collision",
        d3
          .forceCollide()
          .radius((d) => d.size * 0.62)
          .iterations(4),
      )
      .alpha(0.3)
      .restart();
  }, [currentSquareData, globalMaxTime]);

  // 點擊別處時關閉多步選單
  useEffect(() => {
    const closeMenu = () =>
      setMenuConfig((prev) => ({ ...prev, visible: false }));
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  // 播放按鈕：直接調用傳進來的更新函式
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
        position: "relative",
      }}
    >
      {/* 播放控制按鈕 */}
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

      {currentPly > 0 && processedMoves[currentPly - 1] && (
        <div style={{ color: "#ea580c", fontWeight: "bold", fontSize: "14px" }}>
          當前動態：
          {processedMoves[currentPly - 1].color === "white"
            ? "白方"
            : "黑方"}{" "}
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
              多步停留，請選擇：
            </div>
            {menuConfig.history.map((item) => (
              <div
                key={item.plyIndex}
                onClick={() => {
                  // 💡 ✨ 點擊彈出選單中的某一步時，直接呼叫 Props 傳下來的核心方法更新步數
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
                  第 {item.plyIndex} 步 ({item.notation})
                </span>
              </div>
            ))}
          </div>
        )}
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
};
