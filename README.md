# Drone Assembly Job Cards MVP

Demo-ready web app for digitizing paper-based drone assembly job cards.

Purpose:
- replace manual paper updates with structured stage-based tracking
- give operators a fast checklist flow
- give admins full control over users, jobs, and progress visibility

## Demo Summary

This app simulates a small manufacturing workflow where:
- Admin creates users
- Admin creates a job and assigns it to an operator
- System auto-generates 6 stages for that job
- Operator updates stage progress with task checks, remarks, and optional images
- System stores timestamped logs with operator identity
- Admin monitors all activity from one dashboard

  ADMIN DASHBOARD
  <img width="1899" height="873" alt="image" src="https://github.com/user-attachments/assets/83dee0be-196c-48aa-b129-1c170db76d6f" />
  OPERATOR DASHBOARD
  <img width="1889" height="858" alt="image" src="https://github.com/user-attachments/assets/1cff3ef8-7951-4e5d-a469-f053a067996d" />


## Core Roles

### Admin

Can:
- log in
- create operator and admin accounts
- activate/deactivate users
- create jobs
- assign jobs to operators
- view all jobs
- monitor stage-wise progress
- inspect operator logs and uploaded images

### Operator

Can:
- log in
- view only assigned jobs
- open job details
- complete checklist tasks inside stages
- add remarks
- upload images
- complete only current active stage

Cannot:
- create users
- create jobs
- access unassigned jobs
- edit completed stages

## Main Workflow

1. Admin logs in.
2. Admin creates an operator account.
3. Admin creates a new job with:
   - Job ID
   - Project ID
   - Model
   - UAV Serial
   - Assigned Operator
4. System auto-creates `Stage 1` to `Stage 6`.
5. Operator logs in and sees only assigned jobs.
6. Operator opens a job and completes tasks in current stage.
7. On submit, system captures:
   - task completion state
   - remarks
   - optional image
   - operator identity
   - timestamp
8. Completed stage becomes read-only.
9. Admin can review job progress and logs at any time.

## Validation Rules

- authentication required for all access
- no public signup
- only admins can create users
- required tasks must be completed before a stage can be submitted
- at least one action must be provided before submission
- earlier stages must be completed before later stages
- completed stages are locked

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite
- Auth: JWT
- File Uploads: local disk storage

## Default Demo Login

Seed admin account:
- Username: `admin`
- Password: `admin123`

## How To Run

Install dependencies:

```bash
npm install --workspaces
```

Start backend:

```bash
npm run dev:backend
```

Start frontend:

```bash
npm run dev:frontend
```

Open:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Recommended Demo Flow

### Part 1: Admin demo

- Log in with `admin / admin123`
- Create one operator account
- Create one sample job
- Assign that job to the operator
- Show job list and status badges
- Open job detail and show 6 auto-generated stages

### Part 2: Operator demo

- Log out
- Log in as created operator
- Open assigned job
- Complete tasks in `Stage 1`
- Add a remark
- Upload an image
- Submit stage
- Show that stage is now read-only

### Part 3: Monitoring demo

- Log back in as admin
- Open same job
- Show updated job progress
- Show operator log entries
- Show uploaded image link

## MVP Scope

Included:
- role-based access control
- user management
- job assignment
- stage-based workflow
- checklist tracking
- remarks
- image upload
- timestamped audit trail
- admin monitoring dashboard

Not included:
- notifications
- offline mode
- advanced analytics
- approval chains
- external integrations

## Project Structure

- [backend/src/server.js](/C:/Users/fuwad/Downloads/assignment/backend/src/server.js): API routes and app startup
- [backend/src/db.js](/C:/Users/fuwad/Downloads/assignment/backend/src/db.js): SQLite schema and seed logic
- [backend/src/queries.js](/C:/Users/fuwad/Downloads/assignment/backend/src/queries.js): job and log queries
- [frontend/src/App.jsx](/C:/Users/fuwad/Downloads/assignment/frontend/src/App.jsx): main React UI
- [frontend/src/styles.css](/C:/Users/fuwad/Downloads/assignment/frontend/src/styles.css): responsive UI styling

## Demo Notes

- data stored locally in [data/app.db](/C:/Users/fuwad/Downloads/assignment/data/app.db)
- uploaded files stored in [uploads](/C:/Users/fuwad/Downloads/assignment/uploads)
- app is designed for correctness, simplicity, and traceability
- best suited for MVP demonstration and small-team evaluation
