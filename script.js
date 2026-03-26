/**
 * OWASP AI Security Visualizer
 * Force-directed graph powered by D3.js v7
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_COLORS = {
  root:           '#e6edf3',
  umbrella:       '#58a6ff',
  'sub-umbrella': '#1f6feb',
  guide:          '#3fb950',
  standard:       '#bc8cff',
  'cheat sheet':  '#d29922',
  tool:           '#f78166',
};

const NODE_RADII = {
  root:           28,
  umbrella:       20,
  'sub-umbrella': 15,
  default:        11,
};

// ─── State ────────────────────────────────────────────────────────────────────

let allNodes = [];
let allLinks = [];
let simulation;
let svg, g, linkSel, nodeSel, pulseSel;
let activeNode = null;
let activeFilter = 'all';
let searchQuery = '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeColor(d) {
  if (d.depth === 0) return NODE_COLORS.root;
  if (d.data.type === 'umbrella') return NODE_COLORS.umbrella;
  if (d.data.type === 'sub-umbrella') return NODE_COLORS['sub-umbrella'];
  return NODE_COLORS[d.data.type] || '#8b949e';
}

function nodeRadius(d) {
  if (d.depth === 0) return NODE_RADII.root;
  if (d.data.type === 'umbrella') return NODE_RADII.umbrella;
  if (d.data.type === 'sub-umbrella') return NODE_RADII['sub-umbrella'];
  return NODE_RADII.default;
}

function nodeLabel(d) {
  const text = d.data.name || d.data.title || '';
  return text.length > 22 ? text.slice(0, 20) + '…' : text;
}

function typeBadgeStyle(type) {
  const c = NODE_COLORS[type] || NODE_COLORS.umbrella;
  return `color:${c};border-color:${c};`;
}

// ─── Flatten hierarchy → nodes & links ───────────────────────────────────────

function flatten(root) {
  const nodes = [];
  const links = [];

  function walk(node, parent, depth) {
    node.depth = depth;
    node.id = node.id || Math.random().toString(36).slice(2);
    nodes.push(node);
    if (parent) links.push({ source: parent.id, target: node.id });
    if (node.data.children) {
      node.data.children.forEach(child => {
        const childNode = { data: child, id: child.title || child.name || Math.random().toString(36).slice(2) };
        walk(childNode, node, depth + 1);
      });
    }
  }

  walk(root, null, 0);
  return { nodes, links };
}

// ─── Build node/link arrays from D3 hierarchy ─────────────────────────────────

function buildGraph(data) {
  const root = d3.hierarchy(data, d => d.children);
  const nodes = root.descendants().map(d => {
    // targetSectorId: the id of the closest cluster node this node should be pulled toward.
    // Cluster nodes (umbrella, sub-umbrella) are pulled toward their own position.
    // Leaf nodes are pulled toward their direct parent's position.
    const isCluster = d.depth === 0 ||
                      d.data.type === 'umbrella' ||
                      d.data.type === 'sub-umbrella';
    const targetSectorId = isCluster
      ? (d.depth === 0 ? null : (d.data.name || d.data.title))
      : (d.parent ? (d.parent.data.name || d.parent.data.title) : null);

    // Also keep top-level sectorId so pre-position can group by umbrella
    const umbrellaAncestor = d.ancestors().find(a => a.depth === 1);
    return {
      id:             d.data.name || d.data.title,
      data:           d.data,
      depth:          d.depth,
      sectorId:       umbrellaAncestor ? (umbrellaAncestor.data.name || umbrellaAncestor.data.title) : null,
      targetSectorId,
    };
  });
  const links = root.links().map(l => ({
    source: l.source.data.name || l.source.data.title,
    target: l.target.data.name || l.target.data.title,
  }));
  return { nodes, links };
}

// ─── Filtering ────────────────────────────────────────────────────────────────

function isVisible(node) {
  // Root, umbrella, and sub-umbrella nodes always visible
  if (node.depth <= 1 || node.data.type === 'sub-umbrella') return true;

  const type = (node.data.type || '').toLowerCase();
  const title = (node.data.title || node.data.name || '').toLowerCase();
  const desc  = (node.data.description || '').toLowerCase();

  const matchesFilter = activeFilter === 'all' || type === activeFilter;
  const matchesSearch = !searchQuery ||
    title.includes(searchQuery) || desc.includes(searchQuery);

  return matchesFilter && matchesSearch;
}

function applyVisibility() {
  const visibleIds = new Set(allNodes.filter(isVisible).map(n => n.id));

  nodeSel.each(function(d) {
    const vis = visibleIds.has(d.id);
    d3.select(this)
      .classed('dimmed', !vis)
      .select('circle')
      .style('pointer-events', vis ? 'auto' : 'none');
  });

  linkSel.classed('dimmed', d => !visibleIds.has(d.target.id));
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function openPanel(node) {
  activeNode = node;
  const d = node.data;
  const panel     = document.getElementById('detail-panel');
  const badge     = document.getElementById('detail-type-badge');
  const title     = document.getElementById('detail-title');
  const desc      = document.getElementById('detail-description');
  const link      = document.getElementById('detail-link');
  const meta      = document.getElementById('detail-meta');
  const children  = document.getElementById('detail-children');

  // Badge
  const type = d.type || (node.depth === 0 ? 'landscape' : 'umbrella');
  badge.textContent = type;
  badge.style.cssText = typeBadgeStyle(type);

  // Title & description
  title.textContent = d.name || d.title || '';
  desc.textContent  = d.description || '';

  // URL link
  if (d.url) {
    link.href = d.url;
    link.classList.remove('hidden');
  } else {
    link.classList.add('hidden');
  }

  // Meta
  meta.innerHTML = d.url
    ? `<strong>URL:</strong> <span style="word-break:break-all;color:var(--text-muted)">${d.url}</span>`
    : '';

  // Children list
  children.innerHTML = '';
  if (d.children && d.children.length) {
    children.innerHTML = `<h3>${d.children.length} resource${d.children.length !== 1 ? 's' : ''}</h3>`;
    d.children.forEach(child => {
      const childType = child.type || 'guide';
      const color = NODE_COLORS[childType] || NODE_COLORS.umbrella;
      const href = child.url || '#';
      const el = document.createElement('a');
      el.className = 'child-item';
      el.href = href;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
      el.innerHTML = `
        <span class="child-dot" style="background:${color}"></span>
        <div class="child-info">
          <div class="child-title">${child.title || child.name}</div>
          <div class="child-desc">${child.description || ''}</div>
        </div>`;
      children.appendChild(el);
    });
  }

  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
}

function closePanel() {
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('detail-panel').setAttribute('aria-hidden', 'true');
  activeNode = null;
  // Remove active styling
  nodeSel && nodeSel.classed('active', false);
  pulseSel && pulseSel.attr('r', 0).attr('opacity', 0);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const tooltip = document.getElementById('tooltip');

function showTooltip(event, d) {
  const type = d.data.type || (d.depth === 0 ? 'root' : 'umbrella');
  tooltip.innerHTML = `
    <div class="tooltip-type">${type}</div>
    <div class="tooltip-title">${d.data.name || d.data.title}</div>
    <div class="tooltip-desc">${(d.data.description || '').slice(0, 100)}${(d.data.description || '').length > 100 ? '…' : ''}</div>
  `;
  tooltip.classList.add('visible');
  moveTooltip(event);
}

function moveTooltip(event) {
  const x = event.clientX + 14;
  const y = event.clientY - 10;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  tooltip.style.left = (x + tw > window.innerWidth ? x - tw - 28 : x) + 'px';
  tooltip.style.top  = (y + th > window.innerHeight ? y - th : y) + 'px';
}

function hideTooltip() {
  tooltip.classList.remove('visible');
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function buildLegend() {
  const legend = document.getElementById('legend');
  const items = [
    { label: 'Project',     type: 'umbrella' },
    { label: 'Initiative',  type: 'sub-umbrella' },
    { label: 'Guide',       type: 'guide' },
    { label: 'Standard',    type: 'standard' },
    { label: 'Cheat Sheet', type: 'cheat sheet' },
    { label: 'Tool',        type: 'tool' },
  ];
  legend.innerHTML = items.map(i => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${NODE_COLORS[i.type]}"></span>
      ${i.label}
    </div>
  `).join('');
}

// ─── Simulation ───────────────────────────────────────────────────────────────

// Compute cluster-centre positions for every umbrella and sub-umbrella, dynamically.
// Returns a map of { [nodeId]: {x, y} } used by forceX/forceY and prePosition.
function computeSectorTargets(nodes, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const targets = {};
  targets[null] = { x: cx, y: cy };

  // ── Depth-1 umbrellas: evenly spaced ring around center ──
  const umbrellas = nodes.filter(n => n.depth === 1);
  const umbrellaR = Math.min(width, height) * 0.34;
  umbrellas.forEach((u, i) => {
    const angle = (2 * Math.PI * i) / umbrellas.length - Math.PI / 2;
    targets[u.id] = {
      x: cx + umbrellaR * Math.cos(angle),
      y: cy + umbrellaR * Math.sin(angle),
    };
  });

  // ── Depth-2 sub-umbrellas: fan around their parent umbrella ──
  const subUmbrellaR = 130; // distance from umbrella to sub-umbrella cluster centre
  umbrellas.forEach(u => {
    const ut = targets[u.id];
    const parentAngle = Math.atan2(ut.y - cy, ut.x - cx); // direction from center
    const subs = nodes.filter(n => n.data.type === 'sub-umbrella' && n.sectorId === u.id);
    if (!subs.length) return;
    // Spread sub-umbrellas in an arc pointing away from center
    const spread = Math.min(Math.PI * 0.9, (subs.length - 1) * 0.55);
    subs.forEach((s, j) => {
      const offset = subs.length === 1 ? 0 : -spread / 2 + (spread * j) / (subs.length - 1);
      const a = parentAngle + offset;
      targets[s.id] = {
        x: ut.x + subUmbrellaR * Math.cos(a),
        y: ut.y + subUmbrellaR * Math.sin(a),
      };
    });
  });

  return targets;
}

function initSimulation(width, height, sectorTargets) {
  const cx = width / 2;
  const cy = height / 2;
  return d3.forceSimulation(allNodes)
    .force('link', d3.forceLink(allLinks)
      .id(d => d.id)
      .distance(d => {
        if (d.source.depth === 0) return 220;
        if (d.source.data.type === 'umbrella') return 180;
        if (d.source.data.type === 'sub-umbrella') return 130;
        return 80;
      })
      .strength(0.7))
    .force('charge', d3.forceManyBody()
      .strength(d => {
        if (d.depth === 0) return -800;
        if (d.data.type === 'umbrella') return -400;
        if (d.data.type === 'sub-umbrella') return -220;
        return -120;
      }))
    // Pull every node toward its closest cluster centre — keeps all levels separated
    .force('sectorX', d3.forceX(d => {
      const t = sectorTargets[d.targetSectorId] || sectorTargets[null];
      return t.x;
    }).strength(d => d.depth === 0 ? 0.2 : 0.14))
    .force('sectorY', d3.forceY(d => {
      const t = sectorTargets[d.targetSectorId] || sectorTargets[null];
      return t.y;
    }).strength(d => d.depth === 0 ? 0.2 : 0.14))
    .force('collision', d3.forceCollide().radius(d => nodeRadius(d) + 12))
    .alphaDecay(0.018);
}

// Pre-position nodes at their target sector so simulation starts cleanly
function prePosition(nodes, width, height, sectorTargets) {
  const cx = width / 2;
  const cy = height / 2;
  nodes.forEach(n => {
    if (n.depth === 0) {
      n.x = cx; n.y = cy;
    } else {
      const t = sectorTargets[n.targetSectorId] || { x: cx, y: cy };
      const jitter = () => (Math.random() - 0.5) * 40;
      n.x = t.x + jitter();
      n.y = t.y + jitter();
    }
  });
}

// ─── Main render ──────────────────────────────────────────────────────────────

function render(data) {
  const container = document.getElementById('graph-panel');
  const width  = container.clientWidth;
  const height = container.clientHeight;

  // Build graph data
  const { nodes, links } = buildGraph(data);
  allNodes = nodes;
  allLinks = links;

  // SVG setup
  svg = d3.select('#graph-svg');
  svg.attr('width', width).attr('height', height);

  // Zoom behaviour
  const zoom = d3.zoom()
    .scaleExtent([0.25, 4])
    .on('zoom', ({ transform }) => g.attr('transform', transform));
  svg.call(zoom);

  g = svg.append('g');

  // ── Links ──
  linkSel = g.append('g').attr('class', 'links')
    .selectAll('line')
    .data(allLinks)
    .join('line')
    .attr('class', 'link');

  // ── Pulse rings (behind nodes) ──
  const pulseGroup = g.append('g').attr('class', 'pulses');

  // ── Nodes ──
  const nodeGroup = g.append('g').attr('class', 'nodes');

  nodeSel = nodeGroup.selectAll('.node')
    .data(allNodes)
    .join('g')
    .attr('class', 'node')
    .style('cursor', d => d.data.url || d.data.children ? 'pointer' : 'default')
    .call(d3.drag()
      .on('start', dragStart)
      .on('drag',  dragged)
      .on('end',   dragEnd));

  // Circles
  nodeSel.append('circle')
    .attr('r', d => nodeRadius(d))
    .attr('fill', d => nodeColor(d))
    .attr('fill-opacity', d => d.depth === 0 ? 0.9 : 0.85)
    .attr('stroke', d => d3.color(nodeColor(d)).darker(1))
    .attr('stroke-width', d => d.depth <= 1 ? 2 : 1.5);

  // Labels
  nodeSel.append('text')
    .text(d => nodeLabel(d))
    .attr('text-anchor', 'middle')
    .attr('dy', d => nodeRadius(d) + 14)
    .attr('font-weight', d => d.depth <= 1 ? '700' : '400');

  // Pulse element per node (used for active state)
  pulseSel = pulseGroup.selectAll('circle')
    .data(allNodes)
    .join('circle')
    .attr('class', 'node-pulse')
    .attr('fill', d => nodeColor(d))
    .attr('fill-opacity', 0.3)
    .attr('r', 0);

  // ── Events ──
  nodeSel
    .on('mouseenter', (event, d) => showTooltip(event, d))
    .on('mousemove',  (event) => moveTooltip(event))
    .on('mouseleave', () => hideTooltip())
    .on('click', (event, d) => {
      event.stopPropagation();
      hideTooltip();
      // Highlight active
      nodeSel.classed('active', n => n.id === d.id);
      // Animate pulse
      pulseSel.filter(n => n.id === d.id)
        .attr('r', 0)
        .attr('opacity', 0.8)
        .transition().duration(800)
        .attr('r', nodeRadius(d) + 20)
        .attr('opacity', 0);

      openPanel(d);
    });

  // Click on background closes panel
  svg.on('click', () => closePanel());

  // ── Simulation ──
  const sectorTargets = computeSectorTargets(allNodes, width, height);
  prePosition(allNodes, width, height, sectorTargets);
  simulation = initSimulation(width, height, sectorTargets);
  simulation.on('tick', () => {
    linkSel
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
    pulseSel.attr('cx', d => d.x).attr('cy', d => d.y);
  });

  // Hide loading
  document.getElementById('loading').classList.add('hidden');
}

// ─── Drag handlers ────────────────────────────────────────────────────────────

function dragStart(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x; d.fy = d.y;
}
function dragged(event, d) {
  d.fx = event.x; d.fy = event.y;
}
function dragEnd(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null; d.fy = null;
}

// ─── Resize ───────────────────────────────────────────────────────────────────

function onResize() {
  const container = document.getElementById('graph-panel');
  const width  = container.clientWidth;
  const height = container.clientHeight;
  svg.attr('width', width).attr('height', height);
  simulation.force('center', d3.forceCenter(width / 2, height / 2)).alpha(0.3).restart();
}

// ─── UI Controls ──────────────────────────────────────────────────────────────

function setupControls() {
  // Filter chips
  document.getElementById('filter-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.type;
    applyVisibility();
  });

  // Search
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    searchClear.classList.toggle('visible', searchQuery.length > 0);
    applyVisibility();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.remove('visible');
    applyVisibility();
  });

  // Close panel button
  document.getElementById('detail-close').addEventListener('click', closePanel);

  // Resize
  window.addEventListener('resize', onResize);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  buildLegend();
  setupControls();

  try {
    const res = await fetch('./data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    render(data);
  } catch (err) {
    console.error('Failed to load data:', err);
    document.getElementById('loading').innerHTML =
      `<span style="color:var(--accent-red)">Failed to load data.json — ${err.message}</span>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
