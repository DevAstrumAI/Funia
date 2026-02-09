#!/usr/bin/env bash
# Install and run Ollama on EC2 so the chatbot can use it as fallback when Groq fails.
# Run on the EC2 instance (after cloning the repo): chmod +x scripts/setup-ollama-ec2.sh && ./scripts/setup-ollama-ec2.sh
# Requires at least ~2 GB RAM for the default model (e.g. t3.small or larger).

set -e
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"

echo "==> Installing Ollama on EC2..."
curl -fsSL https://ollama.com/install.sh | sh

echo ""
echo "==> Pulling model: $OLLAMA_MODEL (this may take a few minutes)..."
ollama pull "$OLLAMA_MODEL"

echo ""
echo "==> Creating systemd service so Ollama runs on boot..."
sudo tee /etc/systemd/system/ollama.service > /dev/null << 'EOF'
[Unit]
Description=Ollama
After=network-online.target

[Service]
Environment="OLLAMA_GPU=1"
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=default.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama
sudo systemctl status ollama --no-pager || true

echo ""
echo "==> Ollama is running. The app will use it as fallback when Groq fails or is not set."
echo "    Model: $OLLAMA_MODEL (change with OLLAMA_MODEL=gemma2:2b ./scripts/setup-ollama-ec2.sh)"
echo "    In .env you can set: OLLAMA_BASE_URL=http://localhost:11434  OLLAMA_MODEL=$OLLAMA_MODEL"
echo "    Restart the chatbot: pm2 restart functiomed-chatbot"
echo ""
