# OWASP AI Security Visualizer

An interactive force-directed graph visualizing the OWASP AI and machine learning security landscape. Built as a static GitHub Pages site using D3.js.

**Live site:** [https://ricokomenda.github.io/owasp-ai-security-visualizer](https://ricokomenda.github.io/owasp-ai-security-visualizer)

## What it covers

The visualizer maps resources across the major OWASP AI security projects:

- **OWASP Generative AI** (with sub-initiatives: Agentic Security, Red Teaming, Secure Adoption, Data Security, Threat Intelligence, LLM Resources)
- **OWASP AI Exchange**
- **OWASP AISVS** (all chapters)
- **OWASP Cheat Sheet Series** (AI-specific sheets)
- **OWASP AI Testing Guide**
- **OWASP AIMA** (AI Maturity Assessment)
- **OWASP AIVSS** (AI Vulnerability Scoring System)
- **Other AI-Related Projects** (NHI Top 10, Agentic Skills Top 10, ML Security Top 10, and more)

## Tech stack

- [D3.js v7](https://d3js.org/) force-directed graph (bundled locally, no CDN dependency)
- Vanilla HTML/CSS/JavaScript
- Static JSON data model (`data.json`)
- GitHub Pages for hosting

## Contributing

Data quality matters more than quantity, so there is no automatic crawler. All additions are reviewed manually.

**To suggest a new resource or fix incorrect data:**

1. [Open an issue](https://github.com/RicoKomenda/owasp-ai-security-visualizer/issues) describing the resource and why it belongs in the landscape.
2. Or [submit a pull request](https://github.com/RicoKomenda/owasp-ai-security-visualizer/pulls) editing `data.json` directly.

### data.json schema

Each leaf resource follows this structure:

```json
{
  "title": "Resource Name",
  "description": "One or two sentence description.",
  "url": "https://example.com/resource",
  "type": "guide | standard | cheat sheet | tool | ctf"
}
```

Umbrella and sub-umbrella nodes use `name` instead of `title` and contain a `children` array.

## License

MIT — see [LICENSE](LICENSE).
