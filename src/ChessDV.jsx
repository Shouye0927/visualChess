import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

// ==========================================
// ⚙️ Core Configuration: Adjust player and game ranges here
// ==========================================
const TARGET_PLAYER = 'JackFoooo'; // Target player username (case-insensitive)

const DATA_URL = 'https://raw.githubusercontent.com/Shouye0927/chess_data_provider/refs/heads/main/jackFoooo_Rapid.json';

const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = ['8','7','6','5','4','3','2','1'];

// ── Coordinate Conversion: 'f7' → { col:5, row:1 } ──
function squareToIndex(sq) {
  if (!sq || sq.length < 2) return null;
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]) - 1;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return { col: file, row: 7 - rank };
}

// ── Initialize Board State to Track Piece Positions ──
function getInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = ['R','N','B','Q','K','B','N','R'];
  backRank.forEach((p, c) => { board[7][c] = { piece: p, color: 'white' }; });
  for (let c = 0; c < 8; c++) board[6][c] = { piece: 'P', color: 'white' };
  backRank.forEach((p, c) => { board[0][c] = { piece: p, color: 'black' }; });
  for (let c = 0; c < 8; c++) board[1][c] = { piece: 'P', color: 'black' };
  return board;
}

// ── Detect Bishop Captures, Returns Target Square ──
function parseBishopCapture(notation) {
  const n = notation.replace(/[+#!?]/g, '');
  const match = n.match(/^B[a-h1-8]?x([a-h][1-8])$/);
  return match ? match[1] : null;
}

// ── Parse Notation to Get from/to Indexes ──
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

// ── Core Filtering: Parse Bishop Captures Rook within specific Game Range ──
function parseBishopCapturesForGameRange(sortedGames, colorFilter, startIdx, endIdx) {
  const board = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => ({ total: 0, white: 0, black: 0, attacks: [] }))
  );

  // Slice games based on Game Index (1-based index)
  const targetGames = sortedGames.slice(startIdx - 1, endIdx);

  for (const game of targetGames) {
    if (!game.moves) continue;
    let chessBoard = getInitialBoard();
    const isWhite = game.metadata.White?.toLowerCase() === TARGET_PLAYER.toLowerCase();

    for (const move of game.moves) {
      const attackerColor = move.color;
      const isOpponentMove = (isWhite && attackerColor === 'black') || (!isWhite && attackerColor === 'white');
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

        if (toIdx && isOpponentMove && isRookCaptured) {
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
// Subcomponent: Elo Trend Chart (Synchronized Game Range)
// ══════════════════════════════════════════
function EloTrendChart({ trendData, splitPoint, onSplitChange }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!trendData || !trendData.length || !svgRef.current) return;

    const margin = { top: 30, right: 30, bottom: 35, left: 50 };
    const width = 1036 - margin.left - margin.right;
    const height = 180 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // 1. Scales
    const xScale = d3.scaleLinear()
      .domain([1, trendData.length])
      .range([0, width])
      .clamp(true);


    const yMin = d3.min(trendData, d => d.rating) || 0;
    const yMax = d3.max(trendData, d => d.rating) || 2000;
    const yScale = d3.scaleLinear()
      .domain([Math.max(0, yMin - 50), yMax + 50])
      .range([height, 0]);

    // 2. Axes
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
      .tickFormat(d => `G ${d}`);

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

    // 3. Highlighted Game Range Background Bands
    // Range A Background (Tan)
    const bandA = g.append('rect')
      .attr('class', 'band-a')
      .attr('x', xScale(1))
      .attr('width', Math.max(0, xScale(splitPoint) - xScale(1)))
      .attr('y', 0)
      .attr('height', height)
      .attr('fill', '#e8dcc8')
      .attr('opacity', 0.45);

    const bandB = g.append('rect')
      .attr('class', 'band-b')
      .attr('x', xScale(splitPoint + 1))
      .attr('width', Math.max(0, xScale(totalGames) - xScale(splitPoint + 1)))
      .attr('y', 0)
      .attr('height', height)
      .attr('fill', '#d0e0f0')
      .attr('opacity', 0.45);

    // 4. Line Generator & Path
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

    // 5. Data Points: Mark a dot every 10 games
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
      .text(d => `Game: No. ${d.gameIndex}\nDate: ${d3.timeFormat("%Y-%m-%d")(d.date)}\nElo: ${d.rating}`);

const drag = d3.drag()
      .on('drag', (event) => {
        // 即時拖曳視覺更新 (不動到 React 狀態以確保流暢)
        let newSplit = Math.round(xScale.invert(event.x));
        newSplit = Math.max(2, Math.min(newSplit, totalGames - 1));

        d3.select('.drag-line').attr('x1', xScale(newSplit)).attr('x2', xScale(newSplit));
        d3.select('.drag-handle').attr('cx', xScale(newSplit));
        d3.select('.drag-label').attr('x', xScale(newSplit)).text(`Split at Game ${newSplit}`);

        // 即時更新背景寬度
        bandA.attr('width', Math.max(0, xScale(newSplit) - xScale(1)));
        bandB.attr('x', xScale(newSplit + 1)).attr('width', Math.max(0, xScale(totalGames) - xScale(newSplit + 1)));
      })
      .on('end', (event) => {
        // 放開滑鼠時，才正式通知 React 改變狀態並重新運算資料
        let newSplit = Math.round(xScale.invert(event.x));
        newSplit = Math.max(2, Math.min(newSplit, totalGames - 1));
        onSplitChange(newSplit);
      });

    const dragGroup = g.append('g')
      .attr('class', 'drag-group')
      .style('cursor', 'ew-resize') // 滑鼠顯示為左右箭頭
      .call(drag);

    // 繪製虛線
    dragGroup.append('line')
      .attr('class', 'drag-line')
      .attr('x1', xScale(splitPoint))
      .attr('x2', xScale(splitPoint))
      .attr('y1', -20)
      .attr('y2', height)
      .attr('stroke', '#cc0000')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '6,4');

    // 繪製控制點 (圓圈)
    dragGroup.append('circle')
      .attr('class', 'drag-handle')
      .attr('cx', xScale(splitPoint))
      .attr('cy', height / 2)
      .attr('r', 9)
      .attr('fill', '#cc0000')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // 繪製文字標籤
    dragGroup.append('text')
      .attr('class', 'drag-label')
      .attr('x', xScale(splitPoint))
      .attr('y', -25)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('fill', '#cc0000')
      .attr('font-weight', 'bold')
      .text(`Split at Game ${splitPoint}`);

  }, [trendData, splitPoint, onSplitChange]);

  return (
    <div style={{ background: '#fcfaf2', padding: '16px', borderRadius: 8, boxShadow: '0 4px 15px rgba(0,0,0,0.08)', marginBottom: '2rem' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#2c1810', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📈 Elo Rating Trend by Game Count</span>
        <span style={{ fontSize: 12, fontWeight: 'normal', color: '#8b7355' }}>
          Tan Band: Range A | Blue Band: Range B
        </span>
      </h3>
      <svg ref={svgRef} width="100%" height="180" viewBox="0 0 1036 180" style={{ display: 'block' }} />
    </div>
  );
}

// ══════════════════════════════════════════
// Subcomponent: Interactive Chessboard
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
// Subcomponent: Attack Path Detail (Modal)
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
            <h2 style={{ fontSize: 18, color: '#2c1810', margin: 0 }}>Attack Paths for Square {FILES[cellData.col]}{RANKS[cellData.row]}</h2>
            <p style={{ fontSize: 12, color: '#8b7355', margin: '4px 0 0' }}>Bishop captured Rook on this square <strong>{cellData.total}</strong> times (White: {cellData.white} / Black: {cellData.black})</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#8b7355' }}>✕</button>
        </div>
        <svg ref={detailRef} width={W} height={H} style={{ display: 'block', margin: '0 auto', borderRadius: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════
export function ChessDV() {
  const [games, setGames] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [color, setColor] = useState('all');
  const [hovered, setHovered] = useState(null);
  const [ttPos, setTtPos] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState(null);

  const [sortedGamesData, setSortedGamesData] = useState([]);
  const [totalGamesCount, setTotalGamesCount] = useState(0);
  const [splitPoint, setSplitPoint] = useState(150);
  // Sorted and cleaned trend data
  const [trendData, setTrendData] = useState([]);

  // Double board states
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

    // 1. Clean and sort games chronologically to build a reliable timeline
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
      // Filter out invalid records and extreme outliers (Elo < 300)
      .filter(d => d !== null && !isNaN(d.rating) && d.rating >= 300)
      .sort((a, b) => a.date - b.date);

    // Build trend dataset
    const trend = sorted.map((d, i) => ({
      gameIndex: i + 1,
      rating: d.rating,
      date: d.date
    }));
    setSortedGamesData(sorted);
    setTrendData(trend);
    setTotalGamesCount(sorted.length);
    
    setSplitPoint(Math.floor(sorted.length / 2));

  }, [games]);

  useEffect(() => {
    if (sortedGamesData.length === 0) return;

    // Range A: 第 1 場 到 切割點
    const resultA = parseBishopCapturesForGameRange(sortedGamesData, color, 1, splitPoint);
    setRangeAData(resultA.flatData);
    setRangeAGamesCount(resultA.gameCount);

    // Range B: 切割點 + 1 到 最後一場
    const resultB = parseBishopCapturesForGameRange(sortedGamesData, color, splitPoint + 1, totalGamesCount);
    setRangeBData(resultB.flatData);
    setRangeBGamesCount(resultB.gameCount);

  }, [sortedGamesData, color, splitPoint, totalGamesCount]);

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
          {TARGET_PLAYER}'s 's Rook Captured by Bishop: Game Range Comparison
        </h1>
        <hr style={{ borderColor: '#c8b89a', marginBottom: 14 }} />

        <div style={{ color: '#5c4a32', fontSize: 13, marginBottom: 16, lineHeight: 1.9 }}>
          <p>Heatmaps only track games where <strong>{TARGET_PLAYER}</strong>'s <strong>Rook was captured by the opponent's Bishop</strong>.</p>
          <p>Both boards share the same cross-size scale for direct visual comparison between different game ranges.</p>
          <p><strong>Hover</strong> over a square to see stats. <strong>Click</strong> a square to reveal the sniping paths.</p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: '#5c4a32', marginRight: 8 }}>Color:</span>
          {[
            ['all', 'All'], 
            ['white', 'White'], 
            ['black', 'Black']
          ].map(([v, l]) => (
            <button key={v} style={btnStyle(color === v)} onClick={() => setColor(v)}>{l}</button>
          ))}
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', height: 200, fontSize: 18, color: '#5c4a32' }}>
            Loading Chess.com games and simulating board states...
          </div>
        )}

        {error && (
          <div style={{ color: '#c0392b', padding: 16, background: '#fdecea', borderRadius: 8 }}>
            ❌ Load Failed: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* 📈 Elo Trend Chart */}
            <EloTrendChart trendData={trendData} splitPoint={splitPoint} onSplitChange={setSplitPoint} />

            {/* Double Board Layout */}
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              
              {/* Board A: Game Range A */}
              <div style={{ flex: '1 1 450px', minWidth: 350, textAlign: 'center' }}>
                <div style={{ marginBottom: 12, padding: '10px', background: '#e8dcc8', borderRadius: 8 }}>
                  <h3 style={{ margin: '0 0 4px 0', color: '#2c1810' }}>
                    Range A (G 1 - {splitPoint})
                  </h3>
                  <div style={{ fontSize: 12, color: '#5c4a32', display: 'flex', justifyContent: 'space-around' }}>
                    <span>Analyzed: <strong>{rangeAGamesCount}</strong> games</span>
                    <span>Captures: <strong style={{ color: '#8b1a1a' }}>{totalCapturesA}</strong> times</span>
                  </div>
                </div>
                <ChessBoard boardData={rangeAData} maxVal={maxVal} onHover={handleHover} onClick={setSelected} />
              </div>

              {/* Board B: Game Range B */}
              <div style={{ flex: '1 1 450px', minWidth: 350, textAlign: 'center' }}>
                <div style={{ marginBottom: 12, padding: '10px', background: '#d0e0f0', borderRadius: 8 }}>
                  <h3 style={{ margin: '0 0 4px 0', color: '#2c1810' }}>
                    Range B (G {splitPoint + 1} - {totalGamesCount})
                  </h3>
                  <div style={{ fontSize: 12, color: '#5c4a32', display: 'flex', justifyContent: 'space-around' }}>
                    <span>Analyzed: <strong>{rangeBGamesCount}</strong> games</span>
                    <span>Captures: <strong style={{ color: '#8b1a1a' }}>{totalCapturesB}</strong> times</span>
                  </div>
                </div>
                <ChessBoard boardData={rangeBData} maxVal={maxVal} onHover={handleHover} onClick={setSelected} />
              </div>

            </div>
          </>
        )}
      </div>

      {/* Hover Tooltip */}
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
            Square {FILES[hovered.col]}{RANKS[hovered.row]}
          </div>
          <div style={{ marginBottom: 4 }}>
            Captures: <strong style={{ color: '#f5d78e' }}>{hovered.total}</strong> times
          </div>
          <hr style={{ borderColor: '#5c4a32', margin: '5px 0' }} />
          <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.8 }}>
            ♗ White: {hovered.white} times<br />
            ♝ Black: {hovered.black} times
          </div>
        </div>
      )}

      {/* Sniping Path Modal */}
      <AttackDetailChart cellData={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
