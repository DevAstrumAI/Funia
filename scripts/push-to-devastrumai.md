# Push to DevAstrumAI/Funia

Your Mac is using the GitHub account **bilalahmed15**, which doesn’t have push access to DevAstrumAI/Funia. Use the account that **does** have access (e.g. the org owner).

## Option 1: One-time push with a Personal Access Token (PAT)

1. **Create a PAT** on the GitHub account that has push access to DevAstrumAI/Funia:
   - Log in to GitHub as that account → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**.
   - Name it (e.g. "Martin2 push"), enable scope **repo**, generate and **copy the token**.

2. **From your project folder**, run (replace `GITHUB_USERNAME` and `YOUR_PAT`):

   ```bash
   git remote set-url origin https://GITHUB_USERNAME:YOUR_PAT@github.com/DevAstrumAI/Funia.git
   git push -u origin main
   ```

3. **Remove the token from the remote URL** (so it isn’t stored in config):

   ```bash
   git remote set-url origin https://github.com/DevAstrumAI/Funia.git
   ```

Next time you push, Git may ask for username/password again; use that same username and a valid PAT as the password.

---

## Option 2: Fix Keychain so Git prompts every time

1. Open **Keychain Access** (Spotlight → “Keychain Access”).
2. Search for **github.com**.
3. Delete the **github.com** internet password entry (this is the stored “bilalahmed15” login).
4. In the project folder run:

   ```bash
   git push -u origin main
   ```

5. When prompted:
   - **Username:** the GitHub account that has push access to DevAstrumAI/Funia.
   - **Password:** a **Personal Access Token** for that account (create as in Option 1, step 1).

---

## If you don’t have an account with access

Ask an owner of **DevAstrumAI** to either:

- Add **bilalahmed15** as a collaborator with **Write** access to the **Funia** repo, or  
- Add your SSH key to the GitHub account that already has access.

Then you can push with your current credentials (HTTPS or SSH).
