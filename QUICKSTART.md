# Quick Start Guide - CA DMV Branches

## Step 1: Clean Start

From the repo root:

```bash
cd /Users/avipeltz/Developer/SideProjects/DMV
docker compose down -v
```

## Step 2: Start with Real CA DMV Data

```bash
docker compose up --build
```

Watch for this line in the logs:
```
dmv-api  | Database seeded with 30 branches and 180 services!
```

If you don't see it, manually run:
```bash
docker compose exec api python init_db.py
```

## Step 3: Verify It Worked

Open http://localhost:3000 and click "Join Queue". You should see all 30 CA DMV offices in the dropdown:

- San Francisco DMV
- Oakland Claremont DMV
- San Jose DMV
- Los Angeles - South LA DMV
- Sacramento - Broadway DMV
- San Diego - Clairemont DMV
- ... (25 more)

## Step 4: Test the System

**Join a queue:**
1. Select "San Francisco DMV"
2. Choose "Driver License Renewal"
3. Click "Join Queue"
4. Save your ticket number

**Check status:**
1. Click "Check Status"
2. Enter your ticket number
3. See your position and wait time

**Call next ticket (Staff):**
1. Click "Staff Portal"
2. Select a branch
3. Click "Call Next" for any service with waiting tickets

## Data Source

All branches are loaded from `api/data/ca_dmv_branches.csv`

The CSV includes:
- 30 real CA DMV office locations
- Full addresses with city, state, zip
- Unique branch codes (SF01, OAK01, etc.)

Each branch gets all 6 service types:
- Driver License Renewal
- New Driver License
- Vehicle Registration Renewal
- New Vehicle Registration
- ID Card
- Real ID

## Adding More Branches

To add more CA DMV offices:

1. Edit `api/data/ca_dmv_branches.csv`
2. Add rows with format: `name,code,address,city,state,zip`
3. Restart with fresh database:
   ```bash
   docker compose down -v
   docker compose up --build
   ```

Example:
```csv
Chico DMV,CHI01,1590 Mangrove Ave,Chico,CA,95926
```

## Troubleshooting

**If you see only 3 branches:**
- The CSV file wasn't found
- System fell back to sample data
- Check logs for "WARNING: CSV file not found"

**To force re-seed:**
```bash
docker compose down -v
docker compose up --build
```

**To check what's in the database:**
```bash
# Connect to database
docker compose exec postgres psql -U dmv -d dmv_queue

# List all branches
SELECT id, code, name, city FROM branches;

# Exit
\q
```

---

You now have **30 real CA DMV offices** ready to test!
