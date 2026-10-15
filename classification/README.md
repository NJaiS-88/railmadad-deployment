# Classification Agent

This folder contains the AI Classification Agent in the Rail Madad complaint workflow.

## Purpose
The agent evaluates dynamic passenger complaint data and uses NVIDIA NIM (Llama-3.3 Nemotron) to classify the issue into railway operations categories and departments:
- Mechanical
- Electrical
- Commercial/Catering
- Cleanliness/Housekeeping
- Civil/Infrastructure
- RPF/Security
- Medical/Health
- Operations/Train Control
- Ticket Checking

## Execution Modes

### 1. Live Dynamic API Server (Recommended for RailMadad full-stack pipeline)
Receives real-time complaint submissions dynamically from the backend over HTTP port 8001:
```bash
python classification_agent.py --serve
```
- Endpoint: `POST http://localhost:8001/classify-complaint`
- Health check: `GET http://localhost:8001/health`

### 2. Dynamic Database Batch Processing
Automatically connects to MongoDB, retrieves real passenger complaints, classifies them with AI, and updates the database:
```bash
python classification_agent.py
```

### 3. Optional File Input
```bash
python classification_agent.py --input path/to/complaint.json
```

## Output
The agent returns a structured classification with:
`problem_type`, `category`, `department`, `departments`, `sub_department`, `location`, `urgency`, `required_action`, `action_steps`, `confidence`, `reason`, `escalation_required`, `manual_review_required`.

