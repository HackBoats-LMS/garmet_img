# Production Deployment Guide (VPS + Docker + Caddy)

This guide provides step-by-step instructions to deploy this application on any VPS (Netcup, Hetzner, Hostinger, DigitalOcean, etc.) designed for **high traffic**, **zero crashes**, and **minimal cost**.

---

## 1. Architecture Overview

```
[ Client Traffic ] ──► [ Cloudflare CDN & DDoS Shield ]
                                    │
                              (Port 80/443)
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│ VPS (Ubuntu 22.04 / 24.04 LTS)                              │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Caddy Reverse Proxy (Auto-SSL via Let's Encrypt)    │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │ (Port 3000)                  │
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Next.js Standalone Container (garmets_app)          │   │
│   └──────────────────────────┬──────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
[ Neon PostgreSQL (PgBouncer) ]             [ Cloudflare R2 / S3 ]
```

---

## 2. Server Prerequisites

* **Operating System:** Ubuntu 22.04 LTS or 24.04 LTS (x86_64 recommended)
* **Recommended Specs:** 2 to 4 vCPUs, 4GB to 8GB RAM, NVMe SSD (e.g. Netcup VPS 1000 or Hetzner CPX22/CX33)
* **Open Firewall Ports:** `22` (SSH), `80` (HTTP), `443` (HTTPS)

---

## 3. Step 1: Initial VPS Setup & Docker Installation

Log in to your VPS as `root`:
```bash
ssh root@<YOUR_VPS_IP>
```

Update packages and install Docker + Docker Compose:
```bash
# 1. Update system packages
apt update && apt upgrade -y

# 2. Install Docker using official convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 3. Enable and start Docker service
systemctl enable --now docker

# 4. (Optional but recommended) Add 4GB Swap file for memory safety
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 4. Step 2: Clone the Project & Configure Environment

Clone the repository into `/opt/app` or your home directory:
```bash
cd /opt
git clone <YOUR_GIT_REPOSITORY_URL> app
cd app
```

Create your production environment file `.env.local`:
```bash
cp .env .env.local
nano .env.local
```

### Required Environment Variables in `.env.local`:
```env
# Database (Neon PostgreSQL with connection pooler)
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require&pgbouncer=true&connection_limit=5"

# NextAuth Configuration
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="generate_a_random_32_char_secret_using_openssl_rand_base64_32"

# AI Provider Keys
GEMINI_API_KEY="your_gemini_api_key"
TOGETHER_API_KEY="your_together_api_key"
REPLICATE_KEY="your_replicate_key"
KIE_API_KEY="your_kie_key"
PIAPI_API_KEY="your_piapi_key"

# Cloudflare R2 Storage (S3 API)
R2_ACCOUNT_ID="your_cloudflare_account_id"
R2_ACCESS_KEY_ID="your_r2_access_key_id"
R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
R2_BUCKET_NAME="your_r2_bucket_name"
R2_PUBLIC_URL="https://your-r2-custom-domain.com"
```

---

## 5. Step 3: Configure Caddy for Automatic Free HTTPS

Open the [`Caddyfile`](file:///e:/garmets_img/Caddyfile):
```bash
nano Caddyfile
```

Replace `:80` with your actual domain name:
```caddy
yourdomain.com, www.yourdomain.com {
    encode gzip zstd

    reverse_proxy app:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}

        # Generous timeout for long AI generation requests
        transport http {
            response_header_timeout 90s
            read_timeout 90s
        }
    }
}
```

> **DNS Pre-requisite:** Before launching, ensure your domain's `A` record points to your **VPS IP** address in your DNS provider (e.g., Cloudflare, Namecheap). Caddy will automatically provision and renew a free Let's Encrypt SSL certificate.

---

## 6. Step 4: Build & Launch Containers

Run the following command to build and launch the application:
```bash
docker compose up -d --build
```

Verify that both containers (`garmets_app` and `garmets_caddy`) are healthy and running:
```bash
docker compose ps
```

View live application logs:
```bash
docker compose logs -f app
```

---

## 7. How to Deploy Updates (Zero-Downtime Rebuilds)

Whenever you push new code to Git, run this on the VPS to update:

```bash
cd /opt/app
git pull origin main
docker compose build app
docker compose up -d --no-deps app
```

To clean up old, unused Docker image layers and free disk space:
```bash
docker image prune -f
```

---

## 8. High-Traffic Cloudflare Optimization (Recommended)

To handle 1,000+ requests per second for ₹0 additional cost, enable these settings in Cloudflare Dashboard:

1. **SSL/TLS:** Set encryption mode to **Full (Strict)**.
2. **Speed $\rightarrow$ Optimization:** Turn on **Brotli** and **Early Hints**.
3. **Caching $\rightarrow$ Cache Rules:**
   - Add rule for static assets: Path starts with `/_next/static/` $\rightarrow$ Cache Eligibility: **Eligible for cache** (Edge TTL: 1 month).
4. **Security $\rightarrow$ Bots:** Turn on **Bot Fight Mode**.

---

## 9. Troubleshooting & Common Commands

| Command | Description |
| :--- | :--- |
| `docker compose restart app` | Restart the Next.js application container |
| `docker compose restart caddy` | Restart the Caddy reverse proxy |
| `docker compose logs -f --tail=100 app` | Tail the latest 100 lines of app logs |
| `docker compose down` | Stop all containers |
| `npx prisma db push` | Push schema changes directly from within a container |
