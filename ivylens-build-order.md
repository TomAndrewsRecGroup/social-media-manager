# IvyLens Build Order & Execution Plan
## Version 1.0
## Purpose: Force correct implementation sequence for Cline

---

## 1. Objective

This document defines the exact build order for the IvyLens Social Operator system.

It exists to:
- prevent incorrect build sequencing
- stop overengineering early
- ensure working functionality is achieved quickly
- enforce production-minded structure from day one

Cline must follow this order strictly.

---

## 2. Core Principle

Build in this order:

1. Foundation  
2. Telegram Control Layer  
3. Command Router  
4. Research (Tavily)  
5. Topic Selection  
6. Content Generation (Groq)  
7. Formatting  
8. Publishing (PostFast)  
9. Full Workflow  
10. Scheduling  
11. Logging  
12. Controls & Modes  
13. Refinement  
14. Business Tasks (foundation only)

---

## 3. Phase Breakdown

### Phase 1 — Foundation
- Project setup
- Folder structure
- Env validation
- Base API
- Logging utility
- Config system

---

### Phase 2 — Telegram Interface
- Webhook endpoint
- Auth user check
- Send/receive messages

---

### Phase 3 — Command Router
- Intent classification
- Route commands

---

### Phase 4 — Tavily Research
- Fetch trends
- Return structured topics

---

### Phase 5 — Topic Selection
- Score topics
- Select best

---

### Phase 6 — Groq Content
- Generate posts per platform

---

### Phase 7 — Formatting
- Adjust per platform

---

### Phase 8 — PostFast
- Publish posts
- Handle errors

---

### Phase 9 — Full Workflow
- End-to-end pipeline

---

### Phase 10 — Scheduling
- Vercel cron jobs

---

### Phase 11 — Logging
- Store runs, posts, errors

---

### Phase 12 — Controls
- Telegram commands:
  - run
  - pause
  - resume
  - status

---

### Phase 13 — Modes
- auto
- draft
- approval

---

### Phase 14 — Refinement
- improve scoring
- reduce duplication

---

### Phase 15 — Business Tasks
- basic command placeholders

---

## 4. Final Definition of Done

- Runs automatically  
- Works via Telegram  
- Posts across platforms  
- Logs everything  
- Extendable  

---

## 5. Build Philosophy

Build it in layers. Make each phase work before moving on.
