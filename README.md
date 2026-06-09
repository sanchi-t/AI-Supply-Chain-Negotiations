# 🍊 Orange Treaty: A2A Supply Chain Negotiations

A premium multi-agent negotiation simulator exploring citrus economics from grove to shelf. 

This monorepo scaffolds a multi-step negotiation simulator where AI agents represent different actors in the supply chain (Sellers, Juicers/Manufacturers, and Retailers) negotiating prices and contracts based on market conditions, crop yields, and weather risks.

---

## 🖥️ Dashboard Preview

Below is a preview of the **Orange Treaty** simulation dashboard, showcasing the supply chain flow, real-time negotiation metrics, and market volatility gauges:

![Orange Treaty Dashboard UI](docs/orange_treaty_ui.png)

---

## ✨ Key Features

* **Multi-Agent Simulation Pipeline**: Run orange-market negotiation batches through OpenAI decision steps. A single market seed generates distinct simulations for Sellers, Manufacturers, and Retailers.
* **Deterministic Scenario Generator**: Seeds generate reproducible grove yields, processing costs, freeze risks, and market demand patterns.
* **Counterfactual Replay & Time Travel**: Test alternate histories. Select any historical step, provide a branching instruction (e.g., "Assume a sudden freeze happens"), and spin off a new AI-backed branch without mutating the original run.
* **Langfuse Tracing Integration**: Trace simulations, negotiation phases, LLM decisions, and tool calls out-of-the-box. Tracing fails cleanly if credentials aren't configured.
* **Lightweight Local Storage**: Stores canonical run logs (`runs/`), structured event streams (`events/`), and export summary bundles (`exports/`) in clean JSON format.

---

## 📁 Repository Structure

```text
.
├── backend          # FastAPI backend (negotiation loop, LLM prompts, & APIs)
├── web              # Next.js & TypeScript frontend (dashboard UI & replay interface)
├── runs             # Local JSON run records
├── events           # Structured event log streams per run
├── exports          # Simulation pipeline export bundles (summary, conversation, traces)
├── scripts          # Helper bash scripts for setup and running
├── shared           # Shared documentation, notes, and schemas
└── docs             # Project notes and design mockups
```

---

## 🚀 Getting Started

Follow these steps to set up and run the simulator locally.

### 1. Environment Setup

Copy the template environment file:

```bash
cp env.example .env
```

Open `.env` and fill in your details:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.4
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
LANGFUSE_HOST=https://cloud.langfuse.com
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

*Note: If `OPENAI_API_KEY` is omitted, simulation runs will fail cleanly without generating corrupted fallback data.*

### 2. One-Step Automated Setup

Run the master setup script. This will create a Python virtual environment (`.venv`), install backend dependencies, and install frontend packages:

```bash
./scripts/setup-all.sh
```

Alternatively, you can run the setup via npm:

```bash
npm run setup:all
```

### 3. Run the Application

Start both the FastAPI backend and Next.js frontend concurrently:

```bash
./scripts/run-all.sh
```

Or via npm:

```bash
npm run dev
```

* **Frontend URL**: [http://localhost:3000](http://localhost:3000)
* **Backend API URL**: [http://localhost:8000](http://localhost:8000) (Interactive Swagger Docs at `/docs`)

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/health` | API service health check |
| **GET** | `/runs` | List all historical negotiation runs |
| **GET** | `/runs/{id}` | Fetch a specific run record |
| **GET** | `/runs/{id}/detail` | Detailed run metadata including steps |
| **GET** | `/runs/{id}/counterfactual` | Get details for cheap counterfactual replays |
| **POST** | `/simulation/run` | Trigger a new simulation using a seed |
| **POST** | `/simulation/run/custom` | Trigger a custom simulation run |

---

## 🧪 Running Tests

A comprehensive suite of tests covers backend endpoint health, OpenAI preflight logic, seeded scenario generation, and fake-LLM negotiation runs. Run them with:

```bash
npm test
```
