import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

export function TimeSquare({ processedMoves }) {
  const svgRef = useRef(null);

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const squareSize = 30; // 基礎大小 30px
  const margin = 140; // 放大留白，給格子往外推開的空間
  const width = squareSize * 8 + margin * 2;
  const height = squareSize * 8 + margin * 2;

  useEffect(() => {
    if (!svgRef.current || !processedMoves.length) return;

    // 1. 統計與轉換基礎資料
    const squareData = {};
    files.forEach((f) =>
      ranks.forEach((r) => {
        squareData[`${f}${r}`] = 0;
      }),
    );

    processedMoves.forEach((move) => {
      if (move.square && squareData[move.square] !== undefined) {
        squareData[move.square] += move.timeSpent;
      }
    });

    const maxTime = d3.max(Object.values(squareData)) || 1;

    // 2. 建立動態大小比例尺（30px ~ 110px）
    const sizeScale = d3
      .scaleLinear()
      .domain([0, maxTime])
      .range([squareSize, 110]);

    // 3. 建立力導向節點資料 (Nodes)
    const nodes = Object.keys(squareData).map((key) => {
      const fIdx = files.indexOf(key[0]);
      const rIdx = ranks.indexOf(parseInt(key[1]));
      const targetSize = sizeScale(squareData[key]);

      const targetX = margin + fIdx * squareSize + squareSize / 2;
      const targetY = margin + rIdx * squareSize + squareSize / 2;

      return {
        id: key,
        file: key[0],
        rank: parseInt(key[1]),
        totalTime: squareData[key],
        size: targetSize,
        // 給予物理起點微幅的隨機擾動，避免完美重疊
        x: targetX + (Math.random() - 0.5) * 5,
        y: targetY + (Math.random() - 0.5) * 5,
        targetX: targetX,
        targetY: targetY,
      };
    });

    // 4. 初始化 SVG 畫布
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const cellGroup = svg.append("g").attr("class", "cells");

    const cells = cellGroup
      .selectAll(".chess-cell")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "chess-cell");

    // 畫出變形的方格（無圓角直角方框）
    cells
      .append("rect")
      .attr("width", (d) => d.size)
      .attr("height", (d) => d.size)
      .attr("x", (d) => -d.size / 2)
      .attr("y", (d) => -d.size / 2)
      .attr("fill", (d) => {
        const isDark =
          (files.indexOf(d.file) + ranks.indexOf(d.rank)) % 2 === 1;
        return isDark ? "#b58863" : "#f0d9b5";
      })
      .attr("stroke", (d) => (d.totalTime > 0 ? "#ea580c" : "#cbd5e1"))
      .attr("stroke-width", (d) => (d.totalTime > 0 ? 1.5 : 0.5));

    // 在格子正中央加上座標文字
    cells
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("x", 0)
      .attr("y", 0)
      // 動態調配字型大小：當格子因為沒花時間縮到 30px 時，字體縮小到 9px 避免爆字
      .attr("font-size", (d) => (d.size < 40 ? "9px" : "12px"))
      .attr("fill", (d) => {
        const isDark =
          (files.indexOf(d.file) + ranks.indexOf(d.rank)) % 2 === 1;
        return isDark ? "#f0d9b5" : "#b58863";
      })
      .attr("font-weight", "600")
      .text((d) => d.id);

    cells
      .append("title")
      .text((d) => `格子: ${d.id}\n總思考時間: ${d.totalTime} 秒`);

    // 5. 🔥 物理力模擬器核心修正
    const simulation = d3
      .forceSimulation(nodes)
      // 提高吸附定位力（從 0.6 升到 0.75），防止基礎小格子在被推擠時大範圍漂移
      .force("x", d3.forceX((d) => d.targetX).strength(0.75))
      .force("y", d3.forceY((d) => d.targetY).strength(0.75))
      // 💡 最核心修正：將半徑設為 d.size * 0.71
      // 這能產生一個完全包覆方形直角的外切圓，彼此推開時角隅絕對不會重疊、卡死
      .force(
        "collision",
        d3
          .forceCollide()
          .radius((d) => d.size * 0.62)
          .iterations(4),
      )
      .velocityDecay(0.35); // 增加一點點物理阻尼，讓外推陣型更快穩定定格

    // 6. 即時更新 SVG 位置
    simulation.on("tick", () => {
      cells.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    });

    return () => simulation.stop();
  }, [processedMoves]);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <div
        style={{
          background: "#1e293b",
          padding: "20px",
          borderRadius: "16px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
        }}
      >
        <svg ref={svgRef} width={width} height={height} />
      </div>
      <p
        style={{
          fontSize: "14px",
          color: "#475569",
          marginTop: "12px",
          maxWidth: "500px",
          textAlign: "center",
          lineHeight: "1.5",
        }}
      >
        ✨ <strong>無重疊動態棋盤</strong>：維持 30px
        的極致緊湊網格。長考大方塊會滑順地將鄰近小方塊推往外圍，且方塊邊角互不重疊。
      </p>
    </div>
  );
}
