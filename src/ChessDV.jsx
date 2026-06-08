import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

// ==========================================
// ⚙️ 核心設定：修改這裡即可更換棋手、兩個「局數範圍」
// ==========================================
const TARGET_PLAYER = 'JackFoooo'; // 目標棋手用戶名 (不分大小寫)

// 棋盤 A 的局數範圍 [起始局數, 結束局數] (從 1 開始)
const GAME_RANGE_A = [200, 230]; 

// 棋盤 B 的局數範圍 [起始局數, 結束局數]
const GAME_RANGE_B = [230, 240]; 

const DATA_URL = 'https://raw.githubusercontent.com/Shouye0927/chess_data_provider/refs/heads/main/jackFoooo_Rapid.json';

const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = ['8','7','6','5','4','3','2','1'];

// ── 座標轉換：'f7' → { col:5, row:1 } ──
function squareToIndex(sq) {
  if (!sq || sq.length < 2) return null;
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]) - 1;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return { col: file, row: 7 - rank };
}

// ── 用棋盤狀態模擬追蹤棋子位置 ──
function getInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = ['R','N','B','Q','K','B','N','R'];
  backRank.forEach((p, c) => { board[7][c] = { piece: p, color: 'white' }; });
  for (let c = 0; c < 8; c++) board[6][c] = { piece: 'P', color: 'white' };
  backRank.forEach((p, c) => { board[0][c] = { piece: p, color: 'black' }; });
  for (let c = 0; c < 8; c++) board[1][c] = { piece: 'P', color: 'black' };
  return board;
}

// ── 判斷主教吃子，回傳目標格 ──
function parseBishopCapture(notation) {
  const n = notation.replace(/[+#!?]/g, '');
  const match = n.match(/^B[a-h1-8]?x([a-h][1-8])$/);
  return match ? match[1] : null;
}

// ── 解析 notation 取得 from/to ──
function parseMove(notation, board, currentColor) {
  const n = notation.replace(/[+#!?=.]/g, '').trim();
  if (n === 'O-O' || n === 'O-O-O') return null;

  const toMatch = n.match(/([a-h][1-8])$/);
  if (!toMatch) return null;
  const toSq  = toMatch[1];
  const toIdx = squareToIndex(toSq);
  if (!toIdx) return null;

  const pieceChar = n[0] === n[0].toUpperCase() && n[0] !== n[0].toLowerCase() ? n[0] : 'P';
  const piece = 'KQRBN'.includes(pieceChar) ? pieceChar : 'P';
  const disambig = n.replace(/x/, '').replace(/[A-Z]/, '').replace(/[a-h][1-8]$/, '');

  let fromIdx = null;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell || cell.color !== currentColor || cell.piece !== piece) continue;
      if (disambig.length > 0) {
        if (/[a-h]/.test(disambig) && FILES[c] !== disambig.match(/[a-h]/)?.[0]) continue;
        if (/[1-8]/.test(disambig) && RANKS[r] !== disambig.match(/[1-8]/)?.[0]) continue;
      }
      if (piece === 'B') {
        const dr = Math.abs(r - toIdx.row);
        const dc = Math.abs(c - toIdx.col);
        if (dr !== dc || dr === 0) continue;
      }
      fromIdx = { row: r, col: c };
      break;
    }
    if (fromIdx) break;
  }
  return fromIdx ? { from: fromIdx, to: toIdx, piece, color: currentColor } : null;
}

function applyMove(board, moveInfo) {
  if (!moveInfo) return board;
  const newBoard = board.map(r => [...r]);
  const { from, to, piece, color } = moveInfo;
  newBoard[to.row][to.col] = { piece, color };
  newBoard[from.row][from.col] = null;
  return newBoard;
}

// ── 核心過濾：只解析「特定局數範圍」內的主教獵車 ──
function parseBishopCapturesForGameRange(sortedGames, colorFilter, startIdx, endIdx) {
  const board = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => ({ total: 0, white: 0, black: 0, attacks: [] }))
  );

  // 根據局數範圍 (Index 從 1 開始) 進行切片
  const targetGames = sortedGames.slice(startIdx - 1, endIdx);

  for (const game of targetGames) {
    if (!game.moves) continue;
    let chessBoard = getInitialBoard();
    const isWhite = game.metadata.White?.toLowerCase() === TARGET_PLAYER.toLowerCase();

    for (const move of game.moves) {
      const attackerColor = move.color;
      const isTargetMove = (isWhite && attackerColor === 'white') || (!isWhite && attackerColor === 'black');
      const capturedSq = parseBishopCapture(move.notation);

      if (capturedSq) {
        const toIdx = squareToIndex(capturedSq);
        
        let isRookCaptured = false;
        if (toIdx) {
          const targetCell = chessBoard[toIdx.row][toIdx.col];
          if (targetCell && targetCell.piece === 'R') {
            isRookCaptured = true;
          }
        }

        if (toIdx && isTargetMove && isRookCaptured) {
          const moveInfo = parseMove(move.notation, chessBoard, attackerColor);

          if (colorFilter === 'all' || colorFilter === attackerColor) {
            const { row, col } = toIdx;
            board[row][col].total++;
            if (attackerColor === 'white') board[row][col].white++;
            else board[row][col].black++;

            if (moveInfo) {
              board[row][col].attacks.push({
                fromRow: moveInfo.from.row,
                fromCol: moveInfo.from.col,
                color: attackerColor,
              });
            }
          }
        }
        const moveInfo2 = parseMove(move.notation, chessBoard, attackerColor);
        chessBoard = applyMove(chessBoard, moveInfo2);
      } else {
        const moveInfo = parseMove(move.notation, chessBoard, attackerColor);
        chessBoard = applyMove(chessBoard, moveInfo);
      }
    }
  }

  return {
    gameCount: targetGames.length,
    flatData: Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 8 }, (_, col) => ({ row, col, ...board[row][col] }))
    ).flat()
  };
}

