# Windows setup without Docker

Run PowerShell commands from `F:\HotelManagemnt`. The workspace `.env` has been created from `.env.example` with a random JWT secret and separate generated bootstrap passwords. Open `.env` locally to read or change login credentials; do not copy it into Git. The example file remains unchanged.

## 1. Install the MongoDB server

MongoDB Shell (`mongosh`) was detected on this machine, but `mongod` was not detected on PATH or in the default server installation directory. These are separate programs.

Download the Windows MongoDB Community Server MSI from https://www.mongodb.com/try/download/community and install it. For the manual startup below, clear **Install MongoDB as a Service** during installation. MongoDB Compass is optional. Windows installation reference: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows/.

## 2. Start a local replica set

In PowerShell terminal 1:

```powershell
Set-Location F:\HotelManagemnt
New-Item -ItemType Directory -Path .local\mongo-data -Force | Out-Null
$mongoServer = Get-ChildItem 'C:\Program Files\MongoDB\Server\*\bin\mongod.exe' |
  Sort-Object FullName -Descending |
  Select-Object -First 1
if (-not $mongoServer) { throw 'MongoDB Server was not found. Install Community Server first.' }
& $mongoServer.FullName --dbpath 'F:\HotelManagemnt\.local\mongo-data' --replSet rs0 --bind_ip 127.0.0.1 --port 27017
```

Leave this terminal running. If port 27017 is already occupied by a MongoDB service, stop and inspect that installation rather than starting a second server over its data directory. This setup uses a separate project-local data directory.

## 3. Initialize replication once

In PowerShell terminal 2:

```powershell
mongosh "mongodb://localhost:27017"
```

At the **mongosh prompt**, run JavaScript:

```javascript
rs.initiate({
  _id: 'rs0',
  members: [{ _id: 0, host: 'localhost:27017' }],
});
```

Wait a few seconds, then run:

```javascript
rs.status().members.map((member) => ({ name: member.name, state: member.stateStr }));
```

Wait until the state is `PRIMARY`, then run `exit`. Run `rs.initiate()` only the first time you use this data directory. On later starts, the replica-set configuration is retained.

## 4. Environment configuration

The existing `.env` already contains:

```dotenv
MONGODB_URI=mongodb://localhost:27017/annapurna?replicaSet=rs0
WEB_ORIGIN=http://localhost:5173
PORT=5000
```

It also contains generated JWT/bootstrap secrets, `BOOTSTRAP_EMAIL=admin@example.test`, and `DEMO_OWNER_EMAIL=owner@example.test`. Read the corresponding password values locally in `.env`. Change email/name/password values before the first seed if preferred. Passwords require 12+ characters with uppercase, lowercase, and a digit. Rerunning seed does not reset existing users' passwords.

If creating another checkout manually, copy the template only when no `.env` exists, then replace its placeholder secret and blank passwords:

```powershell
if (-not (Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath .env.example -Destination .env
}
```

## 5. Create collections, indexes and initial accounts

MongoDB uses collections. This project's Mongoose initialization creates the collections and indexes; no SQL CREATE TABLE statements are needed.

Use Node 24 LTS. A project-local Node 24 runtime is available in this workspace; to select it for this PowerShell terminal:

```powershell
Set-Location F:\HotelManagemnt
$env:Path = "$PWD\.local\runtime\node_modules\node\bin;$env:Path"
node --version
npm run seed
```

Dependencies are already installed in this checkout. In a fresh checkout, run `npm install` first. Seed creates the administrator, the Essential Monthly SaaS plan, and—because DEMO_OWNER_PASSWORD is populated—a demo hotel owner and a 30-day subscription. Operational customer/vendor records are created through the application.

Inspect the database:

```powershell
mongosh "mongodb://localhost:27017/annapurna?replicaSet=rs0"
```

At the mongosh prompt:

```javascript
db.getName()
show collections
db.users.find({}, { name: 1, email: 1, role: 1 })
db.tenants.find({}, { name: 1, status: 1 })
```

## 6. Start the application

After leaving mongosh with `exit`, run in terminal 2:

```powershell
npm run dev
```

Open http://localhost:5173. Log in using the email/password pairs from `.env`. API health is at http://localhost:5000/health and database readiness at http://localhost:5000/ready.

On subsequent days, restart mongod with the terminal-1 command, then run `npm run dev` in terminal 2. Existing collections and accounts are retained. Initialization and seeding are not required on every start.
