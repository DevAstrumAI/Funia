#!/usr/bin/env bash
# Run on EC2 to verify Ollama is running and reachable by the chatbot.
# Usage: ./scripts/check-ollama-ec2.sh

set -e
echo "=== Ollama status on EC2 ==="
echo ""

if ! command -v systemctl &>/dev/null; then
  echo "1. Service: (systemctl not found, checking process...)"
  pgrep -a ollama || echo "   No ollama process found."
else
  echo "1. Service:"
  sudo systemctl is-active ollama 2>/dev/null && echo "   ollama: active" || echo "   ollama: NOT active (run: sudo systemctl start ollama)"
fi

echo ""
echo "2. API (http://localhost:11434):"
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:11434/api/tags | grep -q 200; then
  echo "   OK – Ollama is responding."
  echo "   Models:"
  curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | head -5 | sed 's/"name":"/     - /;s/"$//'
else
  echo "   FAIL – Cannot reach Ollama (connection refused or timeout)."
  echo "   Fix: sudo systemctl start ollama   or run: ./scripts/setup-ollama-ec2.sh"
fi

echo ""
echo "3. App .env (optional overrides):"
if [ -f .env ]; then
  grep -E "OLLAMA_BASE_URL|OLLAMA_MODEL" .env 2>/dev/null || echo "   (using defaults: http://localhost:11434, llama3.2)"
else
  echo "   No .env – app uses defaults."
fi

echo ""
echo "4. Quick chat test:"
MODEL="${OLLAMA_MODEL:-llama3.2}"
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:11434/api/tags | grep -q 200; then
  OUT=$(curl -s --max-time 30 http://localhost:11434/api/chat -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Say one word: hi\"}],\"stream\":false}" 2>/dev/null)
  if echo "$OUT" | grep -q '"content"'; then
    echo "   OK – Model $MODEL responded."
  else
    echo "   Model $MODEL may not be pulled. Run: ollama pull $MODEL"
  fi
else
  echo "   Skipped (Ollama not reachable)."
fi

echo ""
echo "=== After fixing, restart the chatbot: pm2 restart functiomed-chatbot ==="
