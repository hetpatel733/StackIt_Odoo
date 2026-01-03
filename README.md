# StackIt – A Minimal Q&A Forum Platform

A lightweight, collaborative, and user-friendly Q&A Forum Platform built for structured knowledge sharing. Powered by React, Express.js, MongoDB, and enriched with a Rich Text Editor using TipTap.

---
## Overview
**StackIt** is a minimalistic question-and-answer platform designed to foster community learning. Whether you're a student, developer, or enthusiast, StackIt provides a clean and functional environment to ask, answer, and discuss technical or domain-specific queries. Inspired by platforms like Stack Overflow, StackIt focuses on simplicity, clarity, and performance.

---
## Live Preview
**StackIt** : https://stackit-new.vercel.app

---
## Features
-  **Rich Text Editor Integration (TipTap)**

-  **User Authentication & Authorization**

-  **Create, Edit, Delete Questions & Answers**

-  **Search and Tag-Based Filtering**

-  **Comment System for Community Interaction**

-  **Profile Management and Activity Tracking**

-  **RESTful API with Express.js**

-  **MongoDB-based Persistent Storage**

---

## Checkout latest Deployment

Coming soon..

---

## 🛠 Tech Stack

| Layer         | Technologies Used                    |
|---------------|---------------------------------------|
| Frontend      | React.js, Tip-Tap (Editor), Tailwind CSS    |
| Backend       | Node.js, Express.js     |
| Database       | MongoDB (Mongoose ODM)     |
| Auth       | JWT Authentication, Bcrypt.js               |
| API Type| REST API               |

---

## Getting Started
### 1. Clone the Repo.
Follow command :
```bash
git clone https://github.com/Sudhirkumar6009/StackIt_Odoo.git
cd ./StackIt_Odoo
```
### 2. Install Dependencies
Install dependencies on both `./client` and `./server` : 
```bash
npm install
```
### 3. Run Locally Development
3.1. For `./client` use this command : 
```bash
npm run dev
```
3.2. For `./server` use this command : 
```bash
npm start
```
### Now your Development is live on local port :8080

**Important** Development uses some environment variables for both frontend and backend. User needs to add `.env` file on both directories and provide KEYS as follows : 

### client Environment Variables
|NAME|INFORMATION|
|----|-----------|
|VITE_BACKEND|http://localhost:8000 *Backend server*|

### server Environment Variables
|NAME|INFORMATION|
|----|-----------|
|MONGNO_URL|mongodb+srv://XX:XX...mongodb.net.. *MongoDB URL*|
|PORT|8000 *Backend port*|
|CLIENT_URL| http://localhost:9000 *Client url*|
|JWT_SECRET|XXXXX *secret key for JWT token*|

### Contact
For questions or issues,
MAIL ME : sudhir.kuchara@gmail.com :)

