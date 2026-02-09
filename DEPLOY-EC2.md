# Deploy Funia (Functiomed Chatbot) on AWS EC2

This guide walks you through running the Functiomed chatbot on an EC2 instance from start to finish.

---

## 1. Prerequisites

- **AWS account** with console access
- **GitHub**: repo at `https://github.com/DevAstrumAI/Funia`
- **Groq API key** from [console.groq.com](https://console.groq.com/) (for the chatbot)
- **(Optional)** A domain name and DNS access if you want a custom URL or HTTPS later

---

## 2. Launch an EC2 Instance

### 2.1 Open EC2

1. Log in to [AWS Console](https://console.aws.amazon.com/)
2. Go to **EC2** (search “EC2” or use **Services → Compute → EC2**)
3. Click **Launch instance**

### 2.2 Configure the instance

| Setting | Value |
|--------|--------|
| **Name** | `funia-chatbot` (or any name) |
| **AMI** | **Amazon Linux 2023** or **Ubuntu Server 22.04 LTS** |
| **Instance type** | **t2.micro** (free tier, Groq only) or **t3.small** / **t3.medium** if you will run Ollama fallback (~2 GB RAM needed) |
| **Key pair** | Create new or use existing; **download the `.pem`** – you need it to SSH |
| **Storage** | 8 GB gp3 is enough |

### 2.3 Security group (firewall)

Create a new security group or use an existing one. Add:

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | Your IP (or `0.0.0.0/0` for any IP; less secure) | SSH access |
| Custom TCP | 3001 | `0.0.0.0/0` (or your IP only) | Chatbot app |

Click **Launch instance**. Note the **Public IPv4 address** (e.g. `54.123.45.67`).

---

## 3. Connect to EC2 (SSH)

### 3.1 Fix key permissions (Mac/Linux)

```bash
chmod 400 /path/to/your-key.pem
```

### 3.2 SSH in

Replace `YOUR_KEY.pem` and `EC2_PUBLIC_IP` with your key path and instance IP:

```bash
ssh -i /path/to/YOUR_KEY.pem ec2-user@EC2_PUBLIC_IP
```

- **Amazon Linux**: user is `ec2-user`
- **Ubuntu**: user is `ubuntu`

```bash
ssh -i /path/to/YOUR_KEY.pem ubuntu@EC2_PUBLIC_IP
```

You should see a shell prompt on the instance.

---

## 4. Install Git and Clone the App

### Amazon Linux 2023

```bash
sudo dnf install -y git
```

### Ubuntu

```bash
sudo apt-get update
sudo apt-get install -y git
```

### Clone the repo

```bash
cd ~
git clone https://github.com/DevAstrumAI/Funia.git
cd Funia
```

If the repo is private, use a Personal Access Token:

```bash
git clone https://YOUR_GITHUB_USERNAME:YOUR_PAT@github.com/DevAstrumAI/Funia.git
cd Funia
```

---

## 5. Run the One-Command Setup Script

The project includes a script that installs Node.js (if needed), dependencies, and runs the app with PM2.

```bash
chmod +x run-on-ec2.sh
./run-on-ec2.sh
```

This will:

- Install **Node.js 20** if not present  
- Run **npm install**  
- Create **.env** from `.env.example` if missing  
- Install **PM2** and start the app as `functiomed-chatbot`  
- Save the PM2 process list so it can survive reboots  

**Before the app can answer chat messages**, you must set your Groq API key (see next step).

---

## 6. Set the Groq API Key

The app reads `GROQ_API_KEY` from a `.env` file in the project directory.

```bash
cd ~/Funia
nano .env
```

Set (or update):

```env
GROQ_API_KEY=gsk_your_actual_groq_key_here
```

Save (Ctrl+O, Enter) and exit (Ctrl+X). Then restart the app:

```bash
pm2 restart functiomed-chatbot
```

Get a key at: [https://console.groq.com/](https://console.groq.com/)

---

## 7. Check That the App Is Running

```bash
pm2 status
pm2 logs functiomed-chatbot
```

You should see something like: `Functiomed chatbot running at http://localhost:3001`.

**Test in the browser:**  
`http://EC2_PUBLIC_IP:3001`  
(e.g. `http://54.123.45.67:3001`)

If it doesn’t load, check:

- Security group allows **port 3001** from your IP (or `0.0.0.0/0`)
- `pm2 status` shows the process as **online**

---

## 7.5 (Optional) Run Ollama on EC2 as fallback

When Groq is unavailable (rate limit, no key, or errors), the app can use **Ollama** on the same server. Use an instance with **at least ~2 GB RAM** (e.g. **t3.small** or **t3.medium**); t2.micro is too small for a model.

### Option A: Use the setup script (recommended)

From the project directory on EC2:

```bash
cd ~/Funia
chmod +x scripts/setup-ollama-ec2.sh
./scripts/setup-ollama-ec2.sh
```

This will:

- Install Ollama (Linux)
- Pull the default model (`gemma2:2b`)
- Create a **systemd** service so Ollama starts on boot and keeps running
- Run Ollama in the background

To use a smaller/faster model (e.g. llama2):

```bash
OLLAMA_MODEL=llama2:latest ./scripts/setup-ollama-ec2.sh
```

Then restart the chatbot so it can use Ollama when needed:

```bash
pm2 restart functiomed-chatbot
```

No change to `.env` is required: the app uses `http://localhost:11434` and `OLLAMA_MODEL=gemma2:2b` by default. To override:

```bash
nano .env
# Add or set:
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=gemma2:2b
```

### Option B: Manual install

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model (~1–2 GB download)
ollama pull gemma2:2b

# Run in background (or use systemd as in the script)
nohup ollama serve > /tmp/ollama.log 2>&1 &
```

### Check Ollama

```bash
curl http://localhost:11434/api/tags
```

You should see a list of models. The app will call Ollama automatically when Groq fails or when `GROQ_API_KEY` is not set.

**GPU instances:** The setup script sets `OLLAMA_GPU=1` in the Ollama service so it uses the GPU. After installing NVIDIA drivers and rebooting, restart Ollama: `sudo systemctl restart ollama`. Check GPU use with `nvidia-smi` while sending a chat message. For faster replies, use a smaller model (e.g. `gemma2:2b` or `phi3:mini`) and ensure the instance has enough GPU memory.

---

## 8. Useful PM2 Commands

| Command | Purpose |
|--------|---------|
| `pm2 status` | List processes and status |
| `pm2 logs functiomed-chatbot` | Stream app logs |
| `pm2 restart functiomed-chatbot` | Restart after changing `.env` or code |
| `pm2 stop functiomed-chatbot` | Stop the app |
| `pm2 start functiomed-chatbot` | Start again |

After the first run of `run-on-ec2.sh`, PM2 is configured to restore this app on reboot. To ensure startup on boot is enabled:

```bash
pm2 save
pm2 startup
```

Run the command that `pm2 startup` prints (it may include `sudo env PATH=...`).

---

## 9. Deploy Updates (Pull New Code)

When you push changes to GitHub, on the EC2 instance run:

```bash
cd ~/Funia
git pull origin main
npm install
pm2 restart functiomed-chatbot
```

Your `.env` is not in the repo, so it will stay as you configured it.

---

## 10. (Optional) Use a Custom Domain and HTTPS

### 10.1 Point a domain to EC2

In your DNS provider (Route 53, Cloudflare, etc.), add an **A record**:

- **Name:** `chat` (or `funia`, or leave blank for root domain)
- **Value:** your EC2 **Public IPv4**
- **TTL:** 300 or default

Example: `chat.functiomed.ch` → EC2 IP.

### 10.2 Install Nginx as reverse proxy

**Amazon Linux 2023:**

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

**Ubuntu:**

```bash
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 10.3 Proxy port 3001 through Nginx

```bash
sudo nano /etc/nginx/conf.d/funia.conf
```

Add (replace `chat.yourdomain.com` with your domain or EC2 IP):

```nginx
server {
    listen 80;
    server_name chat.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Open **port 80** (and 443 if you add HTTPS) in the EC2 security group. You can then close direct access to 3001 and use only the domain.

### 10.4 HTTPS with Let’s Encrypt (Ubuntu example)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d chat.yourdomain.com
```

Follow the prompts. Certbot will configure HTTPS and auto-renewal.

---

## 11. Summary Checklist

- [ ] EC2 instance launched (Amazon Linux or Ubuntu)
- [ ] Security group: SSH (22) + Custom TCP 3001
- [ ] SSH access works with your `.pem` key
- [ ] Repo cloned into `~/Funia`
- [ ] `./run-on-ec2.sh` executed successfully
- [ ] `.env` created with `GROQ_API_KEY`
- [ ] `pm2 restart functiomed-chatbot` after setting the key
- [ ] App reachable at `http://EC2_PUBLIC_IP:3001`
- [ ] (Optional) Ollama installed and running for fallback: `./scripts/setup-ollama-ec2.sh`
- [ ] (Optional) Domain and Nginx/HTTPS configured

---

## 12. Troubleshooting

| Issue | What to check |
|-------|----------------|
| **Cannot connect on 3001** | Security group allows inbound 3001 from your IP or 0.0.0.0/0 |
| **502 Bad Gateway** (Nginx) | App is running: `pm2 status`; try `pm2 restart functiomed-chatbot` |
| **Chat doesn’t answer** | `.env` has valid `GROQ_API_KEY`; check `pm2 logs functiomed-chatbot` for Groq errors |
| **App stops after SSH disconnect** | PM2 keeps it running; use `pm2 startup` so it survives reboots |
| **Port 3001 in use** | Run with another port: `PORT=8080 ./run-on-ec2.sh` and open 8080 in the security group |
| **Ollama fallback not used / empty replies** | Run `./scripts/check-ollama-ec2.sh` on EC2. Start Ollama: `sudo systemctl start ollama`. Install if needed: `./scripts/setup-ollama-ec2.sh`. Use t3.small or larger (≥2 GB RAM). Ensure the model is pulled: `ollama pull gemma2:2b`. |

For more detail on the app itself, see the main [README](README.md) in the repo.
