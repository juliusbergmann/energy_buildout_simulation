# energy_buildout_simulation

Demo pull request created from Codex.

## Docker

Build and run the simulator locally:

```sh
docker build -t electricity-buildout-simulation .
docker run --rm -p 3000:3000 electricity-buildout-simulation
```

Or use Docker Compose:

```sh
docker compose up --build -d
```

The app listens on port `3000` inside the container. On a VPS, put a reverse proxy such as Caddy, nginx, or Traefik in front of that port and make sure outbound HTTPS requests to `api.energy-charts.info` are allowed.

## Plans

Project plans live in `plans/`. Pull requests should link the relevant plan so future readers can understand what was implemented, when, and why.
