#!/bin/bash
# Runs after every `git pull` / merge on Replit (see [postMerge] in .replit).
# Database migrations are NOT run here: the API server applies pending
# migrations itself when it starts, so dev and production stay in step.
set -e
pnpm install --frozen-lockfile
