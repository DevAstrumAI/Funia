#!/usr/bin/env bash
# Run the Functiomed chatbot on EC2 (Amazon Linux 2 or Ubuntu).
# Usage: copy your project to EC2, then: chmod +x run-on-ec2.sh && ./run-on-ec2.sh

set -e
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
PORT="${PORT:-3001}"

echo "==> Functiomed chatbot – EC2 setup (app dir: $APP_DIR)"
echo ""

# --- Install Node.js 20 if missing ---
if ! command -v node &>/dev/null; then
  echo "==> Installing Node.js 20 LTS..."
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" == "amzn" ]] || [[ "$ID_LIKE" == *"amzn"* ]]; then
      curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
      sudo yum install -y nodejs
    elif [[ "$ID" == "ubuntu" ]] || [[ "$ID" == "debian" ]]; then
      curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
    else
      echo "Unsupported OS. Install Node.js 20 manually and run again."
      exit 1
    fi
  else
    echo "Cannot detect OS. Install Node.js 20 manually and run again."
    exit 1
  fi
  echo "    Node: $(node -v) – npm: $(npm -v)"
else
  echo "==> Node.js found: $(node -v)"
fi

# --- Install dependencies ---
echo "==> Installing npm dependencies..."
npm ci 2>/dev/null || npm install
echo ""

# --- .env ---
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "==> Created .env from .env.example – please edit .env and set GROQ_API_KEY"
  else
    echo "==> No .env found. Create one with: GROQ_API_KEY=your_key"
  fi
else
  echo "==> .env present"
fi
echo ""

# --- PM2 ---
if ! command -v pm2 &>/dev/null; then
  echo "==> Installing PM2 globally..."
  sudo npm install -g pm2
fi
echo "==> PM2: $(pm2 -v)"
echo ""

# --- Stop existing app if running ---
pm2 delete functiomed-chatbot 2>/dev/null || true

# --- Start app with PM2 ---
echo "==> Starting app on port $PORT (PORT=$PORT)..."
PORT="$PORT" pm2 start server.js --name functiomed-chatbot
pm2 save
pm2 startup 2>/dev/null || true
echo ""

echo "==> Done. App is running."
echo ""
echo "  Local:    http://localhost:$PORT"
echo "  EC2:      http://$(curl -s --connect-timeout 1 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'YOUR_EC2_PUBLIC_IP'):$PORT"
echo ""
echo "  Commands: pm2 status | pm2 logs functiomed-chatbot | pm2 restart functiomed-chatbot"
echo ""
echo "  If you cannot reach the app, open port $PORT in the EC2 Security Group (Inbound: Custom TCP $PORT, 0.0.0.0/0 or your IP)."
echo ""
