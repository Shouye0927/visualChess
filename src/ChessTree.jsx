import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

export function ChessTree() {
  // --- React State ---
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState("all");
  const [matchingGames, setMatchingGames] = useState([]);

  // --- Refs ---
  const svgRef = useRef(null);

  useEffect(() => {
    const jsonUrl =
      "https://raw.githubusercontent.com/Shouye0927/chess_data_provider/refs/heads/main/jackFoooo_Rapid.json";

    fetch(jsonUrl)
      .then((res) => res.json())
      .then((data) => {
        setAllGames(data.map((g, i) => ({ ...g, originalIndex: i })));
        setLoading(false);
      })
      .catch((err) => {
        console.error("讀取資料失敗", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (loading || allGames.length === 0 || !svgRef.current) return;

    let filteredGames = [];
    if (side === "white") {
      filteredGames = allGames.filter((g) => g.metadata.White === "JackFoooo");
    } else if (side === "black") {
      filteredGames = allGames.filter((g) => g.metadata.Black === "JackFoooo");
    } else {
      filteredGames = [...allGames];
    }

    let rawTreeData = { name: "START", count: filteredGames.length, path: [] };

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const zoomGroup = svg.append("g");
    const zoom = d3
      .zoom()
      .scaleExtent([0.2, 3])
      .on("zoom", (event) => zoomGroup.attr("transform", event.transform));

    svg.call(zoom);

    const containerWidth = svgRef.current.clientWidth || 800;
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(containerWidth * 0.35, 80)
    );

    const treeLayout = d3.tree().nodeSize([140, 180]);
    const diagonal = (d) => `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;

    const linkGroup = zoomGroup.append("g").attr("class", "links-layer");
    const nodeGroup = zoomGroup.append("g").attr("class", "nodes-layer");

    function getNodeFill(depth) {
      if (depth === 0) return "#eeeeee";
      return depth % 2 !== 0 ? "#ffffff" : "#000000";
    }

    function getTextColor(depth) {
      if (depth === 0) return "#333333";
      return depth % 2 !== 0 ? "#000000" : "#ffffff";
    }

    function updateList(path) {
      const currentPly = path.length;
      const matching = filteredGames.filter((g) => {
        for (let i = 0; i < currentPly; i++) {
          if (!g.moves[i] || g.moves[i].notation !== path[i]) return false;
        }
        return true;
      });
      setMatchingGames(matching);
    }

    function toggleNode(d) {
      const rawData = d.data;

      if (rawData.children) {
        rawData._children = rawData.children;
        rawData.children = null;
      } else if (rawData._children) {
        rawData.children = rawData._children;
        rawData._children = null;
      } else {
        const path = rawData.path;
        const currentPly = path.length;

        const matching = filteredGames.filter((g) => {
          for (let i = 0; i < currentPly; i++) {
            if (!g.moves[i] || g.moves[i].notation !== path[i]) return false;
          }
          return true;
        });

        const counts = {};
        matching.forEach((g) => {
          if (g.moves.length > currentPly) {
            const n = g.moves[currentPly].notation;
            counts[n] = (counts[n] || 0) + 1;
          }
        });

        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        if (sorted.length > 0) {
          rawData.children = sorted.map((m) => ({
            name: m[0],
            count: m[1],
            path: [...path, m[0]],
          }));
        }
      }

      updateTree();
      updateList(rawData.path);
    }

    function updateTree() {
      const root = d3.hierarchy(rawTreeData);
      const treeData = treeLayout(root);
      const nodes = treeData.descendants();
      const links = treeData.links();

      const maxGames = Math.max(1, filteredGames.length);
      const rScale = d3.scaleSqrt().domain([0, maxGames]).range([25, 60]);

      const node = nodeGroup
        .selectAll("g.node")
        .data(nodes, (d) => d.data.path.join("-") || "root");

      // === Enter ===
      const nodeEnter = node
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", (d) => {
          const p = d.parent || root;
          return `translate(${p.x},${p.y})`;
        })
        .on("click", (event, d) => toggleNode(d));

      nodeEnter
        .append("circle")
        .attr("r", 1e-6)
        .style("stroke", "#666")
        .style("stroke-width", "1px");

      nodeEnter
        .append("text")
        .attr("class", "move-name")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.2em")
        .style("fill-opacity", 1e-6);

      nodeEnter
        .append("text")
        .attr("class", "move-count")
        .attr("text-anchor", "middle")
        .attr("dy", "1.2em")
        .style("font-size", "12px")
        .style("fill-opacity", 1e-6);

      // === Update ===
      const nodeUpdate = nodeEnter.merge(node);

      nodeUpdate
        .transition()
        .duration(500)
        .attr("transform", (d) => `translate(${d.x},${d.y})`);

      nodeUpdate
        .select("circle")
        .transition()
        .duration(500)
        .attr("r", (d) => rScale(d.data.count))
        .style("fill", (d) => getNodeFill(d.depth));

      nodeUpdate
        .select(".move-name")
        .transition()
        .duration(500)
        .style("fill-opacity", 1)
        .text((d) => d.data.name)
        .style("fill", (d) => getTextColor(d.depth));

      nodeUpdate
        .select(".move-count")
        .transition()
        .duration(500)
        .style("fill-opacity", 1)
        .text((d) => (d.data.count ? `(${d.data.count})` : ""))
        .style("fill", (d) => getTextColor(d.depth));

      // === Exit ===
      const nodeExit = node
        .exit()
        .transition()
        .duration(500)
        .attr("transform", (d) => {
          const p = d.parent || root;
          return `translate(${p.x},${p.y})`;
        })
        .remove();

      nodeExit.select("circle").attr("r", 1e-6);
      nodeExit.selectAll("text").style("fill-opacity", 1e-6);

      // === Links ===
      const link = linkGroup
        .selectAll("path.link")
        .data(links, (d) => d.target.data.path.join("-"));

      const linkEnter = link
        .enter()
        .insert("path", "g")
        .attr("class", "link")
        .attr("d", (d) => {
          const o = { x: d.source.x, y: d.source.y };
          return diagonal({ source: o, target: o });
        });

      const linkUpdate = linkEnter.merge(link);
      linkUpdate.transition().duration(500).attr("d", diagonal);

      link
        .exit()
        .transition()
        .duration(500)
        .attr("d", (d) => {
          const o = { x: d.source.x, y: d.source.y };
          return diagonal({ source: o, target: o });
        })
        .remove();
    }

    // initialize
    toggleNode({ data: rawTreeData });

  }, [allGames, side, loading]);

  // --- Render UI ---
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "144vh",
        height: "100vh",
        backgroundColor: "#f0f0f0",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* 獨立注入 D3 節點需要用到的 CSS 樣式 */}
      <style>
        {`
          .node circle { cursor: pointer; transition: stroke-width 0.2s; }
          .node circle:hover { stroke-width: 4px !important; }
          .node text { font-family: Arial, sans-serif; pointer-events: none; }
          .link { fill: none; stroke: #888; stroke-width: 1px; }
        `}
      </style>

      {/* 控制列 */}
      <div
        style={{
          padding: "15px",
          background: "#fff",
          boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "15px",
        }}
      >
        <label htmlFor="side-filter">Side: </label>
        <select
          id="side-filter"
          value={side}
          onChange={(e) => setSide(e.target.value)}
          style={{ padding: "5px", fontSize: "14px" }}
        >
          <option value="all">All</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
        <span
          style={{ fontWeight: "bold", color: "#d32f2f", marginLeft: "20px" }}
        >
          {loading ? "資料載入中..." : `${matchingGames.length} games`}
        </span>
      </div>

      {/* 畫面主體 */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* D3 圖表容器 */}
        <div
          style={{ flex: 3, position: "relative", backgroundColor: "#ffffff" }}
        >
          {/* ✅ 正確：將 ref={svgRef} 綁定在 svg 標籤上 */}
          <svg ref={svgRef} width="100%" height="100%"></svg>
        </div>

        {/* 右側列表容器 */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#ffffff",
            borderLeft: "2px solid #ddd",
            padding: "20px",
            overflowY: "auto",
            boxShadow: "-2px 0 5px rgba(0,0,0,0.05)",
          }}
        >
          <h3 style={{ marginTop: 0, color: "#333" }}>Games</h3>
          <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
            {matchingGames.length === 0 ? (
              <li style={{ color: "#999", padding: "10px 0" }}>None</li>
            ) : (
              matchingGames.map((g) => (
                <li
                  key={g.originalIndex}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid #eee",
                    fontSize: "14px",
                    color: "#333",
                  }}
                >
                  #{g.originalIndex}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}