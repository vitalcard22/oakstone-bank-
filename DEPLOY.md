# Oakstone Bank — Deployment Guide
# GitHub → Fly.io → Vercel → Namecheap

---

## BEFORE YOU START — Install these tools

**Git**
- Windows: https://git-scm.com/downloads
- Mac: run `xcode-select --install` in Terminal
- Linux: `sudo apt install git`

**Node.js 20 (LTS)**
- Download from: https://nodejs.org
- Pick the LTS version

**Fly CLI**
- Mac: `brew install flyctl`
- Windows (PowerShell as admin): `iwr https://fly.io/install.ps1 -useb | iex`
- Linux: `curl -L https://fly.io/install.sh | sh`

Check everything installed:
```
git --version
node --version
fly version
```

---

## STEP 1 — Create a GitHub repository

1. Go to github.com and sign in
2. Click the + icon top-right → New repository
3. Repository name: `oakstone-bank`
4. Set to Public or Private (your choice)
5. Leave ALL checkboxes unchecked (no README, no .gitignore, no license)
6. Click Create repository
7. Copy the URL shown — looks like: https://github.com/YOUR_USERNAME/oakstone-bank.git

---

## STEP 2 — Push your code to GitHub

Open a terminal, go into the unzipped project folder:

```bash
cd oakstone-bank
git init
git add .
git commit -m "feat: initial Oakstone Bank platform"
git remote add origin https://github.com/YOUR_USERNAME/oakstone-bank.git
git branch -M main
git push -u origin main
```

When it asks for a password — use a Personal Access Token, NOT your GitHub password:
1. GitHub → click your profile picture → Settings
2. Scroll to the bottom → Developer settings
3. Personal access tokens → Tokens (classic)
4. Generate new token (classic)
5. Note: oakstone-push | Expiration: 90 days | Check the "repo" scope
6. Click Generate token → copy it immediately
7. Paste it as the password when git push asks

Verify: open https://github.com/YOUR_USERNAME/oakstone-bank — you should see all the files.

---

## STEP 3 — Generate your secret keys

You need three secret values. Run each command in your terminal and save the output:

```bash
# JWT_SECRET (run this, copy the output)
node -e "require('crypto').randomBytes(64).toString('hex')"

# JWT_REFRESH_SECRET (run again — must be a DIFFERENT value)
node -e "require('crypto').randomBytes(64).toString('hex')"
```

Save both outputs. You will need them in the next step.

---

## STEP 4 — Deploy the backend on Fly.io

### Create account
```bash
fly auth signup
```
This opens a browser. Sign up with your email. No credit card required.

### IMPORTANT: Edit fly.toml before deploying
Open the file `backend/fly.toml` in any text editor.
Change this line:
```
app = "oakstone-api"
```
To something unique — add your name or initials:
```
app = "oakstone-api-john"
```
Fly.io app names are global (like domain names) so you need a unique one.
Save the file.

### Launch the app
```bash
cd backend
fly launch --no-deploy
```

Answer the questions:
- App name: press Enter (uses name from fly.toml)
- Region: pick the one closest to you
  - iad = US East (Virginia)
  - lax = US West (Los Angeles)
  - lhr = Europe (London)
  - sin = Asia (Singapore)
- Would you like to set up a PostgreSQL database? → YES
  - Choose: Development (free, 1GB)
- Would you like to set up an Upstash Redis? → YES
  - Choose the free tier

Fly.io automatically sets DATABASE_URL and REDIS_URL. You do not need to configure those manually.

### Set your secrets
Replace the placeholder values with your actual generated secrets from Step 3:

```bash
fly secrets set JWT_SECRET="paste_your_first_generated_value_here"
fly secrets set JWT_REFRESH_SECRET="paste_your_second_generated_value_here"
fly secrets set FRONTEND_URL="https://oakstone-bank.vercel.app"
```

### Deploy
```bash
fly deploy
```

Wait 2-3 minutes. When it finishes you will see:
```
✓ Machine [id] [app] update finished: success
```

### Test the backend
```bash
fly info
```
Copy your app URL. Then run:
```bash
curl https://YOUR_APP_NAME.fly.dev/health
```
You should see: `{"status":"ok","ts":1234567890}`

### Load the database schema
```bash
fly proxy 5432 -a YOUR_POSTGRES_APP_NAME
```

Open a new terminal window and run:
```bash
psql "postgresql://postgres:PASSWORD@localhost:5432/postgres" -f ../db/schema.sql
```

To find your PostgreSQL app name and password:
```bash
fly postgres list
fly secrets list -a YOUR_POSTGRES_APP_NAME
```

Or connect directly:
```bash
fly postgres connect -a YOUR_POSTGRES_APP_NAME
```
Then paste the contents of `db/schema.sql` and press Enter.

---

## STEP 5 — Deploy the frontend on Vercel

1. Go to vercel.com
2. Click Sign up → Continue with GitHub (this links your GitHub account)
3. Click Add New → Project
4. Find oakstone-bank in the list → click Import
5. Under Configure Project:
   - Framework Preset: Vite (auto-detected)
   - Root Directory: click Edit → type `frontend` → click Continue
   - Build Command: `npm run build` (leave as-is)
   - Output Directory: `dist` (leave as-is)