// ══════════════════════════════════════════
// 子元件：Elo 趨勢折線圖 (同步局數背景帶)
// ══════════════════════════════════════════
function EloTrendChart({ trendData }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!trendData || !trendData.length || !svgRef.current) return;

    const margin = { top: 20, right: 30, bottom: 35, left: 50 };
    const width = 1036 - margin.left - margin.right;
    const height = 180 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // 1. 比例尺
    const xScale = d3.scaleLinear()
      .domain([1, trendData.length])
      .range([0, width]);

    const yMin = d3.min(trendData, d => d.rating) || 0;
    const yMax = d3.max(trendData, d => d.rating) || 2000;
    const yScale = d3.scaleLinear()
      .domain([Math.max(0, yMin - 50), yMax + 50])
      .range([height, 0]);

    // 2. 座標軸設定
    const totalGames = trendData.length;
    const tickValues = [1];
    for (let i = 50; i <= totalGames; i += 50) {
      tickValues.push(i);
    }
    if (totalGames % 50 !== 0 && totalGames > 10) {
      tickValues.push(totalGames);
    }

    const xAxis = d3.axisBottom(xScale)
      .tickValues(tickValues)
      .tickFormat(d => `第 ${d} 局`);

    const yAxis = d3.axisLeft(yScale).ticks(4);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .attr('font-family', 'Georgia, serif')
      .attr('color', '#5c4a32')
      .selectAll('text')
      .style('text-anchor', 'middle')
      .attr('dy', '10px');

    g.append('g')
      .call(yAxis)
      .attr('font-family', 'Georgia, serif')
      .attr('color', '#5c4a32');

    // 3. 🌟 繪製「局數區間」背景帶 (直接在 X 軸上標記 A 與 B 區間)
    // 區間 A 背景 (黃褐色)
    g.append('rect')
      .attr('x', xScale(GAME_RANGE_A[0]))
      .attr('width', xScale(GAME_RANGE_A[1]) - xScale(GAME_RANGE_A[0]))
      .attr('y', 0)
      .attr('height', height)
      .attr('fill', '#e8dcc8')
      .attr('opacity', 0.35);

    // 區間 B 背景 (淡藍色)
    g.append('rect')
      .attr('x', xScale(GAME_RANGE_B[0]))
      .attr('width', xScale(GAME_RANGE_B[1]) - xScale(GAME_RANGE_B[0]))
      .attr('y', 0)
      .attr('height', height)
      .attr('fill', '#d0e0f0')
      .attr('opacity', 0.35);

    // 4. 繪製折線
    const line = d3.line()
      .x(d => xScale(d.gameIndex))
      .y(d => yScale(d.rating))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(trendData)
      .attr('fill', 'none')
      .attr('stroke', '#8b1a1a')
      .attr('stroke-width', 2.5)
      .attr('d', line);

    // 5. 繪製資料點：每 10 局標記一個圓點
    const dottedData = trendData.filter(d => d.gameIndex % 10 === 0 || d.gameIndex === 1 || d.gameIndex === totalGames);

    g.selectAll('.dot')
      .data(dottedData)
      .join('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.gameIndex))
      .attr('cy', d => yScale(d.rating))
      .attr('r', 4) 
      .attr('fill', d => d.gameIndex % 50 === 0 ? '#8b1a1a' : '#2c1810') 
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .append('title')
      .text(d => `局數: 第 ${d.gameIndex} 局\n日期: ${d3.timeFormat("%Y-%m-%d")(d.date)}\nElo: ${d.rating}`);

  }, [trendData]);

  return (
    <div style={{ background: '#fcfaf2', padding: '16px', borderRadius: 8, boxShadow: '0 4px 15px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#2c1810', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📈 Elo 實戰局數增長圖</span>
        <span style={{ fontSize: 12, fontWeight: 'normal', color: '#8b7355' }}>
          黃色背景：區間 A (第 {GAME_RANGE_A[0]}-{GAME_RANGE_A[1]} 局) | 藍色背景：區間 B (第 {GAME_RANGE_B[0]}-{GAME_RANGE_B[1]} 局)
        </span>
      </h3>
      <svg ref={svgRef} width="100%" height="180" viewBox="0 0 1036 180" style={{ display: 'block' }} />
    </div>
  );
}

// ══════════════════════════════════════════
// 子元件：單個棋盤繪製 (D3 封裝)
// ══════════════════════════════════════════
function ChessBoard({ boardData, maxVal, onHover, onClick }) {
  const svgRef = useRef(null);
  const CELL = 48;
  const MARGIN = { top: 24, left: 24, right: 24, bottom: 24 };
  const W = CELL * 8 + MARGIN.left + MARGIN.right;
  const H = CELL * 8 + MARGIN.top + MARGIN.bottom;

  useEffect(() => {
    if (!boardData.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    g.selectAll('.cell')
      .data(boardData)
      .join('rect')
      .attr('class', 'cell')
      .attr('x', d => d.col * CELL).attr('y', d => d.row * CELL)
      .attr('width', CELL).attr('height', CELL)
      .attr('fill', d => (d.row + d.col) % 2 === 0 ? '#f0d9b5' : '#b58863')
      .attr('stroke', '#8b7355').attr('stroke-width', 0.8);

    const sizeScale = d3.scaleSqrt().domain([0, maxVal || 1]).range([0, CELL * 0.78]);

    g.selectAll('.xg').data(boardData).join('g')
      .attr('class', 'xg')
      .attr('transform', d => `translate(${d.col * CELL + CELL / 2},${d.row * CELL + CELL / 2})`)
      .each(function(d) {
        if (d.total === 0) return;
        const s  = sizeScale(d.total) / 2;
        const sw = Math.max(1.5, s / 6);
        const c  = (d.row + d.col) % 2 === 0 ? '#8b1a1a' : '#5c0a0a';
        d3.select(this).append('line')
          .attr('x1', -s).attr('y1', -s).attr('x2', s).attr('y2', s)
          .attr('stroke', c).attr('stroke-width', sw).attr('stroke-linecap', 'round');
        d3.select(this).append('line')
          .attr('x1', s).attr('y1', -s).attr('x2', -s).attr('y2', s)
          .attr('stroke', c).attr('stroke-width', sw).attr('stroke-linecap', 'round');
      });

    g.selectAll('.lbl').data(boardData.filter(d => d.total > 0)).join('text')
      .attr('class', 'lbl')
      .attr('x', d => d.col * CELL + CELL - 3).attr('y', d => d.row * CELL + 10)
      .attr('text-anchor', 'end').attr('font-size', 8)
      .attr('fill', d => (d.row + d.col) % 2 === 0 ? '#7a5c3a' : '#f0d9b5')
      .attr('font-family', 'Georgia, serif').text(d => d.total);

    g.selectAll('.hcell').data(boardData).join('rect')
      .attr('class', 'hcell')
      .attr('x', d => d.col * CELL).attr('y', d => d.row * CELL)
      .attr('width', CELL).attr('height', CELL)
      .attr('fill', 'transparent')
      .style('cursor', d => d.total > 0 ? 'pointer' : 'default')
      .on('mousemove', function(event, d) { onHover(d, event); })
      .on('mouseleave', () => onHover(null, null))
      .on('click', function(event, d) {
        if (d.total > 0) onClick(d);
      });

    FILES.forEach((f, i) => {
      g.append('text').attr('x', i * CELL + CELL / 2).attr('y', -10).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-size', 10).attr('fill', '#5c4a32').text(f);
      g.append('text').attr('x', i * CELL + CELL / 2).attr('y', CELL * 8 + 10).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-size', 10).attr('fill', '#5c4a32').text(f);
    });
    RANKS.forEach((r, i) => {
      g.append('text').attr('x', -10).attr('y', i * CELL + CELL / 2).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-size', 10).attr('fill', '#5c4a32').text(r);
      g.append('text').attr('x', CELL * 8 + 10).attr('y', i * CELL + CELL / 2).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-size', 10).attr('fill', '#5c4a32').text(r);
    });

  }, [boardData, maxVal]);

  return (
    <svg ref={svgRef} width={W} height={H} style={{ display: 'block', margin: '0 auto', borderRadius: 4, boxShadow: '0 4px 15px rgba(0,0,0,0.12)' }} />
  );
}

// ══════════════════════════════════════════
// 子元件：詳細獵車來源圖 (Modal)
// ══════════════════════════════════════════
function AttackDetailChart({ cellData, onClose }) {
  const detailRef = useRef(null);
  const CELL = 44;
  const MARGIN = { top: 28, left: 28, right: 28, bottom: 28 };
  const W = CELL * 8 + MARGIN.left + MARGIN.right;
  const H = CELL * 8 + MARGIN.top + MARGIN.bottom;

  useEffect(() => {
    if (!detailRef.current || !cellData) return;

    const svg = d3.select(detailRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        g.append('rect')
          .attr('x', c * CELL).attr('y', r * CELL)
          .attr('width', CELL).attr('height', CELL)
          .attr('fill', (r + c) % 2 === 0 ? '#f0d9b5' : '#b58863')
          .attr('stroke', '#8b7355').attr('stroke-width', 0.5);
      }
    }

    const { row: tRow, col: tCol } = cellData;
    g.append('rect')
      .attr('x', tCol * CELL).attr('y', tRow * CELL)
      .attr('width', CELL).attr('height', CELL)
      .attr('fill', 'rgba(255, 80, 80, 0.45)')
      .attr('stroke', '#cc0000').attr('stroke-width', 2);

    const tx = tCol * CELL + CELL / 2;
    const ty = tRow * CELL + CELL / 2;
    const xs = CELL * 0.3;
    g.append('line').attr('x1', tx - xs).attr('y1', ty - xs).attr('x2', tx + xs).attr('y2', ty + xs).attr('stroke', '#cc0000').attr('stroke-width', 2.5);
    g.append('line').attr('x1', tx + xs).attr('y1', ty - xs).attr('x2', tx - xs).attr('y2', ty + xs).attr('stroke', '#cc0000').attr('stroke-width', 2.5);

    const attacks = cellData.attacks || [];
    const lineCount = {};
    attacks.forEach(a => {
      const key = `${a.fromRow},${a.fromCol},${a.color}`;
      lineCount[key] = (lineCount[key] || 0) + 1;
    });

    const drawn = new Set();
    attacks.forEach(a => {
      const key = `${a.fromRow},${a.fromCol},${a.color}`;
      if (drawn.has(key)) return;
      drawn.add(key);

      const count = lineCount[key];
      const fx = a.fromCol * CELL + CELL / 2;
      const fy = a.fromRow * CELL + CELL / 2;
      const lineColor = a.color === 'white' ? `rgba(240, 200, 80, 0.85)` : `rgba(60, 100, 220, 0.75)`;

      g.append('line')
        .attr('x1', fx).attr('y1', fy).attr('x2', tx).attr('y2', ty)
        .attr('stroke', lineColor)
        .attr('stroke-width', Math.min(1.2 + count * 0.5, 5))
        .attr('opacity', 0.85);

      g.append('circle')
        .attr('cx', fx).attr('cy', fy).attr('r', Math.min(3 + count * 0.4, 7))
        .attr('fill', lineColor).attr('stroke', '#fff').attr('stroke-width', 0.8);
    });

    FILES.forEach((f, i) => {
      g.append('text').attr('x', i * CELL + CELL / 2).attr('y', -10).attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#5c4a32').text(f);
    });
    RANKS.forEach((r, i) => {
      g.append('text').attr('x', -10).attr('y', i * CELL + CELL / 2).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-size', 9).attr('fill', '#5c4a32').text(r);
    });

  }, [cellData]);

  if (!cellData) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#f5f0e8', borderRadius: 12, padding: '24px 28px', boxShadow: '0 8px 40px rgba(0,0,0,0.4)', fontFamily: 'Georgia, serif', maxWidth: 520, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, color: '#2c1810', margin: 0 }}>格子 {FILES[cellData.col]}{RANKS[cellData.row]} 的獵車路徑</h2>
            <p style={{ fontSize: 12, color: '#8b7355', margin: '4px 0 0' }}>主教在此格吃車 <strong>{cellData.total}</strong> 次 (白: {cellData.white} / 黑: {cellData.black})</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#8b7355' }}>✕</button>
        </div>
        <svg ref={detailRef} width={W} height={H} style={{ display: 'block', margin: '0 auto', borderRadius: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// 主元件
// ══════════════════════════════════════════
export default function App() {
  const [games, setGames] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [color, setColor] = useState('all');
  const [hovered, setHovered] = useState(null);
  const [ttPos, setTtPos] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState(null);

  // 統一處理並排序好的趨勢資料
  const [trendData, setTrendData] = useState([]);

  // 雙棋盤資料狀態
  const [rangeAData, setRangeAData] = useState([]);
  const [rangeBData, setRangeBData] = useState([]);
  const [rangeAGamesCount, setRangeAGamesCount] = useState(0);
  const [rangeBGamesCount, setRangeBGamesCount] = useState(0);

  useEffect(() => {
    fetch(DATA_URL)
      .then(r => r.json())
      .then(data => { setGames(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!games) return;

    // 1. 預先清洗並排序所有戰局，建立乾淨的局數時間線
    const sorted = games
      .map(g => {
        const meta = g.metadata;
        if (!meta) return null;
        const isWhite = meta.White?.toLowerCase() === TARGET_PLAYER.toLowerCase();
        const rating = isWhite ? parseInt(meta.WhiteElo) : parseInt(meta.BlackElo);
        const dateStr = meta.Date || meta.UTCDate;
        const date = d3.timeParse("%Y.%m.%d")(dateStr) || new Date();
        return { ...g, date, rating };
      })
      // 排除異常值並排序
      .filter(d => d !== null && !isNaN(d.rating) && d.rating >= 300)
      .sort((a, b) => a.date - b.date);

    // 建立用於折線圖的資料
    const trend = sorted.map((d, i) => ({
      gameIndex: i + 1,
      rating: d.rating,
      date: d.date
    }));
    setTrendData(trend);

    // 2. 根據「局數範圍」解析雙棋盤
    const resultA = parseBishopCapturesForGameRange(sorted, color, GAME_RANGE_A[0], GAME_RANGE_A[1]);
    setRangeAData(resultA.flatData);
    setRangeAGamesCount(resultA.gameCount);

    const resultB = parseBishopCapturesForGameRange(sorted, color, GAME_RANGE_B[0], GAME_RANGE_B[1]);
    setRangeBData(resultB.flatData);
    setRangeBGamesCount(resultB.gameCount);

  }, [games, color]);

  const maxVal = d3.max([...rangeAData, ...rangeBData], d => d.total) || 1;
  const totalCapturesA = rangeAData.reduce((s, d) => s + d.total, 0);
  const totalCapturesB = rangeBData.reduce((s, d) => s + d.total, 0);

  const handleHover = (data, event) => {
    setHovered(data);
    if (event) {
      setTtPos({ x: event.clientX + 16, y: event.clientY - 10 });
    }
  };

  const btnStyle = (active) => ({
    padding: '6px 18px', borderRadius: 20, fontSize: 14,
    border: active ? '2px solid #5c4a32' : '2px solid #c8b89a',
    background: active ? '#5c4a32' : '#f5f0e8',
    color: active ? '#f5f0e8' : '#5c4a32',
    fontWeight: active ? 'bold' : 'normal',
    marginRight: 8, cursor: 'pointer',
    fontFamily: 'Georgia, serif', transition: 'all 0.2s',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f5f0e8', padding: '2rem', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <h1 style={{ fontSize: 26, color: '#2c1810', marginBottom: 4 }}>
          {TARGET_PLAYER} 的主教獵車（Rook）與局數區間對比
        </h1>
        <hr style={{ borderColor: '#c8b89a', marginBottom: 14 }} />

        <div style={{ color: '#5c4a32', fontSize: 13, marginBottom: 16, lineHeight: 1.9 }}>
          <p>🎯 棋盤僅統計 <strong>{TARGET_PLAYER}</strong> 的<strong>主教吃掉對方城堡（車）</strong>的歷史紀錄。</p>
          <p>📐 兩個棋盤使用相同的十字大小比例尺，方便直觀對比不同「局數區間」的戰術表現。</p>
          <p>🖱️ <strong>滑鼠懸停</strong>查看數量　<strong>點擊格子</strong>查看主教從哪裡發動狙擊</p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: '#5c4a32', marginRight: 8 }}>主教顏色：</span>
          {[['all','全部'], ['white','白方主教 ♗'], ['black','黑方主教 ♝']].map(([v, l]) => (
            <button key={v} style={btnStyle(color === v)} onClick={() => setColor(v)}>{l}</button>
          ))}
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', height: 200, fontSize: 18, color: '#5c4a32' }}>
            正在載入 Chess.com 戰局資料並模擬棋盤狀態...
          </div>
        )}

        {error && (
          <div style={{ color: '#c0392b', padding: 16, background: '#fdecea', borderRadius: 8 }}>
            ❌ 載入失敗：{error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* 📈 局數橫軸 Elo 折線圖 (背景帶會自動同步 A 與 B 的局數範圍) */}
            <EloTrendChart trendData={trendData} />

            {/* 雙棋盤並列 */}
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              
              {/* 左棋盤：局數範圍 A */}
              <div style={{ flex: '1 1 450px', minWidth: 350, textAlign: 'center' }}>
                <div style={{ marginBottom: 12, padding: '10px', background: '#e8dcc8', borderRadius: 8 }}>
                  <h3 style={{ margin: '0 0 4px 0', color: '#2c1810' }}>
                    區間 A (第 {GAME_RANGE_A[0]} - {GAME_RANGE_A[1]} 局)
                  </h3>
                  <div style={{ fontSize: 12, color: '#5c4a32', display: 'flex', justifyContent: 'space-around' }}>
                    <span>分析局數：<strong>{rangeAGamesCount}</strong> 局</span>
                    <span>成功獵車：<strong style={{ color: '#8b1a1a' }}>{totalCapturesA}</strong> 次</span>
                  </div>
                </div>
                <ChessBoard boardData={rangeAData} maxVal={maxVal} onHover={handleHover} onClick={setSelected} />
              </div>

              {/* 右棋盤：局數範圍 B */}
              <div style={{ flex: '1 1 450px', minWidth: 350, textAlign: 'center' }}>
                <div style={{ marginBottom: 12, padding: '10px', background: '#d0e0f0', borderRadius: 8 }}>
                  <h3 style={{ margin: '0 0 4px 0', color: '#2c1810' }}>
                    區間 B (第 {GAME_RANGE_B[0]} - {GAME_RANGE_B[1]} 局)
                  </h3>
                  <div style={{ fontSize: 12, color: '#5c4a32', display: 'flex', justifyContent: 'space-around' }}>
                    <span>分析局數：<strong>{rangeBGamesCount}</strong> 局</span>
                    <span>成功獵車：<strong style={{ color: '#8b1a1a' }}>{totalCapturesB}</strong> 次</span>
                  </div>
                </div>
                <ChessBoard boardData={rangeBData} maxVal={maxVal} onHover={handleHover} onClick={setSelected} />
              </div>

            </div>
          </>
        )}
      </div>

      {hovered && hovered.total > 0 && (
        <div style={{
          position: 'fixed', left: ttPos.x, top: ttPos.y,
          background: 'rgba(20,12,5,0.95)', color: '#f5f0e8',
          padding: '10px 14px', borderRadius: 6, fontSize: 13,
          pointerEvents: 'none', zIndex: 500,
          border: '1px solid #8b7355', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          minWidth: 160,
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 5, color: '#f5d78e', fontSize: 14 }}>
            格子 {FILES[hovered.col]}{RANKS[hovered.row]}
          </div>
          <div style={{ marginBottom: 4 }}>
            主教吃車：<strong style={{ color: '#f5d78e' }}>{hovered.total}</strong> 次
          </div>
          <hr style={{ borderColor: '#5c4a32', margin: '5px 0' }} />
          <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.8 }}>
            ♗ 白方：{hovered.white} 次<br />
            ♝ 黑方：{hovered.black} 次
          </div>
        </div>
      )}

      <AttackDetailChart cellData={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
