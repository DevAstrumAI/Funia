#!/usr/bin/env bash
# Clear cached GitHub credential so next 'git push' prompts for the account you want.
# Use this when you need to push as a different user (e.g. DevAstrumAI) instead of bilalahmed15.

echo "Clearing stored GitHub credential for github.com..."
printf "protocol=https\nhost=github.com\n" | git credential reject
echo "Done. Next 'git push' will ask for username and password (use a Personal Access Token as password)."
echo "Sign in with the GitHub account that has push access to DevAstrumAI/Funia."