6. Open the Environment Variables section. Add these two:

   Name: VITE_API_URL
   Value: https://YOUR_APP_NAME.fly.dev/api/v1

   Name: VITE_WS_URL
   Value: wss://YOUR_APP_NAME.fly.dev/ws

   Replace YOUR_APP_NAME with your actual Fly.io app name from Step 4.

7. Click Deploy
8. Wait about 2 minutes
9. You get a URL like: https://oakstone-bank.vercel.app

### Update Fly.io with your real Vercel URL
```bash
fly secrets set FRONTEND_URL="https://oakstone-bank.vercel.app"
```

### Test
Open https://oakstone-bank.vercel.app in your browser.
You should see the Oakstone Bank login page.
Try registering an account.

---

## STEP 6 — Buy a domain on Namecheap

1. Go to namecheap.com
2. Search for your domain — for example: `oakstonebank.com`
3. If available, add to cart
4. Click View Cart → Checkout
5. Create a Namecheap account
6. Complete the purchase (around $9-12 per year)

---

## STEP 7 — Connect domain to Vercel (frontend)

1. In Vercel → click your project → Settings tab → Domains
2. Type: `oakstonebank.com` → click Add
3. Type: `www.oakstonebank.com` → click Add
4. Vercel shows you DNS records. They look like this:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

5. Go to Namecheap:
   - Dashboard → click your domain → Manage
   - Click Advanced DNS tab
   - Delete any existing A Record entries
   - Click Add New Record for each record Vercel gave you
   - Save all changes

6. Wait 15-30 minutes for DNS to update

7. Vercel automatically issues a free SSL certificate.
   Your site will have the padlock (HTTPS).

---

## STEP 8 — Connect subdomain to Fly.io (backend API)

Run this command:
```bash
fly certs create api.oakstonebank.com
```

Fly.io shows you a DNS record. It looks like:
```
Type: CNAME
Name: api
Value: YOUR_APP_NAME.fly.dev
```

Go to Namecheap → Advanced DNS → Add New Record:
- Type: CNAME Record
- Host: api
- Value: YOUR_APP_NAME.fly.dev (the value Fly.io showed you)
- TTL: Automatic

Save. Wait 10-30 minutes.

---

## STEP 9 — Update all URLs to use real domain

### In Vercel
Go to your project → Settings → Environment Variables → update:

VITE_API_URL = https://api.oakstonebank.com/api/v1
VITE_WS_URL  = wss://api.oakstonebank.com/ws

Then go to Deployments → click the three dots on the latest deployment → Redeploy.

### In Fly.io
```bash
fly secrets set FRONTEND_URL="https://oakstonebank.com"
```

---

## STEP 10 — Create your admin account

1. Go to https://oakstonebank.com/register
2. Create an account with your email
3. Connect to the database:

```bash
fly proxy 5432 -a YOUR_POSTGRES_APP_NAME
```

Open a new terminal:
```bash
psql "postgresql://postgres:PASSWORD@localhost:5432/postgres"
```

Run this SQL (replace with your actual email):
```sql
UPDATE users
SET role = 'super_admin', kyc_status = 'approved'
WHERE email = 'your@email.com';
\q
```

4. Log out and log back in
5. You will land on the admin dashboard at https://oakstonebank.com/admin/dashboard

---

## STEP 11 — Enable auto-deploy from GitHub

Every time you push code to GitHub, it will automatically deploy.

In your GitHub repo:
- Click Settings tab
- Click Secrets and variables → Actions
- Click New repository secret for each one below:

| Secret name       | How to get it                                    |
|-------------------|--------------------------------------------------|
| FLY_API_TOKEN     | Run: fly tokens create deploy                    |
| VITE_API_URL      | https://api.oakstonebank.com/api/v1              |
| VITE_WS_URL       | wss://api.oakstonebank.com/ws                    |
| VERCEL_TOKEN      | vercel.com → Settings → Tokens → Create          |
| VERCEL_ORG_ID     | Run vercel link in frontend folder → check .vercel/project.json |
| VERCEL_PROJECT_ID | Same file as above                               |

---

## FINAL CHECKLIST

Open each of these and confirm they work:

| URL | Expected result |
|-----|----------------|
| https://oakstonebank.com | Login page loads |
| https://oakstonebank.com/register | Registration form |
| https://api.oakstonebank.com/health | {"status":"ok"} |
| https://oakstonebank.com/admin/dashboard | Admin dashboard |

---

## COST SUMMARY

| Service | Cost |
|---------|------|
| GitHub | Free |
| Fly.io (backend + DB + Redis) | Free (within free tier) |
| Vercel (frontend) | Free |
| Namecheap domain | ~$10/year |
| **Total** | **~$10/year** |

---

## USEFUL FLY.IO COMMANDS

```bash
fly logs                            # See live backend logs
fly status                          # Check if app is running
fly ssh console                     # Shell inside the container
fly secrets list                    # See all secret names
fly secrets set KEY="value"         # Set or update a secret
fly scale memory 1024               # Increase RAM to 1GB if needed
fly proxy 5432 -a POSTGRES_APP      # Connect to database locally
```
