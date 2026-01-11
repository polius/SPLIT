# SPLIT

<p align="center">
  <img src="src/icon.svg" alt="SPLIT Logo" width="120"/>
</p>

<p align="center">
  <a href="https://github.com/polius/split/releases"><img src="https://img.shields.io/github/v/release/polius/split" alt="GitHub Release"/></a>
  <a href="https://hub.docker.com/r/poliuscorp/split"><img src="https://img.shields.io/docker/pulls/poliuscorp/split" alt="Docker Pulls"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/polius/split" alt="License"/></a>
</p>

<p align="center">
  SPLIT is a simple, lightweight, self-hosted expense splitter that makes it easy to calculate who owes what when sharing expenses with friends or groups.
</p>

---

<p align="center">
  <img src="assets/screenshot.png" alt="SPLIT Screenshot"/>
</p>

## Features

- 🌍 **Multi-language support** - Available in English, Spanish and Catalan
- 💰 **Customizable currency** - Configure your preferred currency symbol and position
- 📱 **Responsive design** - Works seamlessly on desktop and mobile devices
- 🎨 **Modern UI** - Clean, professional interface with smooth animations
- ⚡ **Fast & Lightweight** - No database required, runs entirely in the browser
- 🐳 **Docker-ready** - Easy deployment with Docker

## Installation

The recommended installation method is Docker.

### Run with Docker CLI

```bash
docker run -d \
  --name split \
  -p 80:80 \
  -e CURRENCY="€" \
  -e CURRENCY_POSITION="right" \
  poliuscorp/split
```

### Run with Docker Compose

```yaml
services:
  split:
    image: poliuscorp/split
    container_name: split
    restart: unless-stopped
    ports:
      - "80:80"
    environment:
      CURRENCY: "€"
      CURRENCY_POSITION: "right"
```

## Environment Variables

Split supports the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CURRENCY` | `€` | The currency symbol to display (e.g., `$`, `£`, `€`, `¥`) |
| `CURRENCY_POSITION` | `right` | Position of currency symbol: `left` or `right` |

## License

MIT License - see [LICENSE](LICENSE) file for details