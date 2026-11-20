// Puzzle logic: generation + solving. No DOM code here, so it can be tested in Node.
// Rules: an N x N grid is split into N regions. Place N dots so that every row,
// every column and every region has exactly one dot, and no two dots touch
// (including diagonally).

(function (root) {
  // Small seeded RNG (mulberry32) so daily puzzles are the same for everyone.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Random valid dot layout: cols[r] = column of the dot in row r.
  // Needs distinct columns and |cols[r] - cols[r+1]| > 1 (no diagonal touch).
  function randomSolution(n, rng) {
    const cols = [];
    const used = new Array(n).fill(false);
    function place(r) {
      if (r === n) return true;
      const options = shuffle([...Array(n).keys()], rng);
      for (const c of options) {
        if (used[c]) continue;
        if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
        used[c] = true;
        cols[r] = c;
        if (place(r + 1)) return true;
        used[c] = false;
      }
      return false;
    }
    return place(0) ? cols : null;
  }

  // Grow N regions outward from the dot cells until the grid is filled.
  function growRegions(n, cols, rng) {
    const regions = Array.from({ length: n }, () => new Array(n).fill(-1));
    const frontier = [];
    for (let r = 0; r < n; r++) {
      regions[r][cols[r]] = r;
      frontier.push([r, cols[r]]);
    }
    let filled = n;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (filled < n * n) {
      // Pick a random cell that already has a region and try to spread from it.
      const idx = Math.floor(rng() * frontier.length);
      const [r, c] = frontier[idx];
      const open = dirs
        .map(([dr, dc]) => [r + dr, c + dc])
        .filter(([y, x]) => y >= 0 && y < n && x >= 0 && x < n && regions[y][x] === -1);
      if (open.length === 0) {
        frontier.splice(idx, 1);
        continue;
      }
      const [y, x] = open[Math.floor(rng() * open.length)];
      regions[y][x] = regions[r][c];
      frontier.push([y, x]);
      filled++;
    }
    return regions;
  }

  // Count solutions (stops at `limit`). Returns { count, solution }.
  function solve(regions, limit = 2) {
    const n = regions.length;
    const colUsed = new Array(n).fill(false);
    const regUsed = new Array(n).fill(false);
    const cols = [];
    let count = 0;
    let first = null;
    function place(r) {
      if (count >= limit) return;
      if (r === n) {
        count++;
        if (!first) first = cols.slice();
        return;
      }
      for (let c = 0; c < n; c++) {
        const g = regions[r][c];
        if (colUsed[c] || regUsed[g]) continue;
        if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
        colUsed[c] = regUsed[g] = true;
        cols[r] = c;
        place(r + 1);
        colUsed[c] = regUsed[g] = false;
      }
    }
    place(0);
    return { count, solution: first };
  }

  // Find a solution that differs from `target` (or null if target is the only one).
  function findOther(regions, target) {
    const n = regions.length;
    const colUsed = new Array(n).fill(false);
    const regUsed = new Array(n).fill(false);
    const cols = [];
    let found = null;
    function place(r) {
      if (found) return;
      if (r === n) {
        if (cols.some((c, i) => c !== target[i])) found = cols.slice();
        return;
      }
      for (let c = 0; c < n && !found; c++) {
        const g = regions[r][c];
        if (colUsed[c] || regUsed[g]) continue;
        if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
        colUsed[c] = regUsed[g] = true;
        cols[r] = c;
        place(r + 1);
        colUsed[c] = regUsed[g] = false;
      }
    }
    place(0);
    return found;
  }

  // Is region g still one connected piece?
  function connected(regions, g) {
    const n = regions.length;
    let start = null, total = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (regions[r][c] === g) { total++; if (!start) start = [r, c]; }
    if (!start) return false;
    const seen = new Set([start.join()]);
    const stack = [start];
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [y, x] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
        if (y < 0 || y >= n || x < 0 || x >= n || regions[y][x] !== g) continue;
        const k = y + "," + x;
        if (!seen.has(k)) { seen.add(k); stack.push([y, x]); }
      }
    }
    return seen.size === total;
  }

  // Generate a puzzle with exactly one solution.
  // Grow random regions, then repeatedly break any alternate solution by moving
  // one of its dot cells into a neighbouring region.
  function generate(n, seed) {
    const rng = makeRng(seed);
    for (let attempt = 1; attempt <= 500; attempt++) {
      const cols = randomSolution(n, rng);
      if (!cols) throw new Error("No layout exists for size " + n);
      const regions = growRegions(n, cols, rng);
      for (let fix = 0; fix < n * n * 4; fix++) {
        const other = findOther(regions, cols);
        if (!other) return { n, regions, solution: cols, attempts: attempt };
        // Cells where the alternate solution puts a dot but the real one doesn't.
        const cells = shuffle(
          other.map((c, r) => [r, c]).filter(([r, c]) => cols[r] !== c),
          rng
        );
        let changed = false;
        for (const [r, c] of cells) {
          const from = regions[r][c];
          const neighbours = shuffle(
            [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]].filter(
              ([y, x]) => y >= 0 && y < n && x >= 0 && x < n && regions[y][x] !== from
            ),
            rng
          );
          for (const [y, x] of neighbours) {
            regions[r][c] = regions[y][x];
            if (connected(regions, from)) { changed = true; break; }
            regions[r][c] = from;
          }
          if (changed) break;
        }
        if (!changed) break; // stuck: start over with a fresh layout
      }
    }
    throw new Error("Could not generate a unique puzzle");
  }

  const api = { generate, solve, makeRng };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Puzzle = api;
})(this);
