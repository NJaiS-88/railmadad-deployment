// ==============================================================================
// RailMadad PM2 Production Process Manager Configuration
// Run with: pm2 start ecosystem.config.js
// ==============================================================================

module.exports = {
  apps: [
    // 1. Backend REST API (Node.js)
    {
      name: 'railmadad-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },

    // 2. Multimodal AI / ML Service (Python Flask)
    {
      name: 'railmadad-ml-service',
      cwd: './',
      script: 'ml_service.py',
      interpreter: 'python',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        PORT: 8000
      }
    },

    // 3. AI Classification Agent (Python)
    {
      name: 'railmadad-classification',
      cwd: './classification',
      script: 'classification_agent.py',
      interpreter: 'python',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PORT: 8001
      }
    },

    // 4. AI Staff Assignment Agent (Python)
    {
      name: 'railmadad-staff-assignment',
      cwd: './staff_assignment',
      script: 'staff_assignment_agent.py',
      interpreter: 'python',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PORT: 8002
      }
    },

    // 5. Twilio Voice Server (Python) - Optional
    {
      name: 'railmadad-twilio-voice',
      cwd: './twilio',
      script: 'server.py',
      interpreter: 'python',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PORT: 6000
      }
    },

    // 6. Twilio WhatsApp Server (Python) - Optional
    {
      name: 'railmadad-twilio-whatsapp',
      cwd: './twilio_whatsapp',
      script: 'server.py',
      interpreter: 'python',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PORT: 6001
      }
    }
  ]
};
